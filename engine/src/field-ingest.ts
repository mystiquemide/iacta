import type { EventStore, FillRecord, RedemptionRecord, RoundRecord } from "./store.js";
import { registryByAddress, type GladiatorRegistry, type RegisteredGladiator } from "./registry.js";

export interface ActivityLike {
  id: string;
  kind: "TRADE" | "REDEEM" | "MINT_SET" | "MERGE_SET" | "RESOLUTION" | "STATUS";
  market: string;
  timestamp: string;
  txHash: string;
}

export interface TradeLike extends ActivityLike {
  kind: "TRADE";
  fillPrice: string;
  quantity: string;
  maker: string | null;
  taker: string | null;
  /** The SDK's BinarySide is the full order side: BUY_YES or BUY_NO. */
  makerSide: "BUY_YES" | "BUY_NO" | null;
  takerSide: "BUY_YES" | "BUY_NO" | null;
}

export interface RedeemLike extends ActivityLike {
  kind: "REDEEM";
  account: string;
  payout: string | null;
}

export type FieldActivity = TradeLike | RedeemLike;

export interface PlannedFieldRecords {
  fills: (FillRecord & { poolAddress: string })[];
  redemptions: RedemptionRecord[];
  skippedUnattributable: number;
}

export function planFieldRecords(
  activities: readonly FieldActivity[],
  registry: GladiatorRegistry,
): PlannedFieldRecords {
  const byAddress = registryByAddress(registry);
  const fills: PlannedFieldRecords["fills"] = [];
  const redemptions: RedemptionRecord[] = [];
  let skippedUnattributable = 0;

  const pushFill = (
    gladiator: RegisteredGladiator,
    activity: TradeLike,
    side: "BUY_YES" | "BUY_NO",
  ): void => {
    fills.push({
      marketId: activity.market,
      agentId: gladiator.agentId,
      poolAddress: `0x${"0".repeat(40)}`,
      side,
      price: activity.fillPrice,
      quantity: activity.quantity,
      txHash: activity.txHash,
      fillPath: "book",
      makerOrderId: `external:${activity.id}`,
      occurredAt: isoFromSeconds(activity.timestamp),
    });
  };

  for (const activity of activities) {
    if (activity.kind === "TRADE") {
      const taker = activity.taker ? byAddress.get(activity.taker) : undefined;
      const maker = activity.maker ? byAddress.get(activity.maker) : undefined;
      if (!taker && !maker) continue;
      if (taker && activity.takerSide) {
        pushFill(taker, activity, activity.takerSide);
      } else if (maker && activity.makerSide) {
        pushFill(maker, activity, activity.makerSide);
      } else {
        skippedUnattributable += 1;
      }
    } else if (activity.kind === "REDEEM") {
      const gladiator = byAddress.get(activity.account);
      if (!gladiator) continue;
      redemptions.push({
        marketId: activity.market,
        agentId: gladiator.agentId,
        proceeds: activity.payout ?? "0",
        outcome: "UNKNOWN",
        txHash: activity.txHash,
        occurredAt: isoFromSeconds(activity.timestamp),
      });
    }
  }
  return { fills, redemptions, skippedUnattributable };
}

function isoFromSeconds(timestamp: string): string {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1_000).toISOString()
    : new Date().toISOString();
}

export interface FieldSweepResult {
  marketsScanned: number;
  fillsRecorded: number;
  redemptionsRecorded: number;
  warnings: string[];
}

export interface FieldSweepOptions {
  marketLimit?: number;
  activityLimit?: number;
  readTimeoutMs?: number;
  now?: () => number;
}

const DEFAULT_MARKET_LIMIT = 5;
const DEFAULT_ACTIVITY_LIMIT = 100;
const DEFAULT_READ_TIMEOUT_MS = 15_000;

/**
 * Ingest on-chain activity for registered gladiators: their venue fills and
 * redemptions, recorded against their registry identity. Scoring then flows
 * through the same receipt-backed reducer as the arena roster — no
 * self-reporting, no operator adjustment.
 */
export async function sweepFieldActivity(
  readActivity: (market: { marketId: string; poolAddress: string }, timeoutMs: number) => Promise<FieldActivity[]>,
  rounds: readonly RoundRecord[],
  store: EventStore,
  registry: GladiatorRegistry,
  options: FieldSweepOptions = {},
): Promise<FieldSweepResult> {
  if (registry.gladiators.length === 0) {
    return { marketsScanned: 0, fillsRecorded: 0, redemptionsRecorded: 0, warnings: [] };
  }
  const marketLimit = options.marketLimit ?? DEFAULT_MARKET_LIMIT;
  const activityLimit = options.activityLimit ?? DEFAULT_ACTIVITY_LIMIT;
  const readTimeoutMs = options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS;

  const seen = new Set<string>();
  const markets: { marketId: string; poolAddress: string }[] = [];
  for (const round of [...rounds].sort((left, right) => right.expiry - left.expiry)) {
    const key = round.marketId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    markets.push({ marketId: round.marketId, poolAddress: round.poolAddress });
    if (markets.length >= marketLimit) break;
  }

  const warnings: string[] = [];
  const before = store.counts();
  let skippedUnattributable = 0;

  for (const market of markets) {
    let activities: FieldActivity[];
    try {
      activities = await readActivity(market, readTimeoutMs);
    } catch (error) {
      warnings.push(`field read failed for ${market.marketId}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 180));
      continue;
    }
    const planned = planFieldRecords(activities.slice(0, activityLimit), registry);
    skippedUnattributable += planned.skippedUnattributable;
    for (const fill of planned.fills) {
      store.recordFill({ ...fill, poolAddress: market.poolAddress });
    }
    for (const redemption of planned.redemptions) {
      store.recordRedemption(redemption);
    }
  }

  if (skippedUnattributable > 0) {
    warnings.push(`${skippedUnattributable} registered-wallet trades had no attributable side and were skipped`);
  }
  const after = store.counts();
  return {
    marketsScanned: markets.length,
    fillsRecorded: after.fills - before.fills,
    redemptionsRecorded: after.redemptions - before.redemptions,
    warnings,
  };
}
