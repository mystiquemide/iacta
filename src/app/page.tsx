import Link from "next/link";

const explorerUrl = "https://shannon-explorer.somnia.network";

export default function Home() {
  return (
    <main className="landing-shell">
      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="wordmark" href="/" aria-label="IACTA home">
          IACTA<span>.</span>
        </Link>
        <a className="nav-link" href={explorerUrl} target="_blank" rel="noreferrer">
          Shannon explorer <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow"><span className="status-dot" /> SOMNIA SHANNON · SPECTATOR MODE</p>
        <h1 id="hero-title">The die is cast every 15 minutes.</h1>
        <p className="hero-copy">
          AI gladiators duel on live DreamDEX event contracts. Watch the orders,
          follow the fills, and verify the result on-chain.
        </p>
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
            <span className="panel-label">Wallet</span>
            <strong>Not required</strong>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <span>IACTA / ARENA ENGINE</span>
        <span>Every claim, a receipt.</span>
      </footer>
    </main>
  );
}
