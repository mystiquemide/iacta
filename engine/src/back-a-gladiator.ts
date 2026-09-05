import {
  ORDER_TYPE,
  type BinaryMarket,
  type PlaceOrderResult,
} from "@somnia-chain/markets-sdk";
import { type Address } from "viem";
import {
  addressFor,
  exchangeFor,
  explorerTx,
  FUNDABLE_WALLET_ROLES,
  privateKeyFor,
  loadLocalEnv,
  writeGasLimit,
} from "./config.js";
import { readKnownAgentWallets } from "./participants.js";
import { loadRegistry } from "./registry.js";

const MIN_HEADROOM_SECONDS = 180;
const IOC_WINDOW_SECONDS = 120;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function selectedAsset(): string {
  return (process.env.IACTA_BACK_ASSET ?? "BTC").trim().toUpperCase();
}

function chooseMarket(markets: BinaryMarket[], asset: string): BinaryMarket {
  const candidates = markets
    .filter((market) => market.asset.toUpperCase() === asset && market.status === "Trading")
    .sort((left, right) => Number(right.expiry) - Number(left.expiry));
  if (candidates.length === 0) throw new Error(`No live ${asset} binary market is trading right now`);
  return candidates[0]!;
}

function chooseSide(
  book: Awaited<ReturnType<ReturnType<typeof exchangeFor>["client"]["getBinaryOrderBook"]>>,
  one: bigint,
  preferred: "YES" | "NO" | undefined,
): { side: "BUY_YES" | "BUY_NO"; yesPrice: bigint } {
  const yesAsk = book.yesAsks[0];
  const noAsk = book.noAsks[0];
  if (preferred === "YES" || !preferred) {
    if (yesAsk) return { side: "BUY_YES", yesPrice: yesAsk.price };
    if (noAsk) return { side: "BUY_NO", yesPrice: one - noAsk.price };
  } else {
    if (noAsk) return { side: "BUY_NO", yesPrice: one - noAsk.price };
    if (yesAsk) return { side: "BUY_YES", yesPrice: yesAsk.price };
  }
  throw new Error("The live market has no resting ask to cross; nothing to back right now");
}

async function identifyCounterparty(
  exchange: ReturnType<typeof exchangeFor>,
  market: BinaryMarket,
  txHash: string,
): Promise<{ maker: string | null; taker: string | null } | null> {
  try {
    const activities = await exchange.client.getMarketActivity(market.marketId, {
      kinds: ["TRADE"],
      limit: 20,
      pool: market.poolAddress,
    });
    const match = activities.find((activity) => activity.kind === "TRADE" && activity.txHash === txHash);
    if (!match || match.kind !== "TRADE") return null;
    return { maker: match.maker, taker: match.taker };
  } catch {
    return null;
  }
}

function labelFor(address: string | null, known: Map<string, string>): string | null {
  if (!address) return null;
  return known.get(address.toLowerCase()) ?? null;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const wallet = privateKeyFor("SPECTATOR");
  const exchange = exchangeFor(wallet);
  const spectatorAddress = addressFor("SPECTATOR");

  // Roster identities for honest attribution: arena burners plus registered entrants.
  const known = new Map<string, string>();
  for (const role of FUNDABLE_WALLET_ROLES) {
    try {
      known.set(addressFor(role).toLowerCase(), role);
    } catch {
      // A role without a configured wallet is simply not attributable.
    }
  }
  for (const walletEntry of readKnownAgentWallets()) {
    known.set(walletEntry.address.toLowerCase(), walletEntry.agentId);
  }
  for (const entry of loadRegistry().gladiators) {
    known.set(entry.address.toLowerCase(), entry.agentId);
  }

  const preferredSide = process.argv
    .slice(2)
    .find((value) => value === "YES" || value === "NO")?.toUpperCase() as "YES" | "NO" | undefined;

  try {
    const allLive = await exchange.client.listLiveBinaryMarkets({ limit: 100, asset: selectedAsset() });
    const market = chooseMarket(allLive, selectedAsset());
    const onchain = await exchange.client.getMarketOnchain(market.marketId);
    const block = await exchange.client.getViemClient().getBlock({ blockTag: "latest" });
    const now = Number(block.timestamp);
    const headroom = Number(onchain.expiry) - now;

    if (onchain.status !== 1) throw new Error(`Market ${market.marketId} is not Trading on-chain (status ${onchain.status})`);
    if (headroom < MIN_HEADROOM_SECONDS) throw new Error(`Market ${market.marketId} has only ${headroom}s of on-chain headroom`);

    const book = await exchange.client.getBinaryOrderBook(market.poolAddress, { depth: 5 });
    const params = await exchange.client.getBinaryBookParams(market.poolAddress);
    const quantity = params.minQuantity > 0n ? params.minQuantity : params.lotSize;
    if (quantity <= 0n) throw new Error("The venue reports a zero minimum quantity");

    const one = 10n ** BigInt(market.quoteDecimals);
    const selected = chooseSide(book, one, preferredSide);
    const collateral = await exchange.client.getErc20Balance(market.collateral, spectatorAddress);
    const requiredCollateral = (selected.yesPrice * quantity + one - 1n) / one;
    if (collateral < requiredCollateral) {
      throw new Error(`Spectator collateral ${collateral} is below required ${requiredCollateral}. Run the collateral faucet first.`);
    }

    const expireTimestampNs = BigInt(Math.min(Number(onchain.expiry) - 1, now + IOC_WINDOW_SECONDS)) * 1_000_000_000n;
    const placed = await exchange.trader.placeOrder({
      pool: market.poolAddress as Address,
      side: selected.side,
      price: selected.yesPrice,
      quantity,
      orderType: ORDER_TYPE.MARKET,
      expireTimestampNs,
      autoApprove: true,
      gas: writeGasLimit(),
    });
    const result = placed as PlaceOrderResult;
    if (result.receipt.status !== "success") throw new Error(`Spectator order reverted: ${result.hash}`);

    const counterparty = await identifyCounterparty(exchange, market, result.hash);
    const makerLabel = labelFor(counterparty?.maker ?? null, known);
    const takerLabel = labelFor(counterparty?.taker ?? null, known);

    console.log(JSON.stringify({
      spectator: spectatorAddress,
      marketId: market.marketId,
      asset: market.asset,
      side: selected.side,
      yesPrice: selected.yesPrice.toString(),
      quantity: quantity.toString(),
      txHash: result.hash,
      explorer: explorerTx(result.hash),
      receiptStatus: result.receipt.status,
      fillCount: result.fills.length,
      counterparty: counterparty
        ? {
            maker: counterparty.maker,
            makerLabel,
            taker: counterparty.taker,
            takerLabel,
          }
        : { note: "maker attribution unavailable from the indexer yet; open the explorer receipt to see both wallets" },
      note: "Spectator orders are not recorded in the arena ledger and never enter standings. The receipt is the proof: your wallet traded inside the same DreamDEX book.",
    }, null, 2));
  } finally {
    exchange.client.stopLive();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`Spectator back failed: ${message(error)}`);
    process.exit(1);
  });
