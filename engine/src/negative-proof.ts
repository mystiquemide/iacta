import {
  ORDER_TYPE,
  type BinaryBookParams,
} from "@somnia-chain/markets-sdk";
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi, zeroAddress, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import {
  addressFor,
  exchangeFor,
  explorerTx,
  loadLocalEnv,
  maxFeePerGas,
  privateKeyFor,
  writeGasLimit,
} from "./config.js";
import { negativeProofExpiry, revertReasonFromError } from "./negative-proof-policy.js";
import { EventStore, type RoundRecord } from "./store.js";

const SECUTOR = "SECUTOR" as const;
const binaryPoolWriteAbi = parseAbi([
  "function placeBinaryOrder(uint8 kind, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k, uint64 userData)",
]);
const binaryPoolReadAbi = parseAbi([
  "function marketNonce() view returns (uint64)",
]);

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function transactionHash(error: unknown): Hash | null {
  const matches = message(error).match(/0x[0-9a-fA-F]{64}/g);
  const candidate = matches?.at(-1);
  return candidate ? candidate as Hash : null;
}

function validPrice(params: BinaryBookParams, quoteDecimals: number): bigint {
  const quoteOne = 10n ** BigInt(quoteDecimals);
  const tick = params.tickSize > 0n ? params.tickSize : 1n;
  let price = (quoteOne / 2n / tick) * tick;
  if (price <= 0n) price = tick;
  if (price >= quoteOne) price = quoteOne - tick;
  return price;
}

async function finalizedRound(
  exchange: ReturnType<typeof exchangeFor>,
  rounds: readonly RoundRecord[],
): Promise<{ round: RoundRecord; status: number; expiry: bigint; pool: `0x${string}` } > {
  const candidates = [...rounds].sort((left, right) => right.expiry - left.expiry);
  for (const round of candidates) {
    const onchain = await exchange.client.getMarketOnchain(round.marketId as `0x${string}`);
    if (onchain.finalized || onchain.status === 4 || onchain.status === 5) {
      const currentNonce = await exchange.client.getViemClient().readContract({
        address: onchain.pool,
        abi: binaryPoolReadAbi,
        functionName: "marketNonce",
      });
      if (currentNonce !== onchain.nonce) continue;
      return { round, status: onchain.status, expiry: onchain.expiry, pool: onchain.pool };
    }
  }
  throw new Error("No finalized round is available for the locked-market proof");
}

async function main(): Promise<void> {
  loadLocalEnv();
  const exchange = exchangeFor();
  const store = new EventStore();
  const account = addressFor(SECUTOR);
  const signer = privateKeyToAccount(privateKeyFor(SECUTOR));
  const rpcUrl = somniaShannon.rpcUrls.default.http[0];
  const publicClient = createPublicClient({ chain: somniaShannon, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account: signer, chain: somniaShannon, transport: http(rpcUrl) });

  try {
    const selected = await finalizedRound(exchange, store.snapshot().rounds);
    const params = await exchange.client.getBinaryBookParams(selected.pool);
    const quantity = params.minQuantity > 0n ? params.minQuantity : params.lotSize;
    if (quantity <= 0n) throw new Error("The selected finalized round has no valid minimum quantity");
    const price = validPrice(params, selected.round.quoteDecimals);
    const latestBlock = await publicClient.getBlock({ blockTag: "latest" });
    const expireTimestampNs = negativeProofExpiry(latestBlock.timestamp);
    const marketId = selected.round.marketId.toLowerCase();
    const reasonPrefix = `locked-market proof for status ${selected.status}`;

    const data = encodeFunctionData({
      abi: binaryPoolWriteAbi,
      functionName: "placeBinaryOrder",
      args: [0, price, quantity, expireTimestampNs, ORDER_TYPE.POST_ONLY, 0, zeroAddress, 0n, 0n],
    });
    let hash: Hash | null = null;
    let receipt;
    try {
      hash = await walletClient.sendTransaction({
        account: signer,
        to: selected.pool,
        data,
        gas: writeGasLimit(),
        maxFeePerGas: maxFeePerGas(),
        maxPriorityFeePerGas: 0n,
      });
      receipt = await publicClient.waitForTransactionReceipt({ hash });
    } catch (error) {
      hash ??= transactionHash(error);
      if (!hash) throw new Error(`Locked-market proof failed without a transaction hash: ${message(error)}`);
      receipt = await publicClient.getTransactionReceipt({ hash });
    }
    if (receipt.status !== "reverted") {
      throw new Error(`Locked-market proof transaction ${hash} was ${receipt.status}, not reverted`);
    }
    let revertReason = "revert reason unavailable";
    try {
      await publicClient.call({
        account: signer.address,
        to: selected.pool,
        data,
        gas: writeGasLimit(),
        blockNumber: receipt.blockNumber,
      });
    } catch (error) {
      revertReason = revertReasonFromError(error) ?? message(error).slice(0, 240);
    }
    {
      store.recordRefusal({
        marketId,
        agentId: SECUTOR,
        reason: `${reasonPrefix}: ${revertReason}`,
        status: "REFUSED",
        txHash: hash,
      }, { marketId, pool: selected.pool, price: price.toString(), quantity: quantity.toString(), expireTimestampNs: expireTimestampNs.toString(), revertReason, receipt });
      console.log(JSON.stringify({
        agent: SECUTOR,
        account,
        marketId,
        pool: selected.pool,
        marketStatus: selected.status,
        price: price.toString(),
        quantity: quantity.toString(),
        expireTimestampNs: expireTimestampNs.toString(),
        txHash: hash,
        explorer: explorerTx(hash),
        receiptStatus: receipt.status,
        revertReason,
        store: { path: store.path, ...store.counts() },
      }, null, 2));
    }
  } finally {
    exchange.client.stopLive();
    store.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`Negative proof failed: ${message(error)}`);
    process.exit(1);
  });
