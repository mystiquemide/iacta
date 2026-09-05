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
  privateKeyFor,
  loadLocalEnv,
  writeGasLimit,
} from "./config.js";
import { EventStore } from "./store.js";
import { chooseVenue } from "./trading-helpers.js";

const MIN_HEADROOM_SECONDS = 180;
const IOC_WINDOW_SECONDS = 120;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function selectedAsset(): string {
  return (process.env.IACTA_KILLTEST_ASSET ?? "BTC").trim().toUpperCase();
}

function configuredVenue(): string | undefined {
  const venue = process.env.IACTA_VENUE_ID?.trim();
  return venue || undefined;
}

function chooseMarket(markets: BinaryMarket[], asset: string): BinaryMarket {
  const candidates = markets
    .filter((market) => market.asset.toUpperCase() === asset && market.status === "Trading")
    .sort((left, right) => Number(right.expiry) - Number(left.expiry));
  if (candidates.length === 0) throw new Error(`No live ${asset} binary market matched the runtime venue filter`);
  return candidates[0];
}

function chooseSide(book: Awaited<ReturnType<ReturnType<typeof exchangeFor>["client"]["getBinaryOrderBook"]>>, one: bigint): {
  side: "BUY_YES" | "BUY_NO";
  yesPrice: bigint;
  bookPrice: bigint;
} {
  const yesAsk = book.yesAsks[0];
  if (yesAsk) return { side: "BUY_YES", yesPrice: yesAsk.price, bookPrice: yesAsk.price };

  const noAsk = book.noAsks[0];
  if (noAsk) return { side: "BUY_NO", yesPrice: one - noAsk.price, bookPrice: noAsk.price };

  throw new Error("The selected live market has no resting ask for an IOC fill");
}

async function main(): Promise<void> {
  loadLocalEnv();
  const exchange = exchangeFor(privateKeyFor("SECUTOR"));
  const store = new EventStore();
  const roleAddress = addressFor("SECUTOR");

  try {
    const allLive = await exchange.client.listLiveBinaryMarkets({ limit: 100, asset: selectedAsset() });
    const venueId = chooseVenue(allLive, configuredVenue());
    const venueMarkets = venueId ? allLive.filter((market) => market.venueId === venueId) : allLive;
    const market = chooseMarket(venueMarkets, selectedAsset());
    const onchain = await exchange.client.getMarketOnchain(market.marketId);
    const block = await exchange.client.getViemClient().getBlock({ blockTag: "latest" });
    const now = Number(block.timestamp);
    const headroom = Number(onchain.expiry) - now;

    if (onchain.status !== 1) throw new Error(`Market ${market.marketId} is not Trading on-chain (status ${onchain.status})`);
    if (headroom < MIN_HEADROOM_SECONDS) throw new Error(`Market ${market.marketId} has only ${headroom}s of on-chain headroom`);

    const book = await exchange.client.getBinaryOrderBook(market.poolAddress, { depth: 5 });
    const params = await exchange.client.getBinaryBookParams(market.poolAddress);
    const quantity = params.minQuantity > 0n ? params.minQuantity : params.lotSize;
    if (quantity <= 0n) throw new Error("The selected venue reports a zero minimum quantity");

    const one = 10n ** BigInt(market.quoteDecimals);
    const selected = chooseSide(book, one);
    const collateral = await exchange.client.getErc20Balance(market.collateral, roleAddress);
    const requiredCollateral = (selected.yesPrice * quantity + one - 1n) / one;
    if (collateral < requiredCollateral) {
      throw new Error(`SECUTOR collateral balance ${collateral} is below required ${requiredCollateral}`);
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
    if (result.receipt.status !== "success") throw new Error(`IOC transaction reverted: ${result.hash}`);

    store.recordRound({
      marketId: market.marketId,
      symbol: market.id,
      asset: market.asset,
      status: market.status,
      tradingStart: Number(market.tradingStart),
      expiry: Number(market.expiry),
      venueId: market.venueId ?? null,
      poolAddress: market.poolAddress,
      quoteDecimals: market.quoteDecimals,
    });
    store.recordOrder({
      marketId: market.marketId,
      agentId: "SECUTOR",
      poolAddress: market.poolAddress,
      side: selected.side,
      orderType: "IOC",
      status: result.receipt.status,
      price: selected.yesPrice.toString(),
      quantity: quantity.toString(),
      expireTimestampNs: expireTimestampNs.toString(),
      txHash: result.hash,
    }, result);

    for (const fill of result.fills) {
      store.recordFill({
        marketId: market.marketId,
        agentId: "SECUTOR",
        poolAddress: market.poolAddress,
        side: selected.side,
        price: fill.fillPrice.toString(),
        quantity: fill.quantityFilled.toString(),
        makerOrderId: fill.makerOrderId.toString(),
        txHash: result.hash,
        fillPath: "unknown",
      }, fill);
    }

    const output = {
      agent: "SECUTOR",
      wallet: roleAddress,
      marketId: market.marketId,
      asset: market.asset,
      venueId: market.venueId ?? null,
      poolAddress: market.poolAddress,
      side: selected.side,
      bookPrice: selected.bookPrice.toString(),
      submittedYesPrice: selected.yesPrice.toString(),
      quantity: quantity.toString(),
      expireTimestampNs: expireTimestampNs.toString(),
      txHash: result.hash,
      explorer: explorerTx(result.hash),
      fillCount: result.fills.length,
      store: { path: store.path, ...store.counts() },
    };

    if (result.fills.length === 0) {
      throw new Error(`IOC transaction succeeded but produced no fill: ${JSON.stringify(output)}`);
    }
    console.log(JSON.stringify(output, null, 2));
  } finally {
    exchange.client.stopLive();
    store.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`Kill-test A failed: ${message(error)}`);
    process.exit(1);
  });
