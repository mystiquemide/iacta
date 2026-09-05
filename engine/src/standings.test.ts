import assert from "node:assert/strict";
import test from "node:test";
import { computeStandings } from "./standings.js";
import type { FillRecord, RedemptionRecord } from "./store.js";

const marketId = "0xmarket";
const quoteOneByMarket = new Map([[marketId, 1_000_000n]]);

const fill = (agentId: string, side: FillRecord["side"], price: string, txHash: string): FillRecord => ({
  marketId,
  agentId,
  poolAddress: "0xpool",
  side,
  price,
  quantity: "1000",
  txHash,
  fillPath: "book",
});

const redemption = (agentId: string, proceeds: string, txHash: string): RedemptionRecord => ({
  marketId,
  agentId,
  proceeds,
  outcome: "YES",
  txHash,
});

test("standings apply redeemed proceeds, sell proceeds, and buy costs exactly", () => {
  const rows = computeStandings(
    ["SECUTOR", "RETIARIUS", "MURMILLO"],
    [
      fill("SECUTOR", "BUY_YES", "200000", "0xbuy"),
      fill("RETIARIUS", "BUY_NO", "200000", "0xbuy-no"),
      fill("MURMILLO", "SELL_NO", "700000", "0xsell"),
    ],
    [redemption("SECUTOR", "750", "0xredeem")],
    quoteOneByMarket,
  );

  assert.deepEqual(rows.map((row) => row.agentId), ["SECUTOR", "MURMILLO", "RETIARIUS"]);
  assert.deepEqual(rows.find((row) => row.agentId === "SECUTOR"), {
    agentId: "SECUTOR",
    score: "550",
    redeemedProceeds: "750",
    sellProceeds: "0",
    buyCosts: "200",
    redemptionTxHashes: ["0xredeem"],
    fillTxHashes: ["0xbuy"],
  });
  assert.equal(rows.find((row) => row.agentId === "MURMILLO")?.score, "300");
  assert.equal(rows.find((row) => row.agentId === "RETIARIUS")?.redeemedProceeds, "0");
});

test("standings include a zero redemption amount until a redemption receipt exists", () => {
  const [row] = computeStandings(
    ["SECUTOR"],
    [fill("SECUTOR", "BUY_YES", "200000", "0xbuy")],
    [],
    quoteOneByMarket,
  );

  assert.equal(row?.redeemedProceeds, "0");
  assert.equal(row?.redemptionTxHashes.length, 0);
  assert.equal(row?.score, "-200");
});

test("standings reject score inputs without transaction references", () => {
  assert.throws(
    () => computeStandings(
      ["SECUTOR"],
      [fill("SECUTOR", "BUY_YES", "200000", "")],
      [],
      quoteOneByMarket,
    ),
    /fill transaction hash/,
  );
});

test("standings normalize mixed-case market IDs before joining quote scales", () => {
  const mixedCaseMarketId = `0x${"a".repeat(63)}B`;
  const [row] = computeStandings(
    ["SECUTOR"],
    [{ ...fill("SECUTOR", "BUY_YES", "200000", "0xmixed"), marketId: mixedCaseMarketId }],
    [],
    new Map([[mixedCaseMarketId.toLowerCase(), 1_000_000n]]),
  );

  assert.equal(row?.score, "-200");
});
