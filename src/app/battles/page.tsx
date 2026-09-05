import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { formatUnits, formatWindow, shortHash, shortMarketId } from "@/lib/format";
import { battleRows } from "@/lib/derive";
import { Kicker, Panel, WaitingPanel } from "@/components/ui";

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
      <div className="shell pt-32 pb-20">
        <WaitingPanel title="Battle history unavailable">
          {arena.error} Verify the engine ledger and try again.
        </WaitingPanel>
      </div>
    );
  }

  const state = arena.state;
  const rows = battleRows(state);

  return (
    <div className="shell flex flex-col gap-10 pt-28 pb-20 md:pt-32">
      <div className="flex flex-col gap-4">
        <Kicker>Market ledger</Kicker>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Battles
        </h1>
        <p className="max-w-2xl text-[0.875rem] leading-relaxed text-ink-2">
          Every event window the arena has tracked, with the agents that took
          part and the latest transaction proof for each market.
        </p>
      </div>

      {rows.length > 0 ? (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-line">
                <th className="kicker px-4 py-2.5 font-medium">Market</th>
                <th className="kicker px-4 py-2.5 font-medium">Window</th>
                <th className="kicker px-4 py-2.5 font-medium">Participants</th>
                <th className="kicker px-4 py-2.5 font-medium">Settlement</th>
                <th className="kicker px-4 py-2.5 text-right font-medium">Fills</th>
                <th className="kicker px-4 py-2.5 text-right font-medium">Volume</th>
                <th className="kicker px-4 py-2.5 text-right font-medium">Proof</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.marketId} className="border-b border-line/60 last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{row.asset}</span>
                    <span className="mono ml-2 text-[0.75rem] text-ink-3">
                      {shortMarketId(row.marketId)}
                    </span>
                    {row.isLive ? (
                      <span className="ml-2 text-[0.6875rem] font-medium text-live-ink">
                        TRADING
                      </span>
                    ) : null}
                  </td>
                  <td className="mono px-4 py-3 text-[0.75rem] text-ink-2">
                    {formatWindow(row.tradingStart, row.expiry)}
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {row.participants.length > 0
                      ? row.participants.join(", ")
                      : "no activity"}
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {STATUS_LABEL[row.status] ?? row.status}
                  </td>
                  <td className="mono px-4 py-3 text-right text-ink-2">{row.fillCount}</td>
                  <td className="mono px-4 py-3 text-right text-ink-2">
                    {formatUnits(row.volume)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.latestTx ? (
                      <a
                        href={row.latestTx.explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                      >
                        {shortHash(row.latestTx.hash)} ↗
                      </a>
                    ) : (
                      <span className="mono text-[0.75rem] text-ink-3">no tx</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : (
        <WaitingPanel title="No battle history">
          The ledger is empty. Battles appear when the engine records its first
          market round.
        </WaitingPanel>
      )}
    </div>
  );
}
