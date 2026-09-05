import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore } from "./store.js";
import { parseRegistry, registryByAddress } from "./registry.js";
import { planFieldRecords, sweepFieldActivity, type FieldActivity, type TradeLike, type RedeemLike } from "./field-ingest.js";

const REGISTRY = parseRegistry(JSON.stringify({
  version: 1,
  gladiators: [
    {
      agentId: "PROVOCATOR",
      address: `0x${"a".repeat(40)}`,
      architecture: "Conservative reference entrant",
      behavior: "Reference entrant run by the arena team.",
      posture: "Registered entrant",
      submittedBy: "arena-team",
      registeredAt: "2026-09-05T19:00:00.000Z",
    },
  ],
}));

const market = `0x${"1".repeat(64)}`;
const pool = `0x${"2".repeat(40)}`;

function trade(overrides: Partial<TradeLike> = {}): TradeLike {
  return {
    id: "TRADE:1",
    kind: "TRADE",
    market,
    timestamp: "1757097600",
    txHash: `0x${"3".repeat(64)}`,
    fillPrice: "250000",
    quantity: "1000",
    maker: null,
    taker: null,
    makerSide: null,
    takerSide: null,
    ...overrides,
  };
}

function redeem(overrides: Partial<RedeemLike> = {}): RedeemLike {
  return {
    id: "REDEEM:1",
    kind: "REDEEM",
    market,
    timestamp: "1757097600",
    txHash: `0x${"4".repeat(64)}`,
    account: `0x${"a".repeat(40)}`,
    payout: "1200",
    ...overrides,
  };
}

test("planFieldRecords attributes registered taker and maker fills with their sides", () => {
  const activities: FieldActivity[] = [
    trade({ id: "TRADE:t", taker: `0x${"a".repeat(40)}`, takerSide: "BUY_YES" }),
    trade({ id: "TRADE:m", maker: `0x${"a".repeat(40)}`, makerSide: "BUY_NO", txHash: `0x${"5".repeat(64)}` }),
  ];
  const planned = planFieldRecords(activities, REGISTRY);
  assert.equal(planned.fills.length, 2);
  const [takerFill, makerFill] = planned.fills;
  assert.equal(takerFill.agentId, "PROVOCATOR");
  assert.equal(takerFill.side, "BUY_YES");
  assert.equal(takerFill.makerOrderId, "external:TRADE:t");
  assert.equal(makerFill.side, "BUY_NO");
  assert.equal(planned.skippedUnattributable, 0);
});

test("planFieldRecords ignores wallets outside the registry and other activity kinds", () => {
  const activities: FieldActivity[] = [
    trade({ id: "TRADE:ext", taker: `0x${"b".repeat(40)}`, takerSide: "BUY_YES" }),
    trade({ id: "TRADE:null", taker: `0x${"a".repeat(40)}`, takerSide: null }),
  ];
  const planned = planFieldRecords(activities, REGISTRY);
  assert.equal(planned.fills.length, 0);
  assert.equal(planned.skippedUnattributable, 1);
});

test("planFieldRecords maps a REDEEM payout to a redemption row", () => {
  const planned = planFieldRecords([redeem()], REGISTRY);
  assert.equal(planned.redemptions.length, 1);
  const redemption = planned.redemptions[0]!;
  assert.equal(redemption.agentId, "PROVOCATOR");
  assert.equal(redemption.proceeds, "1200");
  assert.equal(redemption.txHash, `0x${"4".repeat(64)}`);
});

test("registry validation rejects bad versions, addresses, and duplicates", () => {
  const entry = {
    agentId: "PROVOCATOR",
    address: `0x${"a".repeat(40)}`,
    architecture: "x",
    behavior: "y",
    posture: "z",
    submittedBy: "t",
    registeredAt: "2026-09-05T19:00:00.000Z",
  };
  assert.throws(() => parseRegistry(JSON.stringify({ version: 2, gladiators: [] })), /version 2 is not supported/);
  assert.throws(() => parseRegistry(JSON.stringify({ version: 1, gladiators: [{ ...entry, address: "0xABC" }] })), /lowercase address/);
  assert.throws(() => parseRegistry(JSON.stringify({ version: 1, gladiators: [entry, { ...entry, agentId: "OTHERONE" }] })), /registered twice/);
  assert.deepEqual(registryByAddress(REGISTRY).get(`0x${"a".repeat(40)}`)?.agentId, "PROVOCATOR");
});

test("sweepFieldActivity records registered activity into the store idempotently", async () => {
  const dir = mkdtempSync(join(tmpdir(), "iacta-field-"));
  try {
    const store = new EventStore(join(dir, "store.db"));
    store.recordRound({
      marketId: market,
      symbol: "BTC-UP",
      asset: "BTC",
      status: "Resolved",
      tradingStart: 1_000,
      expiry: 2_000,
      venueId: "0xabc",
      poolAddress: pool,
      quoteDecimals: 6,
    });
    const activities: FieldActivity[] = [
      trade({ taker: `0x${"a".repeat(40)}`, takerSide: "BUY_NO" }),
      redeem(),
    ];
    const read = async () => activities;

    const first = await sweepFieldActivity(read, store.snapshot().rounds, store, REGISTRY);
    assert.equal(first.marketsScanned, 1);
    assert.equal(first.fillsRecorded, 1);
    assert.equal(first.redemptionsRecorded, 1);

    const second = await sweepFieldActivity(read, store.snapshot().rounds, store, REGISTRY);
    assert.equal(second.fillsRecorded, 0);
    assert.equal(second.redemptionsRecorded, 0);
    assert.equal(store.counts().fills, 1);
    assert.equal(store.counts().redemptions, 1);

    const ingestedFill = store.snapshot().fills[0]!;
    assert.equal(ingestedFill.agentId, "PROVOCATOR");
    assert.equal(ingestedFill.poolAddress, pool);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sweepFieldActivity reports a warning per failing market and continues", async () => {
  const dir = mkdtempSync(join(tmpdir(), "iacta-field-"));
  try {
    const store = new EventStore(join(dir, "store.db"));
    store.recordRound({
      marketId: market,
      symbol: "BTC-UP",
      asset: "BTC",
      status: "Resolved",
      tradingStart: 1_000,
      expiry: 2_000,
      venueId: "0xabc",
      poolAddress: pool,
      quoteDecimals: 6,
    });
    const read = async (requested: { marketId: string }) => {
      if (requested.marketId === market) throw new Error("indexer down");
      return [];
    };
    const result = await sweepFieldActivity(read, store.snapshot().rounds, store, REGISTRY);
    assert.equal(result.marketsScanned, 1);
    assert.equal(result.fillsRecorded, 0);
    assert.match(result.warnings[0] ?? "", /indexer down/);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an empty registry is a no-op sweep", async () => {
  const dir = mkdtempSync(join(tmpdir(), "iacta-field-"));
  try {
    const store = new EventStore(join(dir, "store.db"));
    let reads = 0;
    const read = async () => {
      reads += 1;
      return [];
    };
    const result = await sweepFieldActivity(read, [], store, { version: 1, gladiators: [] });
    assert.equal(result.marketsScanned, 0);
    assert.equal(reads, 0);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
