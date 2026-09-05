"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ArenaState, KillfeedEvent } from "@/lib/arena-server";

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
  return value ? value.slice(11, 19) : "--:--:--";
}

function statusLabel(status: ArenaState["engine"]["status"]): string {
  return status.toLowerCase();
}

function statusClass(status: ArenaState["engine"]["status"]): string {
  return `status-pill status-${status.toLowerCase()}`;
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
    <main className="arena-shell">
      <nav className="site-nav arena-nav" aria-label="Primary navigation">
        <Link className="wordmark" href="/" aria-label="IACTA home">
          IACTA<span>.</span>
        </Link>
        <div className="arena-nav-links">
          <Link className="nav-link" href="/">Home</Link>
          <Link className="nav-link" href="/standings">Standings</Link>
          <Link className="nav-link" href="/battles">Battles</Link>
          <a className="nav-link" href={state.chain.explorer} target="_blank" rel="noreferrer">
            Explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <header className="arena-heading">
        <div>
          <p className="eyebrow"><span className="status-dot" /> IACTA / SPECTATOR ARENA</p>
          <h1>THE BOUT BOARD</h1>
        </div>
        <div className="engine-status" aria-live="polite">
          <span className={statusClass(state.engine.status)}>{statusLabel(state.engine.status)}</span>
          <p>{state.engine.reason}</p>
        </div>
      </header>

      <section className="round-banner" aria-label="Round status">
        <div>
          <span className="panel-label">Round</span>
          <strong>{roundLabel(state.round)}</strong>
        </div>
        <div>
          <span className="panel-label">Market</span>
          <strong>{state.round?.asset ?? "--"}</strong>
        </div>
        <div>
          <span className="panel-label">Window</span>
          <strong>{state.round?.isLive ? `${state.round.countdownSeconds}s` : "history only"}</strong>
        </div>
        <div>
          <span className="panel-label">Ledger</span>
          <strong>{state.counts.fills} fills / {state.counts.redemptions} redemptions</strong>
        </div>
      </section>

      <section aria-labelledby="gladiators-title">
        <div className="section-heading">
          <div>
            <span className="panel-label">Four architectures</span>
            <h2 id="gladiators-title">GLADIATORS</h2>
          </div>
          <span className="section-note">Scores use redeemed collateral only</span>
        </div>
        <div className="agent-grid">
          {agents.map((agent, index) => (
            <article className="agent-card" key={agent.agentId}>
              <div className="agent-card-top">
                <span className="agent-index">0{index + 1}</span>
                <span className="agent-activity">{agent.fillCount} fills</span>
              </div>
              <h3><Link href={`/agents/${agent.agentId}`}>{agent.agentId}</Link></h3>
              <p className="agent-score">{agent.score}<small> raw</small></p>
              <div className="agent-meta">
                <span>redeemed {agent.redeemedProceeds}</span>
                <span>claims {agent.redemptionCount}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="killfeed-panel" aria-labelledby="killfeed-title">
        <div className="section-heading">
          <div>
            <span className="panel-label">Transaction stream</span>
            <h2 id="killfeed-title">KILLFEED</h2>
          </div>
          <span className="section-note">Every row points to the chain</span>
        </div>
        {state.killfeed.length === 0 ? (
          <p className="empty-state">No recorded events yet. The engine is {statusLabel(state.engine.status)}.</p>
        ) : (
          <div className="killfeed-list">
            {state.killfeed.slice(0, 12).map((event, index) => (
              <div className="killfeed-row" key={`${event.kind}-${event.txHash ?? "local"}-${index}`}>
                <time>{timeLabel(event.occurredAt)}</time>
                <span className={`event-kind event-${event.kind.toLowerCase()}`}>{event.kind}</span>
                <span className="event-copy">{eventTitle(event)}</span>
                {event.kind === "FILL" && event.fillPath === "mint" ? (
                  <span className="mint-badge">MINT-A-PAIR</span>
                ) : null}
                {event.explorer ? (
                  <a className="event-link" href={event.explorer} target="_blank" rel="noreferrer">
                    {shortHash(event.txHash)} ↗
                  </a>
                ) : (
                  <span className="event-link">{shortHash(event.txHash)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {state.dataWarnings.length > 0 ? (
        <aside className="data-warning" role="status">
          Data warning: {state.dataWarnings.join(" ")}
        </aside>
      ) : null}

      <footer className="site-footer">
        <span>IACTA / ARENA ENGINE</span>
        <span>Every claim, a receipt.</span>
      </footer>
    </main>
  );
}
