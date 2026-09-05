import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SOMNIA_TESTNET_ADDRESSES,
  SomniaMarkets,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { privateKeyToAccount } from "viem/accounts";

export const EXPLORER_URL = "https://shannon-explorer.somnia.network";
export const INDEXER_URL = process.env.SOMNIA_INDEXER_URL ?? "https://dev.smk.somnia.host/v1/graphql";
export const WS_RPC_URL = process.env.SOMNIA_WS_RPC_URL ?? "wss://api.infra.testnet.somnia.network/ws";
export const TESTNET_COLLATERAL = SOMNIA_TESTNET_ADDRESSES.collateral;
export const WALLET_ENV_PATH = fileURLToPath(new URL("../.env.local", import.meta.url));

// The SDK defaults to a 10M gas ceiling at a 60 gwei fee cap. That envelope is
// safe for a well-funded operator wallet but requires 0.6 STT before the node
// accepts a write. Keep a smaller fixed envelope for the project's burner wallets.
// The order path has reached about 2.7M estimated gas, while the current base
// fee is 6 gwei, so 3M at a 9 gwei cap fits a 0.05 STT top-up.
export const DEFAULT_WRITE_GAS_LIMIT = 3_000_000n;
export const DEFAULT_MAX_FEE_PER_GAS = 9_000_000_000n;

export const WALLET_ROLES = ["OPS", "RETIARIUS", "SECUTOR", "THRAEX", "MURMILLO"] as const;
export const FUNDABLE_WALLET_ROLES = [...WALLET_ROLES, "FRESH"] as const;
export type WalletRole = (typeof FUNDABLE_WALLET_ROLES)[number];

function positiveBigIntEnv(name: string, fallback: bigint): bigint {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer in wei`);
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`${name} must be greater than zero`);
  return parsed;
}

export function writeGasLimit(): bigint {
  return positiveBigIntEnv("IACTA_WRITE_GAS_LIMIT", DEFAULT_WRITE_GAS_LIMIT);
}

export function maxFeePerGas(): bigint {
  return positiveBigIntEnv("IACTA_MAX_FEE_PER_GAS", DEFAULT_MAX_FEE_PER_GAS);
}

function unquote(value: string): string {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }
  return value;
}

export function loadLocalEnv(path = WALLET_ENV_PATH): void {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const name = trimmed.slice(0, separator).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(name) || process.env[name] !== undefined) continue;
    process.env[name] = unquote(trimmed.slice(separator + 1).trim());
  }
}

export function privateKeyFor(role: WalletRole): `0x${string}` {
  loadLocalEnv();
  const name = `IACTA_${role}_PRIVATE_KEY`;
  const value = process.env[name];
  if (!/^0x[0-9a-fA-F]{64}$/.test(value ?? "")) {
    throw new Error(`Missing or invalid ${name} in ${WALLET_ENV_PATH}`);
  }
  return value as `0x${string}`;
}

export function addressFor(role: WalletRole): `0x${string}` {
  return privateKeyToAccount(privateKeyFor(role)).address;
}

export function exchangeFor(privateKey?: `0x${string}`): SomniaMarkets {
  return new SomniaMarkets({
    indexerUrl: INDEXER_URL,
    chain: somniaShannon,
    wsRpcUrl: WS_RPC_URL,
    fees: {
      maxFeePerGas: maxFeePerGas(),
      maxPriorityFeePerGas: 0n,
    },
    addresses: SOMNIA_TESTNET_ADDRESSES,
    ...(privateKey ? { privateKey } : {}),
  });
}

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}
