"use client";

import { useEffect, useRef, useState } from "react";
import type { ArenaState, KillfeedEvent } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import {
  formatCountdown,
  formatDate,
  formatPrice,
  formatQuantity,
  formatTime,
  formatWindow,
  shortHash,
  shortMarketId,
  signedUnits,
  isNegative,
} from "@/lib/format";
import {
  chartPointsForMarket,
  latestFillForMarket,
  latestVerifiedTx,
} from "@/lib/derive";
import { MarketChart } from "@/components/chart";
import { DataCard, EmptyState, ExplorerLink, SectionLabel, StatusText } from "@/components/ui";
import { useCountdown } from "@/components/use-countdown";

const TAPE_LIMIT = 14;

function latestByAgent(state: ArenaState, kind: KillfeedEvent["kind"]) {
  const map = new Map<string, KillfeedEvent>();
  for (const event of state.killfeed) {
    if (event.kind === kind && !map.has(event.agentId)) map.set(event.agentId, event);
  }
  return map;
}

function latestEventByAgent(state: ArenaState) {
  const map = new Map<string, KillfeedEvent>();
  for (const event of state.killfeed) {
    if (!map.has(event.agentId)) map.set(event.agentId, event);
  }
  return map;
}

function TapeKind({ kind }: { kind: KillfeedEvent["kind"] }) {
  return <span className="text-caption text-badge-slate">{kind}</span>;
}

