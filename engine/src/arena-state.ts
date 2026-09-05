import { existsSync, readFileSync } from "node:fs";
import { defaultHeartbeatPath } from "./heartbeat.js";
import { BATTLE_AGENT_IDS } from "./strategies.js";
import { computeStandings, type StandingRow } from "./standings.js";
import { EventStore, type EventSnapshot, type RoundRecord } from "./store.js";

export type EngineStatus = "LIVE" | "WAITING" | "OFFLINE";

export interface ArenaRound extends RoundRecord {
  isLive: boolean;
  countdownSeconds: number | null;
}

export interface ArenaEngineState {
  status: EngineStatus;
  heartbeatAt: string | null;
  reason: string;
}

export type KillfeedKind = "ORDER" | "FILL" | "REDEMPTION" | "REFUSAL";

export interface KillfeedEvent {
  kind: KillfeedKind;
  agentId: string;
  marketId: string;
  occurredAt: string | null;
  txHash: string | null;
  explorer: string | null;
  side?: string;
  price?: string;
  quantity?: string;
  fillPath?: string;
  outcome?: string;
  status?: string;
  reason?: string;
}

export interface ArenaAgent {
  agentId: string;
  score: string;
  redeemedProceeds: string;
  fillCount: number;
  redemptionCount: number;
  latestEventAt: string | null;
}

export interface ArenaState {
  generatedAt: string;
  chain: { name: "Somnia Shannon"; id: 50312; explorer: string };
  engine: ArenaEngineState;
  round: ArenaRound | null;
  rounds: ArenaRound[];
  counts: {
    rounds: number;
    orders: number;
    fills: number;
    redemptions: number;
    refusals: number;
  };
  agents: ArenaAgent[];
  standings: StandingRow[];
  killfeed: KillfeedEvent[];
  dataWarnings: string[];
}

const EXPLORER_URL = "https://shannon-explorer.somnia.network";
const HEARTBEAT_MAX_AGE_MS = 30_000;

function explorer(txHash: string | null): string | null {
  return txHash ? `${EXPLORER_URL}/tx/${txHash}` : null;
}

function isFreshHeartbeat(heartbeatAt: string | null, now: Date): boolean {
  if (!heartbeatAt) return false;
  const parsed = Date.parse(heartbeatAt);
  if (Number.isNaN(parsed)) return false;
  const age = now.getTime() - parsed;
  return age >= 0 && age <= HEARTBEAT_MAX_AGE_MS;
}

function buildEngineState(
  snapshot: EventSnapshot,
  heartbeatAt: string | null,
  now: Date,
): ArenaEngineState {
  if (!isFreshHeartbeat(heartbeatAt, now)) {
    return {
      status: "OFFLINE",
      heartbeatAt,
      reason: heartbeatAt ? "Engine heartbeat is stale or invalid." : "No engine heartbeat is present.",
    };
  }
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  const liveRound = snapshot.rounds.some((round) => (
    round.status === "Trading" && round.tradingStart <= nowSeconds && round.expiry > nowSeconds
  ));
  return liveRound
    ? { status: "LIVE", heartbeatAt, reason: "Engine heartbeat is fresh and a round is trading." }
    : { status: "WAITING", heartbeatAt, reason: "Engine heartbeat is fresh. Waiting for the next round." };
}

function buildKillfeed(snapshot: EventSnapshot): KillfeedEvent[] {
  const events: KillfeedEvent[] = [
    ...snapshot.orders.map((order) => ({
      kind: "ORDER" as const,
      agentId: order.agentId,
      marketId: order.marketId,
      occurredAt: order.occurredAt ?? null,
      txHash: order.txHash,
      explorer: explorer(order.txHash),
      side: order.side,
      price: order.price,
      quantity: order.quantity,
      status: order.status,
    })),
    ...snapshot.fills.map((fill) => ({
      kind: "FILL" as const,
      agentId: fill.agentId,
      marketId: fill.marketId,
      occurredAt: fill.occurredAt ?? null,
      txHash: fill.txHash,
      explorer: explorer(fill.txHash),
      side: fill.side,
      price: fill.price,
      quantity: fill.quantity,
      fillPath: fill.fillPath,
    })),
    ...snapshot.redemptions.map((redemption) => ({
      kind: "REDEMPTION" as const,
      agentId: redemption.agentId,
      marketId: redemption.marketId,
      occurredAt: redemption.occurredAt ?? null,
      txHash: redemption.txHash,
      explorer: explorer(redemption.txHash),
      outcome: redemption.outcome,
    })),
    ...snapshot.refusals.map((refusal) => ({
      kind: "REFUSAL" as const,
      agentId: refusal.agentId,
      marketId: refusal.marketId,
      occurredAt: refusal.occurredAt ?? null,
      txHash: refusal.txHash ?? null,
      explorer: explorer(refusal.txHash ?? null),
      status: refusal.status,
      reason: refusal.reason,
    })),
  ];
  return events.sort((left, right) => (right.occurredAt ?? "").localeCompare(left.occurredAt ?? ""));
}

