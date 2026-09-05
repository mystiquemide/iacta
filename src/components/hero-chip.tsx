"use client";

import { useEffect, useRef, useState } from "react";
import type { ArenaState } from "@/lib/arena";
import { useCountdown } from "@/components/use-countdown";
import {
  formatPrice,
  formatQuantity,
  formatTime,
  shortHash,
  signedUnits,
} from "@/lib/format";

/**
 * The hero live chip: current market, ticking countdown, and the latest
 * verified fill. Falls back to the last verified event when no round is
 * live, so it never shows a blank or broken state.
 */
export function HeroChip({ initialState }: { initialState: ArenaState }) {
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
  const live = state.engine.status === "LIVE" && round?.isLive;
  const lastFill =
    state.killfeed.find((event) => event.kind === "FILL") ?? null;
  const lastVerified =
    state.killfeed.find(
      (event) => event.kind === "FILL" || event.kind === "REDEMPTION",
    ) ?? null;

  return (
    <div className="inline-flex flex-col gap-2 rounded-xs border border-line bg-canvas/70 px-5 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            live ? "live-dot bg-chart-1" : "bg-ink-3"
          }`}
          aria-hidden="true"
        />
        <span className="text-[0.75rem] font-medium text-ink-2">
          {live ? "Trading now" : state.engine.status === "OFFLINE" ? "Engine offline" : "Between windows"}
        </span>
        {round ? (
          <span className="mono text-[0.75rem] text-ink-2">
            {round.asset} · {formatTime(state.generatedAt)} UTC
          </span>
        ) : null}
      </div>
      {round ? (
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold tracking-tight text-ink">
            {round.asset} window
          </span>
          <span className="mono text-lg text-ink">
            {countdown !== null ? formatCountdownSafe(countdown) : "-"}
          </span>
        </div>
      ) : (
        <span className="text-lg font-semibold tracking-tight text-ink">
          Next window on resumption
        </span>
      )}
      <div className="flex items-center gap-2 text-[0.75rem] text-ink-3">
        {lastFill ? (
          <>
            <span className="mono">{formatTime(lastFill.occurredAt)}</span>
            <span className="text-ink-2">{lastFill.agentId}</span>
            <span className="mono">{lastFill.side}</span>
            <span className="mono">
              {formatPrice(lastFill.price ?? "0")} ×{" "}
              {formatQuantity(lastFill.quantity ?? "0")}
            </span>
            {lastFill.explorer ? (
              <a
                href={lastFill.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
              >
                {shortHash(lastFill.txHash)} ↗
              </a>
            ) : null}
          </>
        ) : lastVerified ? (
          <>
            <span className="mono">{formatTime(lastVerified.occurredAt)}</span>
            <span className="text-ink-2">{lastVerified.agentId}</span>
            <span className="mono">{lastVerified.kind}</span>
            {lastVerified.explorer ? (
              <a
                href={lastVerified.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
              >
                {shortHash(lastVerified.txHash)} ↗
              </a>
            ) : null}
          </>
        ) : (
          <span>No verified events yet</span>
        )}
      </div>
    </div>
  );
}

function formatCountdownSafe(seconds: number): string {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export { signedUnits };
