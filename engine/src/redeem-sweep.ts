import {
  SOMNIA_TESTNET_ADDRESSES,
  type TxResult,
} from "@somnia-chain/markets-sdk";
import {
  addressFor,
  exchangeFor,
  explorerTx,
  FUNDABLE_WALLET_ROLES,
  loadLocalEnv,
  privateKeyFor,
  type WalletRole,
} from "./config.js";
import {
  decodeRedemptionReceipt,
  selectMatchingRedemption,
  sweepAgent,
  type RedemptionPlan,
  type RedemptionReceiptCandidate,
  type RedemptionTxResult,
} from "./redemption.js";
import { EventStore } from "./store.js";

const DEFAULT_ROLES = ["RETIARIUS", "SECUTOR", "THRAEX", "MURMILLO"] as const;
const DEFAULT_READ_TIMEOUT_MS = 15_000;
const RECOVERY_BLOCK_WINDOW = 999n;

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

async function recoverRecentRedemption(
  exchange: ReturnType<typeof exchangeFor>,
  account: string,
  settlementAddress: string,
  plan: RedemptionPlan,
  fromBlock: bigint,
): Promise<RedemptionTxResult | null> {
  const client = exchange.client.getViemClient();
  const latest = await client.getBlockNumber();
  const boundedFrom = latest > fromBlock + RECOVERY_BLOCK_WINDOW
    ? latest - RECOVERY_BLOCK_WINDOW
    : fromBlock + 1n;
  if (boundedFrom > latest) return null;
  const logs = await client.getLogs({
    address: settlementAddress as `0x${string}`,
    fromBlock: boundedFrom,
    toBlock: latest,
  });
  const hashes = [...new Set(logs
    .map((log) => log.transactionHash)
    .filter((hash): hash is `0x${string}` => Boolean(hash)))];
  const candidates: RedemptionReceiptCandidate[] = [];
  for (const hash of hashes) {
    const transaction = await client.getTransaction({ hash });
    if (transaction.from.toLowerCase() !== account.toLowerCase()) continue;
    const receipt = await client.getTransactionReceipt({ hash });
    const events = decodeRedemptionReceipt(receipt.logs, settlementAddress, account);
    candidates.push({ hash, receipt, events });
  }
  return selectMatchingRedemption(plan, candidates);
}

async function main(): Promise<boolean> {
  loadLocalEnv();
  const dryRun = process.argv.includes("--dry-run");
  const configuredTimeout = Number(process.env.IACTA_REDEEM_READ_TIMEOUT_MS ?? DEFAULT_READ_TIMEOUT_MS);
  const readTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_READ_TIMEOUT_MS;
  const settlementAddress = SOMNIA_TESTNET_ADDRESSES.binarySettlement;
  if (!dryRun && !settlementAddress) {
    throw new Error("The SDK does not expose a BinarySettlement address for this network");
  }

  const store = new EventStore();
  const results: Record<string, unknown>[] = [];
  let hasFailure = false;

  try {
    for (const role of selectedRoles()) {
      const exchange = exchangeFor(privateKeyFor(role));
      const account = addressFor(role);
      let writeStartBlock: bigint | undefined;
      try {
        const result = await sweepAgent(role, account, {
          getClaimable: (requestedAccount) => exchange.client.getClaimable(requestedAccount),
        }, {
          dryRun,
          readTimeoutMs,
          redeemMany: async (entries) => {
            writeStartBlock = await exchange.client.getViemClient().getBlockNumber();
            return exchange.trader.redeemMany({
              entries: [...entries],
              autoApprove: true,
            });
          },
          recoverRedemption: async (_error, plan) => {
            if (dryRun || !settlementAddress || writeStartBlock === undefined) return null;
            return recoverRecentRedemption(exchange, account, settlementAddress, plan, writeStartBlock);
          },
          verifyReceipt: (receipt) => decodeRedemptionReceipt(
            (receipt as TxResult["receipt"]).logs,
            settlementAddress ?? "",
            account,
          ),
          recordRedemption: (redemption, raw) => store.recordRedemption(redemption, raw),
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
