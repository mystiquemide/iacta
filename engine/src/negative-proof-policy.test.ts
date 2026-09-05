import assert from "node:assert/strict";
import test from "node:test";
import { encodeErrorResult } from "viem";
import { contractErrorsAbi } from "@somnia-chain/markets-sdk";
import { negativeProofExpiry, revertReasonFromError } from "./negative-proof-policy.js";

test("negative-proof expiry is future-dated from the chain clock", () => {
  const nowSeconds = 1_000n;
  assert.equal(negativeProofExpiry(nowSeconds), 1_300_000_000_000n);
  assert.ok(negativeProofExpiry(nowSeconds) > nowSeconds * 1_000_000_000n);
});

test("negative-proof decodes a contract error from nested RPC data", () => {
  const data = encodeErrorResult({ abi: contractErrorsAbi, errorName: "TradingNotActive" });
  assert.equal(revertReasonFromError({ cause: { data }}), "TradingNotActive");
});
