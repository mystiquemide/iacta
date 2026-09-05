import { readArenaState } from "@/lib/arena-server";
import {
  exchangeFor,
  explorerTx,
  readKnownAgentWallets,
  summarizeExternalParticipants,
  type TradeParticipantActivity,
} from "@/lib/participants-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MARKETS = 20;
const MARKET_READ_TIMEOUT_MS = 8_000;

interface ParticipantMarketTarget {
  marketId: string;
  poolAddress: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`participant scan timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export async function GET(): Promise<Response> {
  const exchange = exchangeFor();
  try {
    const stored = readArenaState();
    const liveMarkets = await withTimeout(
      exchange.client.listLiveBinaryMarkets({ limit: MAX_MARKETS }),
      MARKET_READ_TIMEOUT_MS,
    );
    const targets = [...new Map<string, ParticipantMarketTarget>([
      ...stored.rounds.slice(0, MAX_MARKETS).map((round) => [
        round.marketId,
        { marketId: round.marketId, poolAddress: round.poolAddress },
      ] as const),
      ...liveMarkets.map((market) => [
        market.marketId,
        { marketId: market.marketId, poolAddress: market.poolAddress },
      ] as const),
    ]).values()].slice(0, MAX_MARKETS);
    const activityBatches = await Promise.all(targets.map(async (target) => {
      try {
        return await withTimeout(exchange.client.getMarketActivity(target.marketId, {
          kinds: ["TRADE"],
          limit: 50,
          pool: target.poolAddress,
        }), MARKET_READ_TIMEOUT_MS);
      } catch {
        return [];
      }
    }));
    const activities: TradeParticipantActivity[] = activityBatches.flatMap((batch) => batch
      .filter((activity): activity is typeof activity & { kind: "TRADE" } => activity.kind === "TRADE")
      .map((activity) => ({
        marketId: activity.market,
        txHash: activity.txHash,
        timestamp: activity.timestamp,
        maker: activity.maker,
        taker: activity.taker,
      })));
    const knownWallets = readKnownAgentWallets();
    if (knownWallets.length === 0) {
      return Response.json({
        classification: "UNAVAILABLE",
        reason: "The internal public wallet roster is unavailable, so no wallet is labeled external.",
        marketsScanned: targets.length,
        tradeCount: activities.length,
        participants: [],
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const participants = summarizeExternalParticipants(
      activities,
      knownWallets.map((wallet) => wallet.address),
    ).map((participant) => ({
      ...participant,
      explorerTransactions: participant.txHashes.map(explorerTx),
    }));
    return Response.json({
      classification: "EXTERNAL_PARTICIPANTS",
      reason: "These wallets appear in indexed DreamDEX fills but have no registered IACTA identity or strategy.",
      marketsScanned: targets.length,
      tradeCount: activities.length,
      participants,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({
      classification: "UNAVAILABLE",
      reason: "The public DreamDEX activity scan is temporarily unavailable.",
      participants: [],
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    exchange.client.stopLive();
  }
}
