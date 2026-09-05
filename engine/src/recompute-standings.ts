import {
  BATTLE_AGENT_IDS,
} from "./strategies.js";
import {
  buildRecomputeReport,
  formatRecomputeOutput,
  verifyReceiptStatuses,
} from "./recompute-report.js";
import {
  exchangeFor,
  explorerTx,
  loadLocalEnv,
} from "./config.js";
import { EventStore } from "./store.js";
import type { Hex } from "viem";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonSafe(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested, 2);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const exchange = exchangeFor();
  const store = new EventStore();

  try {
    const snapshot = store.snapshot();
    const marketIds = [...new Set([
      ...snapshot.fills.map((fill) => fill.marketId),
      ...snapshot.redemptions.map((redemption) => redemption.marketId),
    ])];
    const quoteDecimalsByMarket = new Map<string, number>();
    for (const marketId of marketIds) {
      const market = await exchange.client.getBinaryMarket(marketId);
      if (!market) throw new Error(`market ${marketId} is missing from the live indexer`);
      quoteDecimalsByMarket.set(marketId, market.quoteDecimals);
    }

    const agentIds = [...new Set([
      ...BATTLE_AGENT_IDS,
      ...snapshot.fills.map((fill) => fill.agentId),
      ...snapshot.redemptions.map((redemption) => redemption.agentId),
    ])];
    const report = buildRecomputeReport(
      agentIds,
      snapshot.fills,
      snapshot.redemptions,
      quoteDecimalsByMarket,
    );
    await verifyReceiptStatuses(report.source.transactionHashes, {
      getReceipt: (txHash) => exchange.client.getViemClient().getTransactionReceipt({ hash: txHash as Hex }),
    });

    console.log(jsonSafe(formatRecomputeOutput(report, explorerTx)));
  } finally {
    exchange.client.stopLive();
    store.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`Standings recompute failed: ${message(error)}`);
    process.exit(1);
  });
