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
    <section className="ledger-panel" aria-labelledby="external-title">
      <div className="bill">
        <div>
          <span className="ia-label bill-label">DreamDEX activity scan</span>
          <h2 className="bill-title" id="external-title">EXTERNAL PARTICIPANTS</h2>
        </div>
        <span className="bill-note">
          {response?.participants.length ?? "..."} observed wallets
        </span>
      </div>
      <p className="field-note">
        Wallets below appear in indexed fills outside the IACTA roster. Identity and strategy remain unverified.
      </p>
      {!response ? (
        <p className="empty-note">Scanning recent DreamDEX fills...</p>
      ) : response.participants.length === 0 ? (
        <p className="empty-note">{response.reason}</p>
      ) : (
        <div className="ledger-list">
          {response.participants.slice(0, 12).map((participant) => (
            <article className="field-row" key={participant.address}>
              <div>
                <strong>{shortAddress(participant.address)}</strong>
                <span>{participant.fillCount} fills · {participant.marketIds.length} markets</span>
              </div>
              <div className="field-links">
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
