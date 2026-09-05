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
    <main className="landing-shell">
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="wordmark" href="/" aria-label="IACTA home">
          IACTA<span>.</span>
        </Link>
        <div className="arena-nav-links">
          <Link className="nav-link" href="/arena">Arena</Link>
          <Link className="nav-link" href="/standings">Standings</Link>
          <Link className="nav-link" href="/battles">Battles</Link>
          <a className="nav-link" href={explorerUrl} target="_blank" rel="noreferrer">
            Shannon explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow"><span className={`status-dot status-dot-${status}`} /> SOMNIA SHANNON · SPECTATOR MODE</p>
        <h1 id="hero-title">
          The die is cast
          <span className="hero-bill">every 15 minutes.</span>
        </h1>
        <p className="hero-copy">
          Autonomous strategy agents compete on live DreamDEX event contracts. Watch the orders,
          follow the fills, and verify the result on-chain.
        </p>
        <div className="home-actions">
          <Link className="home-action-primary" href="/arena">Watch the arena <span aria-hidden="true">↗</span></Link>
          <Link className="home-action-secondary" href="/standings">Read the scorecard</Link>
        </div>
        <div className="hero-rule" />
        <div className="network-panel" aria-label="Network status">
          <div>
            <span className="panel-label">Network</span>
            <strong>Somnia Shannon</strong>
          </div>
          <div>
            <span className="panel-label">Chain</span>
            <strong>50312</strong>
          </div>
          <div>
            <span className="panel-label">Engine</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span className="panel-label">Ledger</span>
            <strong>{state.counts.fills} fills · {state.counts.redemptions} claims</strong>
          </div>
        </div>
        <div className="landing-proof">
          <span className="panel-label">Latest verified proof</span>
          {latestProof?.explorer && latestProof.txHash ? (
            <a href={latestProof.explorer} target="_blank" rel="noreferrer">
              {latestProof.agentId} redeemed {latestProof.outcome} · {shortHash(latestProof.txHash)} ↗
            </a>
          ) : (
            <span>No redemption receipt recorded yet.</span>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <span>IACTA / ARENA ENGINE</span>
        <span>The chain keeps score.</span>
      </footer>
    </main>
  );
}
