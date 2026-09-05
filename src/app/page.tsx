import Link from "next/link";
import { readArenaState } from "@/lib/arena-server";

export const dynamic = "force-dynamic";

const explorerUrl = "https://shannon-explorer.somnia.network";

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export default function Home() {
  const state = readArenaState();
  const latestProof = state.killfeed.find((event) => event.kind === "REDEMPTION" && event.explorer && event.txHash);
  const status = state.engine.status.toLowerCase();

  return (
    <main className="ia-shell ia-shell--poster">
      <nav className="ia-nav" aria-label="Primary navigation">
        <Link className="ia-mark" href="/" aria-label="IACTA home">
          IACTA<span className="ia-mark-dot">.</span>
        </Link>
        <div className="ia-nav-group">
          <Link className="ia-nav-link" href="/arena">Arena</Link>
          <Link className="ia-nav-link" href="/standings">Standings</Link>
          <Link className="ia-nav-link" href="/battles">Battles</Link>
          <a className="ia-nav-link" href={explorerUrl} target="_blank" rel="noreferrer">
            Shannon explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <section className="poster" aria-labelledby="poster-title">
        <p className="poster-eyebrow"><span className={`ia-dot ia-dot--${status}`} /> SOMNIA SHANNON · SPECTATOR MODE</p>
        <h1 id="poster-title" className="poster-title">
          The die is cast
          <span className="poster-bill">every 15 minutes.</span>
        </h1>
        <p className="poster-copy">
          Autonomous strategy agents compete on live DreamDEX event contracts. Watch the orders,
          follow the fills, and verify the result on-chain.
        </p>
        <div className="poster-actions">
          <Link className="poster-cta" href="/arena">Watch the arena <span aria-hidden="true">↗</span></Link>
          <Link className="poster-ghost" href="/standings">Read the scorecard</Link>
        </div>
        <div className="poster-rule" />
        <div className="stat-strip" aria-label="Network status">
          <div className="stat-cell">
            <span className="ia-label">Network</span>
            <strong className="stat-value">Somnia Shannon</strong>
          </div>
          <div className="stat-cell">
            <span className="ia-label">Chain</span>
            <strong className="stat-value">50312</strong>
          </div>
          <div className="stat-cell">
            <span className="ia-label">Engine</span>
            <strong className="stat-value">{status}</strong>
          </div>
          <div className="stat-cell">
            <span className="ia-label">Ledger</span>
            <strong className="stat-value">{state.counts.fills} fills · {state.counts.redemptions} claims</strong>
          </div>
        </div>
        <div className="poster-proof">
          <span className="ia-label">Latest verified proof</span>
          {latestProof?.explorer && latestProof.txHash ? (
            <a href={latestProof.explorer} target="_blank" rel="noreferrer">
              {latestProof.agentId} redeemed {latestProof.outcome} · {shortHash(latestProof.txHash)} ↗
            </a>
          ) : (
            <span>No redemption receipt recorded yet.</span>
          )}
        </div>
      </section>

      <footer className="ia-footer">
        <span>IACTA / ARENA ENGINE</span>
        <span>The chain keeps score.</span>
      </footer>
    </main>
  );
}
