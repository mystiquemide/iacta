import type { Metadata } from "next";
import { DocH3, DocHeading, DocP } from "@/components/docs-ui";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "How it works",
  description: "The trading loop, event windows, the venue, and the chain.",
};

export default function HowItWorksPage() {
  return (
    <div>
      <Kicker>Explanation</Kicker>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        How it works
      </h1>

      <DocHeading id="loop">The loop</DocHeading>
      <DocP>
        The engine runs a single heartbeat-driven loop. Each cycle it reads the
        live DreamDEX order book for the current market, checks the venue
        guards, asks each strategy for a decision, and places signed orders.
        Every accepted order, fill, and redemption is written to the local
        SQLite ledger with its transaction hash.
      </DocP>
      <DocP>
        The loop is intentionally slow and boring. Reads happen every 15
        seconds, writes are guarded by headroom and gas envelopes, and the
        heartbeat is atomic so a crashed cycle never leaves the arena in a half
        state.
      </DocP>

      <DocHeading id="windows">Event windows</DocHeading>
      <DocP>
        A battle is one event window on one market. Each window has a trading
        start, an expiry, and a settlement state. While a window is live, the
        strategies can quote and cross. After expiry, winning positions are
        redeemed through the venue, and the redemption receipts are what
        actually move the score.
      </DocP>
      <DocP>
        The console header shows the market id, the underlying asset, the full
        window in UTC, the current state, and a countdown to expiry.
      </DocP>

      <DocHeading id="venue">The venue: DreamDEX</DocHeading>
      <DocP>
        IACTA does not deploy custom market contracts. DreamDEX already
        supplies the market, the pool, the mint-a-pair path, settlement, and
        redemption. The arena adds two things: the strategy loop that trades,
        and the receipt ledger that scores.
      </DocP>
      <DocP>
        This is a deliberate choice. Using the sponsor venue as the only
        contract surface keeps the explorer as the single audit log, and keeps
        the arena honest about what it actually built.
      </DocP>

      <DocHeading id="guards">Venue guards</DocHeading>
      <DocP>
        Before any order is signed, the engine checks on-chain market status,
        expiry headroom, the tick grid, the lot grid, and collateral
        availability. An order that fails any guard is recorded as a refusal
        with a reason, and nothing is sent to the chain.
      </DocP>

      <DocHeading id="chain">The chain: Somnia Shannon</DocHeading>
      <DocP>
        Everything trades on Somnia Shannon testnet, chain id 50312. The
        arena reads from the public indexer endpoint and writes through the
        standard RPC. Every transaction the console links to can be opened in
        the Shannon explorer, where the receipt, the block, and the fee are
        visible to anyone.
      </DocP>

      <DocHeading id="ledger">The ledger</DocHeading>
      <DocP>
        The local store records rounds, orders, fills, redemptions, and
        refusals in SQLite. Scores are never stored as facts. They are
        recomputed from the ledger on every request, which is why the
        recompute-standings command and the console always agree.
      </DocP>
      <DocP>
        The store is append-oriented: an event either has a transaction hash
        with a successful receipt, or it does not count. That single rule is
        what makes the scoreboard trustworthy.
      </DocP>

      <DocH3>Related pages</DocH3>
      <DocP>
        See strategies for the decision rules, scoring for the receipt
        invariant, and the HTTP API for reading the same state the console
        renders.
      </DocP>
    </div>
  );
}
