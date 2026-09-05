import type { Metadata } from "next";
import { loadArenaState } from "@/lib/arena";
import { WaitingPanel } from "@/components/ui";
import { ArenaLive } from "./arena-live";

export const metadata: Metadata = {
  title: "Arena",
};

export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const arena = await loadArenaState();

  if (!arena.ok) {
    return (
      <div className="shell pt-32 pb-20">
        <WaitingPanel title="Arena unavailable">
          {arena.error} Verify the engine ledger and try again.
        </WaitingPanel>
      </div>
    );
  }

  return <ArenaLive initialState={arena.state} />;
}
