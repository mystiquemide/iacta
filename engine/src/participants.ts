import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface TradeParticipantActivity {
  marketId: string;
  txHash: string;
  timestamp: string;
  maker: string | null;
  taker: string | null;
}

export interface KnownAgentWallet {
  agentId: string;
  address: string;
}

export interface ExternalParticipant {
  address: string;
  fillCount: number;
  marketIds: string[];
  txHashes: string[];
  lastActivity: string;
}

function validAddress(value: string | null): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(value ?? "");
}

function appendUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function defaultWalletEnvPath(): string {
  const engineRoot = process.cwd().endsWith("/engine") ? process.cwd() : resolve(process.cwd(), "engine");
  return resolve(engineRoot, ".env.local");
}

export function readKnownAgentWallets(path = process.env.IACTA_WALLET_ENV_PATH ?? defaultWalletEnvPath()): KnownAgentWallet[] {
  const wallets = new Map<string, KnownAgentWallet>();
  for (const [name, value] of Object.entries(process.env)) {
    const match = /^IACTA_([A-Z0-9_]+)_ADDRESS$/.exec(name);
    if (match && validAddress(value ?? null)) wallets.set(match[1]!, { agentId: match[1]!, address: value! });
  }
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^IACTA_([A-Z0-9_]+)_ADDRESS=(0x[0-9a-fA-F]{40})\s*$/.exec(line.trim());
      if (match) wallets.set(match[1]!, { agentId: match[1]!, address: match[2]! });
    }
  }
  return [...wallets.values()].sort((left, right) => left.agentId.localeCompare(right.agentId));
}

export function summarizeExternalParticipants(
  activities: readonly TradeParticipantActivity[],
  knownAddresses: readonly string[],
): ExternalParticipant[] {
  const known = new Set(knownAddresses.map((address) => address.toLowerCase()));
  const summaries = new Map<string, ExternalParticipant>();
  for (const activity of activities) {
    const addresses = new Set([activity.maker, activity.taker]
      .filter((address): address is string => validAddress(address))
      .map((address) => address.toLowerCase()));
    for (const address of addresses) {
      if (known.has(address)) continue;
      const summary = summaries.get(address) ?? {
        address,
        fillCount: 0,
        marketIds: [],
        txHashes: [],
        lastActivity: activity.timestamp,
      };
      summary.fillCount += 1;
      appendUnique(summary.marketIds, activity.marketId.toLowerCase());
      appendUnique(summary.txHashes, activity.txHash);
      if (activity.timestamp > summary.lastActivity) summary.lastActivity = activity.timestamp;
      summaries.set(address, summary);
    }
  }
  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      marketIds: [...summary.marketIds].sort(),
      txHashes: [...summary.txHashes].sort(),
    }))
    .sort((left, right) => right.fillCount - left.fillCount
      || right.lastActivity.localeCompare(left.lastActivity)
      || left.address.localeCompare(right.address));
}
