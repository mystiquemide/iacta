import type { Metadata } from "next";
import { CodeBlock, DocHeading, DocP, FieldTable } from "@/components/docs-ui";
import { Callout } from "@/components/docs-ui";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Engine commands",
  description: "Every engine script: doctor, wallets, funding, redemption sweeps, and the loop.",
};

const COMMANDS: { cmd: string; purpose: string; note: string }[] = [
  { cmd: "engine:doctor", purpose: "Read-only health check", note: "Verifies indexer reachability, chain connection, and the venue book surface. Run this first." },
  { cmd: "engine:test", purpose: "Run the test suite", note: "63 tests across store, redemption, strategy, and reconciliation suites." },
  { cmd: "engine:wallets", purpose: "Generate the named wallets", note: "Creates the strategy burner wallets for the roster." },
  { cmd: "engine:fresh-wallet", purpose: "Generate the fallback burner", note: "Creates the isolated FRESH wallet used for the disclosed pair-crossing proof." },
  { cmd: "engine:fund", purpose: "Fund wallets with test collateral", note: "Sends small testnet amounts to the configured wallets." },
  { cmd: "engine:crossing", purpose: "Pair-crossing proof", note: "Executes a guarded crossing proof against the live venue." },
  { cmd: "engine:killtest:a", purpose: "Single-agent IOC proof", note: "On-chain-gated immediate-or-cancel proof run for one agent." },
  { cmd: "engine:loop", purpose: "Run the strategy loop", note: "The heartbeat-driven autonomous loop. Takes the loop asset as an argument, for example BTC." },
  { cmd: "engine:redeem-sweep", purpose: "Redeem settled positions", note: "Plans and executes redemptions. Needs wallet keys. Supports --dry-run to plan without sending." },
  { cmd: "engine:recompute-standings", purpose: "Re-derive all scores", note: "Recomputes every score from receipt-backed ledger rows. Read-only, no keys needed." },
  { cmd: "engine:negative-proof", purpose: "Locked-market refusal proof", note: "Submits one deliberately invalid order to a finalized market and records the on-chain revert. Needs the SECUTOR key and a small amount of testnet gas." },
];

export default function CliPage() {
  return (
    <div>
      <Kicker>Reference</Kicker>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        Engine commands
      </h1>
      <DocP>
        All commands run from the repository root through npm workspaces. The
        engine source lives in the engine workspace and compiles to
        engine/dist. Build it first with the workspace build, which the dev,
        build, and start scripts do automatically.
      </DocP>
      <CodeBlock>{`npm --workspace engine run build
npm run engine:doctor`}</CodeBlock>

      <DocHeading id="commands">Commands</DocHeading>
      <div className="mt-4 overflow-x-auto rounded-xs border border-line">
        <table className="w-full min-w-[640px] text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-line bg-surface-2/50">
              <th className="kicker px-4 py-2 font-medium">Command</th>
              <th className="kicker px-4 py-2 font-medium">Purpose</th>
              <th className="kicker px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {COMMANDS.map((c) => (
              <tr key={c.cmd} className="border-b border-line/60 last:border-b-0">
                <td className="mono px-4 py-2.5 whitespace-nowrap text-ink">{c.cmd}</td>
                <td className="px-4 py-2.5 text-ink-2">{c.purpose}</td>
                <td className="px-4 py-2.5 text-ink-2">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocHeading id="loop-args">Loop arguments</DocHeading>
      <CodeBlock>{`npm run engine:loop -- BTC    # trade the BTC market windows
npm run engine:loop -- ETH    # trade the ETH market windows`}</CodeBlock>

      <DocHeading id="environment">Environment</DocHeading>
      <DocP>
        The engine reads its configuration from environment variables. Copy
        the example file and keep private keys in your server environment
        only. The example file lists public endpoints and safe defaults.
      </DocP>
      <FieldTable
        rows={[
          { name: "SOMNIA_INDEXER_URL", type: "url", note: "Public Somnia Shannon indexer GraphQL endpoint." },
          { name: "SOMNIA_WS_RPC_URL", type: "url", note: "Public WebSocket RPC endpoint." },
          { name: "IACTA_DB_PATH", type: "path", note: "SQLite ledger location. Default ./data/iacta.db." },
          { name: "IACTA_ASSETS", type: "list", note: "Assets the engine tracks, for example BTC,ETH." },
          { name: "IACTA_LOOP_ASSET", type: "string", note: "Default asset for the loop." },
          { name: "IACTA_LOOP_INTERVAL_MS", type: "number", note: "Read cadence in milliseconds. Default 15000." },
          { name: "IACTA_LOOP_READ_TIMEOUT_MS", type: "number", note: "Read timeout. Default 30000." },
          { name: "IACTA_LOOP_WRITE_TIMEOUT_MS", type: "number", note: "Write timeout. Default 60000." },
          { name: "IACTA_WRITE_GAS_LIMIT", type: "number", note: "Small-burner write gas envelope. Default 3000000." },
          { name: "IACTA_MAX_FEE_PER_GAS", type: "number", note: "Fee cap for writes. Default 9000000000." },
        ]}
      />
      <Callout kind="warn" title="Secrets stay local">
        Wallet private keys are never committed. The repository ships only
        public endpoints and defaults in .env.example.
      </Callout>
    </div>
  );
}
