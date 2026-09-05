import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEvidenceFile, EVIDENCE_VERSION, parseEvidenceFile, restoreEvidence } from "./evidence.js";
import { EventStore, type EventSnapshot } from "./store.js";

function emptySnapshot(): EventSnapshot {
  return { rounds: [], orders: [], fills: [], redemptions: [], refusals: [] };
}

test("evidence export round-trips through a fresh store and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "iacta-evidence-"));
  try {
    const source = new EventStore(join(dir, "source.db"));
    source.recordRound({
      marketId: `0x${"1".repeat(64)}`,
      symbol: "BTC-UP",
      asset: "BTC",
      status: "Resolved",
      tradingStart: 1_000,
      expiry: 2_000,
      venueId: "0xabc",
      poolAddress: `0x${"2".repeat(40)}`,
      quoteDecimals: 6,
    });
    source.recordOrder({
      marketId: `0x${"1".repeat(64)}`,
      agentId: "SECUTOR",
      poolAddress: `0x${"2".repeat(40)}`,
      side: "BUY_YES",
      orderType: "MARKET",
      status: "success",
      price: "200000",
      quantity: "1000",
      expireTimestampNs: "1500000000000000000",
      txHash: `0x${"3".repeat(64)}`,
      occurredAt: "2026-09-04T22:37:14.460Z",
    });
    source.recordFill({
      marketId: `0x${"1".repeat(64)}`,
      agentId: "SECUTOR",
      poolAddress: `0x${"2".repeat(40)}`,
      side: "BUY_YES",
      price: "200000",
      quantity: "1000",
      makerOrderId: "7",
      txHash: `0x${"3".repeat(64)}`,
      fillPath: "book",
      occurredAt: "2026-09-04T22:37:14.463Z",
    });
    source.recordRedemption({
      marketId: `0x${"1".repeat(64)}`,
      agentId: "SECUTOR",
      proceeds: "1000",
      outcome: "NO",
      txHash: `0x${"4".repeat(64)}`,
      occurredAt: "2026-09-05T06:00:00.000Z",
    });
    source.recordRefusal({
      marketId: `0x${"1".repeat(64)}`,
      agentId: "SECUTOR",
      reason: "locked-market proof for status 5: TradingNotActive",
      status: "REFUSED",
      txHash: `0x${"5".repeat(64)}`,
      occurredAt: "2026-09-05T09:00:00.000Z",
    });

    const evidence = buildEvidenceFile(source.snapshot());
    assert.equal(evidence.version, EVIDENCE_VERSION);
    assert.equal(evidence.counts.fills, 1);
    assert.equal(evidence.counts.refusals, 1);
    const path = join(dir, "verified-ledger.json");
    writeFileSync(path, `${JSON.stringify(evidence)}\n`);

    const target = new EventStore(join(dir, "target.db"));
    const first = restoreEvidence(target, path);
    assert.deepEqual(first.evidenceCounts, { rounds: 1, orders: 1, fills: 1, redemptions: 1, refusals: 1 });
    assert.deepEqual(target.counts(), first.storeCounts);

    const second = restoreEvidence(target, path);
    assert.deepEqual(second.storeCounts, first.storeCounts);
    assert.deepEqual(target.counts(), first.storeCounts);

    target.close();
    source.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an evidence file with an unknown version is rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "iacta-evidence-"));
  try {
    const path = join(dir, "verified-ledger.json");
    writeFileSync(path, JSON.stringify({ ...buildEvidenceFile(emptySnapshot()), version: 99 }));
    const store = new EventStore(join(dir, "store.db"));
    assert.throws(() => restoreEvidence(store, path), /version 99 is not supported/);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an evidence file missing snapshot tables is rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "iacta-evidence-"));
  try {
    const path = join(dir, "verified-ledger.json");
    const file = buildEvidenceFile(emptySnapshot());
    writeFileSync(path, JSON.stringify({ ...file, snapshot: { rounds: [] } }));
    const store = new EventStore(join(dir, "store.db"));
    assert.throws(() => restoreEvidence(store, path), /missing a complete snapshot/);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseEvidenceFile accepts a valid export", () => {
  const parsed = parseEvidenceFile(JSON.stringify(buildEvidenceFile(emptySnapshot())));
  assert.equal(parsed.chain.id, 50312);
  assert.equal(parsed.snapshot.fills.length, 0);
});
