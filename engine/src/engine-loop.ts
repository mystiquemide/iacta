import {
  ORDER_TYPE,
  type BinaryMarket,
  type MarketOnchain,
  type PlaceOrderResult,
} from "@somnia-chain/markets-sdk";
import { decodeEventLog, parseAbi, type Address } from "viem";
import { fileURLToPath } from "node:url";
import {
  addressFor,
  exchangeFor,
  loadLocalEnv,
  maxFeePerGas,
  privateKeyFor,
  writeGasLimit,
  type WalletRole,
} from "./config.js";
import { writeHeartbeat } from "./heartbeat.js";
import { reconcileAgentActivity } from "./reconciliation.js";
import { sweepRole } from "./redemption-runner.js";
import { collateralRequired, chooseVenue } from "./trading-helpers.js";
import {
  BATTLE_AGENT_IDS,
  decide,
  guardOrderIntent,
  type BattleAgentId,
  type BookLevel,
  type MarketSnapshot,
  type OrderIntent,
  type StrategyDecision,
} from "./strategies.js";
import { EventStore, type FillRecord } from "./store.js";

const MIN_HEADROOM_SECONDS = 180;
const DEFAULT_LOOP_INTERVAL_MS = 15_000;
const DEFAULT_MARKET_LIMIT = 30;
const DEFAULT_REFUSAL_COOLDOWN_MS = 60_000;
const DEFAULT_REDEMPTION_INTERVAL_MS = 300_000;
const DEFAULT_REDEMPTION_READ_TIMEOUT_MS = 15_000;
const DEFAULT_LOOP_READ_TIMEOUT_MS = 10_000;
const DEFAULT_LOOP_WRITE_TIMEOUT_MS = 60_000;
const DEFAULT_RECONCILIATION_LOOKBACK_SECONDS = 3_600;
const DEFAULT_RECONCILIATION_LIMIT = 200;
const NANOSECONDS_PER_SECOND = 1_000_000_000n;

const binaryPoolEventsAbi = parseAbi([
  "event SetMinted(address indexed payer, address indexed yesTo, address indexed noTo, uint256 amount)",
]);

export type LoopRole = BattleAgentId | "FRESH";
export { collateralRequired, chooseVenue } from "./trading-helpers.js";

export interface LoopTradeActivity {
  kind: "TRADE" | "STATUS";
  fillPrice?: string;
  timestamp: string;
}

export interface MarketSnapshotInput {
  marketId: string;
  poolAddress: string;
  status: number;
  now: number;
  expiry: number;
  quoteDecimals: number;
  tickSize: bigint;
  lotSize: bigint;
  minQuantity: bigint;
  yesBids: readonly BookLevel[];
  yesAsks: readonly BookLevel[];
  activities: readonly LoopTradeActivity[];
}

export interface PlannedRoleDecision {
  role: LoopRole;
  strategyId: BattleAgentId;
  decision: StrategyDecision;
}

