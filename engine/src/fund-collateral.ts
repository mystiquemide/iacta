import { EventStore } from "./store.js";
import {
  EXPLORER_URL,
  FUNDABLE_WALLET_ROLES,
  TESTNET_COLLATERAL,
  WALLET_ROLES,
  addressFor,
  exchangeFor,
  privateKeyFor,
  loadLocalEnv,
  writeGasLimit,
  type WalletRole,
} from "./config.js";

function selectedRoles(): WalletRole[] {
  const configured = process.env.IACTA_FUND_ROLES?.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
  const roles = configured?.length ? configured : [...WALLET_ROLES];
  const unknown = roles.filter((role) => !FUNDABLE_WALLET_ROLES.includes(role as WalletRole));
  if (unknown.length > 0) throw new Error(`Unknown wallet role(s): ${unknown.join(", ")}`);
  return roles as WalletRole[];
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<boolean> {
  loadLocalEnv();
  const store = new EventStore();
  const results: Record<string, unknown>[] = [];
  let hasFailure = false;

  try {
    for (const role of selectedRoles()) {
      const exchange = exchangeFor(privateKeyFor(role));
      const address = addressFor(role);
      try {
        if (!TESTNET_COLLATERAL) throw new Error("The SDK testnet collateral address is not configured");
        const before = await exchange.client.getErc20Balance(
          TESTNET_COLLATERAL,
          address,
        );
        const result = await exchange.trader.faucet({ gas: writeGasLimit() });
        if (result.receipt.status !== "success") {
          throw new Error(`collateral faucet reverted in ${result.hash}`);
        }
        const after = await exchange.client.getErc20Balance(
          TESTNET_COLLATERAL,
          address,
        );
        results.push({
          role,
          address,
          before: before.toString(),
          after: after.toString(),
          txHash: result.hash,
          explorer: `${EXPLORER_URL}/tx/${result.hash}`,
        });
      } catch (error) {
        hasFailure = true;
        results.push({ role, address, error: message(error) });
      } finally {
        exchange.client.stopLive();
      }
    }

    console.log(JSON.stringify({ roles: selectedRoles(), results, store: { path: store.path, ...store.counts() } }, null, 2));
    return hasFailure;
  } finally {
    store.close();
  }
}

main()
  .then((hasFailure) => process.exit(hasFailure ? 1 : 0))
  .catch((error: unknown) => {
    console.error(`Collateral funding failed: ${message(error)}`);
    process.exit(1);
  });
