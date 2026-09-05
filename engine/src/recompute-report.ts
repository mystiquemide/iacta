import type { FillRecord, RedemptionRecord } from "./store.js";
import { computeStandings, type StandingRow } from "./standings.js";

export interface RecomputeReport {
  quoteOneByMarket: Record<string, string>;
  source: {
    fillCount: number;
    redemptionCount: number;
    transactionHashes: string[];
  };
  standings: StandingRow[];
}

export interface RecomputeOutput {
  basis: string;
  quoteOneByMarket: Record<string, string>;
  source: RecomputeReport["source"] & {
    explorerTransactions: string[];
    receiptStatus: "success";
  };
  standings: (StandingRow & {
    fillExplorers: string[];
    redemptionExplorers: string[];
  })[];
}

export function formatRecomputeOutput(
  report: RecomputeReport,
  explorer: (txHash: string) => string,
): RecomputeOutput {
  return {
    basis: "Stored fill and redemption events with successful on-chain receipts",
    quoteOneByMarket: report.quoteOneByMarket,
    source: {
      ...report.source,
      explorerTransactions: report.source.transactionHashes.map(explorer),
      receiptStatus: "success",
    },
    standings: report.standings.map((row) => ({
      ...row,
      fillExplorers: row.fillTxHashes.map(explorer),
      redemptionExplorers: row.redemptionTxHashes.map(explorer),
    })),
  };
}

export interface ReceiptStatusReader {
  getReceipt: (txHash: string) => Promise<{ status?: string } | null>;
}

export function buildRecomputeReport(
  agentIds: readonly string[],
  fills: readonly FillRecord[],
  redemptions: readonly RedemptionRecord[],
  quoteDecimalsByMarket: ReadonlyMap<string, number>,
): RecomputeReport {
  const quoteOneByMarket = new Map<string, bigint>();
  for (const [marketId, decimals] of quoteDecimalsByMarket) {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      throw new Error(`quote decimals are invalid for market ${marketId}`);
    }
    quoteOneByMarket.set(marketId.toLowerCase(), 10n ** BigInt(decimals));
  }

  const normalizedFills = fills.map((fill) => ({ ...fill, marketId: fill.marketId.toLowerCase() }));
  const normalizedRedemptions = redemptions.map((redemption) => ({
    ...redemption,
    marketId: redemption.marketId.toLowerCase(),
  }));
  const allAgentIds = [...new Set([
    ...agentIds,
    ...normalizedFills.map((fill) => fill.agentId),
    ...normalizedRedemptions.map((redemption) => redemption.agentId),
  ])];
  const transactionHashes = [...new Set([
    ...normalizedFills.map((fill) => fill.txHash),
    ...normalizedRedemptions.map((redemption) => redemption.txHash),
  ])]
    .filter((hash) => hash.trim())
    .sort();

  return {
    quoteOneByMarket: Object.fromEntries([...quoteOneByMarket.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([marketId, quoteOne]) => [marketId, quoteOne.toString()])),
    source: {
      fillCount: normalizedFills.length,
      redemptionCount: normalizedRedemptions.length,
      transactionHashes,
    },
    standings: computeStandings(allAgentIds, normalizedFills, normalizedRedemptions, quoteOneByMarket),
  };
}

export async function verifyReceiptStatuses(
  transactionHashes: readonly string[],
  reader: ReceiptStatusReader,
): Promise<void> {
  for (const txHash of [...new Set(transactionHashes)]) {
    const receipt = await reader.getReceipt(txHash);
    if (receipt?.status !== "success") {
      throw new Error(`receipt is not successful for ${txHash}`);
    }
  }
}
