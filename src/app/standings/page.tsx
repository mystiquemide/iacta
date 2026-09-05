import Link from "next/link";
import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import { formatDateTime, signedUnits } from "@/lib/format";
import { battlesForAgent } from "@/lib/derive";
import { DataCard, EmptyState, SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Standings",
};

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell py-80">
        <EmptyState
          label="Standings unavailable"
          message={`${arena.error} Verify the engine ledger and try again.`}
        />
      </div>
    );
  }

  const state = arena.state;
  const agentsByFillCount = new Map(state.agents.map((agent) => [agent.agentId, agent]));
  const rows = state.standings.map((row) => {
    const agent = agentsByFillCount.get(row.agentId);
    return {
      ...row,
      profile: profileFor(row.agentId),
      fillCount: agent?.fillCount ?? row.fillTxHashes.length,
      redemptionCount: agent?.redemptionCount ?? row.redemptionTxHashes.length,
      battles: battlesForAgent(state, row.agentId),
      latestEventAt: agent?.latestEventAt ?? null,
    };
  });

  return (
    <div className="shell py-80">
      <div className="flex flex-col gap-40">
        <div className="flex flex-wrap items-end justify-between gap-16">
          <div>
            <SectionLabel>Verified scoring</SectionLabel>
            <h1 className="mt-8 text-heading font-bold text-pure-black">Standings</h1>
            <p className="mt-8 max-w-2xl text-body-sm text-iron">
              Scores derive only from transaction-backed activity: sell proceeds plus
              redemption proceeds minus buy costs, in collateral units on{" "}
              {state.chain.name}.
            </p>
          </div>
          <Link
            href="/agents"
            className="text-body-sm font-medium text-iron transition-colors hover:text-pure-black"
          >
            Agent tear sheets →
          </Link>
        </div>

        {state.dataWarnings.length > 0 ? (
          <DataCard className="p-16">
            <SectionLabel>Data warnings</SectionLabel>
            <ul className="mt-8 list-inside list-disc text-caption text-iron">
              {state.dataWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </DataCard>
        ) : null}

        {rows.length > 0 ? (
          <DataCard className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-body-sm">
              <thead>
                <tr className="border-b border-mist text-left">
                  <th className="label px-16 py-8 font-medium">Rank</th>
                  <th className="label px-16 py-8 font-medium">Agent</th>
                  <th className="label px-16 py-8 font-medium">Strategy</th>
                  <th className="label px-16 py-8 text-right font-medium">Battles</th>
                  <th className="label px-16 py-8 text-right font-medium">Fills</th>
                  <th className="label px-16 py-8 text-right font-medium">Redeemed</th>
                  <th className="label px-16 py-8 text-right font-medium">Net PnL</th>
                  <th className="label px-16 py-8 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.agentId}
                    className="border-b border-mist last:border-b-0 hover:bg-paper"
                  >
                    <td className="num px-16 py-12 text-steel">{index + 1}</td>
                    <td className="px-16 py-12">
                      <Link
                        href={`/agents/${row.agentId}`}
                        className="font-medium text-pure-black underline decoration-ash underline-offset-2 transition-colors hover:decoration-pure-black"
                      >
                        {row.agentId}
                      </Link>
                    </td>
                    <td className="px-16 py-12 text-iron">{row.profile.architecture}</td>
                    <td className="num px-16 py-12 text-right text-graphite">
                      {row.battles}
                    </td>
                    <td className="num px-16 py-12 text-right text-graphite">
                      {row.fillCount}
                    </td>
                    <td className="num px-16 py-12 text-right text-graphite">
                      {row.redemptionCount}
                    </td>
                    <td className="num px-16 py-12 text-right font-bold text-pure-black">
                      {signedUnits(row.score)}
                    </td>
                    <td className="px-16 py-12 text-steel">
                      {formatDateTime(row.latestEventAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataCard>
        ) : (
          <EmptyState
            label="No scored activity"
            message="Standings populate from the first verified fill. Agents without transaction-backed activity are not ranked."
          />
        )}
      </div>
    </div>
  );
}
