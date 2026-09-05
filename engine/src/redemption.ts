import type { ClaimablePosition } from "@somnia-chain/markets-sdk";
import { decodeEventLog, numberToHex, parseAbi, type Address, type Hex } from "viem";
import type { RedemptionRecord } from "./store.js";

const binarySettlementEventsAbi = parseAbi([
  "event Redeemed(uint256 indexed marketKey, address indexed holder, address indexed to, uint8 outcomeIdx, uint256 amountBurned, uint256 collateralOut)",
]);

type RedemptionReceiptLog = {
  address: string;
  data: Hex;
  topics: readonly Hex[];
};

export interface RedemptionEntry {
  marketId: Hex;
  outcomeIdx: 0 | 1;
  amount: bigint;
}

export interface RedemptionPlan {
  agentId: string;
  account: string;
  entries: RedemptionEntry[];
  /** SDK-estimated raw collateral payout, not a replacement for the receipt. */
  estimatedProceeds: bigint;
}

export interface RedemptionReceiptEvent {
  marketId: string;
  outcomeIdx: 0 | 1;
  amountBurned: bigint;
  collateralOut: bigint;
}

export function decodeRedemptionReceipt(
  logs: readonly RedemptionReceiptLog[],
  settlementAddress: string,
  account: string,
): RedemptionReceiptEvent[] {
  assertAccount(account);
  const events: RedemptionReceiptEvent[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== settlementAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: binarySettlementEventsAbi,
        data: log.data,
        topics: [...log.topics] as [Hex, ...Hex[]],
      }) as { eventName: string; args: Record<string, unknown> };
      if (decoded.eventName !== "Redeemed") continue;
      const to = decoded.args.to as Address;
      if (to.toLowerCase() !== account.toLowerCase()) continue;
      const outcomeIdx = Number(decoded.args.outcomeIdx);
      if (outcomeIdx !== 0 && outcomeIdx !== 1) throw new Error("redemption outcome index is invalid");
      events.push({
        marketId: numberToHex(decoded.args.marketKey as bigint, { size: 32 }),
        outcomeIdx,
        amountBurned: decoded.args.amountBurned as bigint,
        collateralOut: decoded.args.collateralOut as bigint,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "redemption outcome index is invalid") throw error;
      // A settlement receipt can contain unrelated protocol logs. Those are not redemption evidence.
    }
  }
  return events;
}

export interface RedemptionReceiptSummary {
  proceeds: bigint;
  marketIds: string[];
  outcomes: ("YES" | "NO")[];
}

export interface RedemptionTxResult {
  hash: string;
  receipt: unknown;
}

export interface RedemptionReceiptCandidate extends RedemptionTxResult {
  events: readonly RedemptionReceiptEvent[];
}

export interface RedemptionExecutionDependencies {
  dryRun: boolean;
  readTimeoutMs?: number;
  redeemMany: (entries: readonly RedemptionEntry[]) => Promise<RedemptionTxResult>;
  recoverRedemption?: (error: unknown, plan: RedemptionPlan) => Promise<RedemptionTxResult | null>;
  verifyReceipt: (receipt: unknown) => readonly RedemptionReceiptEvent[];
  recordRedemption: (redemption: RedemptionRecord, raw?: unknown) => void;
}

export interface RedemptionReader {
  getClaimable: (account: string) => Promise<readonly ClaimablePosition[]>;
}

export type RedemptionExecutionResult =
  | { status: "EMPTY"; estimatedProceeds: bigint }
  | { status: "DRY_RUN"; estimatedProceeds: bigint }
  | { status: "REDEEMED"; estimatedProceeds: bigint; proceeds: bigint; txHash: string };

export type RedemptionSweepResult = {
  agentId: string;
  account: string;
  claimablePositions: number;
} & RedemptionExecutionResult;

function assertAccount(account: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(account)) {
    throw new Error("redemption account must be an address");
  }
}

function assertMarketId(marketId: string): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(marketId)) {
    throw new Error("redemption market identifier must be a bytes32 hex value");
  }
}

function assertNonNegative(value: bigint, label: string): void {
  if (value < 0n) throw new Error(`${label} cannot be negative`);
}

