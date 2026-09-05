import {
  ORDER_TYPE,
  orderBookEventsAbi,
  type BinaryMarket,
  type PlaceOrderResult,
} from "@somnia-chain/markets-sdk";
import { decodeEventLog, parseAbi, type Address } from "viem";
import {
  addressFor,
  exchangeFor,
  explorerTx,
  loadLocalEnv,
  privateKeyFor,
} from "./config.js";
import { EventStore } from "./store.js";

const MIN_HEADROOM_SECONDS = 180;
const ORDER_WINDOW_SECONDS = 120;
const ASSET = (process.env.IACTA_CROSSING_ASSET ?? "BTC").trim().toUpperCase();

const binaryPoolEventsAbi = parseAbi([
  "event SetMinted(address indexed payer, address indexed yesTo, address indexed noTo, uint256 amount)",
  "event BinaryOrderPlaced(uint128 indexed orderId, uint8 kind)",
]);

type Side = "BUY_YES" | "BUY_NO";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonSafe(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested, 2);
}

function decodePoolEvents(receipt: PlaceOrderResult["receipt"], pool: Address) {
  const events: { eventName: string; args: Record<string, unknown> }[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== pool.toLowerCase()) continue;
    for (const abi of [binaryPoolEventsAbi, orderBookEventsAbi]) {
      try {
        const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics }) as {
          eventName: string;
          args: Record<string, unknown>;
        };
        events.push(decoded);
        break;
      } catch {
        // The receipt includes ERC-20 and other pool logs. Only known event ABIs matter.
      }
    }
  }
  return events;
}

function hasMatchingMint(
  events: { eventName: string; args: Record<string, unknown> }[],
  quantity: bigint,
  yesAddress: Address,
  noAddress: Address,
): { amount: bigint; payer: Address; yesTo: Address; noTo: Address } | null {
  const event = events.find((candidate) => candidate.eventName === "SetMinted");
  if (!event) return null;
  const payer = event.args.payer as Address;
  const yesTo = event.args.yesTo as Address;
  const noTo = event.args.noTo as Address;
  const amount = event.args.amount as bigint;
  const recipients = new Set([yesTo.toLowerCase(), noTo.toLowerCase()]);
  if (amount !== quantity || !recipients.has(yesAddress.toLowerCase()) || !recipients.has(noAddress.toLowerCase())) return null;
  return { amount, payer, yesTo, noTo };
}

function orderPriceForSide(side: Side, one: bigint, price: bigint): bigint {
  return side === "BUY_YES" ? price : one - price;
}

function collateralRequired(side: Side, one: bigint, price: bigint, quantity: bigint): bigint {
  return (orderPriceForSide(side, one, price) * quantity + one - 1n) / one;
}

async function eligibleMarkets(exchange: ReturnType<typeof exchangeFor>): Promise<{ market: BinaryMarket; book: Awaited<ReturnType<ReturnType<typeof exchangeFor>["client"]["getBinaryOrderBook"]>>; params: Awaited<ReturnType<ReturnType<typeof exchangeFor>["client"]["getBinaryBookParams"]>>; now: number }[]> {
  const rows = await exchange.client.listLiveBinaryMarkets({ asset: ASSET, limit: 100 });
  const candidates = [];
  for (const market of rows) {
    const onchain = await exchange.client.getMarketOnchain(market.marketId);
    const block = await exchange.client.getViemClient().getBlock({ blockTag: "latest" });
    const now = Number(block.timestamp);
    if (onchain.status !== 1 || Number(onchain.expiry) - now < MIN_HEADROOM_SECONDS) continue;
    const [book, params] = await Promise.all([
      exchange.client.getBinaryOrderBook(market.poolAddress, { depth: 5 }),
      exchange.client.getBinaryBookParams(market.poolAddress),
    ]);
    candidates.push({ market, book, params, now });
  }
  return candidates;
}

function chooseCandidate(
  candidates: Awaited<ReturnType<typeof eligibleMarkets>>,
): Awaited<ReturnType<typeof eligibleMarkets>>[number] {
  const emptyOrNoAsk = candidates
    .filter(({ book }) => book.noAsks.length === 0)
    .sort((left, right) => Number(right.market.expiry) - Number(left.market.expiry));
  const selected = emptyOrNoAsk.find(({ book, params }) => {
    if (params.tickSize <= 0n || params.minQuantity <= 0n) return false;
    if (book.yesAsks.length === 0) return true;
    return book.yesAsks[0].price > params.tickSize;
  });
  if (!selected) throw new Error(`No eligible ${ASSET} market has a safe resting YES bid and an empty NO ask side`);
  return selected;
}

