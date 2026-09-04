import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type RoundStatus = "Listed" | "Trading" | "Locked" | "Settling" | "Resolved" | "Voided" | "Finalized";

export interface RoundRecord {
  marketId: string;
  symbol: string;
  asset: string;
  status: RoundStatus;
  tradingStart: number;
  expiry: number;
  venueId: string | null;
  poolAddress: string;
}

export interface FillRecord {
  marketId: string;
  agentId: string;
  poolAddress: string;
  side: string;
  price: string;
  quantity: string;
  txHash: string;
  fillPath: "book" | "mint" | "unknown";
  occurredAt?: string;
}

export interface OrderRecord {
  marketId: string;
  agentId: string;
  poolAddress: string;
  side: string;
  orderType: string;
  status: string;
  price: string;
  quantity: string;
  expireTimestampNs: string;
  txHash: string;
  occurredAt?: string;
}

export interface RedemptionRecord {
  marketId: string;
  agentId: string;
  proceeds: string;
  outcome: string;
  txHash: string;
  occurredAt?: string;
}

export interface RefusalRecord {
  marketId: string;
  agentId: string;
  reason: string;
  status: "REFUSED" | "EXPIRED";
  txHash?: string | null;
  occurredAt?: string;
}

const DEFAULT_DB_PATH = fileURLToPath(new URL("../data/iacta.db", import.meta.url));

function nowIso(): string {
  return new Date().toISOString();
}

function jsonOrEmpty(value: unknown): string {
  return JSON.stringify(value ?? {}, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested);
}

export class EventStore {
  readonly path: string;
  private readonly db: Database.Database;

  constructor(path = process.env.IACTA_DB_PATH ?? DEFAULT_DB_PATH) {
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new Database(this.path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rounds (
        market_id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        asset TEXT NOT NULL,
        status TEXT NOT NULL,
        trading_start INTEGER NOT NULL,
        expiry INTEGER NOT NULL,
        venue_id TEXT,
        pool_address TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        pool_address TEXT NOT NULL,
        side TEXT NOT NULL,
        order_type TEXT NOT NULL,
        status TEXT NOT NULL,
        price TEXT NOT NULL,
        quantity TEXT NOT NULL,
        expire_timestamp_ns TEXT NOT NULL,
        tx_hash TEXT NOT NULL UNIQUE,
        occurred_at TEXT NOT NULL,
        raw_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        pool_address TEXT NOT NULL,
        side TEXT NOT NULL,
        price TEXT NOT NULL,
        quantity TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        fill_path TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        UNIQUE (tx_hash, agent_id, price, quantity)
      );

      CREATE TABLE IF NOT EXISTS redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        proceeds TEXT NOT NULL,
        outcome TEXT NOT NULL,
        tx_hash TEXT NOT NULL UNIQUE,
        occurred_at TEXT NOT NULL,
        raw_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS refusals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        occurred_at TEXT NOT NULL,
        raw_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_orders_market ON orders (market_id, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_fills_market ON fills (market_id, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_redemptions_market ON redemptions (market_id, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_refusals_market ON refusals (market_id, occurred_at);
    `);
  }

  recordRound(round: RoundRecord): void {
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO rounds (market_id, symbol, asset, status, trading_start, expiry, venue_id, pool_address, created_at, updated_at)
      VALUES (@marketId, @symbol, @asset, @status, @tradingStart, @expiry, @venueId, @poolAddress, @createdAt, @updatedAt)
      ON CONFLICT(market_id) DO UPDATE SET
        symbol = excluded.symbol,
        asset = excluded.asset,
        status = excluded.status,
        trading_start = excluded.trading_start,
        expiry = excluded.expiry,
        venue_id = excluded.venue_id,
        pool_address = excluded.pool_address,
        updated_at = excluded.updated_at
    `).run({ ...round, createdAt: timestamp, updatedAt: timestamp });
  }

  recordOrder(order: OrderRecord, raw: unknown = order): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO orders
        (market_id, agent_id, pool_address, side, order_type, status, price, quantity, expire_timestamp_ns, tx_hash, occurred_at, raw_json)
      VALUES (@marketId, @agentId, @poolAddress, @side, @orderType, @status, @price, @quantity, @expireTimestampNs, @txHash, @occurredAt, @rawJson)
    `).run({ ...order, occurredAt: order.occurredAt ?? nowIso(), rawJson: jsonOrEmpty(raw) });
  }

  recordFill(fill: FillRecord, raw: unknown = fill): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO fills
        (market_id, agent_id, pool_address, side, price, quantity, tx_hash, fill_path, occurred_at, raw_json)
      VALUES (@marketId, @agentId, @poolAddress, @side, @price, @quantity, @txHash, @fillPath, @occurredAt, @rawJson)
    `).run({ ...fill, occurredAt: fill.occurredAt ?? nowIso(), rawJson: jsonOrEmpty(raw) });
  }

  recordRedemption(redemption: RedemptionRecord, raw: unknown = redemption): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO redemptions
        (market_id, agent_id, proceeds, outcome, tx_hash, occurred_at, raw_json)
      VALUES (@marketId, @agentId, @proceeds, @outcome, @txHash, @occurredAt, @rawJson)
    `).run({ ...redemption, occurredAt: redemption.occurredAt ?? nowIso(), rawJson: jsonOrEmpty(raw) });
  }

  recordRefusal(refusal: RefusalRecord, raw: unknown = refusal): void {
    this.db.prepare(`
      INSERT INTO refusals
        (market_id, agent_id, reason, status, tx_hash, occurred_at, raw_json)
      VALUES (@marketId, @agentId, @reason, @status, @txHash, @occurredAt, @rawJson)
    `).run({ ...refusal, txHash: refusal.txHash ?? null, occurredAt: refusal.occurredAt ?? nowIso(), rawJson: jsonOrEmpty(raw) });
  }

  counts(): { rounds: number; orders: number; fills: number; redemptions: number; refusals: number } {
    const row = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM rounds) AS rounds,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COUNT(*) FROM fills) AS fills,
        (SELECT COUNT(*) FROM redemptions) AS redemptions,
        (SELECT COUNT(*) FROM refusals) AS refusals
    `).get() as { rounds: number; orders: number; fills: number; redemptions: number; refusals: number };
    return row;
  }

  close(): void {
    this.db.close();
  }
}
