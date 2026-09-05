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
    <main className="ia-shell">
      <nav className="ia-nav" aria-label="Primary navigation">
        <Link className="ia-mark" href="/" aria-label="IACTA home">
          IACTA<span className="ia-mark-dot">.</span>
        </Link>
        <div className="ia-nav-group">
          <Link className="ia-nav-link" href="/arena">Arena</Link>
          <Link className="ia-nav-link" href="/battles">Battles</Link>
          <a className="ia-nav-link" href={state.chain.explorer} target="_blank" rel="noreferrer">
            Explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <header className="board-head">
        <div>
          <p className="poster-eyebrow"><span className="ia-dot" /> IACTA / PROOF LEDGER</p>
          <h1 className="board-title">STANDINGS</h1>
          <p className="board-copy">
            Score equals redeemed proceeds plus sell proceeds minus buy costs.
            Every component below points to a stored transaction receipt.
          </p>
        </div>
        <div className="engine-box" aria-live="polite">
          <span className={`engine-pill engine-pill--${state.engine.status.toLowerCase()}`}>
            {state.engine.status.toLowerCase()}
          </span>
          <p className="engine-note">{state.engine.reason}</p>
        </div>
      </header>

      <section className="ledger-panel" aria-labelledby="standings-title">
        <div className="rank-head">
          <div>
            <span className="ia-label">Receipt-backed ranking</span>
            <h2 className="rank-head-title" id="standings-title">CURRENT SCORECARD</h2>
          </div>
          <span className="bill-note">{state.counts.redemptions} redemption receipts</span>
        </div>

        {state.standings.length === 0 ? (
          <p className="empty-note">No standings exist until the engine records a fill or redemption.</p>
        ) : (
          <div className="ledger-list">
            {state.standings.map((standing, index) => {
              const agent = agentById.get(standing.agentId);
              const scoreClass = Number(standing.score) > 0
                ? "score-pos"
                : Number(standing.score) < 0
                  ? "score-neg"
                  : "score-flat";
              const proofLinks = [
                ...standing.fillTxHashes.map((hash) => ({ hash, label: "fill" })),
                ...standing.redemptionTxHashes.map((hash) => ({ hash, label: "redeem" })),
              ];
              return (
                <article className="rank-row" key={standing.agentId}>
                  <span className="rank-no">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="rank-name"><Link href={`/agents/${standing.agentId}`}>{standing.agentId}</Link></h3>
                    <span className="rank-facts">{agent?.fillCount ?? 0} fills · {agent?.redemptionCount ?? 0} claims</span>
                  </div>
                  <div className={`rank-score ${scoreClass}`}>
                    <span>{standing.score}</span>
                    <small>raw</small>
                  </div>
                  <div className="rank-breakdown">
                    <span>redeemed {standing.redeemedProceeds}</span>
                    <span>sold {standing.sellProceeds}</span>
                    <span>bought {standing.buyCosts}</span>
                  </div>
                  <div className="rank-proof">
                    {proofLinks.length === 0 ? (
                      <span className="proof-none">No receipt activity</span>
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

      <p className="rank-disclaimer">
        The chain keeps score. This page reads the local event ledger and exposes the receipts used to recompute it.
      </p>

      <footer className="ia-footer">
        <span>IACTA / PROOF LEDGER</span>
        <span>Every claim, a receipt.</span>
      </footer>
    </main>
  );
}
