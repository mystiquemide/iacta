import assert from "node:assert/strict";
import test from "node:test";
import { buildRecomputeReport, formatRecomputeOutput, verifyReceiptStatuses } from "./recompute-report.js";
import type { FillRecord, RedemptionRecord } from "./store.js";

const marketId = `0x${"a".repeat(64)}`;

const fill: FillRecord = {
  marketId,
  agentId: "SECUTOR",
  poolAddress: "0xpool",
  side: "BUY_YES",
  price: "200000",
  quantity: "1000",
  txHash: "0xbuy",
  fillPath: "book",
};

const redemption: RedemptionRecord = {
  marketId,
  agentId: "SECUTOR",
  proceeds: "750",
  outcome: "YES",
  txHash: "0xredeem",
};

test("recompute report exposes exact scores, quote scales, and tx sources", () => {
  const report = buildRecomputeReport(
    ["RETIARIUS", "SECUTOR"],
    [fill],
    [redemption],
    new Map([[marketId, 6]]),
  );

  assert.deepEqual(report, {
    quoteOneByMarket: { [marketId]: "1000000" },
    source: {
      fillCount: 1,
      redemptionCount: 1,
      transactionHashes: ["0xbuy", "0xredeem"],
    },
    standings: [
      {
        agentId: "SECUTOR",
        score: "550",
        redeemedProceeds: "750",
        sellProceeds: "0",
        buyCosts: "200",
        redemptionTxHashes: ["0xredeem"],
        fillTxHashes: ["0xbuy"],
      },
      {
        agentId: "RETIARIUS",
        score: "0",
        redeemedProceeds: "0",
        sellProceeds: "0",
        buyCosts: "0",
        redemptionTxHashes: [],
        fillTxHashes: [],
      },
    ],
  });
});

test("recompute report rejects missing or invalid quote decimals", () => {
  assert.throws(
    () => buildRecomputeReport(["SECUTOR"], [fill], [], new Map()),
    /missing quote scale/,
  );
  assert.throws(
    () => buildRecomputeReport(["SECUTOR"], [fill], [], new Map([[marketId, -1]])),
    /quote decimals/,
  );
});

test("receipt status gate checks each unique score transaction", async () => {
  const checked: string[] = [];
  await verifyReceiptStatuses(["0xbuy", "0xbuy", "0xredeem"], {
    getReceipt: async (txHash) => {
      checked.push(txHash);
      return { status: "success" };
    },
  });
  assert.deepEqual(checked, ["0xbuy", "0xredeem"]);

  await assert.rejects(
    () => verifyReceiptStatuses(["0xreverted"], {
      getReceipt: async () => ({ status: "reverted" }),
    }),
    /receipt is not successful/,
  );
});

test("recompute output contains receipt evidence without stale web-route claims", () => {
  const report = buildRecomputeReport(
    ["SECUTOR"],
    [fill],
    [redemption],
    new Map([[marketId, 6]]),
  );

  const output = formatRecomputeOutput(report, (hash) => `https://explorer.test/tx/${hash}`);

  assert.equal("uiComparison" in output, false);
  assert.deepEqual(output.source.explorerTransactions, [
    "https://explorer.test/tx/0xbuy",
    "https://explorer.test/tx/0xredeem",
  ]);
  assert.equal(output.standings[0]?.agentId, "SECUTOR");
});
