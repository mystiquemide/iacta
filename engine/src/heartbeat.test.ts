import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeHeartbeat } from "./heartbeat.js";

test("heartbeat writer atomically records a fresh timestamp with private permissions", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-heartbeat-"));
  const heartbeatPath = join(directory, "nested", "engine-heartbeat.json");
  const now = new Date("2026-09-05T08:30:00.000Z");

  try {
    assert.equal(writeHeartbeat(heartbeatPath, now), now.toISOString());
    assert.deepEqual(JSON.parse(readFileSync(heartbeatPath, "utf8")), {
      heartbeatAt: now.toISOString(),
      mode: "LIVE",
    });
    assert.equal(statSync(heartbeatPath).mode & 0o777, 0o600);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("heartbeat writer marks dry runs so the UI cannot present them as live", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-heartbeat-dry-run-"));
  const heartbeatPath = join(directory, "engine-heartbeat.json");
  const now = new Date("2026-09-05T08:31:00.000Z");

  try {
    writeHeartbeat(heartbeatPath, now, "DRY_RUN");
    assert.deepEqual(JSON.parse(readFileSync(heartbeatPath, "utf8")), {
      heartbeatAt: now.toISOString(),
      mode: "DRY_RUN",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
