"use client";

import { useEffect, useState } from "react";

interface ExternalParticipant {
  address: string;
  fillCount: number;
  marketIds: string[];
  txHashes: string[];
  explorerTransactions: string[];
  lastActivity: string;
}

interface ParticipantResponse {
  classification: "EXTERNAL_PARTICIPANTS" | "UNAVAILABLE";
  reason: string;
  marketsScanned?: number;
  tradeCount?: number;
  participants: ExternalParticipant[];
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export default function ExternalParticipants() {
  const [response, setResponse] = useState<ParticipantResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/participants", { cache: "no-store" })
      .then(async (result) => {
        const data = await result.json() as ParticipantResponse;
        if (active) setResponse(data);
      })
      .catch(() => {
        if (active) setResponse({
          classification: "UNAVAILABLE",
          reason: "The public DreamDEX activity scan is temporarily unavailable.",
          participants: [],
        });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="external-panel" aria-labelledby="external-title">
      <div className="section-heading">
        <div>
          <span className="panel-label">DreamDEX activity scan</span>
          <h2 id="external-title">EXTERNAL PARTICIPANTS</h2>
        </div>
        <span className="section-note">
          {response?.participants.length ?? "..."} observed wallets
        </span>
      </div>
      <p className="external-note">
        Wallets below appear in indexed fills outside the IACTA roster. Identity and strategy remain unverified.
      </p>
      {!response ? (
        <p className="empty-state">Scanning recent DreamDEX fills...</p>
      ) : response.participants.length === 0 ? (
        <p className="empty-state">{response.reason}</p>
      ) : (
        <div className="external-list">
          {response.participants.slice(0, 12).map((participant) => (
            <article className="external-row" key={participant.address}>
              <div>
                <strong>{shortAddress(participant.address)}</strong>
                <span>{participant.fillCount} fills · {participant.marketIds.length} markets</span>
              </div>
              <div className="external-links">
                {participant.explorerTransactions.slice(0, 3).map((url, index) => (
                  <a href={url} key={url} target="_blank" rel="noreferrer">
                    tx {shortHash(participant.txHashes[index] ?? "")} ↗
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