export interface LoopCycleReport {
  status: "TRADING" | "WAITING";
  marketId: string | null;
  asset: string;
  venueId: string | null;
  decisions: {
    role: LoopRole;
    strategy: BattleAgentId;
    action: StrategyDecision["action"];
    reason: string;
    intentCount: number;
  }[];
  placements: {
    role: LoopRole;
    side: string;
    status: "WOULD_PLACE" | "PLACED" | "SKIPPED" | "REFUSED";
    txHash?: string;
    reason?: string;
  }[];
  redemptions: {
    role: LoopRole;
    status: "EMPTY" | "DRY_RUN" | "REDEEMED" | "ERROR";
    claimablePositions: number;
    txHash?: string;
    reason?: string;
  }[];
  warnings: string[];
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation = "loop read"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export async function bestEffortTradeHistory(
  read: () => Promise<LoopTradeActivity[]>,
  timeoutMs = DEFAULT_LOOP_READ_TIMEOUT_MS,
): Promise<{ activities: LoopTradeActivity[]; warning: string | null }> {
  try {
    return { activities: await withTimeout(read(), timeoutMs, "trade history read"), warning: null };
  } catch (error) {
    return {
      activities: [],
      warning: `trade history unavailable: ${message(error).slice(0, 180)}`,
    };
  }
}

export function buildMarketSnapshot(input: MarketSnapshotInput): MarketSnapshot {
  const recentYesPrices = input.activities
    .filter((activity): activity is LoopTradeActivity & { fillPrice: string } => (
      activity.kind === "TRADE" && activity.fillPrice !== undefined
    ))
    .sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
    .map((activity) => BigInt(activity.fillPrice));

  return {
    marketId: input.marketId.toLowerCase(),
    poolAddress: input.poolAddress,
    status: input.status,
    now: input.now,
    expiry: input.expiry,
    quoteOne: 10n ** BigInt(input.quoteDecimals),
    tickSize: input.tickSize,
    lotSize: input.lotSize,
    minQuantity: input.minQuantity,
    yesBids: input.yesBids,
    yesAsks: input.yesAsks,
    recentYesPrices,
  };
}

export function planDecisions(
  agentIds: readonly BattleAgentId[],
  snapshot: MarketSnapshot,
): StrategyDecision[] {
  return agentIds.map((agentId) => decide(agentId, snapshot));
}

function strategyForRole(role: LoopRole): BattleAgentId {
  return role === "FRESH" ? "RETIARIUS" : role;
}

export function planRoleDecisions(
  roles: readonly LoopRole[],
  snapshot: MarketSnapshot,
): PlannedRoleDecision[] {
  return roles.map((role) => {
    const strategyId = strategyForRole(role);
    return { role, strategyId, decision: decide(strategyId, snapshot) };
  });
}

export function orderTypeFor(intent: OrderIntent): number {
  return intent.orderType === "IOC" ? ORDER_TYPE.MARKET : ORDER_TYPE.POST_ONLY;
}

export function fillPathFromReceipt(
  receipt: PlaceOrderResult["receipt"],
  pool: string,
): FillRecord["fillPath"] {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== pool.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: binaryPoolEventsAbi,
        data: log.data,
        topics: log.topics,
      }) as { eventName: string };
      if (decoded.eventName === "SetMinted") return "mint";
    } catch {
      // A receipt contains unrelated token and order-book logs.
    }
  }
  return "unknown";
}

interface ActiveOrder {
  role: LoopRole;
  side: OrderIntent["side"];
  orderId: bigint;
  remainingQuantity: bigint;
  expireTimestampNs: bigint;
}

interface LoopAgent {
  role: LoopRole;
  strategyId: BattleAgentId;
  address: Address | null;
  exchange: ReturnType<typeof exchangeFor> | null;
}

interface LoopRuntime {
  reader: ReturnType<typeof exchangeFor>;
  agents: readonly LoopAgent[];
  store: EventStore;
  dryRun: boolean;
  activeOrders: Map<string, ActiveOrder>;
  refusalTimes: Map<string, number>;
  pausedRoles: Set<LoopRole>;
  refusalCooldownMs: number;
  asset: string;
  marketLimit: number;
  preferredVenue?: string;
  redemptionIntervalMs: number;
  redemptionReadTimeoutMs: number;
  readTimeoutMs: number;
  writeTimeoutMs: number;
  redemptionsEnabled: boolean;
  lastRedemptionSweepAt: number;
  reconciliationLookbackSeconds: number;
  reconciliationLimit: number;
  startupWarnings: string[];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isAmbiguousOrderError(error: unknown): boolean {
  return !/(placeBinaryOrder reverted|transaction(?:\s+[^\s]+)?\s+reverted)/i.test(message(error));
}

function jsonSafe(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested, 2);
}

function parsePositiveNumber(value: string | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), max) : fallback;
}

function selectedRoles(): LoopRole[] {
  const configured = process.env.IACTA_LOOP_ROLES
    ?.split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const roles = configured?.length ? configured : [...BATTLE_AGENT_IDS];
  const allowed = new Set<LoopRole>([...BATTLE_AGENT_IDS, "FRESH"]);
  const unknown = roles.filter((role) => !allowed.has(role as LoopRole));
  if (unknown.length > 0) throw new Error(`Unknown loop wallet role(s): ${unknown.join(", ")}`);
  return [...new Set(roles)] as LoopRole[];
}

