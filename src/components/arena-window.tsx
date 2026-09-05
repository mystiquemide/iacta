"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ArenaState } from "@/lib/arena";
import { useCountdown } from "@/components/use-countdown";
import {
  formatPrice,
  formatQuantity,
  formatTime,
  shortHash,
  shortMarketId,
  signedUnits,
} from "@/lib/format";
import { StatusBadge } from "@/components/ui";

/**
 * The live arena window: the product-as-hero element on the home page.
 * Shows the current battle and a live tape over SSE. When the engine is
 * offline it shows the last verified events instead, never a broken state.
 */
export function ArenaWindow({ initialState }: { initialState: ArenaState }) {
  const [state, setState] = useState(initialState);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/arena/stream");
    source.addEventListener("arena", (event) => {
      try {
        setState(JSON.parse((event as MessageEvent).data) as ArenaState);
      } catch {
        // Ignore malformed frames; the next event replaces them.
      }
    });
    source.addEventListener("error", () => {
      if (pollRef.current) return;
      source.close();
      pollRef.current = setInterval(async () => {
        try {
          const response = await fetch("/api/arena", { cache: "no-store" });
          if (response.ok) setState((await response.json()) as ArenaState);
        } catch {
          // Keep the last good state; the next poll retries.
        }
      }, 10_000);
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
  const standingsByAgent = new Map(state.standings.map((row) => [row.agentId, row]));
  const latestByAgent = new Map<string, ArenaState["killfeed"][number]>();
  for (const event of state.killfeed) {
    if (!latestByAgent.has(event.agentId)) latestByAgent.set(event.agentId, event);
  }
  const roster = state.agents.filter((agent) => agent.latestEventAt !== null);
  const tape = state.killfeed.slice(0, 6);

  return (
    <div className="overflow-hidden rounded-window border border-line bg-surface shadow-[0_28px_48px_0_rgba(51,51,51,0.13)]">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#484848]" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3a]" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#333333]" aria-hidden="true" />
          <span className="mono ml-3 text-[0.75rem] text-ink-3">
            iacta / arena
          </span>
        </div>
        <StatusBadge status={state.engine.status} />
      </div>

      {/* battle header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        {round ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-base font-semibold tracking-tight text-ink">
                {round.asset}
              </span>
              <span className="mono text-[0.75rem] text-ink-3">
                {shortMarketId(round.marketId)}
              </span>
            </div>
            <div className="mono flex items-center gap-4 text-[0.75rem] text-ink-2">
              <span>{round.isLive ? "TRADING" : round.status}</span>
              <span className="text-ink">{formatCountdownValue(countdown)}</span>
            </div>
          </>
        ) : (
          <span className="text-[0.8125rem] text-ink-2">
            {state.engine.status === "OFFLINE"
              ? "Engine offline. Showing the last verified activity."
              : "Waiting for the next trading window."}
          </span>
        )}
      </div>

      {/* competitor rows */}
      <div className="divide-y divide-line">
        {roster.length > 0 ? (
          roster.slice(0, 4).map((agent) => {
            const standing = standingsByAgent.get(agent.agentId);
            const latest = latestByAgent.get(agent.agentId);
            return (
              <div key={agent.agentId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[0.8125rem] font-medium text-ink">
                    {agent.agentId}
                  </span>
                  <span className="mono text-[0.75rem] text-ink-3">
                    {latest?.kind ?? "HOLD"}
                    {latest?.side ? ` ${latest.side}` : ""}
                    {latest?.price ? ` @ ${formatPrice(latest.price)}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="mono text-[0.8125rem] font-medium text-ink">
                    {standing ? signedUnits(standing.score) : "0.000000"}
                  </span>
                  {latest?.explorer ? (
                    <a
                      href={latest.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono text-[0.75rem] text-ink-3 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                    >
                      {shortHash(latest.txHash)}
                    </a>
                  ) : (
                    <span className="mono text-[0.75rem] text-ink-3">no tx</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-4 text-[0.8125rem] text-ink-2">
            No agent activity in the ledger yet.
          </div>
        )}
      </div>

      {/* live tape */}
      <div className="border-t border-line bg-surface-2/50">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="kicker">Live tape</span>
          <Link
            href="/arena"
            className="text-[0.75rem] font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Open arena →
          </Link>
        </div>
        <div className="divide-y divide-line/60">
          {tape.map((event, index) => (
            <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-1.5">
              <span className="mono text-[0.75rem] text-ink-3">
                {formatTime(event.occurredAt)}
              </span>
              <span className="text-[0.75rem] font-medium text-ink-2">
                {event.agentId}
              </span>
              <span className="mono text-[0.75rem] text-ink-3">
                {event.kind === "ORDER" || event.kind === "FILL"
                  ? `${event.side ?? event.kind}${
                      event.price ? ` ${formatPrice(event.price)}` : ""
                    }${
                      event.quantity ? ` × ${formatQuantity(event.quantity)}` : ""
                    }`
                  : event.kind}
              </span>
              <span className="ml-auto mono text-[0.75rem] text-ink-3">
                {event.explorer ? (
                  <a
                    href={event.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
                  >
                    {shortHash(event.txHash)} ↗
                  </a>
                ) : (
                  "-"
                )}
              </span>
            </div>
          ))}
          {tape.length === 0 ? (
            <div className="px-4 py-3 text-[0.75rem] text-ink-3">
              The tape fills with the next verified event.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatCountdownValue(seconds: number | null): string {
  if (seconds === null) return "-";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
