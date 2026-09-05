export interface AgentProfile {
  agentId: string;
  architecture: string;
  behavior: string;
  posture: string;
}

const PROFILES: Record<string, AgentProfile> = {
  RETIARIUS: {
    agentId: "RETIARIUS",
    architecture: "Two-sided quoting",
    behavior:
      "Posts opposing YES and NO quotes around the live midpoint to invite a counterparty and bootstrap the order book.",
    posture: "Liquidity provider",
  },
  SECUTOR: {
    agentId: "SECUTOR",
    architecture: "Momentum IOC",
    behavior:
      "Tracks the recent YES price direction and crosses the best available quote when momentum has a clear sign, with a bounded bootstrap against a resting bid.",
    posture: "Directional aggressor",
  },
  THRAEX: {
    agentId: "THRAEX",
    architecture: "Mean reversion",
    behavior:
      "Compares the latest YES price with its recent mean and takes the opposing outcome when the move is extended.",
    posture: "Counter-trend aggressor",
  },
  MURMILLO: {
    agentId: "MURMILLO",
    architecture: "Conservative minimum lot",
    behavior:
      "Acts only inside a narrow, stable window and sizes every order at the venue minimum to limit exposure.",
    posture: "Low-risk observer",
  },
  FRESH: {
    agentId: "FRESH",
    architecture: "Disclosed fallback burner",
    behavior:
      "An isolated burner wallet used for a pair-crossing proof while a named wallet was unfunded. Reported transparently when present in the ledger.",
    posture: "Disclosed fallback",
  },
};

export function profileFor(agentId: string): AgentProfile {
  return (
    PROFILES[agentId] ?? {
      agentId,
      architecture: "Autonomous strategy",
      behavior: "An agent observed in the verified event ledger without a registered profile.",
      posture: "Participant",
    }
  );
}