async function discoverMarket(
  reader: ReturnType<typeof exchangeFor>,
  asset: string,
  limit: number,
  preferredVenue?: string,
  readTimeoutMs = DEFAULT_LOOP_READ_TIMEOUT_MS,
): Promise<{ market: BinaryMarket; onchain: MarketOnchain; now: number } | null> {
  const [block, markets] = await Promise.all([
    withTimeout(reader.client.getViemClient().getBlock({ blockTag: "latest" }), readTimeoutMs, "chain head read"),
    withTimeout(reader.client.listLiveBinaryMarkets({ asset, limit }), readTimeoutMs, "market discovery read"),
  ]);
  const now = Number(block.timestamp);
  const venueId = chooseVenue(markets, preferredVenue);
  const candidates = markets
    .filter((market) => (
      market.asset.toUpperCase() === asset
      && market.status === "Trading"
      && Number(market.tradingStart) <= now
      && (!venueId || market.venueId === venueId)
    ))
    .sort((left, right) => Number(left.expiry) - Number(right.expiry));

  for (const market of candidates) {
    const onchain = await withTimeout(reader.client.getMarketOnchain(market.marketId), readTimeoutMs, "market status read");
    if (onchain.status !== 1 || Number(onchain.expiry) - now < MIN_HEADROOM_SECONDS) continue;
    return { market, onchain, now };
  }
  return null;
}

async function readMarketSnapshot(
  reader: ReturnType<typeof exchangeFor>,
  market: BinaryMarket,
  onchain: MarketOnchain,
  now: number,
  readTimeoutMs = DEFAULT_LOOP_READ_TIMEOUT_MS,
): Promise<{ snapshot: MarketSnapshot; warnings: string[] }> {
  const [book, params, history] = await Promise.all([
    withTimeout(reader.client.getBinaryOrderBook(market.poolAddress, { depth: 5 }), readTimeoutMs, "order book read"),
    withTimeout(reader.client.getBinaryBookParams(market.poolAddress), readTimeoutMs, "book parameter read"),
    bestEffortTradeHistory(async () => {
      const activities = await reader.client.getMarketActivity(market.marketId, {
        kinds: ["TRADE"],
        limit: 20,
        pool: market.poolAddress,
      });
      return activities.flatMap((activity): LoopTradeActivity[] => activity.kind === "TRADE"
        ? [{ kind: "TRADE", fillPrice: activity.fillPrice, timestamp: activity.timestamp }]
        : []);
    }, readTimeoutMs),
  ]);
  return {
    snapshot: buildMarketSnapshot({
      marketId: market.marketId,
      poolAddress: market.poolAddress,
      status: onchain.status,
      now,
      expiry: Number(onchain.expiry),
      quoteDecimals: market.quoteDecimals,
      tickSize: params.tickSize,
      lotSize: params.lotSize,
      minQuantity: params.minQuantity,
      yesBids: book.yesBids,
      yesAsks: book.yesAsks,
      activities: history.activities,
    }),
    warnings: history.warning ? [history.warning] : [],
  };
}

async function refreshSnapshot(
  reader: ReturnType<typeof exchangeFor>,
  market: BinaryMarket,
  snapshot: MarketSnapshot,
  readTimeoutMs = DEFAULT_LOOP_READ_TIMEOUT_MS,
): Promise<MarketSnapshot> {
  const [onchain, block] = await Promise.all([
    withTimeout(reader.client.getMarketOnchain(market.marketId), readTimeoutMs, "market status recheck"),
    withTimeout(reader.client.getViemClient().getBlock({ blockTag: "latest" }), readTimeoutMs, "chain head recheck"),
  ]);
  return {
    ...snapshot,
    status: onchain.status,
    now: Number(block.timestamp),
    expiry: Number(onchain.expiry),
  };
}

function restingOrderKey(marketId: string, orderId: bigint): string {
  return `${marketId.toLowerCase()}:${orderId.toString()}`;
}

