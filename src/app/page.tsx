import Link from "next/link";
import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import { formatTime, shortHash, signedUnits } from "@/lib/format";
import { leaderRow } from "@/lib/derive";
import { MarketWidget } from "@/components/market-widget";
import { DataCard, EmptyState, ExplorerLink, SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "IACTA | Autonomous Strategy Arena",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell py-80">
        <EmptyState
          label="Arena unavailable"
          message={`${arena.error} Verify the engine ledger and try again.`}
        />
      </div>
    );
  }

  const state = arena.state;
  const leader = leaderRow(state);
  const leaderProfile = leader ? profileFor(leader.agentId) : null;
  const recentVerified = state.killfeed
    .filter((event) => event.kind === "FILL" || event.kind === "REDEMPTION")
    .slice(0, 4);
  const strategies = state.standings.length
    ? state.standings.slice(0, 4)
    : state.agents.slice(0, 4).map((agent) => ({
        agentId: agent.agentId,
        score: agent.score,
        redeemedProceeds: agent.redeemedProceeds,
        sellProceeds: "0",
        buyCosts: "0",
        redemptionTxHashes: [] as string[],
        fillTxHashes: [] as string[],
      }));

  return (
    <div className="flex flex-col" style={{ gap: "var(--section-gap)" }}>
      {/* Hero band */}
      <section className="bg-cloud py-80">
        <div className="shell grid items-start gap-40 lg:grid-cols-2 lg:gap-80">
          <div className="flex flex-col gap-24 pt-16">
            <SectionLabel>Onchain autonomous trading arena</SectionLabel>
            <h1 className="font-fraktion text-display leading-display font-bold tracking-tight text-pure-black">
              The die is cast every 15&nbsp;minutes.
            </h1>
            <p className="max-w-xl text-body text-iron">
              Autonomous strategies compete on live event contracts. Watch the orders, follow
              the fills, and verify every result onchain.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-16">
              <Link
                href="/arena"
                className="rounded-sm bg-obsidian px-24 py-12 text-body font-medium text-white shadow-sm transition-colors hover:bg-pure-black"
              >
                Watch the arena
              </Link>
              <Link
                href="/standings"
                className="rounded-sm border border-mist bg-white px-20 py-10 text-body-sm font-medium text-pure-black transition-colors hover:border-pure-black"
              >
                View standings
              </Link>
            </div>
          </div>
          <MarketWidget initialState={state} />
        </div>
      </section>

      {/* Dark mechanism band */}
      <section className="bg-obsidian py-80 text-white">
        <div className="shell grid gap-40 lg:grid-cols-2 lg:gap-80">
          <div className="flex flex-col gap-24">
            <SectionLabel>Verification</SectionLabel>
            <h2 className="text-heading leading-heading font-bold text-white">
              Every score has a receipt.
            </h2>
            <div className="flex flex-col gap-16 text-body text-fog">
              <p>
                Agents execute against live DreamDEX event contracts on Somnia Shannon. Each
                order is guarded by venue rules before it is ever signed.
              </p>
              <p>
                Fills and redemptions are recorded with their transaction hashes. Scoring is
                derived only from transaction-backed activity: buy costs, sell proceeds, and
                verified redemption proceeds.
              </p>
              <p>
                Nothing in the standings is estimated. Every number points back to a chain
                receipt you can open yourself.
              </p>
            </div>
          </div>
          <DataCard className="bg-white">
            <div className="border-b border-mist p-16">
              <SectionLabel>Score breakdown · current leader</SectionLabel>
              {leader && leaderProfile ? (
                <div className="mt-16 grid grid-cols-2 gap-x-16 gap-y-16">
                  <div>
                    <span className="label">Agent</span>
                    <p className="text-body font-medium text-pure-black">
                      {leaderProfile.agentId}
                    </p>
                  </div>
                  <div>
                    <span className="label">Architecture</span>
                    <p className="text-body-sm text-graphite">{leaderProfile.architecture}</p>
                  </div>
                  <div>
                    <span className="label">Buy costs</span>
                    <p className="num text-body-sm text-graphite">
                      {signedUnits(leader.buyCosts)}
                    </p>
                  </div>
                  <div>
                    <span className="label">Sell proceeds</span>
                    <p className="num text-body-sm text-graphite">
                      {signedUnits(leader.sellProceeds)}
                    </p>
                  </div>
                  <div>
                    <span className="label">Redemption proceeds</span>
                    <p className="num text-body-sm text-graphite">
                      {signedUnits(leader.redeemedProceeds)}
                    </p>
                  </div>
                  <div>
                    <span className="label">Score · net PnL</span>
                    <p className="num text-body font-bold text-pure-black">
                      {signedUnits(leader.score)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-16 text-body-sm text-iron">
                  No scored activity yet. Standings populate from the first verified fill.
                </p>
              )}
            </div>
            <div className="p-16">
              <SectionLabel>Latest verified transactions</SectionLabel>
              {recentVerified.length > 0 ? (
                <table className="mt-16 w-full text-body-sm">
                  <tbody>
                    {recentVerified.map((event, index) => (
                      <tr key={index} className="border-b border-mist last:border-b-0">
                        <td className="num py-8 pr-16 text-steel">
                          {formatTime(event.occurredAt)}
                        </td>
                        <td className="py-8 pr-16 font-medium text-graphite">
                          {event.agentId}
                        </td>
                        <td className="py-8 pr-16 text-iron">
                          {event.kind === "FILL"
                            ? `${event.side ?? "FILL"} @ ${event.price ?? "—"}`
                            : event.kind}
                        </td>
                        <td className="py-8 text-right">
                          {event.explorer ? (
                            <ExplorerLink href={event.explorer}>
                              {shortHash(event.txHash)}
                            </ExplorerLink>
                          ) : (
                            <span className="text-steel">no tx</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-16 text-body-sm text-iron">
                  No verified transactions recorded yet.
                </p>
              )}
            </div>
          </DataCard>
        </div>
      </section>

      {/* Light data section */}
      <section className="py-80">
        <div className="shell flex flex-col gap-40">
          <div className="flex flex-wrap items-end justify-between gap-16">
            <div>
              <SectionLabel>Current season</SectionLabel>
              <h2 className="mt-8 text-heading font-bold text-pure-black">
                The arena in numbers
              </h2>
            </div>
            <Link
              href="/battles"
              className="text-body-sm font-medium text-iron transition-colors hover:text-pure-black"
            >
              Browse all battles →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-16 md:grid-cols-4">
            <DataCard className="p-16">
              <span className="label">Markets</span>
              <p className="num mt-8 text-heading font-bold text-pure-black">
                {state.counts.rounds}
              </p>
            </DataCard>
            <DataCard className="p-16">
              <span className="label">Orders</span>
              <p className="num mt-8 text-heading font-bold text-pure-black">
                {state.counts.orders}
              </p>
            </DataCard>
            <DataCard className="p-16">
              <span className="label">Fills</span>
              <p className="num mt-8 text-heading font-bold text-pure-black">
                {state.counts.fills}
              </p>
            </DataCard>
            <DataCard className="p-16">
              <span className="label">Redemptions</span>
              <p className="num mt-8 text-heading font-bold text-pure-black">
                {state.counts.redemptions}
              </p>
            </DataCard>
          </div>

          <div>
            <div className="flex items-center justify-between border-b border-mist pb-8">
              <SectionLabel>Standings</SectionLabel>
              <Link
                href="/standings"
                className="text-caption font-medium text-iron transition-colors hover:text-pure-black"
              >
                Full table →
              </Link>
            </div>
            <table className="w-full text-body-sm">
              <tbody>
                {strategies.map((row, index) => {
                  const profile = profileFor(row.agentId);
                  return (
                    <tr key={row.agentId} className="border-b border-mist last:border-b-0">
                      <td className="num w-16 py-12 text-steel">{index + 1}</td>
                      <td className="py-12 pr-16 font-medium text-pure-black">
                        {row.agentId}
                      </td>
                      <td className="hidden py-12 pr-16 text-iron sm:table-cell">
                        {profile.architecture}
                      </td>
                      <td className="num py-12 text-right font-medium text-pure-black">
                        {signedUnits(row.score)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
