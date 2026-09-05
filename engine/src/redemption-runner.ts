import {
  SOMNIA_TESTNET_ADDRESSES,
  type TxResult,
} from "@somnia-chain/markets-sdk";
import {
  addressFor,
  exchangeFor,
  type WalletRole,
} from "./config.js";
import {
  decodeRedemptionReceipt,
  selectMatchingRedemption,
  sweepAgent,
  type RedemptionPlan,
  type RedemptionReceiptCandidate,
  type RedemptionSweepResult,
  type RedemptionTxResult,
} from "./redemption.js";
import { EventStore } from "./store.js";

export const RECOVERY_BLOCK_WINDOW = 999n;

export function recoveryRange(
  broadcastBlock: bigint,
  latestBlock: bigint,
  window = RECOVERY_BLOCK_WINDOW,
): { fromBlock: bigint; toBlock: bigint } | null {
  const fromBlock = latestBlock > broadcastBlock + window
    ? latestBlock - window
    : broadcastBlock + 1n;
  return fromBlock > latestBlock ? null : { fromBlock, toBlock: latestBlock };
}

async function recoverRecentRedemption(
  exchange: ReturnType<typeof exchangeFor>,
  account: string,
  settlementAddress: string,
  plan: RedemptionPlan,
  broadcastBlock: bigint,
): Promise<RedemptionTxResult | null> {
  const client = exchange.client.getViemClient();
  const latestBlock = await client.getBlockNumber();
  const range = recoveryRange(broadcastBlock, latestBlock);
  if (!range) return null;
  const logs = await client.getLogs({
    address: settlementAddress as `0x${string}`,
    fromBlock: range.fromBlock,
    toBlock: range.toBlock,
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

export interface SweepRoleOptions {
  dryRun: boolean;
  readTimeoutMs: number;
  writeTimeoutMs: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`redemption write timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export async function sweepRole(
  role: WalletRole,
  exchange: ReturnType<typeof exchangeFor>,
  store: EventStore,
  options: SweepRoleOptions,
): Promise<RedemptionSweepResult> {
  const settlementAddress = SOMNIA_TESTNET_ADDRESSES.binarySettlement;
  if (!options.dryRun && !settlementAddress) {
    throw new Error("The SDK does not expose a BinarySettlement address for this network");
  }
  const account = addressFor(role);
  let broadcastBlock: bigint | undefined;
  return sweepAgent(role, account, {
    getClaimable: (requestedAccount) => exchange.client.getClaimable(requestedAccount),
  }, {
    dryRun: options.dryRun,
    readTimeoutMs: options.readTimeoutMs,
    redeemMany: async (entries) => {
      broadcastBlock = await exchange.client.getViemClient().getBlockNumber();
      return withTimeout(
        exchange.trader.redeemMany({ entries: [...entries], autoApprove: true }),
        options.writeTimeoutMs,
      );
    },
    recoverRedemption: async (_error, plan) => {
      if (options.dryRun || !settlementAddress || broadcastBlock === undefined) return null;
      return recoverRecentRedemption(exchange, account, settlementAddress, plan, broadcastBlock);
    },
    verifyReceipt: (receipt) => decodeRedemptionReceipt(
      (receipt as TxResult["receipt"]).logs,
      settlementAddress ?? "",
      account,
    ),
    recordRedemption: (redemption, raw) => store.recordRedemption(redemption, raw),
  });
}
