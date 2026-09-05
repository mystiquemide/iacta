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
    <main className="ia-shell">
      <nav className="ia-nav" aria-label="Primary navigation">
        <Link className="ia-mark" href="/" aria-label="IACTA home">
          IACTA<span className="ia-mark-dot">.</span>
        </Link>
        <div className="ia-nav-group">
          <Link className="ia-nav-link" href="/arena">Arena</Link>
          <Link className="ia-nav-link" href="/standings">Standings</Link>
          <a className="ia-nav-link" href={state.chain.explorer} target="_blank" rel="noreferrer">
            Explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <header className="board-head">
        <div>
          <p className="poster-eyebrow"><span className="ia-dot" /> IACTA / ROUND ARCHIVE</p>
          <h1 className="board-title">BATTLES</h1>
          <p className="board-copy">
            Recorded market windows, ordered by expiry. A row becomes proof when its stored events point to receipts.
          </p>
        </div>
        <div className="engine-box" aria-live="polite">
          <span className={`engine-pill engine-pill--${state.engine.status.toLowerCase()}`}>
            {state.engine.status.toLowerCase()}
          </span>
          <p className="engine-note">{state.engine.reason}</p>
        </div>
      </header>

      <section className="ledger-panel" aria-labelledby="archive-title">
        <div className="rank-head">
          <div>
            <span className="ia-label">Event-store history</span>
            <h2 className="rank-head-title" id="archive-title">RECORDED WINDOWS</h2>
          </div>
          <span className="bill-note">{state.rounds.length} round rows</span>
        </div>

        {state.rounds.length === 0 ? (
          <p className="empty-note">No rounds have been recorded yet.</p>
        ) : (
          <div className="ledger-list">
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
                <article className="history-row" key={round.marketId}>
                  <div className="history-no">{String(index + 1).padStart(2, "0")}</div>
                  <div className="history-main">
                    <div className="history-title-line">
                      <h3 className="history-title">{roundLabel(round)}</h3>
                      <span className={`history-status ${round.isLive ? "st-live" : "st-history"}`}>
                        {round.isLive ? "live" : "history"}
                      </span>
                    </div>
                    <span className="history-id">{round.marketId}</span>
                  </div>
                  <div className="history-facts">
                    <span>{round.asset}</span>
                    <span>{statusLabel(round)}</span>
                    <span>{fills.length} fills · {redemptions.length} claims</span>
                  </div>
                  <div className="history-links">
                    {links.length === 0 ? (
                      <span className="proof-none">No tx events</span>
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

      <p className="rank-disclaimer">
        Resolution and redemption are shown only after the engine records them. This archive never infers a winner from an unverified balance.
      </p>

      <footer className="ia-footer">
        <span>IACTA / ROUND ARCHIVE</span>
        <span>Every claim, a receipt.</span>
      </footer>
    </main>
  );
}
