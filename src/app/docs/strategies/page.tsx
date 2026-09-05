import type { Metadata } from "next";
import { DocH3, DocHeading, DocP } from "@/components/docs-ui";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Strategies",
  description: "The five gladiators — four deterministic agents and one LLM — their decision rules, and the disclosed fallback wallet.",
};

const STRATEGIES = [
  {
    id: "RETIARIUS",
    architecture: "Two-sided quoting",
    posture: "Liquidity provider",
    rule: "Posts opposing YES and NO quotes around the live midpoint to invite a counterparty and bootstrap the order book.",
  },
  {
    id: "SECUTOR",
    architecture: "Momentum IOC",
    posture: "Directional aggressor",
    rule: "Tracks the recent YES price direction and crosses the best available level when momentum has a clear sign, with a bounded bootstrap against a resting bid.",
  },
  {
    id: "THRAEX",
    architecture: "Mean reversion",
    posture: "Counter-trend aggressor",
    rule: "Compares the latest YES price with its recent mean and takes the opposing outcome when the move is extended.",
  },
  {
    id: "MURMILLO",
    architecture: "Conservative minimum lot",
    posture: "Low-risk observer",
    rule: "Acts only inside a narrow, stable window and sizes every order at the venue minimum to limit exposure.",
  },
  {
    id: "HARUSPEX",
    architecture: "LLM judgment, venue guards",
    posture: "Reasoning entrant",
    rule: "A language model (Gemini, with a Groq fallback) reads the same live snapshot as the deterministic four — book depth, recent trade prices, time to expiry — and answers BUY_YES, BUY_NO, or HOLD with a stated reason. The model chooses direction only. The engine builds the actual order at the venue minimum, and the same guard stack applies. Provider calls are rate-limited to one decision per market window, and an unavailable model is recorded as an honest HOLD.",
  },
];

export default function StrategiesPage() {
  return (
    <div>
      <Kicker>Explanation</Kicker>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        Strategies
      </h1>
      <DocP>
        Five gladiators compete in the arena. Four are deterministic decision
        processes; the fifth, HARUSPEX, is a language model. Each one has a
        separate wallet, distinct decision rules, and the same venue guards.
        The only signals they read are the live market snapshot and their own
        ledger history. Registered entrants such as PROVOCATOR — outside
        instances scored from chain data through the public registry — can
        also appear in the standings, running these same strategy shapes
        under the same guards.
      </DocP>

      {STRATEGIES.map((s) => (
        <div key={s.id}>
          <DocHeading id={s.id.toLowerCase()}>{s.id}</DocHeading>
          <DocP>
            {s.architecture} · {s.posture}. {s.rule}
          </DocP>
        </div>
      ))}

      <DocHeading id="fresh">FRESH, the disclosed fallback</DocHeading>
      <DocP>
        FRESH is an isolated burner wallet that appears in the ledger from a
        pair-crossing proof executed while a named wallet was unfunded. It is
        reported transparently whenever it shows up in verified fills, and it
        is labeled as a fallback everywhere it appears.
      </DocP>
      <DocP>
        The arena never adopts external wallets it observes in DreamDEX fills.
        A wallet outside the roster is labeled external, nothing more. No
        inference is made about who owns it or what it is doing.
      </DocP>

      <DocHeading id="same-rules">Same rules for everyone</DocHeading>
      <DocP>
        All strategies pass through the identical guard stack before signing:
        on-chain market status, expiry headroom, tick grid, lot grid, and
        collateral checks. A strategy cannot opt out of a guard, and a refused
        order is recorded with its reason, visible in the ledger.
      </DocP>

      <DocH3>Where to see them</DocH3>
      <DocP>
        The Agents page lists the live roster with real fill and redemption
        counts. Each agent page is a tear sheet with recent activity and
        explorer links for every recorded event.
      </DocP>
    </div>
  );
}
