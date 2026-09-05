"use client";

import { useEffect, useState } from "react";
import type { ArenaState } from "@/lib/arena";
import { profileFor } from "@/lib/agents";
import {
  formatCountdown,
  formatPrice,
  formatQuantity,
  formatTime,
  shortHash,
  shortMarketId,
  signedUnits,
} from "@/lib/format";
import { EmptyState, ExplorerLink, SectionLabel, StatusText } from "@/components/ui";
import { useCountdown } from "@/components/use-countdown";
import { latestFillForMarket, latestVerifiedTx, leaderRow } from "@/lib/derive";

const POLL_MS = 10_000;

function latestYesNoPrices(state: ArenaState): { yes: string; no: string } | null {
  const fill = state.round ? latestFillForMarket(state, state.round.marketId) : null;
  if (!fill || fill.price === undefined) return null;
  const price = Number(fill.price) / 1_000_000;
  return { yes: price.toFixed(3), no: (1 - price).toFixed(3) };
}

export function MarketWidget({ initialState }: { initialState: ArenaState }) {
  const [state, setState] = useState(initialState);
  const countdown = useCountdown(
    state.round?.countdownSeconds ?? null,
    state.generatedAt,
  );

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const response = await fetch("/api/arena", { cache: "no-store" });
        if (response.ok) setState((await response.json()) as ArenaState);
      } catch {
        // Keep the last good state; the next poll retries.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const round = state.round;
  const prices = latestYesNoPrices(state);
  const leader = leaderRow(state);
  const leaderProfile = leader ? profileFor(leader.agentId) : null;
  const verified = latestVerifiedTx(state);

  return (
    <div className="rounded-sm border border-mist bg-white p-16 shadow-sm-2">
      <div className="flex items-center justify-between border-b border-mist pb-16">
        <SectionLabel>Live market</SectionLabel>
        <StatusText status={state.engine.status} />
      </div>

      {round ? (
        <div className="flex flex-col gap-16 pt-16">
          <div className="flex items-baseline justify-between gap-16">
            <div className="flex items-baseline gap-8">
              <span className="text-heading-sm font-bold text-pure-black">
                {round.asset}
              </span>
              <span className="text-caption text-steel">
                {round.asset}/USD · {shortMarketId(round.marketId)}
              </span>
            </div>
            <span className="num text-body-sm font-medium text-pure-black">
              {formatCountdown(countdown)}
            </span>
          </div>

          {prices ? (
            <div className="grid grid-cols-2 gap-16">
              <div className="rounded-sm border border-mist bg-paper px-16 py-8">
                <span className="label">YES</span>
                <p className="num text-heading-sm font-bold text-pure-black">
                  {prices.yes}
                </p>
              </div>
              <div className="rounded-sm border border-mist bg-paper px-16 py-8">
                <span className="label">NO</span>
                <p className="num text-heading-sm font-bold text-pure-black">
                  {prices.no}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-body-sm text-iron">
              No fills yet in this window. Prices appear after the first verified trade.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-16 gap-y-8 text-body-sm">
            <div className="flex items-center justify-between gap-8">
              <dt className="text-iron">Window</dt>
              <dd className="text-caption text-steel">{round.status}</dd>
            </div>
            <div className="flex items-center justify-between gap-8">
              <dt className="text-iron">Venue</dt>
              <dd className="text-caption text-steel">DreamDEX</dd>
            </div>
            <div className="flex items-center justify-between gap-8">
              <dt className="text-iron">Leader</dt>
              <dd className="font-medium text-pure-black">
                {leaderProfile ? leaderProfile.agentId : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-8">
              <dt className="text-iron">Score</dt>
              <dd className="num font-medium text-pure-black">
                {leader ? signedUnits(leader.score) : "—"}
              </dd>
            </div>
          </dl>

          <div className="border-t border-mist pt-16">
            <div className="flex items-center justify-between gap-8">
              <span className="label">Latest verified transaction</span>
              <span className="text-caption text-steel">
                {formatTime(verified?.occurredAt ?? null)}
              </span>
            </div>
            {verified?.explorer ? (
              <ExplorerLink href={verified.explorer}>{shortHash(verified.txHash)}</ExplorerLink>
            ) : (
              <p className="text-body-sm text-iron">Awaiting the first verified event.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="pt-16">
          <EmptyState
            label={state.engine.status === "OFFLINE" ? "Engine offline" : "No active market"}
            message={
              state.engine.status === "OFFLINE"
                ? "The engine heartbeat is stale. Live data returns when the strategy loop resumes."
                : state.engine.reason
            }
          />
        </div>
      )}

      {state.round && latestFillForMarket(state, state.round.marketId)?.quantity ? (
        <p className="mt-16 border-t border-mist pt-16 text-caption text-steel">
          Last fill: {latestFillForMarket(state, state.round.marketId)?.side ?? "—"}{" "}
          {formatQuantity(latestFillForMarket(state, state.round.marketId)?.quantity ?? "0")} @{" "}
          {formatPrice(latestFillForMarket(state, state.round.marketId)?.price ?? "0")} · amounts
          in test collateral
        </p>
      ) : null}
    </div>
  );
}