function pruneActiveOrders(activeOrders: Map<string, ActiveOrder>, now: number): void {
  const nowNs = BigInt(now) * NANOSECONDS_PER_SECOND;
  for (const [key, order] of activeOrders) {
    if (order.expireTimestampNs <= nowNs || order.remainingQuantity <= 0n) activeOrders.delete(key);
  }
}

function recordRefusal(
  runtime: LoopRuntime,
  role: LoopRole,
  marketId: string,
  reason: string,
): void {
  const key = `${marketId.toLowerCase()}:${role}:${reason}`;
  const now = Date.now();
  const previous = runtime.refusalTimes.get(key) ?? 0;
  if (now - previous < runtime.refusalCooldownMs) return;
  runtime.refusalTimes.set(key, now);
  if (!runtime.dryRun) {
    runtime.store.recordRefusal({
      marketId: marketId.toLowerCase(),
      agentId: role,
      reason,
      status: "REFUSED",
      txHash: null,
    });
  }
}

function recordOrderResult(
  runtime: LoopRuntime,
  market: BinaryMarket,
  role: LoopRole,
  intent: OrderIntent,
  result: PlaceOrderResult,
): void {
  const marketId = market.marketId.toLowerCase();
  const occurredAt = new Date().toISOString();
  runtime.store.recordRound({
    marketId,
    symbol: market.id,
    asset: market.asset,
    status: market.status,
    tradingStart: Number(market.tradingStart),
    expiry: Number(market.expiry),
    venueId: market.venueId ?? null,
    poolAddress: market.poolAddress,
    quoteDecimals: market.quoteDecimals,
  });
  runtime.store.recordOrder({
    marketId,
    agentId: role,
    poolAddress: market.poolAddress,
    side: intent.side,
    orderType: intent.orderType,
    status: result.receipt.status,
    price: intent.price.toString(),
    quantity: intent.quantity.toString(),
    expireTimestampNs: intent.expireTimestampNs.toString(),
    txHash: result.hash,
    occurredAt,
  }, result);

  const fillPath = fillPathFromReceipt(result.receipt, market.poolAddress);
  for (const fill of result.fills) {
    const makerKey = restingOrderKey(marketId, fill.makerOrderId);
    const maker = runtime.activeOrders.get(makerKey);
    if (maker && maker.role !== role) {
      runtime.store.recordFill({
        marketId,
        agentId: maker.role,
        poolAddress: market.poolAddress,
        side: maker.side,
        price: fill.fillPrice.toString(),
        quantity: fill.quantityFilled.toString(),
        makerOrderId: fill.makerOrderId.toString(),
        txHash: result.hash,
        fillPath,
        occurredAt,
      }, { source: "maker", fill });
    }
    runtime.store.recordFill({
      marketId,
      agentId: role,
      poolAddress: market.poolAddress,
      side: intent.side,
      price: fill.fillPrice.toString(),
      quantity: fill.quantityFilled.toString(),
      makerOrderId: fill.makerOrderId.toString(),
      txHash: result.hash,
      fillPath,
      occurredAt,
    }, { source: "taker", fill });
    if (maker && fill.makerRemainingQuantity <= 0n) runtime.activeOrders.delete(makerKey);
  }

  if (result.orderId !== undefined) {
    runtime.activeOrders.set(restingOrderKey(marketId, result.orderId), {
      role,
      side: intent.side,
      orderId: result.orderId,
      remainingQuantity: intent.quantity,
      expireTimestampNs: intent.expireTimestampNs,
    });
  }
}

