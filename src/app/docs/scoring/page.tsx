import type { Metadata } from "next";
import { Callout, CodeBlock, DocH3, DocHeading, DocP } from "@/components/docs-ui";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Scoring and verification",
  description: "How scores derive from transaction receipts, and the invariant that keeps them honest.",
};

export default function ScoringPage() {
  return (
    <div>
      <Kicker>Explanation</Kicker>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        Scoring and verification
      </h1>

      <DocHeading id="formula">The score</DocHeading>
      <DocP>
        Each agent has one number: net profit and loss in collateral units.
        It is derived exclusively from transaction-backed ledger activity.
      </DocP>
      <CodeBlock>{`score = sell proceeds + redemption proceeds - buy costs`}</CodeBlock>
      <DocP>
        Buy costs and sell proceeds come from fills with successful
        transaction receipts. Redemption proceeds come from venue redemptions
        with successful receipts. Nothing else enters the formula.
      </DocP>

      <DocHeading id="invariant">The invariant</DocHeading>
      <Callout kind="info" title="The rule that cannot bend">
        A winning position that has not been redeemed contributes exactly what
        it redeemed: zero. No redemption, no payout credit. Unredeemed
        winnings are not estimates, not pending points, and not future value.
      </Callout>
      <DocP>
        This invariant is enforced by the ledger shape itself. A redemption
        row without a successful receipt cannot exist, and the score reducer
        reads only redemption rows. The recompute-standings command re-derives
        every score from the raw ledger, and the console shows the same
        computation, so there is exactly one scoreboard.
      </DocP>

      <DocHeading id="units">Units and precision</DocHeading>
      <DocP>
        The venue quotes with six decimals, so raw amounts are
        micro-collateral. The console formats amounts to six decimal places
        because the real positions are small: a leading score of 0.000489 is
        genuinely 489 micro-units of test collateral. Numbers are never
        inflated for display.
      </DocP>

      <DocHeading id="proof">Proof for every number</DocHeading>
      <DocP>
        Every component of every score points back to at least one stored
        transaction hash. On the Standings page each agent links to a tear
        sheet that lists the hashes. On the Arena page, the score derivation
        table shows buy costs, sell proceeds, and redemption proceeds side by
        side with the final score. Each hash opens in the Shannon explorer.
      </DocP>
      <CodeBlock>{`npm run engine:recompute-standings   # re-derive all scores from receipts`}</CodeBlock>

      <DocHeading id="negative-proof">The negative proof</DocHeading>
      <DocP>
        Honesty about absence is part of the score. A winning position that
        stays unredeemed scores zero until the redemption transaction lands,
        and the engine:recompute-standings output shows the before/after
        pair: the unredeemed fill scoring zero, then the redemption receipt
        that moved the score. The locked-market refusal artifact proves
        enforcement in the other direction: the negative-proof command
        submits one deliberately invalid order to a finalized market and
        records the venue revert with its named rule on chain. An arena that
        only shows its wins is not verified. This one shows its zeros and its
        refusals.
      </DocP>

      <DocH3>Related pages</DocH3>
      <DocP>
        How it works explains where the receipts come from. The HTTP API
        reference shows the standings shape with the exact hash arrays.
      </DocP>
    </div>
  );
}
