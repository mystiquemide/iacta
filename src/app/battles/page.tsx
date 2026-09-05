import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { formatUnits, formatWindow, shortHash, shortMarketId } from "@/lib/format";
import { battleRows } from "@/lib/derive";
import { DataCard, EmptyState, ExplorerLink, SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Battles",
};

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  Trading: "Trading",
  Settled: "Settled",
  Pending: "Pending window",
};

export default async function BattlesPage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell py-80">
        <EmptyState
          label="Battle history unavailable"
          message={`${arena.error} Verify the engine ledger and try again.`}
        />
      </div>
    );
  }

  const state = arena.state;
  const rows = battleRows(state);

  return (
    <div className="shell py-80">
      <div className="flex flex-col gap-40">
        <div>
          <SectionLabel>Market ledger</SectionLabel>
          <h1 className="mt-8 text-heading font-bold text-pure-black">Battles</h1>
          <p className="mt-8 max-w-2xl text-body-sm text-iron">
            Every event window the arena has tracked, with the agents that took part and the
            latest transaction proof for each market.
          </p>
        </div>

        {rows.length > 0 ? (
          <DataCard className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-body-sm">
              <thead>
                <tr className="border-b border-mist text-left">
                  <th className="label px-16 py-8 font-medium">Market</th>
                  <th className="label px-16 py-8 font-medium">Window</th>
                  <th className="label px-16 py-8 font-medium">Participants</th>
                  <th className="label px-16 py-8 font-medium">Settlement</th>
                  <th className="label px-16 py-8 text-right font-medium">Fills</th>
                  <th className="label px-16 py-8 text-right font-medium">Volume</th>
                  <th className="label px-16 py-8 text-right font-medium">Proof</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.marketId}
                    className="border-b border-mist last:border-b-0 hover:bg-paper"
                  >
                    <td className="px-16 py-12">
                      <span className="font-medium text-pure-black">{row.asset}</span>
                      <span className="mono ml-8 text-caption text-steel">
                        {shortMarketId(row.marketId)}
                      </span>
                      {row.isLive ? (
                        <span className="ml-8 text-caption text-badge-slate">TRADING</span>
                      ) : null}
                    </td>
                    <td className="px-16 py-12 text-iron">
                      {formatWindow(row.tradingStart, row.expiry)}
                    </td>
                    <td className="px-16 py-12 text-graphite">
                      {row.participants.length > 0
                        ? row.participants.join(", ")
                        : "no activity"}
                    </td>
                    <td className="px-16 py-12 text-graphite">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </td>
                    <td className="num px-16 py-12 text-right text-graphite">
                      {row.fillCount}
                    </td>
                    <td className="num px-16 py-12 text-right text-graphite">
                      {formatUnits(row.volume)}
                    </td>
                    <td className="px-16 py-12 text-right">
                      {row.latestTx ? (
                        <ExplorerLink href={row.latestTx.explorer}>
                          {shortHash(row.latestTx.hash)}
                        </ExplorerLink>
                      ) : (
                        <span className="text-caption text-steel">no tx</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataCard>
        ) : (
          <EmptyState
            label="No battle history"
            message="The ledger is empty. Battles appear when the engine records its first market round."
          />
        )}
      </div>
    </div>
  );
}
