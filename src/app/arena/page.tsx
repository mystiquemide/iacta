import { readArenaState } from "@/lib/arena-server";
import ArenaLive from "./ArenaLive";

export const dynamic = "force-dynamic";

export default function ArenaPage() {
  return <ArenaLive initialState={readArenaState()} />;
}