export function planRedemption(
  agentId: string,
  account: string,
  positions: readonly ClaimablePosition[],
): RedemptionPlan | null {
  if (!agentId.trim()) throw new Error("redemption agent id is required");
  assertAccount(account);

  const grouped = new Map<string, { marketId: Hex; outcomeIdx: 0 | 1; amount: bigint; estimatedProceeds: bigint }>();
  for (const position of positions) {
    if (position.amount <= 0n) continue;
    assertMarketId(position.marketId);
    assertNonNegative(position.estPayout, "estimated payout");
    const marketId = position.marketId.toLowerCase() as Hex;
    const key = `${marketId}:${position.outcomeIdx}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount += position.amount;
      existing.estimatedProceeds += position.estPayout;
      continue;
    }
    grouped.set(key, {
      marketId,
      outcomeIdx: position.outcomeIdx,
      amount: position.amount,
      estimatedProceeds: position.estPayout,
    });
  }

  if (grouped.size === 0) return null;

  const entries = [...grouped.values()]
    .sort((left, right) => left.marketId < right.marketId
      ? -1
      : left.marketId > right.marketId
        ? 1
        : left.outcomeIdx - right.outcomeIdx)
    .map(({ marketId, outcomeIdx, amount }) => ({ marketId, outcomeIdx, amount }));
  const estimatedProceeds = [...grouped.values()]
    .reduce((total, position) => total + position.estimatedProceeds, 0n);

  return { agentId, account, entries, estimatedProceeds };
}

export function summarizeRedemptionReceipt(
  plan: RedemptionPlan,
  events: readonly RedemptionReceiptEvent[],
): RedemptionReceiptSummary {
  if (events.length !== plan.entries.length) {
    throw new Error(`redemption event count ${events.length} does not match planned entry count ${plan.entries.length}`);
  }

  const actual = new Map<string, RedemptionReceiptEvent>();
  for (const event of events) {
    assertMarketId(event.marketId);
    assertNonNegative(event.amountBurned, "amount burned");
    assertNonNegative(event.collateralOut, "collateral payout");
    const marketId = event.marketId.toLowerCase();
    const key = `${marketId}:${event.outcomeIdx}`;
    if (actual.has(key)) throw new Error(`duplicate redemption event for ${key}`);
    actual.set(key, { ...event, marketId });
  }

  const ordered = plan.entries.map((entry) => {
    const key = `${entry.marketId.toLowerCase()}:${entry.outcomeIdx}`;
    const event = actual.get(key);
    if (!event) throw new Error(`missing redemption event for ${key}`);
    if (event.amountBurned !== entry.amount) {
      throw new Error(`redemption amount burned does not match plan for ${key}`);
    }
    actual.delete(key);
    return event;
  });
  if (actual.size > 0) throw new Error("redemption receipt contains an unexpected event");

  return {
    proceeds: ordered.reduce((total, event) => total + event.collateralOut, 0n),
    marketIds: ordered.map((event) => event.marketId),
    outcomes: ordered.map((event) => event.outcomeIdx === 0 ? "YES" : "NO"),
  };
}

export function selectMatchingRedemption(
  plan: RedemptionPlan,
  candidates: readonly RedemptionReceiptCandidate[],
): RedemptionTxResult | null {
  for (const candidate of candidates) {
    const receipt = candidate.receipt as { status?: string } | null;
    if (!candidate.hash.trim() || receipt?.status !== "success") continue;
    try {
      summarizeRedemptionReceipt(plan, candidate.events);
      return { hash: candidate.hash, receipt: candidate.receipt };
    } catch {
      // A recent redemption for another plan is not evidence for this plan.
    }
  }
  return null;
}

export async function executeRedemptionPlan(
  plan: RedemptionPlan | null,
  dependencies: RedemptionExecutionDependencies,
): Promise<RedemptionExecutionResult> {
  if (!plan) return { status: "EMPTY", estimatedProceeds: 0n };
  if (dependencies.dryRun) {
    return { status: "DRY_RUN", estimatedProceeds: plan.estimatedProceeds };
  }

  let transaction: RedemptionTxResult;
  try {
    transaction = await dependencies.redeemMany(plan.entries);
  } catch (error) {
    const recovered = dependencies.recoverRedemption
      ? await dependencies.recoverRedemption(error, plan)
      : null;
    if (!recovered) throw error;
    transaction = recovered;
  }
  if (!transaction.hash.trim()) throw new Error("redemption transaction hash is missing");
  const receipt = transaction.receipt as { status?: string } | null;
  if (receipt?.status !== "success") {
    throw new Error(`redemption transaction reverted: ${transaction.hash}`);
  }
  const events = dependencies.verifyReceipt(transaction.receipt);
  const summary = summarizeRedemptionReceipt(plan, events);
  const firstMarketId = summary.marketIds[0];
  if (!firstMarketId) throw new Error("verified redemption has no market id");
  dependencies.recordRedemption({
    marketId: firstMarketId,
    agentId: plan.agentId,
    proceeds: summary.proceeds.toString(),
    outcome: summary.outcomes.join("+"),
    txHash: transaction.hash,
  }, { plan, summary, events });

  return {
    status: "REDEEMED",
    estimatedProceeds: plan.estimatedProceeds,
    proceeds: summary.proceeds,
    txHash: transaction.hash,
  };
}

export async function sweepAgent(
  agentId: string,
  account: string,
  reader: RedemptionReader,
  dependencies: RedemptionExecutionDependencies,
): Promise<RedemptionSweepResult> {
  const read = reader.getClaimable(account);
  const timeoutMs = dependencies.readTimeoutMs;
  const positions = timeoutMs === undefined || timeoutMs <= 0
    ? await read
    : await new Promise<readonly ClaimablePosition[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`claimable read timed out after ${timeoutMs}ms`)), timeoutMs);
      read.then(resolve, reject).finally(() => clearTimeout(timer));
    });
  const execution = await executeRedemptionPlan(
    planRedemption(agentId, account, positions),
    dependencies,
  );
  return { agentId, account, claimablePositions: positions.length, ...execution };
}
