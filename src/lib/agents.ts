import registry from "../../engine/registry.json";

export interface AgentProfile {
  agentId: string;
  architecture: string;
  behavior: string;
  posture: string;
}

interface RegistryEntry {
  agentId: string;
  address: string;
  architecture: string;
  behavior: string;
  posture: string;
  submittedBy: string;
  registeredAt: string;
}

const BASE_PROFILES: Record<string, AgentProfile> = {
  RETIARIUS: {
    agentId: "RETIARIUS",
    architecture: "Two-sided quoting",
    behavior:
      "Posts YES and NO quotes around the live midpoint to invite a counterparty and bootstrap the order book.",
    posture: "Liquidity provider",
  },
  SECUTOR: {
    agentId: "SECUTOR",
    architecture: "Momentum IOC",
    behavior:
      "Follows recent price direction and crosses the best available level when momentum has a clear sign.",
    posture: "Directional aggressor",
  },
  THRAEX: {
    agentId: "THRAEX",
    architecture: "Mean reversion",
    behavior:
      "Fades a move when the latest YES price is stretched away from its recent average.",
    posture: "Counter-trend aggressor",
  },
  MURMILLO: {
    agentId: "MURMILLO",
    architecture: "Conservative minimum lot",
    behavior:
      "Trades only in a narrow, stable window and sizes every order at the venue minimum to limit exposure.",
    posture: "Low-risk observer",
  },
  FRESH: {
    agentId: "FRESH",
    architecture: "Disclosed fallback burner",
    behavior:
      "An isolated burner wallet used for a pair-crossing proof while a named wallet was unfunded. Disclosed whenever it appears.",
    posture: "Disclosed fallback",
  },
  HARUSPEX: {
    agentId: "HARUSPEX",
    architecture: "LLM judgment, venue guards",
    behavior:
      "Reads the same live market snapshot as the deterministic four, reasons over the book and recent trades, and answers BUY_YES, BUY_NO, or HOLD. The engine builds the order at the venue minimum and every guard still applies.",
    posture: "Reasoning entrant",
  },
};

/**
 * Open-registration entrants: profiles come from the public registry in
 * engine/registry.json, keyed by their wallet address. Their fills and
 * redemptions are ingested from chain data and scored by the same
 * receipt-backed reducer as the arena roster.
 */
const REGISTRY_PROFILES: Record<string, AgentProfile> = Object.fromEntries(
  ((registry as { version: number; gladiators: RegistryEntry[] }).gladiators ?? []).map((entry) => [
    entry.agentId,
    {
      agentId: entry.agentId,
      architecture: entry.architecture,
      behavior: entry.behavior,
      posture: entry.posture,
    },
  ]),
);

const PROFILES: Record<string, AgentProfile> = { ...BASE_PROFILES, ...REGISTRY_PROFILES };

export function profileFor(agentId: string): AgentProfile {
  return (
    PROFILES[agentId] ?? {
      agentId,
      architecture: "Autonomous strategy",
      behavior: "An agent observed in the verified ledger without a registered profile.",
      posture: "Participant",
    }
  );
}
