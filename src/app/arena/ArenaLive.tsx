"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ArenaState, KillfeedEvent } from "@/lib/arena-server";
import { PROFILES } from "@/lib/gladiators";
import ExternalParticipants from "./ExternalParticipants";

const BATTLE_AGENTS = ["RETIARIUS", "SECUTOR", "THRAEX", "MURMILLO"];

function shortHash(hash: string | null): string {
  if (!hash) return "local event";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function eventTitle(event: KillfeedEvent): string {
  switch (event.kind) {
    case "ORDER":
      return `${event.agentId} placed ${event.side ?? "an order"}`;
    case "FILL":
      return `${event.agentId} filled ${event.side ?? "an order"}`;
    case "REDEMPTION":
      return `${event.agentId} redeemed ${event.outcome ?? "a position"}`;
    case "REFUSAL":
      return `${event.agentId} refused a trade`;
  }
}

function timeLabel(value: string | null): string {
  return value ? `${value.slice(11, 19)} UTC` : "--:--:-- UTC";
}

function statusLabel(status: ArenaState["engine"]["status"]): string {
  return status.toLowerCase();
}

function statusClass(status: ArenaState["engine"]["status"]): string {
  return `engine-pill engine-pill--${status.toLowerCase()}`;
}

function roundLabel(round: ArenaState["round"]): string {
  if (!round) return "No recorded round";
  return /^0x[0-9a-f]+$/i.test(round.symbol) ? `${round.asset} window` : round.symbol;
}

export default function ArenaLive({ initialState }: { initialState: ArenaState }) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    const source = new EventSource("/api/arena/stream");
    const handleArena = (event: Event) => {
      try {
        setState(JSON.parse((event as MessageEvent<string>).data) as ArenaState);
      } catch {
        // Keep the last verified state when a malformed stream frame arrives.
      }
    };
    source.addEventListener("arena", handleArena);
    return () => {
      source.removeEventListener("arena", handleArena);
      source.close();
    };
  }, []);

  const agents = BATTLE_AGENTS.map((agentId) => state.agents.find((agent) => agent.agentId === agentId) ?? {
    agentId,
    score: "0",
    redeemedProceeds: "0",
    fillCount: 0,
    redemptionCount: 0,
    latestEventAt: null,
  });

  return (
    <main className="ia-shell">
      <nav className="ia-nav" aria-label="Primary navigation">
        <Link className="ia-mark" href="/" aria-label="IACTA home">
          IACTA<span className="ia-mark-dot">.</span>
        </Link>
        <div className="ia-nav-group">
          <Link className="ia-nav-link" href="/">Home</Link>
          <Link className="ia-nav-link" href="/standings">Standings</Link>
          <Link className="ia-nav-link" href="/battles">Battles</Link>
          <a className="ia-nav-link" href={state.chain.explorer} target="_blank" rel="noreferrer">
            Explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <header className="board-head">
        <div>
          <p className="poster-eyebrow"><span className="ia-dot" /> IACTA / SPECTATOR ARENA</p>
          <h1 className="board-title">THE BOUT BOARD</h1>
        </div>
        <div className="engine-box" aria-live="polite">
          <span className={statusClass(state.engine.status)}>{statusLabel(state.engine.status)}</span>
          <p className="engine-note">{state.engine.reason}</p>
        </div>
      </header>

      <section className="round-strip" aria-label="Round status">
        <div className="round-cell">
          <span className="ia-label">Round</span>
          <strong className="round-value">{roundLabel(state.round)}</strong>
        </div>
        <div className="round-cell">
          <span className="ia-label">Market</span>
          <strong className="round-value">{state.round?.asset ?? "--"}</strong>
        </div>
        <div className="round-cell">
          <span className="ia-label">Window</span>
          <strong className="round-value">{state.round?.isLive ? `${state.round.countdownSeconds}s` : "history only"}</strong>
        </div>
        <div className="round-cell">
          <span className="ia-label">Ledger</span>
          <strong className="round-value">{state.counts.fills} fills / {state.counts.redemptions} redemptions</strong>
        </div>
      </section>

      <section aria-labelledby="gladiators-title">
        <div className="bill">
          <div>
            <span className="ia-label bill-label">Four architectures</span>
            <h2 className="bill-title" id="gladiators-title">GLADIATORS</h2>
          </div>
          <span className="bill-note">Score: redeemed + sold - bought</span>
        </div>
        <div className="fight-grid">
          {agents.map((agent, index) => (
            <article className="fight-card" key={agent.agentId}>
              <div className="fight-top">
                <span className="fight-no">0{index + 1}</span>
                <span className="fight-activity">{agent.fillCount} fills</span>
              </div>
              <h3 className="fight-name"><Link href={`/agents/${agent.agentId}`}>{agent.agentId}</Link></h3>
              <p className="fight-posture">{PROFILES[agent.agentId]?.posture ?? "Unlisted"}</p>
              <p className="fight-score">{agent.score}<small> raw</small></p>
              <div className="fight-meta">
                <span>redeemed {agent.redeemedProceeds}</span>
                <span>claims {agent.redemptionCount}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ledger-panel" aria-labelledby="killfeed-title">
        <div className="bill">
          <div>
            <span className="ia-label bill-label">Transaction stream</span>
            <h2 className="bill-title" id="killfeed-title">KILLFEED</h2>
          </div>
          <span className="bill-note">Every row points to the chain</span>
        </div>
        {state.killfeed.length === 0 ? (
          <p className="empty-note">No recorded events yet. The engine is {statusLabel(state.engine.status)}.</p>
        ) : (
          <div className="ledger-list">
            {state.killfeed.slice(0, 12).map((event, index) => (
              <div className="ledger-row" key={`${event.kind}-${event.txHash ?? "local"}-${index}`}>
                <time className="ledger-time">{timeLabel(event.occurredAt)}</time>
                <span className={`ledger-kind kind-${event.kind.toLowerCase()}`}>{event.kind}</span>
                <span className="ledger-copy">{eventTitle(event)}</span>
                {event.kind === "FILL" && event.fillPath === "mint" ? (
                  <span className="mint-tag">MINT-A-PAIR</span>
                ) : null}
                {event.explorer ? (
                  <a className="ledger-link" href={event.explorer} target="_blank" rel="noreferrer">
                    {shortHash(event.txHash)} ↗
                  </a>
                ) : (
                  <span className="ledger-link">{shortHash(event.txHash)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {state.dataWarnings.length > 0 ? (
        <aside className="warn-note" role="status">
          Data warning: {state.dataWarnings.join(" ")}
        </aside>
      ) : null}

      <ExternalParticipants />

      <footer className="ia-footer">
        <span>IACTA / ARENA ENGINE</span>
        <span>Every claim, a receipt.</span>
      </footer>
    </main>
  );
}