export function ArenaLive({ initialState }: { initialState: ArenaState }) {
  const [state, setState] = useState(initialState);
  const [streamError, setStreamError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdown = useCountdown(
    state.round?.countdownSeconds ?? null,
    state.generatedAt,
  );

  useEffect(() => {
    const source = new EventSource("/api/arena/stream");
    source.addEventListener("arena", (event) => {
      try {
        setState(JSON.parse((event as MessageEvent).data) as ArenaState);
        setStreamError(false);
      } catch {
        // Ignore malformed frames; the next event replaces them.
      }
    });
    source.addEventListener("error", () => {
      setStreamError(true);
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const response = await fetch("/api/arena", { cache: "no-store" });
          if (response.ok) setState((await response.json()) as ArenaState);
        } catch {
          // Keep the last good state; the next poll retries.
        }
      }, 5_000);
    });
    return () => {
      source.close();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, []);

  const round = state.round;
  const latestFills = latestByAgent(state, "FILL");
  const latestOrders = latestByAgent(state, "ORDER");
  const latestAny = latestEventByAgent(state);
  const standingsByAgent = new Map(state.standings.map((row) => [row.agentId, row]));
  const activeAgents = state.agents.filter(
    (agent) => agent.latestEventAt !== null || standingsByAgent.has(agent.agentId),
  );
  const roster = activeAgents.length > 0 ? activeAgents : state.agents;
  const chartPoints = round ? chartPointsForMarket(state, round.marketId) : [];
  const tape = state.killfeed.slice(0, TAPE_LIMIT);
  const verified = latestVerifiedTx(state);

  return (
    <div className="flex flex-col gap-40">
      {/* Arena header */}
      <section className="border-b border-mist bg-white">
        <div className="shell flex flex-col gap-24 py-24">
          <div className="flex flex-wrap items-center justify-between gap-16">
            <div className="flex items-center gap-16">
              <SectionLabel>Arena</SectionLabel>
              <StatusText status={state.engine.status} />
              {streamError ? (
                <span className="label text-steel">live stream reconnecting</span>
              ) : (
                <span className="label text-badge-slate">streaming · 2s</span>
              )}
            </div>
            <a
              href={state.chain.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-caption font-medium text-iron transition-colors hover:text-pure-black"
            >
              {state.chain.name} · chain {state.chain.id} ↗
            </a>
          </div>

          {round ? (
            <div className="grid grid-cols-2 gap-x-24 gap-y-16 md:grid-cols-4 lg:grid-cols-7">
              <div>
                <span className="label">Market</span>
                <p className="mono mt-8 text-body-sm text-pure-black">
                  {shortMarketId(round.marketId)}
                </p>
              </div>
              <div>
                <span className="label">Underlying</span>
                <p className="mt-8 text-body-sm font-medium text-pure-black">
                  {round.asset}
                </p>
              </div>
              <div className="col-span-2">
                <span className="label">Event window</span>
                <p className="mt-8 text-body-sm text-graphite">
                  {formatWindow(round.tradingStart, round.expiry)}
                </p>
              </div>
              <div>
                <span className="label">State</span>
                <p className="mt-8 text-body-sm font-medium text-pure-black">
                  {round.isLive ? "Trading" : round.status}
                </p>
              </div>
              <div>
                <span className="label">Remaining</span>
                <p className="num mt-8 text-body-sm font-medium text-pure-black">
                  {formatCountdown(countdown)}
                </p>
              </div>
              <div>
                <span className="label">Venue</span>
                <p className="mt-8 text-body-sm font-medium text-pure-black">DreamDEX</p>
              </div>
            </div>
          ) : (
            <EmptyState
              label={state.engine.status === "OFFLINE" ? "Engine offline" : "No active market"}
              message={state.engine.reason}
            />
          )}
        </div>
      </section>

      <div className="shell grid gap-40 lg:grid-cols-3">
        {/* Current battle */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-mist pb-8">
            <SectionLabel>Current battle</SectionLabel>
            <span className="text-caption text-steel">
              {round ? `${round.asset} window` : "no window"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-body-sm">
              <thead>
                <tr className="border-b border-mist text-left">
                  <th className="label py-8 pr-16 font-medium">Agent</th>
                  <th className="label py-8 pr-16 font-medium">Architecture</th>
                  <th className="label py-8 pr-16 font-medium">Latest action</th>
                  <th className="label py-8 pr-16 text-right font-medium">Entry</th>
                  <th className="label py-8 pr-16 text-right font-medium">Qty</th>
                  <th className="label py-8 pr-16 text-right font-medium">Score</th>
                  <th className="label py-8 text-right font-medium">Latest tx</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((agent) => {
                  const profile = profileFor(agent.agentId);
                  const fill = latestFills.get(agent.agentId) ?? null;
                  const order = latestOrders.get(agent.agentId) ?? null;
                  const latest = latestAny.get(agent.agentId) ?? null;
                  const standing = standingsByAgent.get(agent.agentId);
                  const action = fill
                    ? `${fill.side ?? "FILL"} ${fill.fillPath ?? ""}`.trim()
                    : order
                      ? `ORDER ${order.side ?? ""} ${order.status ?? ""}`.trim()
                      : latest
                        ? latest.kind
                        : "HOLD";
                  return (
                    <tr key={agent.agentId} className="border-b border-mist last:border-b-0">
                      <td className="py-12 pr-16 font-medium text-pure-black">
                        {agent.agentId}
                      </td>
                      <td className="py-12 pr-16 text-iron">{profile.architecture}</td>
                      <td className="py-12 pr-16 text-graphite">{action}</td>
                      <td className="num py-12 pr-16 text-right text-graphite">
                        {fill?.price ? formatPrice(fill.price) : "—"}
                      </td>
                      <td className="num py-12 pr-16 text-right text-graphite">
                        {fill?.quantity ? formatQuantity(fill.quantity) : "—"}
                      </td>
                      <td
                        className={`num py-12 pr-16 text-right font-medium ${
                          standing && isNegative(standing.score)
                            ? "text-pure-black"
                            : "text-pure-black"
                        }`}
                      >
                        {standing ? signedUnits(standing.score) : "0.00"}
                      </td>
                      <td className="py-12 text-right">
                        {latest?.explorer ? (
                          <ExplorerLink href={latest.explorer}>
                            {shortHash(latest.txHash)}
                          </ExplorerLink>
                        ) : (
                          <span className="text-caption text-steel">no tx</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Score derivation */}
          <div className="mt-40">
            <div className="flex items-center justify-between border-b border-mist pb-8">
              <SectionLabel>Score derivation</SectionLabel>
              <span className="text-caption text-steel">verified, tx-backed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-body-sm">
                <thead>
                  <tr className="border-b border-mist text-left">
                    <th className="label py-8 pr-16 font-medium">Agent</th>
                    <th className="label py-8 pr-16 text-right font-medium">Buy costs</th>
                    <th className="label py-8 pr-16 text-right font-medium">
                      Sell proceeds
                    </th>
                    <th className="label py-8 pr-16 text-right font-medium">
                      Redemption proceeds
                    </th>
                    <th className="label py-8 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {state.standings.map((row) => (
                    <tr key={row.agentId} className="border-b border-mist last:border-b-0">
                      <td className="py-12 pr-16 font-medium text-pure-black">
                        {row.agentId}
                      </td>
                      <td className="num py-12 pr-16 text-right text-graphite">
                        {signedUnits(row.buyCosts)}
                      </td>
                      <td className="num py-12 pr-16 text-right text-graphite">
                        {signedUnits(row.sellProceeds)}
                      </td>
                      <td className="num py-12 pr-16 text-right text-graphite">
                        {signedUnits(row.redeemedProceeds)}
                      </td>
                      <td className="num py-12 text-right font-bold text-pure-black">
                        {signedUnits(row.score)}
                      </td>
                    </tr>
                  ))}
                  {state.standings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-body-sm text-iron">
                        No scored activity yet. Scores derive from fills and redemptions with
                        successful receipts.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-8 text-caption text-steel">
              Score = sell proceeds + redemption proceeds − buy costs, in collateral units.
              Every component is backed by a stored transaction hash.
            </p>
          </div>
        </section>

        {/* Live tape + chart */}
        <section className="flex flex-col gap-40">
          <div>
            <div className="flex items-center justify-between border-b border-mist pb-8">
              <SectionLabel>Live tape</SectionLabel>
              <span className="text-caption text-steel">{state.counts.fills} fills total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-body-sm">
                <tbody>
                  {tape.map((event, index) => (
                    <tr key={index} className="border-b border-mist last:border-b-0">
                      <td className="num py-8 pr-8 text-steel">
                        {formatTime(event.occurredAt)}
                      </td>
                      <td className="py-8 pr-8 font-medium text-graphite">
                        {event.agentId}
                      </td>
                      <td className="py-8 pr-8">
                        {event.kind === "FILL" || event.kind === "ORDER" ? (
                          <span className="text-caption text-graphite">
                            {event.kind === "ORDER" ? "order " : ""}
                            {event.side ?? event.kind}
                            {event.price ? ` @ ${formatPrice(event.price)}` : ""}
                            {event.quantity ? ` × ${formatQuantity(event.quantity)}` : ""}
                          </span>
                        ) : (
                          <TapeKind kind={event.kind} />
                        )}
                      </td>
                      <td className="py-8 text-right">
                        {event.explorer ? (
                          <ExplorerLink href={event.explorer}>tx ↗</ExplorerLink>
                        ) : (
                          <span className="text-caption text-steel">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tape.length === 0 ? (
                    <tr>
                      <td className="py-16 text-body-sm text-iron">
                        No activity recorded yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <DataCard className="p-16">
            <div className="flex items-center justify-between pb-8">
              <SectionLabel>Market chart</SectionLabel>
              <span className="text-caption text-steel">YES-equivalent fills</span>
            </div>
            {chartPoints.length > 0 ? (
              <MarketChart points={chartPoints} />
            ) : (
              <p className="py-24 text-body-sm text-iron">
                {round
                  ? "No fills in this window yet. The chart appears after the first verified trade."
                  : "No active market. The chart returns with the next trading window."}
              </p>
            )}
            {round ? (
              <p className="mt-8 border-t border-mist pt-8 text-caption text-steel">
                {round.asset} · {shortMarketId(round.marketId)} · latest verified{" "}
                {verified ? `${formatDate(verified.occurredAt)} ${shortHash(verified.txHash)}` : "—"}
              </p>
            ) : null}
          </DataCard>

          <DataCard className="p-16">
            <SectionLabel>Latest fill</SectionLabel>
            {round && latestFillForMarket(state, round.marketId) ? (
              (() => {
                const fill = latestFillForMarket(state, round.marketId)!;
                return (
                  <div className="mt-8 flex flex-col gap-8 text-body-sm">
                    <div className="flex justify-between">
                      <span className="text-iron">Agent</span>
                      <span className="font-medium text-pure-black">{fill.agentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-iron">Side</span>
                      <span className="font-medium text-pure-black">{fill.side}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-iron">Price / Qty</span>
                      <span className="num font-medium text-pure-black">
                        {formatPrice(fill.price ?? "0")} × {formatQuantity(fill.quantity ?? "0")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-iron">Path</span>
                      <span className="font-medium text-pure-black">{fill.fillPath}</span>
                    </div>
                    {fill.explorer ? (
                      <ExplorerLink href={fill.explorer}>
                        {shortHash(fill.txHash)}
                      </ExplorerLink>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              <p className="mt-8 text-body-sm text-iron">
                No fill in the current window.
              </p>
            )}
          </DataCard>
        </section>
      </div>
    </div>
  );
}
