import type { Metadata } from "next";
import { DocH3, DocHeading, DocP } from "@/components/docs-ui";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Direct answers to the questions judges and spectators ask most.",
};

const FAQ = [
  {
    q: "Is this an AI model?",
    a: "The lineup is four deterministic autonomous strategy processes, not an LLM. Each strategy has a separate wallet, distinct decision rules, and the same order and receipt guards. Every score is recomputed from venue redemption receipts, never self-reported.",
  },
  {
    q: "Are the agents self-dealing?",
    a: "The lineup uses disclosed burner wallets funded on Somnia Shannon testnet. The verified ledger attributes fills to SECUTOR, FRESH, RETIARIUS, and THRAEX. This is transparent testnet order flow, not an adoption claim.",
  },
  {
    q: "Why are there no custom contracts?",
    a: "DreamDEX already supplies the market, pool, mint-a-pair path, settlement, and redemption layer. IACTA adds the strategy loop and the receipt ledger, so the sponsor venue remains the contract surface and the explorer remains the audit log.",
  },
  {
    q: "What does an external participant prove?",
    a: "Only that a wallet appeared as a maker or taker in indexed DreamDEX fills. IACTA does not infer its owner, bot status, or strategy.",
  },
  {
    q: "What happens to unredeemed winnings?",
    a: "Nothing. No redemption, no payout credit. A winning position that has not been redeemed contributes exactly what it redeemed: zero. That invariant is the core of the scoring.",
  },
  {
    q: "Why does the console say Engine offline?",
    a: "Because the engine heartbeat is stale. The strategy loop is not running right now. The console shows the last verified events from the ledger instead of inventing activity. When the loop resumes, live data returns within seconds.",
  },
  {
    q: "Can I trade in the arena?",
    a: "Not through this console. IACTA is a spectator surface over a verified ledger. The strategies are the only participants, and their wallets are disclosed burners on testnet.",
  },
  {
    q: "Where do the prices come from?",
    a: "From real fills on DreamDEX, recorded with transaction hashes. The chart plots YES-equivalent fill prices for the current market window. If there are no fills in a window, the chart says so instead of drawing an invented line.",
  },
];

export default function FaqPage() {
  return (
    <div>
      <Kicker>Reference</Kicker>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        FAQ
      </h1>
      {FAQ.map((item) => (
        <div key={item.q}>
          <DocHeading id={item.q.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}>
            {item.q}
          </DocHeading>
          <DocP>{item.a}</DocP>
        </div>
      ))}
      <DocH3>Still stuck?</DocH3>
      <DocP>
        Open any transaction hash in the Shannon explorer, or re-run the
        verification commands from the quickstart to see the same numbers the
        console shows.
      </DocP>
    </div>
  );
}
