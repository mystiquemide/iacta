import type { ArenaState, KillfeedEvent } from "@/lib/arena";
import { QUOTE_ONE } from "@/lib/format";

export interface ChartPoint {
  at: number;
  price: number;
}

/** YES-equivalent fill price series for one market, oldest first. */
export function chartPointsForMarket(
  state: ArenaState,
  marketId: string,
): ChartPoint[] {
  return state.killfeed
    .filter(
      (event): event is KillfeedEvent & { occurredAt: string } =>
        event.kind === "FILL" &&
        event.marketId.toLowerCase() === marketId.toLowerCase() &&
        event.occurredAt !== null &&
        event.price !== undefined,
    )
    .map((event) => {
      const raw = Number(event.price) / QUOTE_ONE;
      const yesEquivalent = event.side === "BUY_NO" ? 1 - raw : raw;
      return { at: Date.parse(event.occurredAt) / 1000, price: yesEquivalent };
    })
    .sort((a, b) => a.at - b.at);
}

export interface BattleRow {
  marketId: string;
  asset: string;
  status: string;
  tradingStart: number;
  expiry: number;
  participants: string[];
  fillCount: number;
  volume: string;
  latestTx: { hash: string; explorer: string } | null;
  isLive: boolean;
  countdownSeconds: number | null;
}

export function battleRows(state: ArenaState): BattleRow[] {
  return state.rounds.map((round) => {
    const marketId = round.marketId.toLowerCase();
    const fills = state.killfeed.filter(
      (event) =>
        event.marketId.toLowerCase() === marketId &&
        (event.kind === "FILL" || event.kind === "REDEMPTION" || event.kind === "ORDER"),
    );
    const participants = [...new Set(fills.map((event) => event.agentId))].sort();
    const fillEvents = fills.filter((event) => event.kind === "FILL");
    let volumeRaw = 0n;
    for (const fill of fillEvents) {
      const price = BigInt(fill.price ?? "0");
      const quantity = BigInt(fill.quantity ?? "0");
      volumeRaw += (price * quantity) / BigInt(QUOTE_ONE);
    }
    const latest = fills.find((event) => event.explorer !== null) ?? null;
    return {
      marketId: round.marketId,
      asset: round.asset,
      status: round.status,
      tradingStart: round.tradingStart,
      expiry: round.expiry,
      participants,
      fillCount: fillEvents.length,
      volume: volumeRaw.toString(),
      latestTx: latest?.txHash && latest.explorer
        ? { hash: latest.txHash, explorer: latest.explorer }
        : null,
      isLive: round.isLive,
      countdownSeconds: round.countdownSeconds,
    };
  });
}

/** Markets where an agent has recorded events. */
export function battlesForAgent(state: ArenaState, agentId: string): number {
  return new Set(
    state.killfeed
      .filter((event) => event.agentId === agentId)
      .map((event) => event.marketId.toLowerCase()),
  ).size;
}

export function latestFillForMarket(
  state: ArenaState,
  marketId: string,
): KillfeedEvent | null {
  return (
    state.killfeed.find(
      (event) =>
        event.kind === "FILL" &&
        event.marketId.toLowerCase() === marketId.toLowerCase(),
    ) ?? null
  );
}

export function latestVerifiedTx(state: ArenaState): KillfeedEvent | null {
  return (
    state.killfeed.find(
      (event) => event.kind === "FILL" || event.kind === "REDEMPTION",
    ) ?? null
  );
}

export function leaderRow(state: ArenaState) {
  return state.standings.length > 0 ? state.standings[0] : null;
}

/** Proof-chain events for the verification section, newest first. */
export function proofChain(state: ArenaState): KillfeedEvent[] {
  return state.killfeed
    .filter((event) => event.kind === "FILL" || event.kind === "REDEMPTION")
    .slice(0, 5);
}
