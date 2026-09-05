import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketSnapshot,
  collateralRequired,
  bestEffortTradeHistory,
  isAmbiguousOrderError,
  planDecisions,
  planRoleDecisions,
  withTimeout,
  type LoopTradeActivity,
} from "./engine-loop.js";

const baseSnapshot = {
  marketId: `0x${"a".repeat(64)}`,
  poolAddress: `0x${"b".repeat(40)}`,
  status: 1,
  now: 1_000,
  expiry: 2_000,
  quoteDecimals: 6,
  tickSize: 10_000n,
  lotSize: 1_000n,
  minQuantity: 1_000n,
  yesBids: [{ price: 400_000n, quantity: 5_000n }],
  yesAsks: [{ price: 600_000n, quantity: 5_000n }],
};

test("market snapshot keeps chronological trade prices for strategy decisions", () => {
  const activities: LoopTradeActivity[] = [
    { kind: "TRADE", fillPrice: "600000", timestamp: "1002" },
    { kind: "TRADE", fillPrice: "500000", timestamp: "1001" },
    { kind: "STATUS", timestamp: "1000" },
  ];

  const snapshot = buildMarketSnapshot({ ...baseSnapshot, activities });

  assert.deepEqual(snapshot.recentYesPrices, [500_000n, 600_000n]);
  assert.equal(snapshot.quoteOne, 1_000_000n);
  assert.deepEqual(snapshot.yesBids, baseSnapshot.yesBids);
});

test("decision planning invokes every configured gladiator strategy", () => {
  const decisions = planDecisions(["RETIARIUS", "SECUTOR", "THRAEX", "MURMILLO"], buildMarketSnapshot({
    ...baseSnapshot,
    activities: [
      { kind: "TRADE", fillPrice: "400000", timestamp: "1000" },
      { kind: "TRADE", fillPrice: "600000", timestamp: "1001" },
      { kind: "TRADE", fillPrice: "700000", timestamp: "1002" },
    ],
  }));

  assert.deepEqual(decisions.map((decision) => decision.agentId), [
    "RETIARIUS",
    "SECUTOR",
    "THRAEX",
    "MURMILLO",
  ]);
  assert.ok(decisions.some((decision) => decision.action === "ORDER"));
});

test("collateral requirement uses the complementary YES price for BUY_NO", () => {
  assert.equal(collateralRequired("BUY_YES", 1_000_000n, 250_000n, 4_000n), 1_000n);
  assert.equal(collateralRequired("BUY_NO", 1_000_000n, 250_000n, 4_000n), 3_000n);
});

test("fallback FRESH role uses the Retiarius strategy while keeping its own attribution", () => {
  const [planned] = planRoleDecisions(["FRESH"], buildMarketSnapshot({
    ...baseSnapshot,
    activities: [],
  }));

  assert.equal(planned?.role, "FRESH");
  assert.equal(planned?.strategyId, "RETIARIUS");
  assert.equal(planned?.decision.agentId, "RETIARIUS");
});

test("loop reads reject when an indexer promise exceeds the configured timeout", async () => {
  await assert.rejects(
    () => withTimeout(new Promise<void>(() => undefined), 5),
    /timed out after 5ms/,
  );
});

test("slow trade history degrades to an explicit empty history result", async () => {
  const result = await bestEffortTradeHistory(
    () => new Promise<LoopTradeActivity[]>(() => undefined),
    5,
  );

  assert.deepEqual(result.activities, []);
  assert.match(result.warning ?? "", /trade history unavailable/);
});

test("known venue rejections do not pause a wallet, while transport outcomes do", () => {
  assert.equal(isAmbiguousOrderError(new Error("placeBinaryOrder reverted: SelfMatchCancelTaker()")), false);
  assert.equal(isAmbiguousOrderError(new Error("transaction 0xabc123 reverted (no revert data recoverable)")), false);
  assert.equal(isAmbiguousOrderError(new Error("order write timed out after 60000ms")), true);
});
