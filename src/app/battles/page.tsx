import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { loadFieldSnapshot } from "@/lib/participants";
import { formatUnits, formatWindow, shortHash, shortMarketId, formatDateTime } from "@/lib/format";
import { battleRows } from "@/lib/derive";
import { Kicker, Panel, WaitingPanel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Battles",
};

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  Trading: "Trading",
  Settled: "Settled",
  Closed: "Closed",
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
  const field = await loadFieldSnapshot();

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
        <>
          <Panel className="hidden overflow-x-auto md:block">
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
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
              <Panel key={row.marketId} className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-ink">{row.asset}</span>
                    <span className="mono text-[0.6875rem] text-ink-3">
                      {shortMarketId(row.marketId)}
                    </span>
                  </div>
                  {row.isLive ? (
                    <span className="text-[0.6875rem] font-medium text-live-ink">TRADING</span>
                  ) : (
                    <span className="text-[0.75rem] text-ink-2">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  )}
                </div>
                <p className="mono mt-1 text-[0.75rem] text-ink-3">
                  {formatWindow(row.tradingStart, row.expiry)}
                </p>
                <p className="mt-2 text-[0.8125rem] text-ink-2">
                  {row.participants.length > 0 ? row.participants.join(", ") : "no activity"}
                </p>
                <div className="mono mt-3 flex items-center justify-between gap-3 text-[0.75rem]">
                  <span className="text-ink-2">
                    {row.fillCount} fills · {formatUnits(row.volume)}
                  </span>
                  {row.latestTx ? (
                    <a
                      href={row.latestTx.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                    >
                      {shortHash(row.latestTx.hash)} ↗
                    </a>
                  ) : (
                    <span className="text-ink-3">no tx</span>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </>
      ) : (
        <WaitingPanel title="No battle history">
          The ledger is empty. Battles appear when the engine records its first
          market round.
        </WaitingPanel>
      )}

      {field.ok ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-2">
            <div>
              <Kicker>The field</Kicker>
              <p className="mt-1 max-w-xl text-[0.75rem] text-ink-3">
                Outside wallets observed in indexed DreamDEX fills on the
                markets this arena tracks. Labeled external, never adopted —
                no inference about owner or intent.
              </p>
            </div>
            <span className="mono text-[0.75rem] text-ink-3">
              {field.marketsScanned} markets · {field.tradesScanned} trades ·{" "}
              {field.participants.length} external wallets
              {field.stale ? " · cached" : ""}
            </span>
          </div>
          {field.participants.length > 0 ? (
            <div>
              {field.participants.slice(0, 8).map((participant) => (
                <div
                  key={participant.address}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line/50 py-2.5 last:border-b-0"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <a
                      href={participant.addressExplorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono text-[0.8125rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                    >
                      {shortHash(participant.address)}
                    </a>
                    <span className="text-[0.75rem] text-ink-3">
                      {participant.fillCount} fill{participant.fillCount === 1 ? "" : "s"} ·{" "}
                      {participant.marketIds.length} market
                      {participant.marketIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="mono text-[0.6875rem] text-ink-3">
                      last {formatDateTime(participant.lastActivity)}
                    </span>
                    <a
                      href={participant.txExplorers[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                    >
                      {shortHash(participant.txHashes[0])} ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-3 text-[0.8125rem] text-ink-2">
              No outside wallets in the recent trade windows scanned. The
              field repopulates as external flow hits these markets.
            </p>
          )}
        </section>
      ) : (
        <WaitingPanel title="Field data unavailable">
          {field.error} The indexer feed is unreachable right now; the ledger
          above is unaffected.
        </WaitingPanel>
      )}
    </div>
  );
}
