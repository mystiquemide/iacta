"use client";

import Link from "next/link";
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
} from "@/lib/format";
import { chartPointsForMarket, latestFillForMarket } from "@/lib/derive";
import { MarketChart } from "@/components/chart";
import { useCountdown } from "@/components/use-countdown";
import { Kicker, Panel, StatusBadge } from "@/components/ui";

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

export function ArenaLive({ initialState }: { initialState: ArenaState }) {
  const [state, setState] = useState(initialState);
  const [streamError, setStreamError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      source.close();
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

  const countdown = useCountdown(
    state.round?.countdownSeconds ?? null,
    state.generatedAt,
  );
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
  const lastFill = round ? latestFillForMarket(state, round.marketId) : null;

  return (
    <div className="shell flex flex-col gap-10 pt-28 pb-20 md:pt-32">
      {/* header */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="kicker">Arena</h1>
            <StatusBadge status={state.engine.status} />
            <span className="text-[0.75rem] text-ink-3">
              {streamError ? "live stream reconnecting" : "streaming · 2s"}
            </span>
          </div>
          <a
            href={state.chain.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
          >
            {state.chain.name} · chain {state.chain.id} ↗
          </a>
        </div>

        {round ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xs border border-line bg-surface px-5 py-4 md:grid-cols-4 lg:grid-cols-7">
            <div>
              <p className="kicker">Market</p>
              <p className="mono mt-1 text-[0.8125rem] text-ink">
                {shortMarketId(round.marketId)}
              </p>
            </div>
            <div>
              <p className="kicker">Underlying</p>
              <p className="mt-1 text-[0.8125rem] font-medium text-ink">{round.asset}</p>
            </div>
            <div className="col-span-2">
              <p className="kicker">Event window</p>
              <p className="mt-1 text-[0.8125rem] text-ink-2">
                {formatWindow(round.tradingStart, round.expiry)}
              </p>
            </div>
            <div>
              <p className="kicker">State</p>
              <p className="mt-1 text-[0.8125rem] font-medium text-ink">
                {round.isLive ? "Trading" : round.status}
              </p>
            </div>
            <div>
              <p className="kicker">Remaining</p>
              <p className="mono mt-1 text-[0.8125rem] font-medium text-ink">
                {formatCountdown(countdown)}
              </p>
            </div>
            <div>
              <p className="kicker">Venue</p>
              <p className="mt-1 text-[0.8125rem] font-medium text-ink">DreamDEX</p>
            </div>
          </div>
        ) : (
          <Panel className="px-5 py-4">
            <p className="kicker">
              {state.engine.status === "OFFLINE" ? "Engine offline" : "No active market"}
            </p>
            <p className="mt-2 text-[0.8125rem] text-ink-2">{state.engine.reason}</p>
          </Panel>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* current battle + score derivation */}
        <section className="flex flex-col gap-10 lg:col-span-2">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <Kicker>Current battle</Kicker>
              <span className="text-[0.75rem] text-ink-3">
                {round ? `${round.asset} window` : "no window"}
              </span>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="kicker py-2 pr-4 font-medium">Agent</th>
                    <th className="kicker py-2 pr-4 font-medium">Architecture</th>
                    <th className="kicker py-2 pr-4 font-medium">Latest action</th>
                    <th className="kicker py-2 pr-4 text-right font-medium">Entry</th>
                    <th className="kicker py-2 pr-4 text-right font-medium">Qty</th>
                    <th className="kicker py-2 pr-4 text-right font-medium">Score</th>
                    <th className="kicker py-2 text-right font-medium">Latest tx</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((agent) => {
                    const profile = profileFor(agent.agentId);
                    const fill = latestFills.get(agent.agentId) ?? null;
                    const order = latestOrders.get(agent.agentId) ?? null;
                    const latest = latestAny.get(agent.agentId) ?? null;
                    // One event drives both the action text and the tx link,
                    // so a fill row never sits next to "no tx" from an
                    // unrelated guard refusal.
                    const shown = fill ?? order ?? latest ?? null;
                    const standing = standingsByAgent.get(agent.agentId);
                    const action = shown
                      ? shown.kind === "FILL"
                        ? `FILL ${shown.side ?? ""}`.trim()
                        : shown.kind === "ORDER"
                          ? `ORDER ${shown.side ?? ""} ${shown.status ?? ""}`.trim()
                          : shown.kind
                      : "HOLD";
                    return (
                      <tr key={agent.agentId} className="border-b border-line/60 last:border-b-0">
                        <td className="py-3 pr-4 font-medium text-ink">{agent.agentId}</td>
                        <td className="py-3 pr-4 text-ink-2">{profile.architecture}</td>
                        <td className="mono py-3 pr-4 text-ink-2">{action}</td>
                        <td className="mono py-3 pr-4 text-right text-ink-2">
                          {shown?.kind === "FILL" && shown.price ? formatPrice(shown.price) : "-"}
                        </td>
                        <td className="mono py-3 pr-4 text-right text-ink-2">
                          {shown?.kind === "FILL" && shown.quantity ? formatQuantity(shown.quantity) : "-"}
                        </td>
                        <td className="mono py-3 pr-4 text-right font-medium text-ink">
                          {standing ? signedUnits(standing.score) : "0.000000"}
                        </td>
                        <td className="py-3 text-right">
                          {shown?.explorer ? (
                            <a
                              href={shown.explorer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mono text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                            >
                              {shortHash(shown.txHash)} ↗
                            </a>
                          ) : (
                            <span className="mono text-[0.75rem] text-ink-3">
                              {shown?.kind === "REFUSAL" ? "off-chain" : "no tx"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 md:hidden">
              {roster.map((agent) => {
                const profile = profileFor(agent.agentId);
                const fill = latestFills.get(agent.agentId) ?? null;
                const order = latestOrders.get(agent.agentId) ?? null;
                const latest = latestAny.get(agent.agentId) ?? null;
                const shown = fill ?? order ?? latest ?? null;
                const standing = standingsByAgent.get(agent.agentId);
                const action = shown
                  ? shown.kind === "FILL"
                    ? `FILL ${shown.side ?? ""}`.trim()
                    : shown.kind === "ORDER"
                      ? `ORDER ${shown.side ?? ""} ${shown.status ?? ""}`.trim()
                      : shown.kind
                  : "HOLD";
                return (
                  <Panel key={agent.agentId} className="p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/agents/${agent.agentId}`}
                        className="font-medium text-ink underline decoration-line-2 underline-offset-2 transition-colors hover:decoration-ink"
                      >
                        {agent.agentId}
                      </Link>
                      <span className="mono text-[0.875rem] font-medium text-ink">
                        {standing ? signedUnits(standing.score) : "0.000000"}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.75rem] text-ink-2">{profile.architecture}</p>
                    <div className="mono mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[0.8125rem]">
                      <span className="text-ink-2">
                        {action}
                        {shown?.kind === "FILL" && shown.price ? ` @ ${formatPrice(shown.price)}` : ""}
                        {shown?.kind === "FILL" && shown.quantity ? ` × ${formatQuantity(shown.quantity)}` : ""}
                      </span>
                      {shown?.explorer ? (
                        <a
                          href={shown.explorer}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                        >
                          {shortHash(shown.txHash)} ↗
                        </a>
                      ) : (
                        <span className="text-[0.75rem] text-ink-3">
                          {shown?.kind === "REFUSAL" ? "off-chain refusal" : "no tx"}
                        </span>
                      )}
                    </div>
                  </Panel>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <Kicker>Score derivation</Kicker>
              <span className="text-[0.75rem] text-ink-3">verified, tx-backed</span>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="kicker py-2 pr-4 font-medium">Agent</th>
                    <th className="kicker py-2 pr-4 text-right font-medium">Buy costs</th>
                    <th className="kicker py-2 pr-4 text-right font-medium">Sell proceeds</th>
                    <th className="kicker py-2 pr-4 text-right font-medium">Redemptions</th>
                    <th className="kicker py-2 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {state.standings.map((row) => (
                    <tr key={row.agentId} className="border-b border-line/60 last:border-b-0">
                      <td className="py-3 pr-4 font-medium text-ink">{row.agentId}</td>
                      <td className="mono py-3 pr-4 text-right text-ink-2">
                        {signedUnits(row.buyCosts)}
                      </td>
                      <td className="mono py-3 pr-4 text-right text-ink-2">
                        {signedUnits(row.sellProceeds)}
                      </td>
                      <td className="mono py-3 pr-4 text-right text-ink-2">
                        {signedUnits(row.redeemedProceeds)}
                      </td>
                      <td className="mono py-3 text-right font-medium text-ink">
                        {signedUnits(row.score)}
                      </td>
                    </tr>
                  ))}
                  {state.standings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-ink-2">
                        No scored activity yet. Scores derive from fills and
                        redemptions with successful receipts.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 md:hidden">
              {state.standings.map((row) => (
                <Panel key={row.agentId} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-ink">{row.agentId}</span>
                    <span className="mono text-[0.875rem] font-medium text-ink">
                      {signedUnits(row.score)}
                    </span>
                  </div>
                  <div className="mono mt-3 grid grid-cols-3 gap-2 text-[0.8125rem] text-ink-2">
                    <div>
                      <span className="kicker block text-ink-3">Buy</span>
                      {signedUnits(row.buyCosts)}
                    </div>
                    <div>
                      <span className="kicker block text-ink-3">Sell</span>
                      {signedUnits(row.sellProceeds)}
                    </div>
                    <div>
                      <span className="kicker block text-ink-3">Redeemed</span>
                      {signedUnits(row.redeemedProceeds)}
                    </div>
                  </div>
                </Panel>
              ))}
              {state.standings.length === 0 ? (
                <p className="py-2 text-[0.8125rem] text-ink-2">
                  No scored activity yet. Scores derive from fills and
                  redemptions with successful receipts.
                </p>
              ) : null}
            </div>
            <p className="text-[0.75rem] text-ink-3">
              Score = sell proceeds + redemption proceeds − buy costs, in test
              collateral. Every component is backed by a stored transaction hash.
            </p>
          </div>
        </section>

        {/* tape + chart + last fill */}
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <Kicker>Live tape</Kicker>
              <span className="mono text-[0.75rem] text-ink-3">
                {state.counts.fills} fills total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-[0.8125rem]">
                <tbody>
                  {tape.map((event, index) => (
                    <tr key={index} className="border-b border-line/50 last:border-b-0">
                      <td className="mono py-2 pr-3 text-ink-3">
                        {formatTime(event.occurredAt)}
                      </td>
                      <td className="py-2 pr-3 font-medium text-ink-2">{event.agentId}</td>
                      <td className="mono py-2 pr-3 text-ink-3">
                        {event.kind === "ORDER" || event.kind === "FILL"
                          ? `${event.kind === "ORDER" ? "order " : ""}${event.side ?? ""}${
                              event.price ? ` @ ${formatPrice(event.price)}` : ""
                            }${
                              event.quantity ? ` × ${formatQuantity(event.quantity)}` : ""
                            }`
                          : event.kind}
                      </td>
                      <td className="py-2 text-right">
                        {event.explorer ? (
                          <a
                            href={event.explorer}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mono text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                          >
                            tx ↗
                          </a>
                        ) : (
                          <span className="mono text-[0.75rem] text-ink-3">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tape.length === 0 ? (
                    <tr>
                      <td className="py-4 text-ink-2">No activity recorded yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <Panel className="p-4">
            <div className="flex items-center justify-between pb-2">
              <Kicker>Market chart</Kicker>
              <span className="text-[0.75rem] text-ink-3">YES-equivalent fills</span>
            </div>
            {chartPoints.length > 0 ? (
              <MarketChart points={chartPoints} />
            ) : (
              <p className="py-8 text-center text-[0.8125rem] text-ink-2">
                {round
                  ? "No fills in this window yet. The chart appears after the first verified trade."
                  : "No active market. The chart returns with the next trading window."}
              </p>
            )}
            {round ? (
              <p className="mt-2 border-t border-line pt-2 text-[0.75rem] text-ink-3">
                {round.asset} · {shortMarketId(round.marketId)}
              </p>
            ) : null}
          </Panel>

          <Panel className="p-4">
            <Kicker>Latest fill</Kicker>
            {lastFill ? (
              <div className="mt-3 flex flex-col gap-1.5 text-[0.8125rem]">
                <div className="flex justify-between">
                  <span className="text-ink-2">Agent</span>
                  <span className="font-medium text-ink">{lastFill.agentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Side</span>
                  <span className="mono font-medium text-ink">{lastFill.side}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Price / Qty</span>
                  <span className="mono font-medium text-ink">
                    {formatPrice(lastFill.price ?? "0")} ×{" "}
                    {formatQuantity(lastFill.quantity ?? "0")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Path</span>
                  <span className="mono font-medium text-ink">{lastFill.fillPath}</span>
                </div>
                {lastFill.explorer ? (
                  <a
                    href={lastFill.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono mt-1 text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                  >
                    {shortHash(lastFill.txHash)} ↗
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[0.8125rem] text-ink-2">
                {round
                  ? "No fill in the current window yet. The last verified events are on the tape."
                  : "No active window. Last verified activity stays on the tape."}
              </p>
            )}
            {state.counts.fills > 0 && !round ? (
              <p className="mt-2 text-[0.75rem] text-ink-3">
                Last recorded fill: {formatDate(state.killfeed.find((e) => e.kind === "FILL")?.occurredAt ?? null)}
              </p>
            ) : null}
          </Panel>
        </section>
      </div>
    </div>
  );
}
