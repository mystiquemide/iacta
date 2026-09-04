import assert from "node:assert/strict";
import test from "node:test";
import {
  decide,
  guardOrderIntent,
  type MarketSnapshot,
  type OrderIntent,
} from "./strategies.js";

const one = 1_000_000n;

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    marketId: "0xmarket",
    poolAddress: "0xpool",
    status: 1,
    now: 1_000,
    expiry: 1_600,
    quoteOne: one,
    tickSize: 10_000n,
    lotSize: 1_000n,
    minQuantity: 1_000n,
    yesBids: [{ price: 490_000n, quantity: 5_000n }],
    yesAsks: [{ price: 510_000n, quantity: 5_000n }],
    recentYesPrices: [490_000n, 500_000n, 510_000n],
    ...overrides,
  };
}

test("guard accepts a grid-aligned order with bounded expiry", () => {
  const intent: OrderIntent = {
    agentId: "SECUTOR",
    side: "BUY_YES",
    orderType: "IOC",
    price: 510_000n,
    quantity: 1_000n,
    expireTimestampNs: 1_120_000_000_000n,
  };

  const result = guardOrderIntent(snapshot(), intent);

  assert.deepEqual(result, { accepted: true, intent });
});

test("guard refuses a market without on-chain trading status", () => {
  const result = guardOrderIntent(snapshot({ status: 2 }), {
    agentId: "SECUTOR",
    side: "BUY_YES",
    orderType: "IOC",
    price: 510_000n,
    quantity: 1_000n,
    expireTimestampNs: 1_120_000_000_000n,
  });

  assert.equal(result.accepted, false);
  if (!result.accepted) assert.match(result.reason, /status must be 1/);
});

test("guard refuses a market inside the three-minute headroom", () => {
  const result = guardOrderIntent(snapshot({ expiry: 1_170 }), {
    agentId: "SECUTOR",
    side: "BUY_YES",
    orderType: "IOC",
    price: 510_000n,
    quantity: 1_000n,
    expireTimestampNs: 1_120_000_000_000n,
  });

  assert.equal(result.accepted, false);
  if (!result.accepted) assert.match(result.reason, /headroom/);
});

test("guard refuses off-grid prices and quantities", () => {
  const result = guardOrderIntent(snapshot(), {
    agentId: "SECUTOR",
    side: "BUY_YES",
    orderType: "IOC",
    price: 515_000n,
    quantity: 1_001n,
    expireTimestampNs: 1_120_000_000_000n,
  });

  assert.equal(result.accepted, false);
  if (!result.accepted) assert.match(result.reason, /tick grid/);
});

test("Secutor emits a momentum IOC toward a rising YES book", () => {
  const result = decide("SECUTOR", snapshot({ recentYesPrices: [450_000n, 480_000n, 510_000n] }));

  assert.equal(result.action, "ORDER");
  assert.equal(result.intents.length, 1);
  assert.equal(result.intents[0]?.side, "BUY_YES");
  assert.equal(result.intents[0]?.price, 510_000n);
  assert.equal(result.intents[0]?.orderType, "IOC");
});

test("Thraex emits a mean-reversion IOC after a high YES move", () => {
  const result = decide("THRAEX", snapshot({ recentYesPrices: [450_000n, 500_000n, 700_000n] }));

  assert.equal(result.action, "ORDER");
  assert.equal(result.intents.length, 1);
  assert.equal(result.intents[0]?.side, "BUY_NO");
  assert.equal(result.intents[0]?.price, 490_000n);
  assert.equal(result.intents[0]?.orderType, "IOC");
});

test("Retiarius emits two opposing post-only quotes", () => {
  const result = decide("RETIARIUS", snapshot());

  assert.equal(result.action, "ORDER");
  assert.deepEqual(result.intents.map((intent) => intent.side), ["BUY_YES", "BUY_NO"]);
  assert.deepEqual(result.intents.map((intent) => intent.price), [500_000n, 500_000n]);
  assert.ok(result.intents.every((intent) => intent.orderType === "POST_ONLY"));
});

test("Murmillo trades only inside a stable narrow spread", () => {
  const result = decide("MURMILLO", snapshot({ recentYesPrices: [495_000n, 500_000n, 505_000n] }));

  assert.equal(result.action, "ORDER");
  assert.equal(result.intents.length, 1);
  assert.equal(result.intents[0]?.quantity, 1_000n);
  assert.equal(result.intents[0]?.side, "BUY_YES");
});

test("Murmillo holds when recent prices are too volatile", () => {
  const result = decide("MURMILLO", snapshot({ recentYesPrices: [300_000n, 500_000n, 700_000n] }));

  assert.equal(result.action, "HOLD");
  assert.equal(result.intents.length, 0);
});
