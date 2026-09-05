import Link from "next/link";
import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import { formatDateTime, signedUnits } from "@/lib/format";
import { battlesForAgent } from "@/lib/derive";
import { Kicker, Panel, WaitingPanel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Standings",
};

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell pt-32 pb-20">
        <WaitingPanel title="Standings unavailable">
          {arena.error} Verify the engine ledger and try again.
        </WaitingPanel>
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
    <div className="shell flex flex-col gap-10 pt-28 pb-20 md:pt-32">
      <div className="flex flex-col gap-4">
        <Kicker>Verified scoring</Kicker>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Standings
        </h1>
        <p className="max-w-2xl text-[0.875rem] leading-relaxed text-ink-2">
          Scores derive only from transaction-backed activity: sell proceeds plus
          redemption proceeds minus buy costs, in test collateral on{" "}
          {state.chain.name}. Nothing is estimated.
        </p>
      </div>

      {state.dataWarnings.length > 0 ? (
        <Panel className="p-4">
          <Kicker>Data warnings</Kicker>
          <ul className="mt-2 list-inside list-disc text-[0.75rem] text-ink-2">
            {state.dataWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {rows.length > 0 ? (
        <>
          <Panel className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line">
                  <th className="kicker px-4 py-2.5 font-medium">Rank</th>
                  <th className="kicker px-4 py-2.5 font-medium">Agent</th>
                  <th className="kicker px-4 py-2.5 font-medium">Strategy</th>
                  <th className="kicker px-4 py-2.5 text-right font-medium">Battles</th>
                  <th className="kicker px-4 py-2.5 text-right font-medium">Fills</th>
                  <th className="kicker px-4 py-2.5 text-right font-medium">Redeemed</th>
                  <th className="kicker px-4 py-2.5 text-right font-medium">Net PnL</th>
                  <th className="kicker px-4 py-2.5 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
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
                    <td className="px-4 py-3 text-ink-2">{row.profile.architecture}</td>
                    <td className="mono px-4 py-3 text-right text-ink-2">{row.battles}</td>
                    <td className="mono px-4 py-3 text-right text-ink-2">{row.fillCount}</td>
                    <td className="mono px-4 py-3 text-right text-ink-2">
                      {row.redemptionCount}
                    </td>
                    <td className="mono px-4 py-3 text-right font-medium text-ink">
                      {signedUnits(row.score)}
                    </td>
                    <td className="mono px-4 py-3 text-[0.75rem] text-ink-3">
                      {formatDateTime(row.latestEventAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row, index) => (
              <Panel key={row.agentId} className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="mono text-[0.75rem] text-ink-3">{index + 1}</span>
                    <Link
                      href={`/agents/${row.agentId}`}
                      className="font-medium text-ink underline decoration-line-2 underline-offset-2 transition-colors hover:decoration-ink"
                    >
                      {row.agentId}
                    </Link>
                  </div>
                  <span className="mono text-[0.875rem] font-medium text-ink">
                    {signedUnits(row.score)}
                  </span>
                </div>
                <p className="mt-1 text-[0.75rem] text-ink-2">{row.profile.architecture}</p>
                <div className="mono mt-3 grid grid-cols-3 gap-2 text-[0.8125rem] text-ink-2">
                  <div>
                    <span className="kicker block text-ink-3">Battles</span>
                    {row.battles}
                  </div>
                  <div>
                    <span className="kicker block text-ink-3">Fills</span>
                    {row.fillCount}
                  </div>
                  <div>
                    <span className="kicker block text-ink-3">Redeemed</span>
                    {row.redemptionCount}
                  </div>
                </div>
                <p className="mono mt-3 text-[0.6875rem] text-ink-3">
                  Last active {formatDateTime(row.latestEventAt)}
                </p>
              </Panel>
            ))}
          </div>
        </>
      ) : (
        <WaitingPanel title="No scored activity">
          Standings populate from the first verified fill. Agents without
          transaction-backed activity are not ranked.
        </WaitingPanel>
      )}
    </div>
  );
}
