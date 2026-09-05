import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EventStore, resolveDatabasePath, type FillRecord } from "./store.js";

test("event store reopens with tx-linked lifecycle events intact", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-store-"));
  const databasePath = join(directory, "arena.db");
  const round = {
    marketId: "0xmarket",
    symbol: "BTC-TEST",
    asset: "BTC",
    status: "Trading" as const,
    tradingStart: 1_000,
    expiry: 1_600,
    venueId: "0xvenue",
    poolAddress: "0xpool",
    quoteDecimals: 6,
  };
  const fill = {
    marketId: round.marketId,
    agentId: "SECUTOR",
    poolAddress: round.poolAddress,
    side: "BUY_YES",
    price: "500000",
    quantity: "1000",
    txHash: "0xfill",
    fillPath: "book" as const,
    occurredAt: "2026-09-04T00:00:00.000Z",
  };

  try {
    const first = new EventStore(databasePath);
    first.recordRound(round);
    first.recordFill(fill);
    first.recordFill(fill);
    first.recordRedemption({
      marketId: round.marketId,
      agentId: "SECUTOR",
      proceeds: "900",
      outcome: "YES",
      txHash: "0xredeem",
      occurredAt: "2026-09-04T00:01:00.000Z",
    });
    assert.equal(first.snapshot().fills.length, 1);
    first.close();

    const reopened = new EventStore(databasePath);
    const snapshot = reopened.snapshot();
    reopened.close();

    assert.deepEqual(snapshot.rounds, [round]);
    assert.deepEqual(snapshot.fills, [fill]);
    assert.deepEqual(snapshot.redemptions, [{
      marketId: round.marketId,
      agentId: "SECUTOR",
      proceeds: "900",
      outcome: "YES",
      txHash: "0xredeem",
      occurredAt: "2026-09-04T00:01:00.000Z",
    }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("event store preserves distinct same-price fills from different maker orders", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-fill-key-"));
  const databasePath = join(directory, "arena.db");

  try {
    const store = new EventStore(databasePath);
    const fill: FillRecord = {
      marketId: "0xmarket",
      agentId: "SECUTOR",
      poolAddress: "0xpool",
      side: "BUY_YES",
      price: "500000",
      quantity: "1000",
      txHash: "0xtaker",
      fillPath: "book" as const,
      occurredAt: "2026-09-05T00:00:00.000Z",
    };
    store.recordFill({ ...fill, makerOrderId: "101" });
    store.recordFill({ ...fill, makerOrderId: "202" });

    assert.equal(store.snapshot().fills.length, 2);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("event store allows one redemption transaction to cover multiple markets", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-redemption-key-"));
  const databasePath = join(directory, "arena.db");

  try {
    const store = new EventStore(databasePath);
    const base = {
      agentId: "SECUTOR",
      proceeds: "1000",
      outcome: "YES",
      txHash: "0xbatch-redemption",
    };
    store.recordRedemption({ ...base, marketId: "0xmarket-a" });
    store.recordRedemption({ ...base, marketId: "0xmarket-b" });

    assert.equal(store.snapshot().redemptions.length, 2);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("relative database paths resolve from the engine root", () => {
  const expected = fileURLToPath(new URL("../data/iacta.db", import.meta.url));
  assert.equal(resolveDatabasePath("./data/iacta.db"), expected);
});

test("event store migrates legacy fill and redemption uniqueness keys", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-store-migration-"));
  const databasePath = join(directory, "arena.db");

  try {
    const legacy = new Database(databasePath);
    legacy.exec(`
      CREATE TABLE fills (
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
      CREATE TABLE redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        proceeds TEXT NOT NULL,
        outcome TEXT NOT NULL,
        tx_hash TEXT NOT NULL UNIQUE,
        occurred_at TEXT NOT NULL,
        raw_json TEXT NOT NULL
      );
      INSERT INTO fills (market_id, agent_id, pool_address, side, price, quantity, tx_hash, fill_path, occurred_at, raw_json)
      VALUES ('0xmarket', 'SECUTOR', '0xpool', 'BUY_YES', '500000', '1000', '0xtaker', 'book', '2026-09-05T00:00:00.000Z', '{}');
      INSERT INTO redemptions (market_id, agent_id, proceeds, outcome, tx_hash, occurred_at, raw_json)
      VALUES ('0xmarket-a', 'SECUTOR', '900', 'YES', '0xbatch', '2026-09-05T00:00:00.000Z', '{}');
    `);
    legacy.close();

    const store = new EventStore(databasePath);
    store.recordFill({
      marketId: "0xmarket",
      agentId: "SECUTOR",
      poolAddress: "0xpool",
      side: "BUY_YES",
      price: "500000",
      quantity: "1000",
      makerOrderId: "202",
      txHash: "0xtaker",
      fillPath: "book",
    });
    store.recordRedemption({
      marketId: "0xmarket-b",
      agentId: "SECUTOR",
      proceeds: "450",
      outcome: "NO",
      txHash: "0xbatch",
    });

    const snapshot = store.snapshot();
    assert.equal(snapshot.fills.length, 1);
    assert.equal(snapshot.fills[0]?.makerOrderId, "202");
    assert.equal(snapshot.redemptions.length, 2);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("event store enriches a legacy fill instead of duplicating it during reconciliation", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-fill-enrichment-"));
  const databasePath = join(directory, "arena.db");

  try {
    const store = new EventStore(databasePath);
    const fill = {
      marketId: "0xmarket",
      agentId: "SECUTOR",
      poolAddress: "0xpool",
      side: "BUY_YES",
      price: "500000",
      quantity: "1000",
      txHash: "0xtaker",
      fillPath: "book" as const,
      occurredAt: "2026-09-05T00:00:00.000Z",
    };
    store.recordFill(fill);
    store.recordFill({ ...fill, makerOrderId: "202" });

    assert.deepEqual(store.snapshot().fills, [{
      ...fill,
      makerOrderId: "202",
    }]);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
