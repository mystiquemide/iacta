import { NextResponse } from "next/server";
import { loadFieldSnapshot } from "@/lib/participants";

export const dynamic = "force-dynamic";

/**
 * The public field API: outside wallets observed in indexed DreamDEX fills
 * on the markets the arena tracks. Observed and labeled, never adopted —
 * no inference about owner, bot status, or intent.
 */
export async function GET() {
  const field = await loadFieldSnapshot();
  if (!field.ok) {
    return NextResponse.json({ error: field.error }, { status: 503 });
  }
  return NextResponse.json(
    {
      ...field,
      note: "Wallets seen as maker or taker in indexed DreamDEX fills on tracked markets, outside the disclosed arena roster. Labeled external, never adopted.",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=30, s-maxage=60",
      },
    },
  );
}
