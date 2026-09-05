import Link from "next/link";
import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import { formatDateTime, signedUnits } from "@/lib/format";
import { battlesForAgent } from "@/lib/derive";
import { DataCard, EmptyState, SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Agents",
};

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell py-80">
        <EmptyState
          label="Agent roster unavailable"
          message={`${arena.error} Verify the engine ledger and try again.`}
        />
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
    <div className="shell py-80">
      <div className="flex flex-col gap-40">
        <div>
          <SectionLabel>Strategy roster</SectionLabel>
          <h1 className="mt-8 text-heading font-bold text-pure-black">Agents</h1>
          <p className="mt-8 max-w-2xl text-body-sm text-iron">
            Autonomous strategies competing in the arena. Metrics come from the verified
            event ledger only.
          </p>
        </div>

        {roster.length > 0 ? (
          <div className="grid gap-16 md:grid-cols-2">
            {roster.map(({ agent, profile, standing, battles }) => (
              <DataCard key={agent.agentId} className="p-16">
                <div className="flex items-start justify-between gap-16">
                  <div>
                    <Link
                      href={`/agents/${agent.agentId}`}
                      className="text-body font-bold text-pure-black underline decoration-ash underline-offset-2 transition-colors hover:decoration-pure-black"
                    >
                      {agent.agentId}
                    </Link>
                    <p className="mt-4 text-caption text-iron">{profile.architecture}</p>
                  </div>
                  <span className="label">{profile.posture}</span>
                </div>
                <p className="mt-16 text-body-sm text-iron">{profile.behavior}</p>
                <div className="mt-16 grid grid-cols-4 gap-8 border-t border-mist pt-16">
                  <div>
                    <span className="label">Battles</span>
                    <p className="num text-body-sm font-medium text-pure-black">{battles}</p>
                  </div>
                  <div>
                    <span className="label">Fills</span>
                    <p className="num text-body-sm font-medium text-pure-black">
                      {agent.fillCount}
                    </p>
                  </div>
                  <div>
                    <span className="label">Redeemed</span>
                    <p className="num text-body-sm font-medium text-pure-black">
                      {agent.redemptionCount}
                    </p>
                  </div>
                  <div>
                    <span className="label">Score</span>
                    <p className="num text-body-sm font-bold text-pure-black">
                      {standing ? signedUnits(standing.score) : "0.00"}
                    </p>
                  </div>
                </div>
                <p className="mt-8 text-caption text-steel">
                  Last active {formatDateTime(agent.latestEventAt)}
                </p>
              </DataCard>
            ))}
          </div>
        ) : (
          <EmptyState
            label="No agents"
            message="The roster appears when the engine ledger records agent activity."
          />
        )}
      </div>
    </div>
  );
}
