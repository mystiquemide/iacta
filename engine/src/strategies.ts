export const BATTLE_AGENT_IDS = ["RETIARIUS", "SECUTOR", "THRAEX", "MURMILLO"] as const;
export type BattleAgentId = (typeof BATTLE_AGENT_IDS)[number];

export type TradingSide = "BUY_YES" | "BUY_NO";
export type StrategyOrderType = "IOC" | "POST_ONLY";

export interface BookLevel {
  price: bigint;
  quantity: bigint;
}

export interface MarketSnapshot {
  marketId: string;
  poolAddress: string;
  /** On-chain BinaryMarket status. `1` is Trading. */
  status: number;
  now: number;
  expiry: number;
  quoteOne: bigint;
  tickSize: bigint;
  lotSize: bigint;
  minQuantity: bigint;
  yesBids: readonly BookLevel[];
  yesAsks: readonly BookLevel[];
  /** Chronological YES prices, in the market's raw quote scale. */
  recentYesPrices: readonly bigint[];
}

export interface OrderIntent {
  agentId: BattleAgentId;
  side: TradingSide;
  orderType: StrategyOrderType;
  /** SDK order price, always expressed in YES terms, including for BUY_NO. */
  price: bigint;
  quantity: bigint;
  expireTimestampNs: bigint;
}

export interface StrategyDecision {
  agentId: BattleAgentId;
  action: "ORDER" | "HOLD";
  reason: string;
  intents: readonly OrderIntent[];
}

export type GuardResult =
  | { accepted: true; intent: OrderIntent }
  | { accepted: false; reason: string };

export const MIN_HEADROOM_SECONDS = 180;
export const DEFAULT_ORDER_WINDOW_SECONDS = 120;
const NANOSECONDS_PER_SECOND = 1_000_000_000n;

export function guardOrderIntent(snapshot: MarketSnapshot, intent: OrderIntent): GuardResult {
  if (snapshot.status !== 1) {
    return { accepted: false, reason: `market status must be 1, received ${snapshot.status}` };
  }
  if (snapshot.expiry - snapshot.now < MIN_HEADROOM_SECONDS) {
    return { accepted: false, reason: "market has less than 180 seconds of expiry headroom" };
  }
  if (snapshot.quoteOne <= 0n) {
    return { accepted: false, reason: "market quote scale is invalid" };
  }
  if (snapshot.tickSize <= 0n) {
    return { accepted: false, reason: "market tick size is invalid" };
  }
  if (snapshot.lotSize <= 0n || snapshot.minQuantity <= 0n) {
    return { accepted: false, reason: "market quantity grid is invalid" };
  }
  if (intent.price <= 0n || intent.price >= snapshot.quoteOne) {
    return { accepted: false, reason: "order price must be inside the binary price range" };
  }
  if (intent.price % snapshot.tickSize !== 0n) {
    return { accepted: false, reason: "order price is off the tick grid" };
  }
  if (intent.quantity < snapshot.minQuantity) {
    return { accepted: false, reason: "order quantity is below the venue minimum" };
  }
  if (intent.quantity % snapshot.lotSize !== 0n) {
    return { accepted: false, reason: "order quantity is off the lot grid" };
  }

  const nowNs = BigInt(snapshot.now) * NANOSECONDS_PER_SECOND;
  const expiryNs = BigInt(snapshot.expiry) * NANOSECONDS_PER_SECOND;
  if (intent.expireTimestampNs <= nowNs) {
    return { accepted: false, reason: "order expiry must be in the future" };
  }
  if (intent.expireTimestampNs > expiryNs) {
    return { accepted: false, reason: "order expiry must not exceed market expiry" };
  }

  return { accepted: true, intent };
}

function orderExpiry(snapshot: MarketSnapshot): bigint {
  const seconds = Math.min(
    snapshot.expiry,
    snapshot.now + DEFAULT_ORDER_WINDOW_SECONDS,
  );
  return BigInt(seconds) * NANOSECONDS_PER_SECOND;
}

function acceptedIntent(
  snapshot: MarketSnapshot,
  intent: OrderIntent,
): OrderIntent | null {
  const result = guardOrderIntent(snapshot, intent);
  return result.accepted ? result.intent : null;
}

function decision(
  agentId: BattleAgentId,
  reason: string,
  intents: readonly (OrderIntent | null)[],
): StrategyDecision {
  const accepted = intents.filter((intent): intent is OrderIntent => intent !== null);
  return {
    agentId,
    action: accepted.length > 0 ? "ORDER" : "HOLD",
    reason,
    intents: accepted,
  };
}

function midpoint(snapshot: MarketSnapshot): bigint {
  const bid = snapshot.yesBids[0]?.price;
  const ask = snapshot.yesAsks[0]?.price;
  const raw = bid !== undefined && ask !== undefined
    ? (bid + ask) / 2n
    : snapshot.quoteOne / 2n;
  const snapped = (raw / snapshot.tickSize) * snapshot.tickSize;
  const lower = snapshot.tickSize;
  const upper = snapshot.quoteOne - snapshot.tickSize;
  return snapped < lower ? lower : snapped > upper ? upper : snapped;
}

function range(values: readonly bigint[]): bigint {
  if (values.length === 0) return 0n;
  let lowest = values[0] ?? 0n;
  let highest = lowest;
  for (const value of values.slice(1)) {
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }
  return highest - lowest;
}

function average(values: readonly bigint[]): bigint {
  if (values.length === 0) return 0n;
  return values.reduce((total, value) => total + value, 0n) / BigInt(values.length);
}

