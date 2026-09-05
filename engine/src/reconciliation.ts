import type { FillRecord, OrderRecord } from "./store.js";

export interface ReconciliationOrder {
  market: string;
  pool: string;
  side: string | null;
  status: string;
  price: string;
  fullQuantity: string;
  expireTimestampNs: string;
  placedTxHash: string;
  placedAtTimestamp: string;
}

export interface ReconciliationFill {
  market: string;
  pool: string;
  fillPrice: string;
  quantity: string;
  maker: string | null;
  makerSide: string | null;
  taker: string | null;
  takerSide: string | null;
  takerOrder: { owner: string; side: string | null } | null;
  kind: string | null;
  makerOrderId: string;
  takerOrderId: string;
  timestamp: string;
  txHash: string;
}

export interface ReconciliationReader {
  getOrders: (account: string, options: { limit: number }) => Promise<readonly ReconciliationOrder[]>;
  getUserFills: (account: string, options: { since: number; limit: number }) => Promise<readonly ReconciliationFill[]>;
}

export interface ReconciliationStore {
  recordOrder: (order: OrderRecord) => void;
  recordFill: (fill: FillRecord) => void;
}

export interface ReconciliationOptions {
  sinceSeconds: number;
  limit: number;
}

export interface ReconciliationResult {
  orders: number;
  fills: number;
}

function occurredAt(timestamp: string): string {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`invalid reconciliation timestamp ${timestamp}`);
  return new Date(seconds * 1_000).toISOString();
}

function fillPath(kind: string | null): FillRecord["fillPath"] {
  if (kind === "MINT_A_PAIR" || kind === "BURN_A_PAIR") return "mint";
  if (kind === "DIRECT_YES" || kind === "DIRECT_NO") return "book";
  return "unknown";
}

function ownedSide(fill: ReconciliationFill, account: string): string | null {
  const owner = account.toLowerCase();
  if (fill.maker?.toLowerCase() === owner) return fill.makerSide;
  if (fill.taker?.toLowerCase() === owner) return fill.takerOrder?.side ?? fill.takerSide;
  return null;
}

function recoveredOrder(agentId: string, row: ReconciliationOrder): OrderRecord {
  return {
    marketId: row.market,
    agentId,
    poolAddress: row.pool,
    side: row.side ?? "UNKNOWN",
    orderType: "RECOVERED",
    status: row.status,
    price: row.price,
    quantity: row.fullQuantity,
    expireTimestampNs: row.expireTimestampNs,
    txHash: row.placedTxHash,
    occurredAt: occurredAt(row.placedAtTimestamp),
  };
}

function recoveredFill(agentId: string, account: string, row: ReconciliationFill): FillRecord | null {
  const side = ownedSide(row, account);
  if (!side) return null;
  return {
    marketId: row.market,
    agentId,
    poolAddress: row.pool,
    side,
    price: row.fillPrice,
    quantity: row.quantity,
    makerOrderId: row.makerOrderId,
    txHash: row.txHash,
    fillPath: fillPath(row.kind),
    occurredAt: occurredAt(row.timestamp),
  };
}

export async function reconcileAgentActivity(
  agentId: string,
  account: string,
  reader: ReconciliationReader,
  store: ReconciliationStore,
  options: ReconciliationOptions,
): Promise<ReconciliationResult> {
  if (!agentId.trim()) throw new Error("reconciliation agent id is required");
  if (!/^0x[0-9a-fA-F]{40}$/.test(account)) throw new Error("reconciliation account must be an address");
  if (!Number.isInteger(options.sinceSeconds) || options.sinceSeconds < 0) {
    throw new Error("reconciliation since timestamp is invalid");
  }
  if (!Number.isInteger(options.limit) || options.limit <= 0) throw new Error("reconciliation limit is invalid");

  const [orders, fills] = await Promise.all([
    reader.getOrders(account, { limit: options.limit }),
    reader.getUserFills(account, { since: options.sinceSeconds, limit: options.limit }),
  ]);
  const seenOrders = new Set<string>();
  let orderCount = 0;
  for (const row of orders) {
    if (Number(row.placedAtTimestamp) < options.sinceSeconds || !row.placedTxHash.trim()) continue;
    if (seenOrders.has(row.placedTxHash.toLowerCase())) continue;
    seenOrders.add(row.placedTxHash.toLowerCase());
    store.recordOrder(recoveredOrder(agentId, row));
    orderCount += 1;
  }

  const seenFills = new Set<string>();
  let fillCount = 0;
  for (const row of fills) {
    if (Number(row.timestamp) < options.sinceSeconds || !row.txHash.trim()) continue;
    const fill = recoveredFill(agentId, account, row);
    if (!fill) continue;
    const key = `${fill.txHash.toLowerCase()}:${fill.makerOrderId}:${fill.price}:${fill.quantity}`;
    if (seenFills.has(key)) continue;
    seenFills.add(key);
    store.recordFill(fill);
    fillCount += 1;
  }

  return { orders: orderCount, fills: fillCount };
}
