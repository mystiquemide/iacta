import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildArenaState, readArenaState } from "./arena-state.js";
import type { EventSnapshot } from "./store.js";

const now = new Date("2026-09-05T00:00:00.000Z");
const marketId = `0x${"a".repeat(64)}`;

function baseSnapshot(): EventSnapshot {
  return {
    rounds: [{
      marketId,
      symbol: "BTC-TEST",
      asset: "BTC",
      status: "Trading",
      tradingStart: 1_000,
      expiry: Math.floor(now.getTime() / 1_000) + 600,
      venueId: "0xvenue",
      poolAddress: "0xpool",
      quoteDecimals: 6,
    }],
    orders: [],
    fills: [{
      marketId,
      agentId: "SECUTOR",
      poolAddress: "0xpool",
      side: "BUY_YES",
      price: "200000",
      quantity: "1000",
      txHash: "0xfill",
      fillPath: "mint",
      occurredAt: "2026-09-04T23:59:00.000Z",
    }],
    redemptions: [{
      marketId,
      agentId: "SECUTOR",
      proceeds: "750",
      outcome: "YES",
      txHash: "0xredeem",
      occurredAt: "2026-09-04T23:59:30.000Z",
    }],
    refusals: [],
  };
}

test("arena state stays offline and labels stored events as history without a heartbeat", () => {
  const state = buildArenaState(baseSnapshot(), null, now);

  assert.equal(state.engine.status, "OFFLINE");
  assert.match(state.engine.reason, /heartbeat/);
  assert.equal(state.round?.marketId, marketId);
  assert.equal(state.agents.find((agent) => agent.agentId === "SECUTOR")?.score, "550");
  assert.equal(state.killfeed[0]?.kind, "REDEMPTION");
  assert.equal(state.killfeed.find((event) => event.kind === "FILL")?.fillPath, "mint");
});

test("arena state reports live only with a fresh heartbeat and a live round", () => {
  const heartbeatAt = new Date(now.getTime() - 5_000).toISOString();
  const state = buildArenaState(baseSnapshot(), heartbeatAt, now);

  assert.equal(state.engine.status, "LIVE");
  assert.equal(state.engine.heartbeatAt, heartbeatAt);
});

test("arena state reports waiting when the engine is healthy between rounds", () => {
  const snapshot = baseSnapshot();
  snapshot.rounds[0] = { ...snapshot.rounds[0]!, status: "Finalized", expiry: Math.floor(now.getTime() / 1_000) - 60 };
  const heartbeatAt = new Date(now.getTime() - 5_000).toISOString();
  const state = buildArenaState(snapshot, heartbeatAt, now);

  assert.equal(state.engine.status, "WAITING");
  assert.match(state.engine.reason, /next round/);
});

test("arena state reader loads a heartbeat and closes its store", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-arena-"));
  const databasePath = join(directory, "arena.db");
  const heartbeatPath = join(directory, "heartbeat.json");
  const heartbeatAt = new Date(now.getTime() - 5_000).toISOString();
  writeFileSync(heartbeatPath, JSON.stringify({ heartbeatAt }), { mode: 0o600 });

  try {
    const state = readArenaState(databasePath, heartbeatPath, now);
    assert.equal(state.engine.status, "WAITING");
    assert.equal(state.counts.rounds, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("arena state ignores a dry-run heartbeat", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-arena-dry-run-"));
  const databasePath = join(directory, "arena.db");
  const heartbeatPath = join(directory, "heartbeat.json");
  const heartbeatAt = new Date(now.getTime() - 5_000).toISOString();
  writeFileSync(heartbeatPath, JSON.stringify({ heartbeatAt, mode: "DRY_RUN" }), { mode: 0o600 });

  try {
    const state = readArenaState(databasePath, heartbeatPath, now);
    assert.equal(state.engine.status, "OFFLINE");
    assert.match(state.engine.reason, /heartbeat/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("arena state exposes recorded rounds newest first with honest live flags", () => {
  const snapshot = baseSnapshot();
  snapshot.rounds.push({
    ...snapshot.rounds[0]!,
    marketId: `0x${"b".repeat(64)}`,
    symbol: "BTC-OLDER",
    expiry: snapshot.rounds[0]!.expiry - 900,
    status: "Finalized",
  });

  const state = buildArenaState(snapshot, null, now);

  assert.deepEqual(state.rounds.map((round) => round.marketId), [marketId, `0x${"b".repeat(64)}`]);
  assert.equal(state.rounds[0]?.isLive, false);
  assert.equal(state.rounds[1]?.status, "Finalized");
});