function secutor(snapshot: MarketSnapshot): StrategyDecision {
  const prices = snapshot.recentYesPrices;
  if (prices.length < 2) {
    const bid = snapshot.yesBids[0];
    if (!bid) return decision("SECUTOR", "waiting for momentum history", []);
    return decision("SECUTOR", "bootstrapping against the best YES bid", [acceptedIntent(snapshot, {
      agentId: "SECUTOR",
      side: "BUY_NO",
      orderType: "IOC",
      price: bid.price,
      quantity: snapshot.minQuantity,
      expireTimestampNs: orderExpiry(snapshot),
    })]);
  }

  const first = prices[0] ?? 0n;
  const last = prices[prices.length - 1] ?? first;
  const expiry = orderExpiry(snapshot);
  if (last > first) {
    const ask = snapshot.yesAsks[0];
    if (!ask) return decision("SECUTOR", "rising momentum has no YES ask", []);
    return decision("SECUTOR", "momentum is rising, taking the best YES ask", [acceptedIntent(snapshot, {
      agentId: "SECUTOR",
      side: "BUY_YES",
      orderType: "IOC",
      price: ask.price,
      quantity: snapshot.minQuantity,
      expireTimestampNs: expiry,
    })]);
  }
  if (last < first) {
    const bid = snapshot.yesBids[0];
    if (!bid) return decision("SECUTOR", "falling momentum has no NO ask", []);
    return decision("SECUTOR", "momentum is falling, taking the best NO ask", [acceptedIntent(snapshot, {
      agentId: "SECUTOR",
      side: "BUY_NO",
      orderType: "IOC",
      price: bid.price,
      quantity: snapshot.minQuantity,
      expireTimestampNs: expiry,
    })]);
  }
  return decision("SECUTOR", "momentum is flat", []);
}

function thraex(snapshot: MarketSnapshot): StrategyDecision {
  const prices = snapshot.recentYesPrices;
  if (prices.length < 3) return decision("THRAEX", "waiting for a mean estimate", []);

  const last = prices[prices.length - 1] ?? 0n;
  const mean = average(prices);
  const threshold = snapshot.tickSize * 2n;
  const expiry = orderExpiry(snapshot);
  if (last >= mean + threshold) {
    const bid = snapshot.yesBids[0];
    if (!bid) return decision("THRAEX", "YES is extended but no NO ask is resting", []);
    return decision("THRAEX", "YES is above its recent mean, buying NO", [acceptedIntent(snapshot, {
      agentId: "THRAEX",
      side: "BUY_NO",
      orderType: "IOC",
      price: bid.price,
      quantity: snapshot.minQuantity,
      expireTimestampNs: expiry,
    })]);
  }
  if (last <= mean - threshold) {
    const ask = snapshot.yesAsks[0];
    if (!ask) return decision("THRAEX", "YES is depressed but no YES ask is resting", []);
    return decision("THRAEX", "YES is below its recent mean, buying YES", [acceptedIntent(snapshot, {
      agentId: "THRAEX",
      side: "BUY_YES",
      orderType: "IOC",
      price: ask.price,
      quantity: snapshot.minQuantity,
      expireTimestampNs: expiry,
    })]);
  }
  return decision("THRAEX", "price is close to its recent mean", []);
}

function retiarius(snapshot: MarketSnapshot): StrategyDecision {
  const price = midpoint(snapshot);
  const expiry = orderExpiry(snapshot);
  return decision("RETIARIUS", "quoting both sides around the live midpoint", [
    acceptedIntent(snapshot, {
      agentId: "RETIARIUS",
      side: "BUY_YES",
      orderType: "POST_ONLY",
      price,
      quantity: snapshot.minQuantity,
      expireTimestampNs: expiry,
    }),
    acceptedIntent(snapshot, {
      agentId: "RETIARIUS",
      side: "BUY_NO",
      orderType: "POST_ONLY",
      price,
      quantity: snapshot.minQuantity,
      expireTimestampNs: expiry,
    }),
  ]);
}

function murmillo(snapshot: MarketSnapshot): StrategyDecision {
  const prices = snapshot.recentYesPrices;
  if (prices.length < 3) return decision("MURMILLO", "waiting for a stability window", []);
  if (range(prices) > snapshot.tickSize * 4n) {
    return decision("MURMILLO", "recent volatility is above the conservative limit", []);
  }
  const ask = snapshot.yesAsks[0];
  if (!ask) return decision("MURMILLO", "stable window has no YES ask", []);
  if ((prices[prices.length - 1] ?? 0n) - midpoint(snapshot) > snapshot.tickSize * 2n) {
    return decision("MURMILLO", "stable window is too far above midpoint", []);
  }
  return decision("MURMILLO", "stable narrow window, using the minimum lot", [acceptedIntent(snapshot, {
    agentId: "MURMILLO",
    side: "BUY_YES",
    orderType: "IOC",
    price: ask.price,
    quantity: snapshot.minQuantity,
    expireTimestampNs: orderExpiry(snapshot),
  })]);
}

export function decide(agentId: BattleAgentId, snapshot: MarketSnapshot): StrategyDecision {
  switch (agentId) {
    case "RETIARIUS":
      return retiarius(snapshot);
    case "SECUTOR":
      return secutor(snapshot);
    case "THRAEX":
      return thraex(snapshot);
    case "MURMILLO":
      return murmillo(snapshot);
  }
}
