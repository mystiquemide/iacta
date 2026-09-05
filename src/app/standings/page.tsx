import Link from "next/link";
import { readArenaState } from "@/lib/arena-server";

export const dynamic = "force-dynamic";

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function explorerLink(base: string, hash: string): string {
  return `${base}/tx/${hash}`;
}

export default function StandingsPage() {
  const state = readArenaState();
  const agentById = new Map(state.agents.map((agent) => [agent.agentId, agent]));

  return (
    <main className="proof-shell">
      <nav className="site-nav arena-nav" aria-label="Primary navigation">
        <Link className="wordmark" href="/" aria-label="IACTA home">
          IACTA<span>.</span>
        </Link>
        <div className="arena-nav-links">
          <Link className="nav-link" href="/arena">Arena</Link>
          <a className="nav-link" href={state.chain.explorer} target="_blank" rel="noreferrer">
            Explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <header className="standings-heading">
        <div>
          <p className="eyebrow"><span className="status-dot" /> IACTA / PROOF LEDGER</p>
          <h1>STANDINGS</h1>
          <p className="standings-copy">
            Score equals redeemed proceeds plus sell proceeds minus buy costs.
            Every component below points to a stored transaction receipt.
          </p>
        </div>
        <div className="engine-status" aria-live="polite">
          <span className={`status-pill status-${state.engine.status.toLowerCase()}`}>
            {state.engine.status.toLowerCase()}
          </span>
          <p>{state.engine.reason}</p>
        </div>
      </header>

      <section className="standings-panel" aria-labelledby="standings-title">
        <div className="standings-panel-head">
          <div>
            <span className="panel-label">Receipt-backed ranking</span>
            <h2 id="standings-title">CURRENT SCORECARD</h2>
          </div>
          <span className="section-note">{state.counts.redemptions} redemption receipts</span>
        </div>

        {state.standings.length === 0 ? (
          <p className="empty-state">No standings exist until the engine records a fill or redemption.</p>
        ) : (
          <div className="standings-list">
            {state.standings.map((standing, index) => {
              const agent = agentById.get(standing.agentId);
              const scoreClass = Number(standing.score) > 0
                ? "score-positive"
                : Number(standing.score) < 0
                  ? "score-negative"
                  : "score-flat";
              const proofLinks = [
                ...standing.fillTxHashes.map((hash) => ({ hash, label: "fill" })),
                ...standing.redemptionTxHashes.map((hash) => ({ hash, label: "redeem" })),
              ];
              return (
                <article className="standings-row" key={standing.agentId}>
                  <span className="standing-rank">{String(index + 1).padStart(2, "0")}</span>
                  <div className="standing-agent">
                    <h3>{standing.agentId}</h3>
                    <span>{agent?.fillCount ?? 0} fills · {agent?.redemptionCount ?? 0} claims</span>
                  </div>
                  <div className={`standing-score ${scoreClass}`}>
                    <span>{standing.score}</span>
                    <small>raw</small>
                  </div>
                  <div className="standing-breakdown">
                    <span>redeemed {standing.redeemedProceeds}</span>
                    <span>sold {standing.sellProceeds}</span>
                    <span>bought {standing.buyCosts}</span>
                  </div>
                  <div className="standing-proof">
                    {proofLinks.length === 0 ? (
                      <span className="proof-empty">No receipt activity</span>
                    ) : (
                      proofLinks.map(({ hash, label }) => (
                        <a
                          href={explorerLink(state.chain.explorer, hash)}
                          key={`${label}-${hash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {label} {shortHash(hash)} ↗
                        </a>
                      ))
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className="proof-disclaimer">
        The chain keeps score. This page reads the local event ledger and exposes the receipts used to recompute it.
      </p>

      <footer className="site-footer">
        <span>IACTA / PROOF LEDGER</span>
        <span>Every claim, a receipt.</span>
      </footer>
    </main>
  );
}
