import assert from "node:assert/strict";
import test from "node:test";
import { LLMAdvisor, llmProvidersFromEnv, parseVerdict, type LLMProviderConfig } from "./llm-advisor.js";
import { haruspexDecision } from "./engine-loop.js";
import type { MarketSnapshot } from "./strategies.js";

const snapshot: MarketSnapshot = {
  marketId: `0x${"a".repeat(64)}`,
  poolAddress: `0x${"b".repeat(40)}`,
  status: 1,
  now: 1_000,
  expiry: 2_000,
  quoteOne: 1_000_000n,
  tickSize: 10_000n,
  lotSize: 1_000n,
  minQuantity: 1_000n,
  yesBids: [{ price: 400_000n, quantity: 5_000n }],
  yesAsks: [{ price: 600_000n, quantity: 5_000n }],
  recentYesPrices: [500_000n, 520_000n, 540_000n],
};

function provider(name: string): LLMProviderConfig {
  return { name, baseUrl: `https://${name}.example/v1`, apiKey: `key-${name}`, model: "test-model" };
}

function okResponse(action: string, reason: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ action, reason }) } }],
  }), { status: 200 });
}

test("parseVerdict accepts strict JSON and rejects malformed or off-schema answers", () => {
  assert.deepEqual(parseVerdict('{"action":"BUY_YES","reason":"book tilting up"}', "gemini"), {
    action: "BUY_YES",
    reason: "book tilting up",
    provider: "gemini",
  });
  assert.deepEqual(parseVerdict('prose {"action":"HOLD","reason":"thin book"} trailing', "groq"), {
    action: "HOLD",
    reason: "thin book",
    provider: "groq",
  });
  assert.equal(parseVerdict('{"action":"BUY_MAYBE"}', "gemini"), null);
  assert.equal(parseVerdict("no json at all", "groq"), null);
  assert.equal(parseVerdict('{"action":"SELL_ALL","reason":"panic"}', "gemini"), null);
});

test("decideForMarket caches per market so cycles within the TTL make no new calls", async () => {
  let calls = 0;
  const advisor = new LLMAdvisor({
    providers: [provider("gemini")],
    fetchImpl: async () => {
      calls += 1;
      return okResponse("BUY_YES", "calls counted");
    },
    now: (() => 10_000) as () => number,
  });

  const first = await advisor.decideForMarket(snapshot.marketId, snapshot);
  const second = await advisor.decideForMarket(snapshot.marketId, snapshot);
  assert.equal(first?.action, "BUY_YES");
  assert.equal(second?.action, "BUY_YES");
  assert.equal(calls, 1);
});

test("the global interval gate holds a new market back until the interval passes", async () => {
  let calls = 0;
  let clock = 10_000;
  const advisor = new LLMAdvisor({
    providers: [provider("gemini")],
    minCallIntervalMs: 30_000,
    fetchImpl: async () => {
      calls += 1;
      return okResponse("HOLD", "first call");
    },
    now: () => clock,
  });

  const first = await advisor.decideForMarket(`0x${"1".repeat(64)}`, snapshot);
  clock += 5_000;
  const gated = await advisor.decideForMarket(`0x${"2".repeat(64)}`, snapshot);
  assert.equal(first?.reason, "first call");
  assert.equal(gated, null);
  assert.equal(calls, 1);

  clock += 30_000;
  const second = await advisor.decideForMarket(`0x${"2".repeat(64)}`, snapshot);
  assert.equal(second?.reason, "first call");
  assert.equal(calls, 2);
});

test("a failing primary provider falls through to the fallback", async () => {
  const seen: string[] = [];
  const advisor = new LLMAdvisor({
    providers: [provider("gemini"), provider("groq")],
    fetchImpl: async (input) => {
      const url = String(input);
      seen.push(url.includes("gemini") ? "gemini" : "groq");
      if (url.includes("gemini")) return new Response("rate limited", { status: 429 });
      return okResponse("BUY_NO", "gemini throttled, groq answering");
    },
    now: (() => 10_000) as () => number,
  });

  const verdict = await advisor.decideForMarket(snapshot.marketId, snapshot);
  assert.deepEqual(seen, ["gemini", "groq"]);
  assert.equal(verdict?.provider, "groq");
  assert.equal(verdict?.action, "BUY_NO");
});

test("an aborted request counts as a provider failure and the chain continues", async () => {
  const advisor = new LLMAdvisor({
    providers: [provider("gemini"), provider("groq")],
    timeoutMs: 10,
    fetchImpl: (input, init) => {
      const url = String(input);
      if (url.includes("gemini")) {
        return new Promise<Response>((_resolve, reject) => {
          (init as { signal?: AbortSignal }).signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }
      return Promise.resolve(okResponse("HOLD", "fallback after timeout"));
    },
    now: (() => 10_000) as () => number,
  });

  const verdict = await advisor.decideForMarket(snapshot.marketId, snapshot);
  assert.equal(verdict?.provider, "groq");
});

test("every provider failing yields null, which the loop records as an honest HOLD", async () => {
  const advisor = new LLMAdvisor({
    providers: [provider("gemini"), provider("groq")],
    fetchImpl: async () => new Response("down", { status: 500 }),
    now: (() => 10_000) as () => number,
  });
  assert.equal(await advisor.decideForMarket(snapshot.marketId, snapshot), null);

  const decision = haruspexDecision(null, snapshot);
  assert.equal(decision.action, "HOLD");
  assert.match(decision.reason, /LLM advisor unavailable/);
});

test("haruspexDecision converts a verdict into a guarded venue-minimum IOC order", () => {
  const decision = haruspexDecision({ action: "BUY_YES", reason: "asks lifting", provider: "gemini" }, snapshot);
  assert.equal(decision.action, "ORDER");
  assert.equal(decision.intents.length, 1);
  const intent = decision.intents[0]!;
  assert.equal(intent.side, "BUY_YES");
  assert.equal(intent.orderType, "IOC");
  assert.equal(intent.price, 600_000n);
  assert.equal(intent.quantity, 1_000n);
  assert.match(decision.reason, /^gemini: asks lifting$/);
});

test("haruspexDecision holds when the model says HOLD and when no level is crossable", () => {
  assert.equal(haruspexDecision({ action: "HOLD", reason: "unclear", provider: "groq" }, snapshot).action, "HOLD");
  const emptyBook: MarketSnapshot = {
    ...snapshot,
    yesAsks: [],
    yesBids: [],
  };
  const decision = haruspexDecision({ action: "BUY_YES", reason: "wants in", provider: "gemini" }, emptyBook);
  assert.equal(decision.action, "HOLD");
  assert.match(decision.reason, /no crossable level/);
});

test("llmProvidersFromEnv reads the primary and fallback configuration", () => {
  const providers = llmProvidersFromEnv({
    IACTA_GEMINI_API_KEY: "gemini-key",
    IACTA_GROQ_API_KEY: "groq-key",
  } as NodeJS.ProcessEnv);
  assert.deepEqual(providers.map((p) => p.name), ["gemini", "groq"]);
  assert.equal(providers[0]?.model, "gemini-3.6-flash");
  assert.equal(providers[1]?.model, "openai/gpt-oss-120b");

  assert.deepEqual(llmProvidersFromEnv({} as NodeJS.ProcessEnv), []);
});
