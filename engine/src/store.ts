import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

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
  quoteDecimals: number;
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

export interface EventSnapshot {
  rounds: RoundRecord[];
  orders: OrderRecord[];
  fills: FillRecord[];
  redemptions: RedemptionRecord[];
  refusals: RefusalRecord[];
}

const LEGACY_QUOTE_DECIMALS = 6;

function defaultDatabasePath(): string {
  const dataRoot = process.cwd().endsWith("/engine") ? process.cwd() : resolve(process.cwd(), "engine");
  return resolve(dataRoot, "data", "iacta.db");
}

function nowIso(): string {
  return new Date().toISOString();
}

function jsonOrEmpty(value: unknown): string {
  return JSON.stringify(value ?? {}, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested);
}

export class EventStore {
  readonly path: string;
  private readonly db: Database.Database;

  constructor(path = process.env.IACTA_DB_PATH ?? defaultDatabasePath()) {
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
        quote_decimals INTEGER NOT NULL DEFAULT 6,
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
    const roundColumns = this.db.pragma("table_info(rounds)") as { name: string }[];
    if (!roundColumns.some((column) => column.name === "quote_decimals")) {
      this.db.exec(`ALTER TABLE rounds ADD COLUMN quote_decimals INTEGER NOT NULL DEFAULT ${LEGACY_QUOTE_DECIMALS}`);
    }
  }

  recordRound(round: RoundRecord): void {
    if (!Number.isInteger(round.quoteDecimals) || round.quoteDecimals < 0 || round.quoteDecimals > 36) {
      throw new Error(`quote decimals are invalid for market ${round.marketId}`);
    }
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO rounds (market_id, symbol, asset, status, trading_start, expiry, venue_id, pool_address, quote_decimals, created_at, updated_at)
      VALUES (@marketId, @symbol, @asset, @status, @tradingStart, @expiry, @venueId, @poolAddress, @quoteDecimals, @createdAt, @updatedAt)
      ON CONFLICT(market_id) DO UPDATE SET
        symbol = excluded.symbol,
        asset = excluded.asset,
        status = excluded.status,
        trading_start = excluded.trading_start,
        expiry = excluded.expiry,
        venue_id = excluded.venue_id,
        pool_address = excluded.pool_address,
        quote_decimals = excluded.quote_decimals,
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

  snapshot(): EventSnapshot {
    const rounds = this.db.prepare(`
      SELECT market_id, symbol, asset, status, trading_start, expiry, venue_id, pool_address, quote_decimals
      FROM rounds
      ORDER BY created_at ASC
    `).all() as {
      market_id: string;
      symbol: string;
      asset: string;
      status: RoundStatus;
      trading_start: number;
      expiry: number;
      venue_id: string | null;
      pool_address: string;
      quote_decimals: number;
    }[];
    const orders = this.db.prepare(`
      SELECT market_id, agent_id, pool_address, side, order_type, status, price, quantity,
             expire_timestamp_ns, tx_hash, occurred_at
      FROM orders
      ORDER BY occurred_at ASC, id ASC
    `).all() as {
      market_id: string;
      agent_id: string;
      pool_address: string;
      side: string;
      order_type: string;
      status: string;
      price: string;
      quantity: string;
      expire_timestamp_ns: string;
      tx_hash: string;
      occurred_at: string;
    }[];
    const fills = this.db.prepare(`
      SELECT market_id, agent_id, pool_address, side, price, quantity, tx_hash, fill_path, occurred_at
      FROM fills
      ORDER BY occurred_at ASC, id ASC
    `).all() as {
      market_id: string;
      agent_id: string;
      pool_address: string;
      side: string;
      price: string;
      quantity: string;
      tx_hash: string;
      fill_path: FillRecord["fillPath"];
      occurred_at: string;
    }[];
    const redemptions = this.db.prepare(`
      SELECT market_id, agent_id, proceeds, outcome, tx_hash, occurred_at
      FROM redemptions
      ORDER BY occurred_at ASC, id ASC
    `).all() as {
      market_id: string;
      agent_id: string;
      proceeds: string;
      outcome: string;
      tx_hash: string;
      occurred_at: string;
    }[];
    const refusals = this.db.prepare(`
      SELECT market_id, agent_id, reason, status, tx_hash, occurred_at
      FROM refusals
      ORDER BY occurred_at ASC, id ASC
    `).all() as {
      market_id: string;
      agent_id: string;
      reason: string;
      status: RefusalRecord["status"];
      tx_hash: string | null;
      occurred_at: string;
    }[];

    return {
      rounds: rounds.map((row) => ({
        marketId: row.market_id,
        symbol: row.symbol,
        asset: row.asset,
        status: row.status,
        tradingStart: row.trading_start,
        expiry: row.expiry,
        venueId: row.venue_id,
        poolAddress: row.pool_address,
        quoteDecimals: row.quote_decimals,
      })),
      orders: orders.map((row) => ({
        marketId: row.market_id,
        agentId: row.agent_id,
        poolAddress: row.pool_address,
        side: row.side,
        orderType: row.order_type,
        status: row.status,
        price: row.price,
        quantity: row.quantity,
        expireTimestampNs: row.expire_timestamp_ns,
        txHash: row.tx_hash,
        occurredAt: row.occurred_at,
      })),
      fills: fills.map((row) => ({
        marketId: row.market_id,
        agentId: row.agent_id,
        poolAddress: row.pool_address,
        side: row.side,
        price: row.price,
        quantity: row.quantity,
        txHash: row.tx_hash,
        fillPath: row.fill_path,
        occurredAt: row.occurred_at,
      })),
      redemptions: redemptions.map((row) => ({
        marketId: row.market_id,
        agentId: row.agent_id,
        proceeds: row.proceeds,
        outcome: row.outcome,
        txHash: row.tx_hash,
        occurredAt: row.occurred_at,
      })),
      refusals: refusals.map((row) => ({
        marketId: row.market_id,
        agentId: row.agent_id,
        reason: row.reason,
        status: row.status,
        txHash: row.tx_hash,
        occurredAt: row.occurred_at,
      })),
    };
  }

  close(): void {
    this.db.close();
  }
}
