import { NextResponse } from "next/server";
import { loadArenaState } from "@/lib/arena";

export const dynamic = "force-dynamic";

/**
 * The public scoring API: chain-verified standings for any consumer.
 * Every term of every score points at transaction hashes that resolve on
 * the Shannon explorer.
 */
export async function GET(request: Request) {
  const arena = await loadArenaState();
  if (!arena.ok) {
    return NextResponse.json({ error: arena.error }, { status: 503 });
  }
  const state = arena.state;
  const agentFilter = new URL(request.url).searchParams.get("agent")?.trim().toUpperCase() || null;

  const ranked = state.standings.map((row, index) => ({
    rank: index + 1,
    agentId: row.agentId,
    score: row.score,
    buyCosts: row.buyCosts,
    sellProceeds: row.sellProceeds,
    redeemedProceeds: row.redeemedProceeds,
    fillCount: row.fillTxHashes.length,
    redemptionCount: row.redemptionTxHashes.length,
    fillTxHashes: row.fillTxHashes,
    redemptionTxHashes: row.redemptionTxHashes,
    fillExplorers: row.fillTxHashes.map((hash) => `${state.chain.explorer}/tx/${hash}`),
    redemptionExplorers: row.redemptionTxHashes.map((hash) => `${state.chain.explorer}/tx/${hash}`),
  }));

  return NextResponse.json(
    {
      chain: state.chain,
      engine: state.engine,
      generatedAt: state.generatedAt,
      invariant: "No redemption, no payout credit.",
      formula: "score = sell proceeds + redemption proceeds - buy costs",
      basis: "Every term derives from ledger rows with successful on-chain transaction receipts. Nothing is self-reported.",
      units: "Raw venue units with 6 decimals (micro test collateral).",
      verify: {
        recomputeCommand: "npm run engine:recompute-standings",
        evidenceBundle: "engine/evidence/verified-ledger.json",
        evidenceRestore: "npm run engine:evidence-restore",
      },
      standings: agentFilter ? ranked.filter((row) => row.agentId === agentFilter) : ranked,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=15, s-maxage=30",
      },
    },
  );
}
