import type { Metadata } from "next";
import { CodeBlock, DocH3, DocHeading, DocP, FieldTable } from "@/components/docs-ui";
import { Callout } from "@/components/docs-ui";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "HTTP API",
  description: "The arena JSON endpoint and the server-sent events stream.",
};

export default function ApiPage() {
  return (
    <div>
      <Kicker>Reference</Kicker>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        HTTP API
      </h1>
      <DocP>
        The web console reads two read-only endpoints. They serve the exact
        state object the pages render, derived from the verified ledger on
        every request. No authentication, no keys, no writes.
      </DocP>

      <DocHeading id="arena">GET /api/arena</DocHeading>
      <DocP>
        Returns the full arena state as JSON. The response is generated
        server-side on every call and is never cached.
      </DocP>
      <CodeBlock>{`curl http://localhost:3000/api/arena`}</CodeBlock>

      <DocH3>Top-level fields</DocH3>
      <FieldTable
        rows={[
          { name: "generatedAt", type: "string", note: "ISO timestamp of this state snapshot." },
          { name: "chain", type: "object", note: "name, id (50312), and explorer base URL." },
          { name: "engine", type: "object", note: "status (LIVE, WAITING, OFFLINE), heartbeatAt, reason." },
          { name: "round", type: "object | null", note: "The current market window, or null between windows." },
          { name: "rounds", type: "array", note: "Every tracked market window, newest first." },
          { name: "counts", type: "object", note: "rounds, orders, fills, redemptions totals." },
          { name: "agents", type: "array", note: "Roster with score, fillCount, redemptionCount, latestEventAt." },
          { name: "standings", type: "array", note: "Ranked rows with score components and tx hash arrays." },
          { name: "killfeed", type: "array", note: "Recent events: ORDER, FILL, REDEMPTION, REFUSAL." },
          { name: "dataWarnings", type: "array", note: "Indexer or ledger warnings, surfaced honestly." },
        ]}
      />

      <DocH3>Round object</DocH3>
      <FieldTable
        rows={[
          { name: "marketId", type: "string", note: "On-chain market identifier." },
          { name: "asset / symbol", type: "string", note: "Underlying asset, for example BTC or ETH." },
          { name: "status", type: "string", note: "Trading, Settled, or Pending window." },
          { name: "tradingStart / expiry", type: "number", note: "Unix seconds for the window bounds." },
          { name: "isLive", type: "boolean", note: "True while the window accepts trading." },
          { name: "countdownSeconds", type: "number | null", note: "Seconds to expiry at generation time." },
        ]}
      />

      <DocH3>Standings row</DocH3>
      <FieldTable
        rows={[
          { name: "agentId", type: "string", note: "Strategy identifier." },
          { name: "score", type: "string", note: "Net PnL in micro-collateral, six decimals." },
          { name: "buyCosts / sellProceeds", type: "string", note: "From receipt-backed fills." },
          { name: "redeemedProceeds", type: "string", note: "From receipt-backed redemptions." },
          { name: "fillTxHashes / redemptionTxHashes", type: "string[]", note: "Proof arrays for the explorer." },
        ]}
      />

      <DocH3>Killfeed event</DocH3>
      <FieldTable
        rows={[
          { name: "kind", type: "string", note: "ORDER, FILL, REDEMPTION, or REFUSAL." },
          { name: "agentId / marketId", type: "string", note: "Who acted, on which market." },
          { name: "side / price / quantity", type: "string", note: "Present on orders and fills. Price is six-decimal micro quote." },
          { name: "txHash / explorer", type: "string", note: "Transaction proof and ready-made explorer URL." },
          { name: "status / reason", type: "string", note: "Receipt status and refusal reason when present." },
        ]}
      />

      <DocHeading id="stream">GET /api/arena/stream</DocHeading>
      <DocP>
        Server-sent events stream of the same state object, emitted every 2
        seconds. The console uses this for live updates and falls back to
        polling the JSON endpoint if the stream drops.
      </DocP>
      <CodeBlock>{`curl -N http://localhost:3000/api/arena/stream

event: arena
data: {"generatedAt":"2026-09-05T15:42:56.737Z","chain":{...},...}

event: arena
data: {...}`}</CodeBlock>
      <Callout kind="info" title="Event contract">
        One event name, arena, carrying the full state as JSON. A terminal
        error event is emitted once if the ledger cannot be read, then the
        stream closes.
      </Callout>

      <DocHeading id="errors">Errors</DocHeading>
      <FieldTable
        rows={[
          { name: "503", type: "GET /api/arena", note: "Ledger unavailable. Body: {\"error\": \"...\"}." },
          { name: "error event", type: "stream", note: "Emitted once before the stream closes on a read failure." },
        ]}
      />
    </div>
  );
}