async function executeIntent(
  runtime: LoopRuntime,
  agent: LoopAgent,
  market: BinaryMarket,
  baseSnapshot: MarketSnapshot,
  intent: OrderIntent,
): Promise<LoopCycleReport["placements"][number]> {
  if (intent.orderType === "POST_ONLY" && [...runtime.activeOrders.values()].some((order) => (
    order.role === agent.role && order.side === intent.side && order.expireTimestampNs > BigInt(baseSnapshot.now) * NANOSECONDS_PER_SECOND
  ))) {
    return { role: agent.role, side: intent.side, status: "SKIPPED", reason: "resting quote is still active" };
  }

  let snapshot: MarketSnapshot;
  try {
    snapshot = await refreshSnapshot(runtime.reader, market, baseSnapshot, runtime.readTimeoutMs);
  } catch (error) {
    const reason = "live market recheck failed before order";
    recordRefusal(runtime, agent.role, market.marketId, reason);
    return { role: agent.role, side: intent.side, status: "REFUSED", reason: `${reason}: ${message(error).slice(0, 180)}` };
  }
  const guarded = guardOrderIntent(snapshot, { ...intent, agentId: agent.strategyId });
  if (!guarded.accepted) {
    recordRefusal(runtime, agent.role, market.marketId, guarded.reason);
    return { role: agent.role, side: intent.side, status: "REFUSED", reason: guarded.reason };
  }
  if (runtime.dryRun) {
    return { role: agent.role, side: intent.side, status: "WOULD_PLACE" };
  }
  if (!agent.exchange || !agent.address) {
    const reason = "live loop wallet is unavailable";
    recordRefusal(runtime, agent.role, market.marketId, reason);
    return { role: agent.role, side: intent.side, status: "REFUSED", reason };
  }

  try {
    const nativeBalance = await withTimeout(
      agent.exchange.client.getViemClient().getBalance({ address: agent.address }),
      runtime.readTimeoutMs,
      "native balance read",
    );
    const gasEnvelope = writeGasLimit() * maxFeePerGas();
    if (nativeBalance < gasEnvelope) {
      const reason = `native balance ${nativeBalance} is below write envelope ${gasEnvelope}`;
      recordRefusal(runtime, agent.role, market.marketId, reason);
      return { role: agent.role, side: intent.side, status: "REFUSED", reason };
    }
    const required = collateralRequired(intent.side, snapshot.quoteOne, intent.price, intent.quantity);
    const collateral = await withTimeout(
      agent.exchange.client.getErc20Balance(market.collateral, agent.address),
      runtime.readTimeoutMs,
      "collateral balance read",
    );
    if (collateral < required) {
      const reason = `collateral ${collateral} is below required ${required}`;
      recordRefusal(runtime, agent.role, market.marketId, reason);
      return { role: agent.role, side: intent.side, status: "REFUSED", reason };
    }
    const result = await withTimeout(agent.exchange.trader.placeOrder({
      pool: market.poolAddress,
      side: intent.side,
      price: intent.price,
      quantity: intent.quantity,
      orderType: orderTypeFor(intent),
      expireTimestampNs: intent.expireTimestampNs,
      autoApprove: true,
      gas: writeGasLimit(),
    }), runtime.writeTimeoutMs, "order write");
    if (result.receipt.status !== "success") {
      throw new Error(`transaction reverted: ${result.hash}`);
    }
    recordOrderResult(runtime, market, agent.role, intent, result);
    return { role: agent.role, side: intent.side, status: "PLACED", txHash: result.hash };
  } catch (error) {
    const ambiguous = isAmbiguousOrderError(error);
    if (ambiguous) runtime.pausedRoles.add(agent.role);
    const reason = ambiguous
      ? `order outcome unknown; role paused until restart: ${message(error).slice(0, 180)}`
      : `order refused: ${message(error).slice(0, 180)}`;
    recordRefusal(runtime, agent.role, market.marketId, reason);
    return { role: agent.role, side: intent.side, status: "REFUSED", reason };
  }
}

async function sweepRedemptions(runtime: LoopRuntime): Promise<LoopCycleReport["redemptions"]> {
  if (!runtime.redemptionsEnabled) return [];
  const now = Date.now();
  if (now - runtime.lastRedemptionSweepAt < runtime.redemptionIntervalMs) return [];
  runtime.lastRedemptionSweepAt = now;
  return Promise.all(runtime.agents.map(async (agent) => {
    try {
      const exchange = agent.exchange ?? runtime.reader;
      const result = await sweepRole(agent.role as WalletRole, exchange, runtime.store, {
        dryRun: runtime.dryRun,
        readTimeoutMs: runtime.redemptionReadTimeoutMs,
        writeTimeoutMs: runtime.writeTimeoutMs,
      });
      return {
        role: agent.role,
        status: result.status,
        claimablePositions: result.claimablePositions,
        ...("txHash" in result ? { txHash: result.txHash } : {}),
      };
    } catch (error) {
      return {
        role: agent.role,
        status: "ERROR" as const,
        claimablePositions: 0,
        reason: message(error).slice(0, 180),
      };
    }
  }));
}

