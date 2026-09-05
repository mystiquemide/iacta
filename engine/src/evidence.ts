import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EventStore, type EventSnapshot } from "./store.js";

export const EVIDENCE_VERSION = 1;
export const ENGINE_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const DEFAULT_EVIDENCE_PATH = resolve(ENGINE_ROOT, "evidence", "verified-ledger.json");

export interface EvidenceFile {
  version: number;
  exportedAt: string;
  chain: { name: "Somnia Shannon"; id: 50312; explorer: string };
  basis: string;
  counts: { rounds: number; orders: number; fills: number; redemptions: number; refusals: number };
  snapshot: EventSnapshot;
}

export function defaultEvidencePath(): string {
  return process.env.IACTA_EVIDENCE_PATH?.trim() || DEFAULT_EVIDENCE_PATH;
}

export function buildEvidenceFile(snapshot: EventSnapshot, now = new Date()): EvidenceFile {
  return {
    version: EVIDENCE_VERSION,
    exportedAt: now.toISOString(),
    chain: { name: "Somnia Shannon", id: 50312, explorer: "https://shannon-explorer.somnia.network" },
    basis: "Verified ledger export. Every fill and redemption row carries a transaction hash that resolves on the Shannon explorer. Restore it with npm run engine:evidence-restore.",
    counts: {
      rounds: snapshot.rounds.length,
      orders: snapshot.orders.length,
      fills: snapshot.fills.length,
      redemptions: snapshot.redemptions.length,
      refusals: snapshot.refusals.length,
    },
    snapshot,
  };
}

export function exportEvidence(
  store: EventStore,
  path = defaultEvidencePath(),
  now = new Date(),
): { path: string; counts: EvidenceFile["counts"] } {
  const file = buildEvidenceFile(store.snapshot(), now);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { encoding: "utf8" });
  return { path, counts: file.counts };
}

export interface RestoreResult {
  path: string;
  /** Store counts measured after the restore is applied. */
  storeCounts: { rounds: number; orders: number; fills: number; redemptions: number; refusals: number };
  /** Row counts carried by the evidence file itself. */
  evidenceCounts: { rounds: number; orders: number; fills: number; redemptions: number; refusals: number };
}

export function parseEvidenceFile(contents: string): EvidenceFile {
  const parsed = JSON.parse(contents) as Partial<EvidenceFile>;
  if (parsed.version !== EVIDENCE_VERSION) {
    throw new Error(`evidence file version ${String(parsed.version)} is not supported`);
  }
  if (!parsed.snapshot || !Array.isArray(parsed.snapshot.rounds) || !Array.isArray(parsed.snapshot.orders)
    || !Array.isArray(parsed.snapshot.fills) || !Array.isArray(parsed.snapshot.redemptions)
    || !Array.isArray(parsed.snapshot.refusals)) {
    throw new Error("evidence file is missing a complete snapshot");
  }
  return parsed as EvidenceFile;
}

export function restoreEvidence(
  store: EventStore,
  path = defaultEvidencePath(),
): RestoreResult {
  const evidence = parseEvidenceFile(readFileSync(path, "utf8"));
  const snapshot = evidence.snapshot;
  for (const round of snapshot.rounds) store.recordRound(round);
  for (const order of snapshot.orders) store.recordOrder(order);
  for (const fill of snapshot.fills) store.recordFill(fill);
  for (const redemption of snapshot.redemptions) store.recordRedemption(redemption);
  for (const refusal of snapshot.refusals) store.recordRefusal(refusal);
  return {
    path,
    storeCounts: store.counts(),
    evidenceCounts: {
      rounds: snapshot.rounds.length,
      orders: snapshot.orders.length,
      fills: snapshot.fills.length,
      redemptions: snapshot.redemptions.length,
      refusals: snapshot.refusals.length,
    },
  };
}
