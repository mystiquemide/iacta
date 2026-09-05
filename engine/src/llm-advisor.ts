import type { BookLevel, MarketSnapshot } from "./strategies.js";

export interface LLMProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LLMAdvisorOptions {
  providers: readonly LLMProviderConfig[];
  /** One cached decision per market for this long. */
  cacheTtlMs?: number;
  /** Minimum spacing between any two provider calls. */
  minCallIntervalMs?: number;
  /** Per-provider HTTP timeout. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface LLMVerdict {
  action: "BUY_YES" | "BUY_NO" | "HOLD";
  reason: string;
  provider: string;
}

interface CacheEntry {
  verdict: LLMVerdict | null;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 120_000;
const DEFAULT_MIN_CALL_INTERVAL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_REASON_LENGTH = 140;

const SYSTEM_PROMPT = [
  "You are HARUSPEX, the fifth gladiator in IACTA, an arena where autonomous strategies trade binary event contracts on DreamDEX.",
  "You compete against four deterministic strategies. Your edge is reasoning; their edge is discipline.",
  "The venue rules are strict: orders must respect the tick grid, the lot grid, and the venue minimum. The engine builds and guards the actual order — you only choose direction.",
  "Answer with strict JSON only, no prose, no markdown:",
  '{"action":"BUY_YES"|"BUY_NO"|"HOLD","reason":"short human-readable justification"}',
  "Reasons must be at most 120 characters, concrete, and reference the market data you used.",
  "When the picture is unclear or the book is thin, HOLD. A gladiator that survives wins more than one that guesses.",
].join(" ");

export class LLMAdvisor {
  private readonly providers: readonly LLMProviderConfig[];
  private readonly cacheTtlMs: number;
  private readonly minCallIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();
  private lastCallAt = -Infinity;

  constructor(options: LLMAdvisorOptions) {
    if (options.providers.length === 0) throw new Error("LLM advisor requires at least one provider");
    this.providers = options.providers;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.minCallIntervalMs = options.minCallIntervalMs ?? DEFAULT_MIN_CALL_INTERVAL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  /** Rate-limited decision lookup. Returns null when every provider fails or the global interval gate closes. */
  async decideForMarket(marketId: string, snapshot: MarketSnapshot): Promise<LLMVerdict | null> {
    const key = marketId.toLowerCase();
    const now = this.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) return cached.verdict;

    if (now - this.lastCallAt < this.minCallIntervalMs) {
      return cached?.verdict ?? null;
    }

    const verdict = await this.callProviders(snapshot);
    this.lastCallAt = this.now();
    this.cache.set(key, { verdict, expiresAt: this.now() + this.cacheTtlMs });
    return verdict;
  }

  private async callProviders(snapshot: MarketSnapshot): Promise<LLMVerdict | null> {
    for (const provider of this.providers) {
      const verdict = await this.callProvider(provider, snapshot);
      if (verdict) return verdict;
    }
    return null;
  }

  private async callProvider(provider: LLMProviderConfig, snapshot: MarketSnapshot): Promise<LLMVerdict | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: marketBrief(snapshot) },
          ],
          max_tokens: 2_000,
          temperature: 0.2,
          reasoning_effort: "low",
        }),
      });
      if (!response.ok) {
        console.error(`llm provider ${provider.name} returned HTTP ${response.status}`);
        return null;
      }
      const payload = await response.json() as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        console.error(`llm provider ${provider.name} returned an empty completion`);
        return null;
      }
      return parseVerdict(content, provider.name);
    } catch {
      console.error(`llm provider ${provider.name} call failed or timed out`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

function marketBrief(snapshot: MarketSnapshot): string {
  const scale = (value: bigint): string => {
    const digits = snapshot.quoteOne.toString().length - 1;
    const whole = (value * 100n) / snapshot.quoteOne;
    return `${(Number(whole) / 100).toFixed(digits > 0 ? Math.min(digits, 2) : 0)}`;
  };
  const levels = (levels: readonly BookLevel[]): string => levels
    .slice(0, 3)
    .map((level) => `${scale(level.price)}×${level.quantity.toString()}`)
    .join(", ") || "empty";
  const history = snapshot.recentYesPrices.slice(-8).map(scale).join(", ") || "no trades yet";
  const headroom = snapshot.expiry - snapshot.now;
  return [
    `Asset market, on-chain status ${snapshot.status} (1 = trading).`,
    `Time to expiry: ${headroom}s.`,
    `YES book — bids: ${levels(snapshot.yesBids)}; asks: ${levels(snapshot.yesAsks)}.`,
    `Recent YES trade prices, oldest first: ${history}.`,
    "Choose your action.",
  ].join("\n");
}

export function parseVerdict(content: string, provider: string): LLMVerdict | null {
  const jsonSlice = content.match(/\{[^{}]*\}/);
  if (!jsonSlice) return null;
  let parsed: { action?: unknown; reason?: unknown };
  try {
    parsed = JSON.parse(jsonSlice[0]) as { action?: unknown; reason?: unknown };
  } catch {
    return null;
  }
  if (parsed.action !== "BUY_YES" && parsed.action !== "BUY_NO" && parsed.action !== "HOLD") return null;
  const reason = typeof parsed.reason === "string" && parsed.reason.trim()
    ? parsed.reason.trim().slice(0, MAX_REASON_LENGTH)
    : `${provider} verdict without a stated reason`;
  return { action: parsed.action, reason, provider };
}

export function llmProvidersFromEnv(env: NodeJS.ProcessEnv = process.env): LLMProviderConfig[] {
  const providers: LLMProviderConfig[] = [];
  const geminiKey = env.IACTA_GEMINI_API_KEY?.trim();
  if (geminiKey) {
    providers.push({
      name: "gemini",
      baseUrl: env.IACTA_GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: geminiKey,
      model: env.IACTA_GEMINI_MODEL?.trim() || "gemini-3.6-flash",
    });
  }
  const groqKey = env.IACTA_GROQ_API_KEY?.trim();
  if (groqKey) {
    providers.push({
      name: "groq",
      baseUrl: env.IACTA_GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1",
      apiKey: groqKey,
      model: env.IACTA_GROQ_MODEL?.trim() || "openai/gpt-oss-120b",
    });
  }
  return providers;
}
