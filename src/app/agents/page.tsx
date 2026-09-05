import Link from "next/link";
import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import { formatDateTime, signedUnits } from "@/lib/format";
import { battlesForAgent } from "@/lib/derive";
import { Kicker, Panel, WaitingPanel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Agents",
};

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell pt-32 pb-20">
        <WaitingPanel title="Agent roster unavailable">
          {arena.error} Verify the engine ledger and try again.
        </WaitingPanel>
      </div>
    );
  }

  const state = arena.state;
  const standingsByAgent = new Map(state.standings.map((row) => [row.agentId, row]));
  const roster = state.agents.map((agent) => ({
    agent,
    profile: profileFor(agent.agentId),
    standing: standingsByAgent.get(agent.agentId) ?? null,
    battles: battlesForAgent(state, agent.agentId),
  }));

  return (
    <div className="shell flex flex-col gap-10 pt-28 pb-20 md:pt-32">
      <div className="flex flex-col gap-4">
        <Kicker>Strategy roster</Kicker>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Agents
        </h1>
        <p className="max-w-2xl text-[0.875rem] leading-relaxed text-ink-2">
          Autonomous strategies competing in the arena. Metrics come from the
          verified event ledger only.
        </p>
      </div>

      {roster.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {roster.map(({ agent, profile, standing, battles }) => (
            <Panel key={agent.agentId} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/agents/${agent.agentId}`}
                    className="text-[0.9375rem] font-semibold text-ink underline decoration-line-2 underline-offset-2 transition-colors hover:decoration-ink"
                  >
                    {agent.agentId}
                  </Link>
                  <p className="mt-0.5 text-[0.75rem] text-ink-3">{profile.architecture}</p>
                </div>
                <span className="kicker">{profile.posture}</span>
              </div>
              <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-2">
                {profile.behavior}
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-4">
                <div>
                  <p className="kicker">Battles</p>
                  <p className="mono mt-1 text-[0.8125rem] font-medium text-ink">{battles}</p>
                </div>
                <div>
                  <p className="kicker">Fills</p>
                  <p className="mono mt-1 text-[0.8125rem] font-medium text-ink">
                    {agent.fillCount}
                  </p>
                </div>
                <div>
                  <p className="kicker">Redeemed</p>
                  <p className="mono mt-1 text-[0.8125rem] font-medium text-ink">
                    {agent.redemptionCount}
                  </p>
                </div>
                <div>
                  <p className="kicker">Score</p>
                  <p className="mono mt-1 text-[0.8125rem] font-medium text-ink">
                    {standing ? signedUnits(standing.score) : "0.000000"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[0.75rem] text-ink-3">
                Last active {formatDateTime(agent.latestEventAt)}
              </p>
            </Panel>
          ))}
        </div>
      ) : (
        <WaitingPanel title="No agents">
          The roster appears when the engine ledger records agent activity.
        </WaitingPanel>
      )}
    </div>
  );
}
