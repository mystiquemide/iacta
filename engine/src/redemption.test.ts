import assert from "node:assert/strict";
import test from "node:test";
import type { ClaimablePosition } from "@somnia-chain/markets-sdk";
import { encodeAbiParameters, encodeEventTopics, parseAbi, type Hex } from "viem";
import {
  decodeRedemptionReceipt,
  executeRedemptionPlan,
  planRedemption,
  summarizeRedemptionReceipt,
  sweepAgent,
} from "./redemption.js";

const marketA = `0x${"a".repeat(64)}`;
const marketB = `0x${"b".repeat(64)}`;
const account = `0x${"1".repeat(40)}`;
const settlement = `0x${"3".repeat(40)}`;
const redemptionAbi = parseAbi([
  "event Redeemed(uint256 indexed marketKey, address indexed holder, address indexed to, uint8 outcomeIdx, uint256 amountBurned, uint256 collateralOut)",
]);

function position(
  marketId: string,
  outcomeIdx: 0 | 1,
  amount: bigint,
  estPayout: bigint,
): ClaimablePosition {
  return {
    marketId,
    pool: `0x${"2".repeat(40)}`,
    outcomeIdx,
    amount,
    estPayout,
    status: "Resolved",
  };
}

function redeemedLog(
  marketId: string,
  outcomeIdx: 0 | 1,
  amountBurned: bigint,
  collateralOut: bigint,
): { address: string; topics: readonly Hex[]; data: Hex } {
  return {
    address: settlement,
    topics: [...encodeEventTopics({
      abi: redemptionAbi,
      eventName: "Redeemed",
      args: {
        marketKey: BigInt(marketId),
        holder: account as `0x${string}`,
        to: account as `0x${string}`,
      },
    })] as readonly Hex[],
    data: encodeAbiParameters(
      [{ type: "uint8" }, { type: "uint256" }, { type: "uint256" }],
      [outcomeIdx, amountBurned, collateralOut],
    ),
  };
}

test("redemption planner sorts and combines claimable entries deterministically", () => {
  const plan = planRedemption("SECUTOR", account, [
    position(marketB, 1, 100n, 90n),
    position(marketA, 0, 1_000n, 900n),
    position(marketA, 1, 200n, 100n),
    position(marketA, 0, 500n, 450n),
  ]);

  assert.deepEqual(plan, {
    agentId: "SECUTOR",
    account,
    entries: [
      { marketId: marketA, outcomeIdx: 0, amount: 1_500n },
      { marketId: marketA, outcomeIdx: 1, amount: 200n },
      { marketId: marketB, outcomeIdx: 1, amount: 100n },
    ],
    estimatedProceeds: 1_540n,
  });
});

test("redemption decoder extracts only settlement payouts for the swept account", () => {
  const events = decodeRedemptionReceipt([
    {
      address: `0x${"4".repeat(40)}`,
      topics: [],
      data: "0x",
    },
    redeemedLog(marketA, 0, 1_000n, 890n),
  ], settlement, account);

  assert.deepEqual(events, [{
    marketId: marketA,
    outcomeIdx: 0,
    amountBurned: 1_000n,
    collateralOut: 890n,
  }]);
});

test("redemption planner returns no write plan when nothing is claimable", () => {
  assert.equal(planRedemption("SECUTOR", account, []), null);
  assert.equal(planRedemption("SECUTOR", account, [position(marketA, 0, 0n, 0n)]), null);
});

test("redemption planner rejects malformed market identifiers and payouts", () => {
  assert.throws(
    () => planRedemption("SECUTOR", account, [position("0xshort", 0, 100n, 90n)]),
    /market identifier/,
  );
  assert.throws(
    () => planRedemption("SECUTOR", account, [position(marketA, 0, 100n, -1n)]),
    /estimated payout/,
  );
});

