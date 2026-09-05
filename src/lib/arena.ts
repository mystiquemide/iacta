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

export type ArenaLoadResult =
  | { ok: true; state: ArenaState }
  | { ok: false; error: string };

export async function loadArenaState(): Promise<ArenaLoadResult> {
  try {
    return { ok: true, state: (await loadEngine()).readArenaState() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Arena state is unavailable.",
    };
  }
}

export async function readEngineArenaState(): Promise<ArenaState> {
  return (await loadEngine()).readArenaState();
}
