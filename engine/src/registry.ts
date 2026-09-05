import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REGISTRY_VERSION = 1;
export const ENGINE_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const DEFAULT_REGISTRY_PATH = resolve(ENGINE_ROOT, "registry.json");

/**
 * A gladiator entered through open registration. The registry maps a wallet
 * address to a public identity so on-chain fills can be attributed without
 * trusting any operator: anyone can verify the address traded by reading the
 * explorer, and the score is derived from receipts exactly as for the arena
 * roster.
 */
export interface RegisteredGladiator {
  agentId: string;
  /** Wallet address, lowercased. */
  address: string;
  architecture: string;
  behavior: string;
  posture: string;
  /** Who added the entry — a GitHub handle, a team name, or arena-team. */
  submittedBy: string;
  registeredAt: string;
}

export interface GladiatorRegistry {
  version: number;
  gladiators: RegisteredGladiator[];
}

export function registryPath(): string {
  return process.env.IACTA_REGISTRY_PATH?.trim() || DEFAULT_REGISTRY_PATH;
}

export function parseRegistry(contents: string): GladiatorRegistry {
  const parsed = JSON.parse(contents) as Partial<GladiatorRegistry>;
  if (parsed.version !== REGISTRY_VERSION) {
    throw new Error(`registry version ${String(parsed.version)} is not supported`);
  }
  if (!Array.isArray(parsed.gladiators)) {
    throw new Error("registry is missing the gladiators list");
  }
  const seen = new Set<string>();
  for (const entry of parsed.gladiators) {
    if (!/^[A-Z][A-Z0-9_]{2,15}$/.test(entry.agentId)) {
      throw new Error(`registry agentId "${entry.agentId}" is invalid`);
    }
    if (!/^0x[0-9a-f]{40}$/.test(entry.address)) {
      throw new Error(`registry address for ${entry.agentId} is not a lowercase address`);
    }
    if (seen.has(entry.address)) throw new Error(`registry address ${entry.address} is registered twice`);
    seen.add(entry.address);
  }
  return parsed as GladiatorRegistry;
}

export function emptyRegistry(): GladiatorRegistry {
  return { version: REGISTRY_VERSION, gladiators: [] };
}

export function loadRegistry(path = registryPath()): GladiatorRegistry {
  if (!existsSync(path)) return emptyRegistry();
  return parseRegistry(readFileSync(path, "utf8"));
}

export function registryByAddress(
  registry: GladiatorRegistry,
): Map<string, RegisteredGladiator> {
  return new Map(registry.gladiators.map((entry) => [entry.address, entry]));
}
