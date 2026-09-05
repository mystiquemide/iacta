import { readArenaState } from "@/lib/arena-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  try {
    return Response.json(readArenaState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Arena state is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
