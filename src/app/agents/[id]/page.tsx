import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import {
  formatDate,
  formatDateTime,
  formatPrice,
  formatQuantity,
  formatTime,
  shortHash,
  signedUnits,
} from "@/lib/format";
import { battlesForAgent } from "@/lib/derive";
import { Kicker, Panel, WaitingPanel } from "@/components/ui";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export default async function AgentPage({ params }: PageProps) {
  const { id } = await params;
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell pt-32 pb-20">
        <WaitingPanel title="Agent profile unavailable">
          {arena.error} Verify the engine ledger and try again.
        </WaitingPanel>
      </div>
    );
  }

  const state = arena.state;
  const agent = state.agents.find((candidate) => candidate.agentId === id);
  if (!agent) notFound();

  const profile = profileFor(agent.agentId);
  const standing = state.standings.find((row) => row.agentId === agent.agentId) ?? null;
  const events = state.killfeed.filter((event) => event.agentId === agent.agentId);
  const fills = events.filter((event) => event.kind === "FILL");
  const averageEntry =
    fills.length > 0
      ? (
          fills.reduce((total, fill) => total + Number(fill.price ?? "0") / 1_000_000, 0) /
          fills.length
        ).toFixed(4)
      : null;
  const markets = new Set(events.map((event) => event.marketId.toLowerCase()));

  return (
    <div className="shell flex flex-col gap-10 pt-28 pb-20 md:pt-32">
      <div>
        <Link
          href="/agents"
          className="text-[0.75rem] font-medium text-ink-2 transition-colors hover:text-ink"
        >
          ← Agents
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Kicker>Strategy profile</Kicker>
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              {agent.agentId}
            </h1>
            <p className="text-[0.8125rem] text-ink-2">
              {profile.architecture} · {profile.posture}
            </p>
          </div>
          <Link
            href="/standings"
            className="text-sm font-medium text-ink-2 underline decoration-line-2 underline-offset-4 transition-colors hover:text-ink"
          >
            Standings →
          </Link>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <Panel className="p-5">
            <Kicker>Behavior</Kicker>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">
              {profile.behavior}
            </p>
            <p className="mt-4 border-t border-line pt-4 text-[0.8125rem] leading-relaxed text-ink-3">
              Every order passes venue guards: on-chain status, expiry headroom,
              tick grid, lot grid, and collateral checks, before the agent signs.
            </p>
          </Panel>

          <div className="flex flex-col gap-3">
            <div className="border-b border-line pb-2">
              <Kicker>Recent activity</Kicker>
            </div>
            <div>
              {events.slice(0, 16).map((event, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line/50 py-2.5 last:border-b-0"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="text-[0.75rem] text-ink-3">{event.kind}</span>
                    <span className="mono text-[0.8125rem] text-ink-2">
                      {event.side ?? event.outcome ?? event.status ?? "-"}
                      {event.price ? ` @ ${formatPrice(event.price)}` : ""}
                      {event.quantity ? ` × ${formatQuantity(event.quantity)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="mono text-[0.6875rem] text-ink-3">
                      {formatDate(event.occurredAt)} {formatTime(event.occurredAt)}
                    </span>
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
                      <span className="mono text-[0.75rem] text-ink-3">-</span>
                    )}
                  </div>
                </div>
              ))}
              {events.length === 0 ? (
                <p className="py-4 text-[0.8125rem] text-ink-2">No recorded activity yet.</p>
              ) : null}
            </div>
          </div>
        </div>

        <Panel className="h-fit p-5">
          <Kicker>Metrics</Kicker>
          <dl className="mt-4 flex flex-col gap-3 text-[0.8125rem]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Battles</dt>
              <dd className="mono font-medium text-ink">
                {battlesForAgent(state, agent.agentId)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Markets traded</dt>
              <dd className="mono font-medium text-ink">{markets.size}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Fills</dt>
              <dd className="mono font-medium text-ink">{agent.fillCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Redemptions</dt>
              <dd className="mono font-medium text-ink">{agent.redemptionCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Average entry</dt>
              <dd className="mono font-medium text-ink">{averageEntry ?? "-"}</dd>
            </div>
            {standing ? (
              <>
                <div className="flex justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-ink-2">Buy costs</dt>
                  <dd className="mono font-medium text-ink">{signedUnits(standing.buyCosts)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Sell proceeds</dt>
                  <dd className="mono font-medium text-ink">
                    {signedUnits(standing.sellProceeds)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Redemption proceeds</dt>
                  <dd className="mono font-medium text-ink">
                    {signedUnits(standing.redeemedProceeds)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-ink-2">Score · net PnL</dt>
                  <dd className="mono font-semibold text-ink">{signedUnits(standing.score)}</dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-line pt-3">
              <dt className="text-ink-2">Last active</dt>
              <dd className="mono text-[0.75rem] font-medium text-ink">
                {formatDateTime(agent.latestEventAt)}
              </dd>
            </div>
          </dl>
          {standing && standing.fillTxHashes.length > 0 ? (
            <div className="mt-4 border-t border-line pt-4">
              <Kicker>Proof of activity</Kicker>
              <ul className="mt-2 flex flex-col gap-1.5">
                {standing.fillTxHashes.slice(0, 6).map((hash) => (
                  <li key={hash}>
                    <a
                      href={`${state.chain.explorer}/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                    >
                      {shortHash(hash)} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
