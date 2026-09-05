import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type HeartbeatMode = "LIVE" | "DRY_RUN";

export function defaultHeartbeatPath(): string {
  const dataRoot = process.cwd().endsWith("/engine") ? process.cwd() : resolve(process.cwd(), "engine");
  return resolve(dataRoot, "data", "engine-heartbeat.json");
}

export function writeHeartbeat(
  path = process.env.IACTA_HEARTBEAT_PATH ?? defaultHeartbeatPath(),
  now = new Date(),
  mode: HeartbeatMode = "LIVE",
): string {
  const heartbeatAt = now.toISOString();
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(temporaryPath, `${JSON.stringify({ heartbeatAt, mode })}\n`, { mode: 0o600, encoding: "utf8" });
    renameSync(temporaryPath, path);
    return heartbeatAt;
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}
