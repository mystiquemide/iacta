import { contractErrorsAbi } from "@somnia-chain/markets-sdk";
import { decodeErrorResult, type Hex } from "viem";

const NANOSECONDS_PER_SECOND = 1_000_000_000n;
const PROOF_HEADROOM_SECONDS = 300n;

export function negativeProofExpiry(nowSeconds: bigint): bigint {
  return (nowSeconds + PROOF_HEADROOM_SECONDS) * NANOSECONDS_PER_SECOND;
}

function revertDataCandidates(error: unknown): Hex[] {
  if (!error || typeof error !== "object") return [];
  const record = error as { data?: unknown; cause?: unknown };
  const candidates: Hex[] = [];
  if (typeof record.data === "string" && /^0x[0-9a-fA-F]+$/.test(record.data)) {
    candidates.push(record.data as Hex);
  }
  if (record.cause) candidates.push(...revertDataCandidates(record.cause));
  return candidates;
}

export function revertReasonFromError(error: unknown): string | null {
  for (const data of revertDataCandidates(error)) {
    try {
      const decoded = decodeErrorResult({ abi: contractErrorsAbi, data });
      return decoded.errorName;
    } catch {
      // Keep looking through nested causes for a decodable payload.
    }
  }
  return null;
}
