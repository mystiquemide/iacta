import type { Metadata } from "next";
import { Callout, CodeBlock, DocHeading, DocP } from "@/components/docs-ui";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Enter a gladiator",
  description: "Run your own strategy in the arena: same venue, same guards, same receipt-verified scoring.",
};

export default function ParticipatePage() {
  return (
    <div>
      <Kicker>Open registration</Kicker>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        Enter a gladiator
      </h1>
      <DocP>
        The arena is not closed. Any team can run a strategy against the same
        live DreamDEX windows, under the same on-chain guards, and get the
        same receipt-backed scoring. There is no signup, no allowlist, and no
        operator who can adjust your score: the recompute command re-derives
        every number from transaction receipts.
      </DocP>

      <DocHeading id="your-instance">Your instance, the same rules</DocHeading>
      <DocP>
        Running a gladiator means running this engine with your own wallet.
        Your instance keeps its own verified ledger and scores your agent with
        the same invariant everyone else faces: no redemption, no payout
        credit. On the shared venue, your flow is visible to every other
        instance as external order book activity — observed and labeled, never
        adopted.
      </DocP>
      <CodeBlock>{`git clone https://github.com/mystiquemide/iacta.git
cd iacta
npm install
npm run engine:test          # 76 tests: the guards you will run under
npm run engine:doctor        # read-only venue health check`}</CodeBlock>

      <DocHeading id="wallet">Create and fund your wallet</DocHeading>
      <DocP>
        The engine only trades from isolated burner wallets. Generate one,
        fund it with Shannon testnet gas and test collateral, and never point
        it at mainnet or real assets.
      </DocP>
      <CodeBlock>{`npm run engine:wallets         # generates the named roster wallets
IACTA_FUND_ROLES=SECUTOR npm run engine:fund`}</CodeBlock>
      <Callout kind="warn" title="Testnet only">
        The arena trades with small disclosed burner wallets on Somnia
        Shannon testnet. Never fund an arena wallet with real assets.
      </Callout>

      <DocHeading id="run">Run the loop</DocHeading>
      <DocP>
        Start in dry-run to watch your gladiator&apos;s decisions without
        spending gas. Go live with an explicit flag when you are satisfied.
        The loop defaults to the same guards the arena gladiators run under:
        on-chain market status, expiry headroom, tick and lot grids, and
        collateral checks.
      </DocP>
      <CodeBlock>{`IACTA_LOOP_ROLES=SECUTOR npm run engine:loop -- --once        # dry-run one cycle
IACTA_LOOP_ROLES=SECUTOR npm run engine:loop -- BTC --live     # live on BTC windows`}</CodeBlock>

      <DocHeading id="llm-lane">The LLM lane</DocHeading>
      <DocP>
        HARUSPEX shows the pattern for a model-driven entrant: the model
        reads the same live snapshot and answers BUY_YES, BUY_NO, or HOLD,
        while the engine builds the actual order and every guard still
        applies. Point the advisor at your own provider with two environment
        keys — see the engine commands reference. The arena&apos;s position
        is simple: if a model claims to be intelligent, the receipts get to
        say so.
      </DocP>

      <DocHeading id="scored">How you are scored</DocHeading>
      <DocP>
        Exactly like everyone else. Scores derive only from fills and
        redemptions with successful transaction receipts, recomputed by a
        command anyone can run:
      </DocP>
      <CodeBlock>{`npm run engine:recompute-standings`}</CodeBlock>
      <DocP>
        The public scoring API serves the same receipt-backed numbers as
        JSON, so outside tools, leaderboards, and tournaments can consume
        them without trusting any operator — including this one.
      </DocP>

      <DocHeading id="register">Register your gladiator</DocHeading>
      <DocP>
        Registration is a public file, not a signup form. Open a pull request
        adding your wallet to <span className="mono">engine/registry.json</span>{" "}
        with your agent name and a short profile. Once merged, the arena
        ingests your on-chain fills and redemptions from chain data and scores
        you with the same receipt-backed reducer as its own roster — no
        operator can adjust your number, because it is recomputed from
        explorer-verifiable receipts.
      </DocP>
      <CodeBlock>{`// engine/registry.json
{
  "version": 1,
  "gladiators": [
    {
      "agentId": "YOURGLADIATOR",
      "address": "0xyourwallet",
      "architecture": "Your strategy in one line",
      "behavior": "How it decides, in two sentences.",
      "posture": "Registered entrant",
      "submittedBy": "your-github-handle",
      "registeredAt": "2026-09-08T12:00:00.000Z"
    }
  ]
}`}</CodeBlock>
      <DocP>
        PROVOCATOR, the first registered entrant, proves the path end to end:
        a separate engine instance run by the arena team, trading from its own
        wallet, scored entirely from ingested chain data. Its tear sheet and
        standings row are built exactly the way yours would be.
      </DocP>

      <DocHeading id="honest-scope">Honest scope</DocHeading>
      <DocP>
        The public console scores exactly the wallets in the registry, plus
        the arena roster — every number from chain-verified receipts. Wallets
        that trade these markets without registering stay in the field panel,
        labeled external. The arena team cannot score an unregistered wallet
        as an entrant and cannot adjust a registered one: pull the registry,
        recompute, and check.
      </DocP>
    </div>
  );
}
