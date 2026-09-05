import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type {
  ArenaAgent,
  ArenaEngineState,
  ArenaRound,
  ArenaState,
  EngineStatus,
  KillfeedEvent,
  KillfeedKind,
} from "@iacta/engine/dist/arena-state.js";

import type { ArenaState } from "@iacta/engine/dist/arena-state.js";

type EngineModule = typeof import("@iacta/engine/dist/arena-state.js");

// The engine resolves runtime paths from import.meta.url, so it must stay
// out of the bundler. Load it through Node at runtime instead.
async function loadEngine(): Promise<EngineModule> {
  const modulePath = resolve(process.cwd(), "engine", "dist", "arena-state.js");
  const moduleUrl = pathToFileURL(modulePath).href;
  return (await import(
    /* turbopackIgnore: true */ /* webpackIgnore: true */ moduleUrl
  )) as EngineModule;
}

/**
 * Fresh clones have no runtime ledger. The repository ships a verified
 * evidence export (every receipt re-verified on chain at export time), so the
 * console falls back to it and renders real, receipt-backed history instead
 * of an empty state.
 */
async function readBundledEvidence(): Promise<ArenaState | null> {
  try {
    const path = resolve(process.cwd(), "engine", "evidence", "verified-ledger.json");
    if (!existsSync(path)) return null;
    const evidence = JSON.parse(readFileSync(path, "utf8")) as {
      version: number;
      snapshot: Parameters<EngineModule["buildArenaState"]>[0];
    };
    if (evidence.version !== 1) return null;
    const engine = await loadEngine();
    return engine.buildArenaState(evidence.snapshot, null);
  } catch {
    return null;
  }
}

export type ArenaLoadResult =
  | { ok: true; state: ArenaState }
  | { ok: false; error: string };

export async function loadArenaState(): Promise<ArenaLoadResult> {
  try {
    return { ok: true, state: (await loadEngine()).readArenaState() };
  } catch {
    const evidence = await readBundledEvidence();
    if (evidence) return { ok: true, state: evidence };
    return {
      ok: false,
      error: "Arena state is unavailable. Run the engine or restore the verified evidence bundle.",
    };
  }
}

export async function readEngineArenaState(): Promise<ArenaState> {
  try {
    return (await loadEngine()).readArenaState();
  } catch {
    const evidence = await readBundledEvidence();
    if (evidence) return evidence;
    throw new Error("Arena state is unavailable and no verified evidence bundle is present.");
  }
}
