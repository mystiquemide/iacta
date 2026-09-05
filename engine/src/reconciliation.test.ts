import assert from "node:assert/strict";
import test from "node:test";
import { reconcileAgentActivity, type ReconciliationStore } from "./reconciliation.js";

const account = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";

test("startup reconciliation backfills owned orders and maker or taker fills", async () => {
  const orders: unknown[] = [];
  const fills: unknown[] = [];
  const requested: unknown[] = [];
  const store: ReconciliationStore = {
    recordOrder: (order) => orders.push(order),
    recordFill: (fill) => fills.push(fill),
  };

  const result = await reconcileAgentActivity("SECUTOR", account, {
    getOrders: async (_owner, options) => {
      requested.push({ kind: "orders", options });
      return [{
        market: "0xmarket",
        pool: "0xpool",
        side: "BUY_YES",
        status: "Filled",
        price: "500000",
        fullQuantity: "1000",
        expireTimestampNs: "1700000000000000000",
        placedTxHash: "0xorder",
        placedAtTimestamp: "150",
      }];
    },
    getUserFills: async (_owner, options) => {
      requested.push({ kind: "fills", options });
      return [
        {
          market: "0xmarket",
          pool: "0xpool",
          fillPrice: "490000",
          quantity: "1000",
          maker: account,
          makerSide: "BUY_NO",
          taker: other,
          takerSide: null,
          takerOrder: { owner: other, side: "BUY_YES" },
          kind: "MINT_A_PAIR",
          makerOrderId: "7",
          takerOrderId: "8",
          timestamp: "151",
          txHash: "0xmaker-fill",
        },
        {
          market: "0xmarket",
          pool: "0xpool",
          fillPrice: "510000",
          quantity: "500",
          maker: other,
          makerSide: "BUY_NO",
          taker: account,
          takerSide: null,
          takerOrder: { owner: account, side: "BUY_YES" },
          kind: null,
          makerOrderId: "9",
          takerOrderId: "10",
          timestamp: "152",
          txHash: "0xtaker-fill",
        },
      ];
    },
  }, store, { sinceSeconds: 100, limit: 25 });

  assert.deepEqual(requested, [
    { kind: "orders", options: { limit: 25 } },
    { kind: "fills", options: { since: 100, limit: 25 } },
  ]);
  assert.equal(result.orders, 1);
  assert.equal(result.fills, 2);
  assert.deepEqual(orders, [{
    marketId: "0xmarket",
    agentId: "SECUTOR",
    poolAddress: "0xpool",
    side: "BUY_YES",
    orderType: "RECOVERED",
    status: "Filled",
    price: "500000",
    quantity: "1000",
    expireTimestampNs: "1700000000000000000",
    txHash: "0xorder",
    occurredAt: new Date(150_000).toISOString(),
  }]);
  assert.deepEqual(fills, [
    {
      marketId: "0xmarket",
      agentId: "SECUTOR",
      poolAddress: "0xpool",
      side: "BUY_NO",
      price: "490000",
      quantity: "1000",
      makerOrderId: "7",
      txHash: "0xmaker-fill",
      fillPath: "mint",
      occurredAt: new Date(151_000).toISOString(),
    },
    {
      marketId: "0xmarket",
      agentId: "SECUTOR",
      poolAddress: "0xpool",
      side: "BUY_YES",
      price: "510000",
      quantity: "500",
      makerOrderId: "9",
      txHash: "0xtaker-fill",
      fillPath: "unknown",
      occurredAt: new Date(152_000).toISOString(),
    },
  ]);
});

test("startup reconciliation skips fills without provable side attribution", async () => {
  let stored = 0;
  await reconcileAgentActivity("SECUTOR", account, {
    getOrders: async () => [],
    getUserFills: async () => [{
      market: "0xmarket",
      pool: "0xpool",
      fillPrice: "500000",
      quantity: "1000",
      maker: account,
      makerSide: null,
      taker: other,
      takerSide: null,
      takerOrder: null,
      kind: null,
      makerOrderId: "1",
      takerOrderId: "2",
      timestamp: "101",
      txHash: "0xf",
    }],
  }, {
    recordOrder: () => undefined,
    recordFill: () => { stored += 1; },
  }, { sinceSeconds: 100, limit: 10 });

  assert.equal(stored, 0);
});
