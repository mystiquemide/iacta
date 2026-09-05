import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import {
  formatDate,
  formatPrice,
  formatQuantity,
  formatTime,
  formatDateTime,
  shortHash,
  signedUnits,
} from "@/lib/format";
import { battlesForAgent } from "@/lib/derive";
import { DataCard, EmptyState, ExplorerLink, SectionLabel } from "@/components/ui";

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
      <div className="shell py-80">
        <EmptyState
          label="Agent profile unavailable"
          message={`${arena.error} Verify the engine ledger and try again.`}
        />
      </div>
    );
  }

  const state = arena.state;
  const agent = state.agents.find((candidate) => candidate.agentId === id);
  if (!agent) notFound();

  const profile = profileFor(agent.agentId);
  const standing =
    state.standings.find((row) => row.agentId === agent.agentId) ?? null;
  const events = state.killfeed.filter((event) => event.agentId === agent.agentId);
  const fills = events.filter((event) => event.kind === "FILL");
  const averageEntry =
    fills.length > 0
      ? (
          fills.reduce(
            (total, fill) => total + Number(fill.price ?? "0") / 1_000_000,
            0,
          ) / fills.length
        ).toFixed(4)
      : null;
  const markets = new Set(events.map((event) => event.marketId.toLowerCase()));

  return (
    <div className="shell py-80">
      <div className="flex flex-col gap-40">
        <div>
          <Link
            href="/agents"
            className="text-caption font-medium text-iron transition-colors hover:text-pure-black"
          >
            ← Agents
          </Link>
          <div className="mt-16 flex flex-wrap items-end justify-between gap-16">
            <div>
              <SectionLabel>Strategy profile</SectionLabel>
              <h1 className="mt-8 text-heading font-bold text-pure-black">
                {agent.agentId}
              </h1>
              <p className="mt-8 text-body-sm text-iron">
                {profile.architecture} · {profile.posture}
              </p>
            </div>
            <Link
              href="/standings"
              className="text-body-sm font-medium text-iron transition-colors hover:text-pure-black"
            >
              Standings →
            </Link>
          </div>
        </div>

        <div className="grid gap-40 lg:grid-cols-3">
          <div className="flex flex-col gap-40 lg:col-span-2">
            <DataCard className="p-16">
              <SectionLabel>Behavior</SectionLabel>
              <p className="mt-8 text-body text-graphite">{profile.behavior}</p>
              <p className="mt-16 border-t border-mist pt-16 text-body-sm text-iron">
                Every order passes venue guards — on-chain status, price grid, and quantity
                grid checks — before the agent signs a transaction.
              </p>
            </DataCard>

            <div>
              <div className="border-b border-mist pb-8">
                <SectionLabel>Recent activity</SectionLabel>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-body-sm">
                  <tbody>
                    {events.slice(0, 16).map((event, index) => (
                      <tr key={index} className="border-b border-mist last:border-b-0">
                        <td className="num py-8 pr-16 text-steel">
                          {formatDate(event.occurredAt)}{" "}
                          {formatTime(event.occurredAt)}
                        </td>
                        <td className="py-8 pr-16 text-caption text-badge-slate">
                          {event.kind}
                        </td>
                        <td className="py-8 pr-16 text-graphite">
                          {event.side ?? event.outcome ?? event.status ?? "—"}
                          {event.price ? ` @ ${formatPrice(event.price)}` : ""}
                          {event.quantity ? ` × ${formatQuantity(event.quantity)}` : ""}
                        </td>
                        <td className="py-8 text-right">
                          {event.explorer ? (
                            <ExplorerLink href={event.explorer}>
                              {shortHash(event.txHash)}
                            </ExplorerLink>
                          ) : (
                            <span className="text-caption text-steel">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {events.length === 0 ? (
                      <tr>
                        <td className="py-16 text-body-sm text-iron">
                          No recorded activity yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DataCard className="h-fit p-16">
            <SectionLabel>Metrics</SectionLabel>
            <dl className="mt-16 flex flex-col gap-16 text-body-sm">
              <div className="flex justify-between gap-16">
                <dt className="text-iron">Battles</dt>
                <dd className="num font-medium text-pure-black">
                  {battlesForAgent(state, agent.agentId)}
                </dd>
              </div>
              <div className="flex justify-between gap-16">
                <dt className="text-iron">Markets traded</dt>
                <dd className="num font-medium text-pure-black">{markets.size}</dd>
              </div>
              <div className="flex justify-between gap-16">
                <dt className="text-iron">Fills</dt>
                <dd className="num font-medium text-pure-black">{agent.fillCount}</dd>
              </div>
              <div className="flex justify-between gap-16">
                <dt className="text-iron">Redemptions</dt>
                <dd className="num font-medium text-pure-black">
                  {agent.redemptionCount}
                </dd>
              </div>
              <div className="flex justify-between gap-16">
                <dt className="text-iron">Average entry</dt>
                <dd className="num font-medium text-pure-black">
                  {averageEntry ?? "—"}
                </dd>
              </div>
              {standing ? (
                <>
                  <div className="flex justify-between gap-16 border-t border-mist pt-16">
                    <dt className="text-iron">Buy costs</dt>
                    <dd className="num font-medium text-pure-black">
                      {signedUnits(standing.buyCosts)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-16">
                    <dt className="text-iron">Sell proceeds</dt>
                    <dd className="num font-medium text-pure-black">
                      {signedUnits(standing.sellProceeds)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-16">
                    <dt className="text-iron">Redemption proceeds</dt>
                    <dd className="num font-medium text-pure-black">
                      {signedUnits(standing.redeemedProceeds)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-16 border-t border-mist pt-16">
                    <dt className="text-iron">Score · net PnL</dt>
                    <dd className="num font-bold text-pure-black">
                      {signedUnits(standing.score)}
                    </dd>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between gap-16 border-t border-mist pt-16">
                <dt className="text-iron">Last active</dt>
                <dd className="font-medium text-pure-black">
                  {formatDateTime(agent.latestEventAt)}
                </dd>
              </div>
            </dl>
            {standing && standing.fillTxHashes.length > 0 ? (
              <div className="mt-16 border-t border-mist pt-16">
                <SectionLabel>Proof of activity</SectionLabel>
                <ul className="mt-8 flex flex-col gap-8">
                  {standing.fillTxHashes.slice(0, 6).map((hash) => (
                    <li key={hash}>
                      <ExplorerLink href={`${state.chain.explorer}/tx/${hash}`}>
                        {shortHash(hash)}
                      </ExplorerLink>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </DataCard>
        </div>
      </div>
    </div>
  );
}
