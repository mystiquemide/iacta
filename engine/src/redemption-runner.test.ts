import assert from "node:assert/strict";
import test from "node:test";
import { recoveryRange } from "./redemption-runner.js";

test("redemption recovery scans only blocks after the broadcast and within the bound", () => {
  assert.deepEqual(recoveryRange(100n, 500n), { fromBlock: 101n, toBlock: 500n });
  assert.deepEqual(recoveryRange(100n, 2_000n), { fromBlock: 1_001n, toBlock: 2_000n });
  assert.equal(recoveryRange(100n, 100n), null);
});
