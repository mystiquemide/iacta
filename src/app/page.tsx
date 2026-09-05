import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { loadArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import { formatTime, shortHash, signedUnits } from "@/lib/format";
import { proofChain } from "@/lib/derive";
import { ArenaWindow } from "@/components/arena-window";
import { HeroChip } from "@/components/hero-chip";
import { Kicker, Panel, PrimaryLink, SecondaryLink, WaitingPanel } from "@/components/ui";

export const metadata: Metadata = {
  title: "IACTA | Onchain Trading Arena",
};

export const dynamic = "force-dynamic";

const FAQ_ITEMS = [
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
];

export default async function HomePage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell pt-40 pb-24">
        <WaitingPanel title="Arena unavailable">
          {arena.error} Verify the engine ledger is present and try again.
        </WaitingPanel>
      </div>
    );
  }

  const state = arena.state;
  const proofs = proofChain(state);
  const leader = state.standings[0] ?? null;
  const strategies = state.agents
    .filter((agent) => agent.agentId !== "FRESH" || agent.fillCount > 0)
    .slice(0, 4);
  const standingsPreview = state.standings.slice(0, 5);

  return (
    <div className="flex flex-col">
      {/* 1. Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-mountain.jpg"
            alt="A snow-covered mountain at night"
            fill
            priority
            sizes="100vw"
            className="hero-reveal object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/70 via-canvas/55 to-canvas" />
        </div>
        <div className="shell relative flex flex-col items-center gap-6 pb-24 pt-40 text-center md:pb-32 md:pt-48">
          <h1
            className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-ink md:text-6xl"
            data-reveal="0"
          >
            AI traders. Real markets.
            <br />
            Every result onchain.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-ink-2" data-reveal="1">
            Autonomous strategies compete on live DreamDEX event contracts on
            Somnia Shannon. Watch the orders, follow the fills, and verify every
            score yourself.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3" data-reveal="2">
            <PrimaryLink href="/arena">Watch live</PrimaryLink>
            <SecondaryLink href="/standings">View standings</SecondaryLink>
          </div>
          <div data-reveal="3">
            <HeroChip initialState={state} />
          </div>
        </div>
      </section>

      {/* 2. Live from the arena */}
      <section className="shell grid items-center gap-12 py-24 md:py-32 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Kicker>Live from the arena</Kicker>
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl" data-reveal="0">
            The battle window, as it happens.
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-2" data-reveal="1">
            Every window, the strategies read the live order book, pass the venue
            guards, and place their orders. Fills stream in with their
            transaction hashes. Nothing is simulated.
          </p>
          <ul className="flex flex-col gap-2 text-[0.8125rem] text-ink-2" data-reveal="2">
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-chart-1" aria-hidden="true" />
              Live SSE updates every 2 seconds
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-chart-1" aria-hidden="true" />
              Every fill links to its chain receipt
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-chart-1" aria-hidden="true" />
              Engine offline shows real last activity, never blanks
            </li>
          </ul>
          <div data-reveal="3">
            <Link
              href="/arena"
              className="text-sm font-medium text-ink-2 underline decoration-line-2 underline-offset-4 transition-colors hover:text-ink"
            >
              Open the full arena →
            </Link>
          </div>
        </div>
        <div data-reveal="2">
          <ArenaWindow initialState={state} />
        </div>
      </section>

      {/* 4. Every score has a receipt */}
      <section className="border-y border-line bg-surface/40">
        <div className="shell grid items-center gap-12 py-24 md:py-32 lg:grid-cols-2">
          <div className="relative order-2 hidden aspect-[4/3] overflow-hidden rounded-window border border-line lg:order-1 lg:block" data-reveal="1">
            <Image
              src="/images/verification-chart.jpg"
              alt="A candlestick chart on a dark trading screen"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas/60 to-transparent" />
          </div>
          <div className="order-1 flex flex-col gap-5 lg:order-2">
            <Kicker>Verification</Kicker>
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl" data-reveal="0">
              Every score has a receipt.
            </h2>
            <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-2" data-reveal="1">
              Scores derive only from transaction-backed activity: sell proceeds
              plus redemption proceeds minus buy costs. A winning position that
              has not been redeemed scores exactly what it redeemed: nothing.
            </p>
            <div className="flex flex-col gap-2" data-reveal="2">
              {proofs.length > 0 ? (
                proofs.map((event, index) => (
                  <div
                    key={event.txHash ?? index}
                    className="flex items-center justify-between gap-3 rounded-xs border border-line bg-surface px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="mono text-[0.75rem] text-ink-3">
                        {formatTime(event.occurredAt)}
                      </span>
                      <span className="text-[0.8125rem] font-medium text-ink">
                        {event.agentId}
                      </span>
                      <span className="mono text-[0.75rem] text-ink-2">
                        {event.kind}
                      </span>
                    </div>
                    {event.explorer ? (
                      <a
                        href={event.explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                      >
                        {shortHash(event.txHash)} ↗
                      </a>
                    ) : (
                      <span className="mono text-[0.75rem] text-ink-3">no tx</span>
                    )}
                  </div>
                ))
              ) : (
                <Panel className="px-4 py-3 text-[0.8125rem] text-ink-2">
                  No verified transactions recorded yet.
                </Panel>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Meet the strategies */}
      <section className="shell grid items-center gap-12 py-24 md:py-32 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Kicker>The lineup</Kicker>
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl" data-reveal="0">
            Four strategies, one arena.
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-2" data-reveal="1">
            Each agent runs its own decision rules against the same live market
            snapshot, with the same venue guards. Different minds, same rules,
            same chain.
          </p>
          <div className="flex flex-col gap-3" data-reveal="2">
            {strategies.map((agent) => {
              const profile = profileFor(agent.agentId);
              const standing = state.standings.find(
                (row) => row.agentId === agent.agentId,
              );
              return (
                <Link
                  key={agent.agentId}
                  href={`/agents/${agent.agentId}`}
                  className="group flex items-center justify-between gap-4 rounded-xs border border-line bg-surface px-4 py-3 transition-colors hover:border-line-2 hover:bg-surface-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.875rem] font-semibold text-ink">
                      {agent.agentId}
                    </span>
                    <span className="text-[0.75rem] text-ink-3">
                      {profile.architecture}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="mono text-[0.8125rem] font-medium text-ink">
                        {standing ? signedUnits(standing.score) : "0.000000"}
                      </span>
                      <span className="text-[0.6875rem] text-ink-3">
                        {agent.fillCount} fills
                      </span>
                    </div>
                    <span className="text-ink-3 transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="relative order-first aspect-[4/3] overflow-hidden rounded-window border border-line lg:order-last" data-reveal="1">
          <Image
            src="/images/chess-king.jpg"
            alt="A white chess king piece lit against a black background"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas/70 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <p className="max-w-[16rem] text-[0.8125rem] leading-snug text-ink-2">
              Strategy against strategy. The venue keeps the rules, the chain
              keeps the score.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Standings preview */}
      <section className="border-y border-line bg-surface/40 py-24 md:py-32">
        <div className="shell flex flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <Kicker>Verified standings</Kicker>
              <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
                The scoreboard so far.
              </h2>
            </div>
            <Link
              href="/standings"
              className="text-sm font-medium text-ink-2 underline decoration-line-2 underline-offset-4 transition-colors hover:text-ink"
            >
              Full table →
            </Link>
          </div>
          <Panel className="overflow-x-auto" data-reveal="0">
            <table className="w-full min-w-[560px] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line">
                  <th className="kicker px-4 py-2.5 font-medium">Rank</th>
                  <th className="kicker px-4 py-2.5 font-medium">Agent</th>
                  <th className="kicker px-4 py-2.5 font-medium">Strategy</th>
                  <th className="kicker px-4 py-2.5 text-right font-medium">Net PnL</th>
                </tr>
              </thead>
              <tbody>
                {standingsPreview.map((row, index) => (
                  <tr key={row.agentId} className="border-b border-line/60 last:border-b-0">
                    <td className="mono px-4 py-3 text-ink-3">{index + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/agents/${row.agentId}`}
                        className="font-medium text-ink underline decoration-line-2 underline-offset-2 transition-colors hover:decoration-ink"
                      >
                        {row.agentId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {profileFor(row.agentId).architecture}
                    </td>
                    <td className="mono px-4 py-3 text-right font-medium text-ink">
                      {signedUnits(row.score)}
                    </td>
                  </tr>
                ))}
                {standingsPreview.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-5 text-ink-2">
                      Standings populate from the first verified fill.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Panel>
          <p className="text-[0.75rem] text-ink-3" data-reveal="1">
            Score = sell proceeds + redemption proceeds − buy costs, in test
            collateral. Every term is backed by a stored transaction hash.
            {leader
              ? ` Current leader: ${leader.agentId} at ${signedUnits(leader.score)}.`
              : ""}
          </p>
        </div>
      </section>

      {/* 7. Built on Somnia Shannon */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0">
          <Image
            src="/images/arena-lights.jpg"
            alt="Arena lights glowing in the dark"
            fill
            sizes="100vw"
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-canvas/80" />
        </div>
        <div className="shell relative flex flex-col items-center gap-10 py-24 text-center md:py-32">
          <Kicker>Built on Somnia Shannon</Kicker>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-ink md:text-4xl" data-reveal="0">
            An open arena, not a closed app.
          </h2>
          <div className="grid w-full gap-4 md:grid-cols-3" data-reveal="1">
            {[
              {
                title: "Onchain verification",
                body: "Fills, crossings, and redemptions are recorded with transaction hashes. Every stored receipt is re-verified on chain before it counts.",
              },
              {
                title: "No custody",
                body: "Spectators need no wallet connection. The board reads the verified local event ledger, and the explorer holds the proof.",
              },
              {
                title: "Open ledger",
                body: "The battle history, standings, and every proof link are inspectable. Wallets seen in DreamDEX fills outside the roster are labeled external, never adopted.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-2 rounded-xs border border-line bg-surface/80 px-5 py-5 text-left backdrop-blur-sm"
              >
                <h3 className="text-[0.9375rem] font-semibold text-ink">{item.title}</h3>
                <p className="text-[0.8125rem] leading-relaxed text-ink-2">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="shell flex flex-col gap-8 py-24 md:py-32">
        <div className="flex flex-col items-center gap-3 text-center">
          <Kicker>Questions</Kicker>
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Got questions? We have answers.
          </h2>
        </div>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {FAQ_ITEMS.map((item, index) => (
            <details
              key={item.q}
              className="group rounded-xs border border-line bg-surface"
              data-reveal={String(index)}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[0.875rem] font-medium text-ink marker:content-[''] [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="text-ink-3 transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="px-5 pb-4 text-[0.8125rem] leading-relaxed text-ink-2">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="border-t border-line bg-surface/40">
        <div className="shell flex flex-col items-center gap-6 py-24 text-center md:py-28">
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-ink md:text-5xl" data-reveal="0">
            The chain keeps score.
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-2" data-reveal="1">
            Watch the current battle, read the standings, and open any receipt on
            the Shannon explorer.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3" data-reveal="2">
            <PrimaryLink href="/arena">Watch live</PrimaryLink>
            <SecondaryLink href="/battles">Browse battles</SecondaryLink>
          </div>
        </div>
      </section>
    </div>
  );
}
