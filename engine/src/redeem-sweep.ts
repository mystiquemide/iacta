import {
  addressFor,
  exchangeFor,
  explorerTx,
  FUNDABLE_WALLET_ROLES,
  loadLocalEnv,
  privateKeyFor,
  type WalletRole,
} from "./config.js";
import { sweepRole } from "./redemption-runner.js";
import { EventStore } from "./store.js";

const DEFAULT_ROLES = ["RETIARIUS", "SECUTOR", "THRAEX", "MURMILLO"] as const;
const DEFAULT_READ_TIMEOUT_MS = 15_000;
const DEFAULT_WRITE_TIMEOUT_MS = 60_000;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonSafe(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested, 2);
}

function selectedRoles(): WalletRole[] {
  const configured = process.env.IACTA_REDEEM_ROLES
    ?.split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const roles = configured?.length ? configured : [...DEFAULT_ROLES];
  const unknown = roles.filter((role) => !FUNDABLE_WALLET_ROLES.includes(role as WalletRole));
  if (unknown.length > 0) throw new Error(`Unknown redemption wallet role(s): ${unknown.join(", ")}`);
  return roles as WalletRole[];
}

async function main(): Promise<boolean> {
  loadLocalEnv();
  const dryRun = process.argv.includes("--dry-run");
  const configuredTimeout = Number(process.env.IACTA_REDEEM_READ_TIMEOUT_MS ?? DEFAULT_READ_TIMEOUT_MS);
  const readTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_READ_TIMEOUT_MS;
  const configuredWriteTimeout = Number(process.env.IACTA_REDEEM_WRITE_TIMEOUT_MS ?? DEFAULT_WRITE_TIMEOUT_MS);
  const writeTimeoutMs = Number.isFinite(configuredWriteTimeout) && configuredWriteTimeout > 0
    ? configuredWriteTimeout
    : DEFAULT_WRITE_TIMEOUT_MS;
  const store = new EventStore();
  const results: Record<string, unknown>[] = [];
  let hasFailure = false;

  try {
    for (const role of selectedRoles()) {
      const exchange = exchangeFor(privateKeyFor(role));
      const account = addressFor(role);
      try {
        const result = await sweepRole(role, exchange, store, {
          dryRun,
          readTimeoutMs,
          writeTimeoutMs,
        });
        results.push({
          ...result,
          ...(result.status === "REDEEMED" ? { explorer: explorerTx(result.txHash) } : {}),
        });
      } catch (error) {
        hasFailure = true;
        results.push({ role, account, error: message(error) });
      } finally {
        exchange.client.stopLive();
      }
    }

    console.log(jsonSafe({
      dryRun,
      roles: selectedRoles(),
      results,
      store: { path: store.path, ...store.counts() },
    }));
    return hasFailure;
  } finally {
    store.close();
  }
}

main()
  .then((hasFailure) => process.exit(hasFailure ? 1 : 0))
  .catch((error: unknown) => {
    console.error(`Redemption sweep failed: ${message(error)}`);
    process.exit(1);
  });
