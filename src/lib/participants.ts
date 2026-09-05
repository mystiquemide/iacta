import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type EngineConfig = typeof import("@iacta/engine/dist/config.js");
type EngineStore = typeof import("@iacta/engine/dist/store.js");
type EngineParticipants = typeof import("@iacta/engine/dist/participants.js");

// The engine resolves runtime paths from import.meta.url, so it must stay
// out of the bundler. Load it through Node at runtime instead.
async function loadEngineModule<T>(file: string): Promise<T> {
  const modulePath = resolve(process.cwd(), "engine", "dist", file);
  return (await import(
    /* turbopackIgnore: true */ /* webpackIgnore: true */ pathToFileURL(modulePath).href
  )) as T;
}

export interface FieldParticipant {
  address: string;
  fillCount: number;
  marketIds: string[];
  txHashes: string[];
  lastActivity: string;
  addressExplorer: string;
  txExplorers: string[];
}

export interface FieldSnapshot {
  ok: true;
  fetchedAt: string;
  marketsScanned: number;
  tradesScanned: number;
  participants: FieldParticipant[];
  stale: boolean;
}

export type FieldResult = FieldSnapshot | { ok: false; error: string };

const CACHE_TTL_MS = 60_000;
const MARKET_LIMIT = 6;
const TRADE_LIMIT = 50;
const READ_TIMEOUT_MS = 8_000;

let cache: { snapshot: FieldSnapshot; at: number } | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`read timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(resolvePromise, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Classify the outside wallets trading the same DreamDEX markets as the
 * arena. Reads the indexer directly, never loads private keys into this
 * process, and caches for a minute so page renders do not hammer the feed.
 */
export async function loadFieldSnapshot(): Promise<FieldResult> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.snapshot;
  let exchange: Awaited<ReturnType<EngineConfig["exchangeFor"]>> | null = null;
  let store: InstanceType<EngineStore["EventStore"]> | null = null;
  try {
    const config = await loadEngineModule<EngineConfig>("config.js");
    const storeModule = await loadEngineModule<EngineStore>("store.js");
    const participantsModule = await loadEngineModule<EngineParticipants>("participants.js");

    store = new storeModule.EventStore();
    const rounds = [...store.snapshot().rounds].sort((left, right) => right.expiry - left.expiry);
    const seenMarkets = new Set<string>();
    const markets: { marketId: string; poolAddress: string }[] = [];
    for (const round of rounds) {
      const key = round.marketId.toLowerCase();
      if (seenMarkets.has(key)) continue;
      seenMarkets.add(key);
      markets.push({ marketId: round.marketId, poolAddress: round.poolAddress });
      if (markets.length >= MARKET_LIMIT) break;
    }

    const knownAddresses = participantsModule.readKnownAgentWallets().map((wallet) => wallet.address);

    exchange = config.exchangeFor();
    type TradeActivity = Parameters<EngineParticipants["summarizeExternalParticipants"]>[0][number];
    const activities: TradeActivity[] = [];
    for (const market of markets) {
      try {
        const rows = await withTimeout(
          exchange.client.getMarketActivity(market.marketId as `0x${string}`, {
            kinds: ["TRADE"],
            limit: TRADE_LIMIT,
            pool: market.poolAddress,
          }),
          READ_TIMEOUT_MS,
        );
        for (const row of rows) {
          if (row.kind !== "TRADE") continue;
          activities.push({
            marketId: market.marketId,
            txHash: row.txHash,
            timestamp: row.timestamp,
            maker: row.maker,
            taker: row.taker,
          });
        }
      } catch {
        // Skip a market whose feed read fails; the rest still classify.
      }
    }

    const explorer = config.EXPLORER_URL;
    const external = participantsModule.summarizeExternalParticipants(activities, knownAddresses);
    const snapshot: FieldSnapshot = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      marketsScanned: markets.length,
      tradesScanned: activities.length,
      participants: external.map((participant) => ({
        address: participant.address,
        fillCount: participant.fillCount,
        marketIds: participant.marketIds,
        txHashes: participant.txHashes,
        lastActivity: new Date(Number(participant.lastActivity) * 1_000).toISOString(),
        addressExplorer: `${explorer}/address/${participant.address}`,
        txExplorers: participant.txHashes.map((hash) => `${explorer}/tx/${hash}`),
      })),
      stale: false,
    };
    cache = { snapshot, at: Date.now() };
    return snapshot;
  } catch (error) {
    if (cache) return { ...cache.snapshot, stale: true };
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The field snapshot is unavailable.",
    };
  } finally {
    try {
      await exchange?.client.stopLive();
    } catch {
      // Closing a failed client is best-effort.
    }
    store?.close();
  }
}
