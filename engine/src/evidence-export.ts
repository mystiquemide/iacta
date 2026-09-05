import { exchangeFor, explorerTx, loadLocalEnv } from "./config.js";
import { exportEvidence } from "./evidence.js";
import { EventStore } from "./store.js";
import { formatRecomputeOutput, buildRecomputeReport, verifyReceiptStatuses } from "./recompute-report.js";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonSafe(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested, 2);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const store = new EventStore();
  try {
    const exported = exportEvidence(store);
    const exchange = exchangeFor();
    try {
      const snapshot = store.snapshot();
      const quoteDecimals = new Map(snapshot.rounds.map((round) => [round.marketId.toLowerCase(), round.quoteDecimals]));
      const report = buildRecomputeReport([], snapshot.fills, snapshot.redemptions, quoteDecimals);
      await verifyReceiptStatuses(
        report.source.transactionHashes,
        { getReceipt: (txHash) => exchange.client.getViemClient().getTransactionReceipt({ hash: txHash as `0x${string}` }) },
      );
      console.log(jsonSafe({
        exported: exported.path,
        counts: exported.counts,
        receiptStatus: "success",
        standings: formatRecomputeOutput(report, explorerTx).standings.map((row) => ({
          agentId: row.agentId,
          score: row.score,
        })),
      }));
    } finally {
      await exchange.client.stopLive();
    }
  } finally {
    store.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`Evidence export failed: ${message(error)}`);
    process.exit(1);
  });
