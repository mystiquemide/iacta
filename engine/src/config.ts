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

export const WALLET_ROLES = ["OPS", "RETIARIUS", "SECUTOR", "THRAEX", "MURMILLO"] as const;
export const FUNDABLE_WALLET_ROLES = [...WALLET_ROLES, "FRESH"] as const;
export type WalletRole = (typeof FUNDABLE_WALLET_ROLES)[number];

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
    addresses: SOMNIA_TESTNET_ADDRESSES,
    ...(privateKey ? { privateKey } : {}),
  });
}

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}
