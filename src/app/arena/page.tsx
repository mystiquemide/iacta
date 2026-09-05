import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { EmptyState } from "@/components/ui";
import { ArenaLive } from "./arena-live";

export const metadata: Metadata = {
  title: "Arena",
};

export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell py-80">
        <EmptyState
          label="Arena unavailable"
          message={`${arena.error} Verify the engine ledger and try again.`}
        />
      </div>
    );
  }

  return (
    <div className="py-40">
      <ArenaLive initialState={arena.state} />
    </div>
  );
}
