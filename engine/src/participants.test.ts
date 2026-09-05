import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readKnownAgentWallets, summarizeExternalParticipants } from "./participants.js";

const known = `0x${"1".repeat(40)}`;
const externalA = `0x${"a".repeat(40)}`;
const externalB = `0x${"b".repeat(40)}`;
const marketA = `0x${"a".repeat(64)}`;
const marketB = `0x${"b".repeat(64)}`;

test("participant summary excludes known wallets and deduplicates each fill", () => {
  const participants = summarizeExternalParticipants([
    {
      marketId: marketA,
      txHash: "0xtrade1",
      timestamp: "2026-09-05T00:00:00.000Z",
      maker: externalA,
      taker: known,
    },
    {
      marketId: marketA,
      txHash: "0xtrade2",
      timestamp: "2026-09-05T00:01:00.000Z",
      maker: externalA,
      taker: externalA,
    },
    {
      marketId: marketB,
      txHash: "0xtrade3",
      timestamp: "2026-09-05T00:02:00.000Z",
      maker: externalB,
      taker: null,
    },
  ], [known]);

  assert.deepEqual(participants, [
    {
      address: externalA,
      fillCount: 2,
      marketIds: [marketA],
      txHashes: ["0xtrade1", "0xtrade2"],
      lastActivity: "2026-09-05T00:01:00.000Z",
    },
    {
      address: externalB,
      fillCount: 1,
      marketIds: [marketB],
      txHashes: ["0xtrade3"],
      lastActivity: "2026-09-05T00:02:00.000Z",
    },
  ]);
});

test("known wallet reader extracts addresses without loading private keys", () => {
  const directory = mkdtempSync(join(tmpdir(), "iacta-wallets-"));
  const envPath = join(directory, ".env.local");
  writeFileSync(envPath, [
    `IACTA_SECUTOR_ADDRESS=${known}`,
    `IACTA_SECUTOR_PRIVATE_KEY=0x${"f".repeat(64)}`,
    `IACTA_FRESH_ADDRESS=${externalA}`,
  ].join("\n"), { mode: 0o600 });

  try {
    assert.deepEqual(readKnownAgentWallets(envPath), [
      { agentId: "FRESH", address: externalA },
      { agentId: "SECUTOR", address: known },
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