async function reconcileStartup(runtime: LoopRuntime): Promise<void> {
  if (runtime.dryRun) return;

  let sinceSeconds: number;
  try {
    const block = await withTimeout(
      runtime.reader.client.getViemClient().getBlock({ blockTag: "latest" }),
      runtime.readTimeoutMs,
      "startup reconciliation chain head read",
    );
    sinceSeconds = Math.max(0, Number(block.timestamp) - runtime.reconciliationLookbackSeconds);
  } catch (error) {
    for (const agent of runtime.agents) runtime.pausedRoles.add(agent.role);
    runtime.startupWarnings.push(`startup reconciliation unavailable; all roles paused: ${message(error).slice(0, 180)}`);
    return;
  }

  for (const agent of runtime.agents) {
    if (!agent.address) continue;
    try {
      await reconcileAgentActivity(agent.role, agent.address, {
        getOrders: (account, options) => withTimeout(
          runtime.reader.client.getOrders(account, { limit: options.limit }),
          runtime.readTimeoutMs,
          "startup order reconciliation read",
        ),
        getUserFills: (account, options) => withTimeout(
          runtime.reader.client.getUserFills(account, { since: options.since, limit: options.limit }),
          runtime.readTimeoutMs,
          "startup fill reconciliation read",
        ),
      }, runtime.store, {
        sinceSeconds,
        limit: runtime.reconciliationLimit,
      });
    } catch (error) {
      runtime.pausedRoles.add(agent.role);
      runtime.startupWarnings.push(`${agent.role} startup reconciliation failed; role paused until restart: ${message(error).slice(0, 180)}`);
    }
  }
}

function takeStartupWarnings(runtime: LoopRuntime): string[] {
  const warnings = [...runtime.startupWarnings];
  runtime.startupWarnings.length = 0;
  return warnings;
}

async function runCycle(runtime: LoopRuntime): Promise<LoopCycleReport> {
  const startupWarnings = takeStartupWarnings(runtime);
  const redemptions = await sweepRedemptions(runtime);
  const selected = await discoverMarket(
    runtime.reader,
    runtime.asset,
    runtime.marketLimit,
    runtime.preferredVenue,
    runtime.readTimeoutMs,
  );
  if (!selected) {
    return {
      status: "WAITING",
      marketId: null,
      asset: runtime.asset,
      venueId: runtime.preferredVenue ?? null,
      decisions: [],
      placements: [],
      redemptions,
      warnings: startupWarnings,
    };
  }
  const marketRead = await readMarketSnapshot(
    runtime.reader,
    selected.market,
    selected.onchain,
    selected.now,
    runtime.readTimeoutMs,
  );
  const snapshot = marketRead.snapshot;
  pruneActiveOrders(runtime.activeOrders, snapshot.now);
  const planned = planRoleDecisions(runtime.agents.map((agent) => agent.role), snapshot);
  const decisions = planned.map(({ role, strategyId, decision }) => ({
    role,
    strategy: strategyId,
    action: decision.action,
    reason: decision.reason,
    intentCount: decision.intents.length,
  }));
  const placements: LoopCycleReport["placements"] = [];
  for (const plannedDecision of planned) {
    const agent = runtime.agents.find((candidate) => candidate.role === plannedDecision.role);
    if (!agent || runtime.pausedRoles.has(agent.role)) continue;
    for (const intent of plannedDecision.decision.intents) {
      placements.push(await executeIntent(runtime, agent, selected.market, snapshot, intent));
    }
  }
  return {
    status: "TRADING",
    marketId: selected.market.marketId,
    asset: selected.market.asset,
    venueId: selected.market.venueId ?? null,
    decisions,
    placements,
    redemptions,
    warnings: [...startupWarnings, ...marketRead.warnings],
  };
}

