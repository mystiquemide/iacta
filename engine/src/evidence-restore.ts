import { isAbsolute, resolve } from "node:path";
import { EventStore } from "./store.js";
import { defaultEvidencePath, restoreEvidence } from "./evidence.js";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonSafe(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested, 2);
}

function main(): void {
  const provided = process.argv.find((value, index) => index > 1 && !value.startsWith("--"))
    ?? defaultEvidencePath();
  const evidencePath = isAbsolute(provided) ? provided : resolve(process.cwd(), provided);
  const store = new EventStore();
  try {
    const restored = restoreEvidence(store, resolve(evidencePath));
    const evidence = restored.evidenceCounts;
    const storeCounts = restored.storeCounts;
    if (storeCounts.rounds < evidence.rounds || storeCounts.orders < evidence.orders
      || storeCounts.fills < evidence.fills || storeCounts.redemptions < evidence.redemptions
      || storeCounts.refusals < evidence.refusals) {
      throw new Error(`restore did not fully apply: store ${JSON.stringify(storeCounts)} evidence ${JSON.stringify(evidence)}`);
    }
    console.log(jsonSafe({
      restoredFrom: restored.path,
      database: store.path,
      evidenceCounts: evidence,
      storeCounts,
      note: storeCounts.rounds > evidence.rounds
        ? "The store also holds rows recorded after the export (for example, from a doctor run). Restore is additive."
        : undefined,
      nextSteps: [
        "npm run engine:recompute-standings",
        "npm run dev",
      ],
    }));
  } finally {
    store.close();
  }
}

try {
  main();
} catch (error) {
  console.error(`Evidence restore failed: ${message(error)}`);
  process.exit(1);
}