function buildRound(
  round: RoundRecord | null,
  now: Date,
  engineStatus: EngineStatus,
): ArenaRound | null {
  if (!round) return null;
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  const marketIsLive = round.status === "Trading"
    && round.tradingStart <= nowSeconds
    && round.expiry > nowSeconds;
  const isLive = marketIsLive && engineStatus === "LIVE";
  return {
    ...round,
    isLive,
    countdownSeconds: isLive ? round.expiry - nowSeconds : null,
  };
}

function buildRounds(rounds: readonly RoundRecord[], now: Date, engineStatus: EngineStatus): ArenaRound[] {
  return rounds
    .map((round) => buildRound(round, now, engineStatus))
    .filter((round): round is ArenaRound => round !== null)
    .sort((left, right) => right.expiry - left.expiry);
}

export function buildArenaState(
  snapshot: EventSnapshot,
  heartbeatAt: string | null,
  now = new Date(),
): ArenaState {
  const engine = buildEngineState(snapshot, heartbeatAt, now);
  const rounds = buildRounds(snapshot.rounds, now, engine.status);
  const quoteOneByMarket = new Map(
    snapshot.rounds.map((round) => [round.marketId.toLowerCase(), 10n ** BigInt(round.quoteDecimals)]),
  );
  const agentIds = [...new Set([
    ...BATTLE_AGENT_IDS,
    ...snapshot.orders.map((order) => order.agentId),
    ...snapshot.fills.map((fill) => fill.agentId),
    ...snapshot.redemptions.map((redemption) => redemption.agentId),
  ])];
  const dataWarnings: string[] = [];
  let standings: StandingRow[] = [];
  try {
    standings = computeStandings(agentIds, snapshot.fills, snapshot.redemptions, quoteOneByMarket);
  } catch (error) {
    dataWarnings.push(error instanceof Error ? error.message : String(error));
  }
  const byAgent = new Map(standings.map((row) => [row.agentId, row]));
  const latestEventAt = new Map<string, string>();
  for (const event of buildKillfeed(snapshot)) {
    if (event.occurredAt && !latestEventAt.has(event.agentId)) latestEventAt.set(event.agentId, event.occurredAt);
  }
  const agents = agentIds.map((agentId) => {
    const standing = byAgent.get(agentId);
    return {
      agentId,
      score: standing?.score ?? "0",
      redeemedProceeds: standing?.redeemedProceeds ?? "0",
      fillCount: snapshot.fills.filter((fill) => fill.agentId === agentId).length,
      redemptionCount: snapshot.redemptions.filter((redemption) => redemption.agentId === agentId).length,
      latestEventAt: latestEventAt.get(agentId) ?? null,
    };
  });
  return {
    generatedAt: now.toISOString(),
    chain: { name: "Somnia Shannon", id: 50312, explorer: EXPLORER_URL },
    engine,
    round: rounds[0] ?? null,
    rounds,
    counts: {
      rounds: snapshot.rounds.length,
      orders: snapshot.orders.length,
      fills: snapshot.fills.length,
      redemptions: snapshot.redemptions.length,
      refusals: snapshot.refusals.length,
    },
    agents,
    standings,
    killfeed: buildKillfeed(snapshot),
    dataWarnings,
  };
}

function readHeartbeatAt(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { heartbeatAt?: unknown; mode?: unknown };
    if (parsed.mode !== undefined && parsed.mode !== "LIVE") return null;
    return typeof parsed.heartbeatAt === "string" ? parsed.heartbeatAt : null;
  } catch {
    return null;
  }
}

export function readArenaState(
  databasePath?: string,
  heartbeatPath = process.env.IACTA_HEARTBEAT_PATH ?? defaultHeartbeatPath(),
  now = new Date(),
): ArenaState {
  const store = new EventStore(databasePath);
  try {
    return buildArenaState(store.snapshot(), readHeartbeatAt(heartbeatPath), now);
  } finally {
    store.close();
  }
}