function choosePrice(
  book: Awaited<ReturnType<ReturnType<typeof exchangeFor>["client"]["getBinaryOrderBook"]>>,
  tickSize: bigint,
  one: bigint,
): bigint {
  const raw = book.yesAsks[0]?.price;
  if (raw !== undefined && raw > tickSize) return raw - tickSize;
  const midpoint = one / 2n;
  const snapped = (midpoint / tickSize) * tickSize;
  if (snapped <= 0n || snapped >= one) throw new Error("The selected market has no valid interior price on its tick grid");
  return snapped;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const freshAddress = addressFor("FRESH");
  const secutorAddress = addressFor("SECUTOR");
  const exchange = exchangeFor(privateKeyFor("FRESH"));
  const takerExchange = exchangeFor(privateKeyFor("SECUTOR"));
  const store = new EventStore();
  let makerOrderId: bigint | undefined;
  let pool: Address | undefined;

  try {
    const candidate = chooseCandidate(await eligibleMarkets(exchange));
    const { market, book, params, now } = candidate;
    pool = market.poolAddress;
    const onchain = await exchange.client.getMarketOnchain(market.marketId);
    const one = 10n ** BigInt(market.quoteDecimals);
    const quantity = params.minQuantity;
    const price = choosePrice(book, params.tickSize, one);
    const expireTimestampNs = BigInt(Math.min(Number(onchain.expiry) - 1, now + ORDER_WINDOW_SECONDS)) * 1_000_000_000n;
    const [freshCollateral, secutorCollateral] = await Promise.all([
      exchange.client.getErc20Balance(market.collateral, freshAddress),
      takerExchange.client.getErc20Balance(market.collateral, secutorAddress),
    ]);
    const freshRequired = collateralRequired("BUY_YES", one, price, quantity);
    const secutorRequired = collateralRequired("BUY_NO", one, price, quantity);
    if (freshCollateral < freshRequired) throw new Error(`FRESH collateral ${freshCollateral} is below ${freshRequired}`);
    if (secutorCollateral < secutorRequired) throw new Error(`SECUTOR collateral ${secutorCollateral} is below ${secutorRequired}`);

    const maker = await exchange.trader.placeOrder({
      pool,
      side: "BUY_YES",
      price,
      quantity,
      orderType: ORDER_TYPE.POST_ONLY,
      expireTimestampNs,
      autoApprove: true,
    });
    const makerResult = maker as PlaceOrderResult;
    if (makerResult.receipt.status !== "success" || makerResult.fills.length > 0 || makerResult.orderId === undefined) {
      throw new Error(`FRESH post-only quote did not rest cleanly in ${makerResult.hash}`);
    }
    makerOrderId = makerResult.orderId;

    const taker = await takerExchange.trader.placeOrder({
      pool,
      side: "BUY_NO",
      price,
      quantity,
      orderType: ORDER_TYPE.MARKET,
      expireTimestampNs,
      autoApprove: true,
    });
    const takerResult = taker as PlaceOrderResult;
    const events = decodePoolEvents(takerResult.receipt, pool);
    const fill = takerResult.fills.find((item) => item.makerOrderId === makerOrderId);
    const mint = hasMatchingMint(events, quantity, freshAddress, secutorAddress);
    if (takerResult.receipt.status !== "success" || !fill || !mint) {
      await exchange.trader.cancelOrder({ pool, orderId: makerOrderId });
      throw new Error(`Opposing order did not produce a verified mint-a-pair crossing in ${takerResult.hash}`);
    }

    store.recordRound({
      marketId: market.marketId,
      symbol: market.id,
      asset: market.asset,
      status: market.status,
      tradingStart: Number(market.tradingStart),
      expiry: Number(market.expiry),
      venueId: market.venueId ?? null,
      poolAddress: pool,
      quoteDecimals: market.quoteDecimals,
    });
    store.recordOrder({
      marketId: market.marketId,
      agentId: "FRESH",
      poolAddress: pool,
      side: "BUY_YES",
      orderType: "POST_ONLY",
      status: makerResult.receipt.status,
      price: price.toString(),
      quantity: quantity.toString(),
      expireTimestampNs: expireTimestampNs.toString(),
      txHash: makerResult.hash,
    }, makerResult);
    store.recordOrder({
      marketId: market.marketId,
      agentId: "SECUTOR",
      poolAddress: pool,
      side: "BUY_NO",
      orderType: "IOC",
      status: takerResult.receipt.status,
      price: price.toString(),
      quantity: quantity.toString(),
      expireTimestampNs: expireTimestampNs.toString(),
      txHash: takerResult.hash,
    }, takerResult);
    store.recordFill({
      marketId: market.marketId,
      agentId: "FRESH",
      poolAddress: pool,
      side: "BUY_YES",
      price: fill.fillPrice.toString(),
      quantity: fill.quantityFilled.toString(),
      txHash: takerResult.hash,
      fillPath: "mint",
    }, { source: "SetMinted", mint, order: fill });
    store.recordFill({
      marketId: market.marketId,
      agentId: "SECUTOR",
      poolAddress: pool,
      side: "BUY_NO",
      price: fill.fillPrice.toString(),
      quantity: fill.quantityFilled.toString(),
      txHash: takerResult.hash,
      fillPath: "mint",
    }, { source: "SetMinted", mint, order: fill });

    console.log(jsonSafe({
      asset: market.asset,
      marketId: market.marketId,
      poolAddress: pool,
      venueId: market.venueId ?? null,
      price: price.toString(),
      quantity: quantity.toString(),
      yesWallet: freshAddress,
      noWallet: secutorAddress,
      makerTxHash: makerResult.hash,
      makerExplorer: explorerTx(makerResult.hash),
      crossingTxHash: takerResult.hash,
      crossingExplorer: explorerTx(takerResult.hash),
      makerOrderId: makerOrderId.toString(),
      takerOrderId: fill.takerOrderId.toString(),
      mint,
      fillPrice: fill.fillPrice.toString(),
      fillQuantity: fill.quantityFilled.toString(),
      store: { path: store.path, ...store.counts() },
    }));
  } finally {
    exchange.client.stopLive();
    takerExchange.client.stopLive();
    store.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`Mint-a-pair crossing failed: ${message(error)}`);
    process.exit(1);
  });
