import Link from "next/link";
import { readArenaState } from "@/lib/arena-server";

export const dynamic = "force-dynamic";

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function roundLabel(round: { symbol: string; asset: string }): string {
  return /^0x[0-9a-f]+$/i.test(round.symbol) ? `${round.asset} window` : round.symbol;
}

function statusLabel(round: { isLive: boolean; status: string }): string {
  return !round.isLive && round.status === "Trading" ? "Recorded" : round.status;
}

export default function BattlesPage() {
  const state = readArenaState();

  return (
    <main className="proof-shell">
      <nav className="site-nav arena-nav" aria-label="Primary navigation">
        <Link className="wordmark" href="/" aria-label="IACTA home">
          IACTA<span>.</span>
        </Link>
        <div className="arena-nav-links">
          <Link className="nav-link" href="/arena">Arena</Link>
          <Link className="nav-link" href="/standings">Standings</Link>
          <a className="nav-link" href={state.chain.explorer} target="_blank" rel="noreferrer">
            Explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <header className="archive-heading">
        <div>
          <p className="eyebrow"><span className="status-dot" /> IACTA / ROUND ARCHIVE</p>
          <h1>BATTLES</h1>
          <p className="standings-copy">
            Recorded market windows, ordered by expiry. A row becomes proof when its stored events point to receipts.
          </p>
        </div>
        <div className="engine-status" aria-live="polite">
          <span className={`status-pill status-${state.engine.status.toLowerCase()}`}>
            {state.engine.status.toLowerCase()}
          </span>
          <p>{state.engine.reason}</p>
        </div>
      </header>

      <section className="archive-panel" aria-labelledby="archive-title">
        <div className="standings-panel-head">
          <div>
            <span className="panel-label">Event-store history</span>
            <h2 id="archive-title">RECORDED WINDOWS</h2>
          </div>
          <span className="section-note">{state.rounds.length} round rows</span>
        </div>

        {state.rounds.length === 0 ? (
          <p className="empty-state">No rounds have been recorded yet.</p>
        ) : (
          <div className="archive-list">
            {state.rounds.map((round, index) => {
              const events = state.killfeed.filter((event) => event.marketId === round.marketId);
              const fills = events.filter((event) => event.kind === "FILL");
              const redemptions = events.filter((event) => event.kind === "REDEMPTION");
              const links = [...new Map(
                events
                  .filter((event) => event.explorer && event.txHash)
                  .map((event) => [event.txHash, event.explorer] as const),
              ).entries()];
              return (
                <article className="archive-row" key={round.marketId}>
                  <div className="archive-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="archive-main">
                    <div className="archive-title-line">
                      <h3>{roundLabel(round)}</h3>
                      <span className={`archive-status ${round.isLive ? "archive-live" : "archive-history"}`}>
                        {round.isLive ? "live" : "history"}
                      </span>
                    </div>
                    <span className="archive-id">{round.marketId}</span>
                  </div>
                  <div className="archive-facts">
                    <span>{round.asset}</span>
                    <span>{statusLabel(round)}</span>
                    <span>{fills.length} fills · {redemptions.length} claims</span>
                  </div>
                  <div className="archive-links">
                    {links.length === 0 ? (
                      <span className="proof-empty">No tx events</span>
                    ) : (
                      links.map(([hash, explorer]) => (
                        <a href={explorer ?? "#"} key={hash} target="_blank" rel="noreferrer">
                          {shortHash(hash ?? "")} ↗
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
        Resolution and redemption are shown only after the engine records them. This archive never infers a winner from an unverified balance.
      </p>

      <footer className="site-footer">
        <span>IACTA / ROUND ARCHIVE</span>
        <span>Every claim, a receipt.</span>
      </footer>
    </main>
  );
}
