import {
  SOMNIA_TESTNET_ADDRESSES,
  SomniaMarkets,
  type BinaryMarket,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { EventStore } from "./store.js";

const INDEXER_URL = process.env.SOMNIA_INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql";
const WS_RPC_URL = process.env.SOMNIA_WS_RPC_URL ?? "wss://api.infra.testnet.somnia.network/ws";
const ASSETS = new Set(
  (process.env.IACTA_ASSETS ?? "BTC,ETH")
    .split(",")
    .map((asset) => asset.trim().toUpperCase())
    .filter(Boolean),
);
const MARKET_LIMIT = Math.min(Math.max(Number(process.env.IACTA_DOCTOR_LIMIT ?? 20), 1), 100);

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function roundStatus(market: BinaryMarket): BinaryMarket["status"] {
  return market.status;
}

async function inspectMarket(exchange: SomniaMarkets, store: EventStore, market: BinaryMarket) {
  store.recordRound({
    marketId: market.marketId,
    symbol: market.id,
    asset: market.asset,
    status: roundStatus(market),
    tradingStart: Number(market.tradingStart),
    expiry: Number(market.expiry),
    venueId: market.venueId ?? null,
    poolAddress: market.poolAddress,
  });

  const result: Record<string, unknown> = {
    marketId: market.marketId,
    symbol: market.id,
    asset: market.asset,
    venueId: market.venueId ?? null,
    poolAddress: market.poolAddress,
    status: market.status,
    expiry: Number(market.expiry),
    secondsToExpiry: Number(market.expiry) - Math.floor(Date.now() / 1000),
    tradeCount: market.tradeCount,
  };

  try {
    const onchain = await exchange.client.getMarketOnchain(market.marketId);
    result.onchain = {
      status: onchain.status,
      isResolved: onchain.isResolved,
      isVoided: onchain.isVoided,
      finalized: onchain.finalized,
      pool: onchain.pool,
      nonce: onchain.nonce.toString(),
    };
    result.tradeEligible = onchain.status === 1 && Number(onchain.expiry) - Math.floor(Date.now() / 1000) >= 180;

    try {
      const book = await exchange.client.getBinaryOrderBook(market.poolAddress, { depth: 5 });
      result.book = {
        yesBids: book.yesBids.length,
        yesAsks: book.yesAsks.length,
        noBids: book.noBids.length,
        noAsks: book.noAsks.length,
        bestYesBid: book.yesBids[0]?.price.toString() ?? null,
        bestYesAsk: book.yesAsks[0]?.price.toString() ?? null,
      };
    } catch (error) {
      result.bookError = message(error);
    }
  } catch (error) {
    result.onchainError = message(error);
    result.tradeEligible = false;
  }

  return result;
}

async function main(): Promise<void> {
  const exchange = new SomniaMarkets({
    indexerUrl: INDEXER_URL,
    chain: somniaShannon,
    wsRpcUrl: WS_RPC_URL,
    addresses: SOMNIA_TESTNET_ADDRESSES,
  });
  const store = new EventStore();

  try {
    const liveMarkets = await exchange.client.listLiveBinaryMarkets({ limit: MARKET_LIMIT });
    const targetMarkets = liveMarkets.filter((market) => ASSETS.has(market.asset.toUpperCase()));
    const markets = [];

    for (const market of targetMarkets) {
      markets.push(await inspectMarket(exchange, store, market));
    }

    const output = JSON.stringify({
      network: { chainId: somniaShannon.id, name: somniaShannon.name },
      indexerUrl: INDEXER_URL,
      assets: [...ASSETS],
      liveMarketCount: liveMarkets.length,
      targetMarketCount: targetMarkets.length,
      markets,
      store: { path: store.path, ...store.counts() },
    }, null, 2);
    await new Promise<void>((resolve, reject) => {
      process.stdout.write(`${output}\n`, (error) => error ? reject(error) : resolve());
    });
  } finally {
    exchange.client.stopLive();
    store.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(`Doctor failed: ${message(error)}`);
    process.exit(1);
  });