test("redemption receipt verifier matches every planned entry and sums actual payouts", () => {
  const plan = planRedemption("SECUTOR", account, [
    position(marketA, 0, 1_000n, 900n),
    position(marketB, 1, 200n, 180n),
  ]);
  assert.ok(plan);

  const summary = summarizeRedemptionReceipt(plan, [
    { marketId: marketB, outcomeIdx: 1, amountBurned: 200n, collateralOut: 170n },
    { marketId: marketA, outcomeIdx: 0, amountBurned: 1_000n, collateralOut: 890n },
  ]);

  assert.deepEqual(summary, {
    proceeds: 1_060n,
    marketIds: [marketA, marketB],
    outcomes: ["YES", "NO"],
  });
});

test("redemption receipt verifier rejects missing or mismatched events", () => {
  const plan = planRedemption("SECUTOR", account, [position(marketA, 0, 1_000n, 900n)]);
  assert.ok(plan);

  assert.throws(
    () => summarizeRedemptionReceipt(plan, []),
    /event count/,
  );
  assert.throws(
    () => summarizeRedemptionReceipt(plan, [{
      marketId: marketA,
      outcomeIdx: 0,
      amountBurned: 999n,
      collateralOut: 890n,
    }]),
    /amount burned/,
  );
});

test("redemption execution dry-run never calls the writer", async () => {
  const plan = planRedemption("SECUTOR", account, [position(marketA, 0, 1_000n, 900n)]);
  assert.ok(plan);
  let writeCalls = 0;

  const result = await executeRedemptionPlan(plan, {
    dryRun: true,
    redeemMany: async () => {
      writeCalls += 1;
      return { hash: "0xunexpected", receipt: { status: "success" } };
    },
    verifyReceipt: () => [],
    recordRedemption: () => undefined,
  });

  assert.deepEqual(result, {
    status: "DRY_RUN",
    estimatedProceeds: 900n,
  });
  assert.equal(writeCalls, 0);
});

test("redemption execution records verified collateral out from the receipt", async () => {
  const plan = planRedemption("SECUTOR", account, [position(marketA, 0, 1_000n, 900n)]);
  assert.ok(plan);
  const recorded: unknown[] = [];

  const result = await executeRedemptionPlan(plan, {
    dryRun: false,
    redeemMany: async (entries) => {
      assert.deepEqual(entries, [{ marketId: marketA, outcomeIdx: 0, amount: 1_000n }]);
      return { hash: "0xredeem", receipt: { status: "success" } };
    },
    verifyReceipt: () => [{
      marketId: marketA,
      outcomeIdx: 0 as const,
      amountBurned: 1_000n,
      collateralOut: 890n,
    }],
    recordRedemption: (redemption) => recorded.push(redemption),
  });

  assert.deepEqual(result, {
    status: "REDEEMED",
    estimatedProceeds: 900n,
    proceeds: 890n,
    txHash: "0xredeem",
  });
  assert.deepEqual(recorded, [{
    marketId: marketA,
    agentId: "SECUTOR",
    proceeds: "890",
    outcome: "YES",
    txHash: "0xredeem",
  }]);
});

test("redemption sweep reads claimable positions before deciding whether to write", async () => {
  let readAccount = "";
  let writeCalls = 0;

  const result = await sweepAgent("SECUTOR", account, {
    getClaimable: async (requestedAccount) => {
      readAccount = requestedAccount;
      return [];
    },
  }, {
    dryRun: false,
    redeemMany: async () => {
      writeCalls += 1;
      return { hash: "0xunexpected", receipt: { status: "success" } };
    },
    verifyReceipt: () => [],
    recordRedemption: () => undefined,
  });

  assert.equal(readAccount, account);
  assert.deepEqual(result, {
    agentId: "SECUTOR",
    account,
    claimablePositions: 0,
    status: "EMPTY",
    estimatedProceeds: 0n,
  });
  assert.equal(writeCalls, 0);
});

test("redemption sweep times out a stalled claimable read", async () => {
  await assert.rejects(
    () => sweepAgent("SECUTOR", account, {
      getClaimable: async () => new Promise<ClaimablePosition[]>((resolve) => {
        setTimeout(() => resolve([]), 50);
      }),
    }, {
      dryRun: true,
      readTimeoutMs: 5,
      redeemMany: async () => ({ hash: "0xunexpected", receipt: { status: "success" } }),
      verifyReceipt: () => [],
      recordRedemption: () => undefined,
    }),
    /claimable read timed out/,
  );
});
