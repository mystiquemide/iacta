import Link from "next/link";
import { notFound } from "next/navigation";
import { readArenaState } from "@/lib/arena-server";

export const dynamic = "force-dynamic";

const PROFILES: Record<string, { architecture: string; description: string; posture: string }> = {
  RETIARIUS: {
    architecture: "Two-sided quoting",
    description: "Posts opposing YES and NO quotes around the live midpoint to invite a counterparty and bootstrap the book.",
    posture: "Liquidity seeker",
  },
  SECUTOR: {
    architecture: "Momentum IOC",
    description: "Tracks recent direction and crosses the best available ask when momentum has a clear sign, with a bounded bootstrap against a resting quote.",
    posture: "Directional aggressor",
  },
  THRAEX: {
    architecture: "Mean reversion",
    description: "Compares the latest YES price with its recent mean and takes the opposing outcome when the move is extended.",
    posture: "Counter-trend aggressor",
  },
  MURMILLO: {
    architecture: "Conservative minimum lot",
    description: "Acts only during a narrow, stable window and uses the venue minimum quantity to limit exposure.",
    posture: "Low-risk observer",
  },
  FRESH: {
    architecture: "Temporary fallback burner",
    description: "An isolated burner used for the CP-003 pair-crossing proof while the named RETIARIUS wallet was unfunded.",
    posture: "Disclosed fallback",
  },
};

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agentId = id.toUpperCase();
  const profile = PROFILES[agentId];
  if (!profile) notFound();

  const state = readArenaState();
  const agent = state.agents.find((candidate) => candidate.agentId === agentId);
  const events = state.killfeed.filter((event) => event.agentId === agentId);

  return (
    <main className="proof-shell">
      <nav className="site-nav arena-nav" aria-label="Primary navigation">
        <Link className="wordmark" href="/" aria-label="IACTA home">
          IACTA<span>.</span>
        </Link>
        <div className="arena-nav-links">
          <Link className="nav-link" href="/arena">Arena</Link>
          <Link className="nav-link" href="/standings">Standings</Link>
          <Link className="nav-link" href="/battles">Battles</Link>
          <a className="nav-link" href={state.chain.explorer} target="_blank" rel="noreferrer">
            Explorer <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>

      <header className="profile-heading">
        <div>
          <p className="eyebrow"><span className="status-dot" /> IACTA / AGENT PROFILE</p>
          <h1>{agentId}</h1>
          <p className="profile-posture">{profile.posture} · {profile.architecture}</p>
        </div>
        <div className="engine-status" aria-live="polite">
          <span className={`status-pill status-${state.engine.status.toLowerCase()}`}>
            {state.engine.status.toLowerCase()}
          </span>
          <p>{state.engine.reason}</p>
        </div>
      </header>

      <section className="profile-grid" aria-label={`${agentId} summary`}>
        <article className="profile-card profile-card-wide">
          <span className="panel-label">Strategy in plain words</span>
          <h2>{profile.description}</h2>
        </article>
        <article className="profile-card">
          <span className="panel-label">Score</span>
          <strong className="profile-score">{agent?.score ?? "0"}<small> raw</small></strong>
        </article>
        <article className="profile-card">
          <span className="panel-label">Receipts</span>
          <strong className="profile-number">{events.filter((event) => event.txHash).length}</strong>
          <span className="profile-help">linked events</span>
        </article>
      </section>

      <section className="profile-events" aria-labelledby="profile-events-title">
        <div className="section-heading">
          <div>
            <span className="panel-label">Agent history</span>
            <h2 id="profile-events-title">RECEIPT TRAIL</h2>
          </div>
          <Link className="section-note profile-back" href="/battles">View round archive</Link>
        </div>
        {events.length === 0 ? (
          <p className="empty-state">No events recorded for this agent.</p>
        ) : (
          <div className="profile-event-list">
            {events.map((event, index) => (
              <div className="profile-event-row" key={`${event.kind}-${event.txHash ?? "local"}-${index}`}>
                <span className="event-kind">{event.kind}</span>
                <span>{event.side ?? event.outcome ?? event.reason ?? "Recorded event"}</span>
                {event.explorer && event.txHash ? (
                  <a href={event.explorer} target="_blank" rel="noreferrer">
                    {shortHash(event.txHash)} ↗
                  </a>
                ) : (
                  <span className="proof-empty">No tx</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="proof-disclaimer">
        Strategy descriptions are architecture commitments. Performance claims come from the receipt trail, not from a backtest.
      </p>

      <footer className="site-footer">
        <span>IACTA / AGENT PROFILE</span>
        <span>Every claim, a receipt.</span>
      </footer>
    </main>
  );
}
