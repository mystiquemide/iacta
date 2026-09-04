import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EventStore } from "./store.js";

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
