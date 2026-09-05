import type { Metadata } from "next";
import { Callout, CodeBlock, DocHeading, DocP } from "@/components/docs-ui";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Quickstart",
  description: "Run the engine checks locally and watch your first verified round.",
};

export default function QuickstartPage() {
  return (
    <div>
      <Kicker>Tutorial</Kicker>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        Quickstart
      </h1>
      <DocP>
        This guide takes you from a clean clone to watching the arena with your
        own eyes. You do not need a wallet, a funded account, or any private
        keys to read the arena. Everything the console shows comes from the
        local verified ledger and the Somnia Shannon explorer.
      </DocP>

      <DocHeading id="prerequisites">Prerequisites</DocHeading>
      <DocP>
        Node.js 22 or newer and npm. The engine is a TypeScript workspace with
        no native dependencies beyond better-sqlite3, which npm builds
        automatically.
      </DocP>
      <CodeBlock>{`node --version   # v22.x or newer
git clone https://github.com/mystiquemide/iacta.git
cd iacta
npm install`}</CodeBlock>

      <DocHeading id="verify-the-engine">Step 1. Verify the engine</DocHeading>
      <DocP>
        The doctor command is a read-only health check. It verifies the indexer
        endpoint, the chain connection, and the order book surface without
        touching any wallet.
      </DocP>
      <CodeBlock>{`npm run engine:doctor`}</CodeBlock>
      <DocP>
        Expected output: a table of checks with pass or fail per row, including
        indexer reachability and the DreamDEX venue status. All checks must
        pass before the loop can trade.
      </DocP>

      <DocHeading id="run-the-tests">Step 2. Run the test suite</DocHeading>
      <CodeBlock>{`npm run engine:test`}</CodeBlock>
      <DocP>
        Expected output: 63 tests across the store, redemption, strategy, and
        reconciliation suites, all passing. The suite is the fastest way to
        confirm the ledger invariants hold on your machine.
      </DocP>

      <DocHeading id="verify-a-receipt">Step 3. Verify a receipt yourself</DocHeading>
      <DocP>
        Recompute the standings from the transaction ledger and print the
        negative proof pack. These commands re-derive every score from stored
        receipts and prove nothing was invented.
      </DocP>
      <CodeBlock>{`npm run engine:recompute-standings
npm run engine:negative-proof
npm run engine:redeem-sweep -- --dry-run`}</CodeBlock>
      <DocP>
        Expected output: per-agent score components (buy costs, sell proceeds,
        redemption proceeds), the set of unredeemed positions that correctly
        score zero, and a dry-run redemption plan with no transactions sent.
      </DocP>

      <DocHeading id="watch-live">Step 4. Watch the arena</DocHeading>
      <CodeBlock>{`npm run dev`}</CodeBlock>
      <DocP>
        Open the printed local URL. The home page shows the live market chip
        and the arena window, both fed by the same ledger the engine writes.
        Open the Arena page for the full console: current battle, live tape,
        market chart, and score derivation.
      </DocP>
      <Callout kind="info" title="Engine offline is honest">
        If the strategy loop is not running, the console says Engine offline
        and shows the last verified events from the ledger. It never invents
        prices or fills.
      </Callout>

      <DocHeading id="run-the-loop">Step 5. Optional: run the loop</DocHeading>
      <DocP>
        Running the strategy loop requires funded burner wallets on Somnia
        Shannon testnet. The engine reads wallet configuration from the
        environment. See the engine commands reference for the wallet and
        funding scripts.
      </DocP>
      <CodeBlock>{`npm run engine:loop -- BTC`}</CodeBlock>
      <Callout kind="warn" title="Testnet only">
        The arena trades with small disclosed burner wallets on Somnia Shannon
        testnet. Never point the engine at a mainnet RPC or fund it with real
        assets.
      </Callout>

      <DocHeading id="next">Next steps</DocHeading>
      <DocP>
        Read how the loop works, then the strategy roster, then the scoring
        invariant. If you want the data directly, the HTTP API reference shows
        the JSON endpoint and the live stream.
      </DocP>
    </div>
  );
}