function createAgents(roles: readonly LoopRole[], dryRun: boolean): LoopAgent[] {
  return roles.map((role) => {
    if (dryRun) return { role, strategyId: strategyForRole(role), address: null, exchange: null };
    const walletRole = role as WalletRole;
    return {
      role,
      strategyId: strategyForRole(role),
      address: addressFor(walletRole),
      exchange: exchangeFor(privateKeyFor(walletRole)),
    };
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  loadLocalEnv();
  const dryRun = !process.argv.includes("--live");
  const once = process.argv.includes("--once");
  const roles = selectedRoles();
  const runtime: LoopRuntime = {
    reader: exchangeFor(),
    agents: createAgents(roles, dryRun),
    store: new EventStore(),
    dryRun,
    activeOrders: new Map(),
    refusalTimes: new Map(),
    pausedRoles: new Set(),
    refusalCooldownMs: parsePositiveNumber(process.env.IACTA_LOOP_REFUSAL_COOLDOWN_MS, DEFAULT_REFUSAL_COOLDOWN_MS),
    asset: (process.env.IACTA_LOOP_ASSET ?? "BTC").trim().toUpperCase(),
    marketLimit: parsePositiveNumber(process.env.IACTA_LOOP_MARKET_LIMIT, DEFAULT_MARKET_LIMIT, 100),
    preferredVenue: process.env.IACTA_LOOP_VENUE_ID?.trim() || undefined,
    redemptionIntervalMs: parsePositiveNumber(process.env.IACTA_LOOP_REDEMPTION_INTERVAL_MS, DEFAULT_REDEMPTION_INTERVAL_MS, 86_400_000),
    redemptionReadTimeoutMs: parsePositiveNumber(process.env.IACTA_LOOP_REDEMPTION_READ_TIMEOUT_MS, DEFAULT_REDEMPTION_READ_TIMEOUT_MS, 120_000),
    readTimeoutMs: parsePositiveNumber(process.env.IACTA_LOOP_READ_TIMEOUT_MS, DEFAULT_LOOP_READ_TIMEOUT_MS, 120_000),
    writeTimeoutMs: parsePositiveNumber(process.env.IACTA_LOOP_WRITE_TIMEOUT_MS, DEFAULT_LOOP_WRITE_TIMEOUT_MS, 300_000),
    redemptionsEnabled: !process.argv.includes("--skip-redemptions"),
    lastRedemptionSweepAt: 0,
    reconciliationLookbackSeconds: parsePositiveNumber(process.env.IACTA_RECONCILIATION_LOOKBACK_SECONDS, DEFAULT_RECONCILIATION_LOOKBACK_SECONDS, 86_400),
    reconciliationLimit: parsePositiveNumber(process.env.IACTA_RECONCILIATION_LIMIT, DEFAULT_RECONCILIATION_LIMIT, 1_000),
    startupWarnings: [],
  };
  const intervalMs = parsePositiveNumber(process.env.IACTA_LOOP_INTERVAL_MS, DEFAULT_LOOP_INTERVAL_MS, 300_000);
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await reconcileStartup(runtime);
    do {
      try {
        const report = await runCycle(runtime);
        const heartbeatAt = writeHeartbeat(undefined, undefined, dryRun ? "DRY_RUN" : "LIVE");
        console.log(jsonSafe({
          mode: dryRun ? "DRY_RUN" : "LIVE",
          roles,
          heartbeatAt,
          ...report,
          store: { path: runtime.store.path, ...runtime.store.counts() },
        }));
      } catch (error) {
        console.error(`Engine loop cycle failed: ${message(error)}`);
        if (once) throw error;
      }
      if (once || stopping) break;
      await delay(intervalMs);
    } while (!stopping);
  } finally {
    runtime.reader.client.stopLive();
    for (const agent of runtime.agents) agent.exchange?.client.stopLive();
    runtime.store.close();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(`Engine loop failed: ${message(error)}`);
      process.exit(1);
    });
}
