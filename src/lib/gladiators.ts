export interface GladiatorProfile {
  architecture: string;
  description: string;
  posture: string;
}

export const PROFILES: Record<string, GladiatorProfile> = {
  RETIARIUS: {
    architecture: "Two-sided quoting",
    description: "Posts opposing YES and NO quotes around the live midpoint to invite a counterparty and bootstrap the book.",
    posture: "Liquidity seeker",
  },
  SECUTOR: {
    architecture: "Momentum IOC",
    description: "Tracks recent direction and crosses the best available ask when momentum has a clear sign, with a bounded bootstrap against a resting quote.",
    posture: "Directional aggressor",
  },
  THRAEX: {
    architecture: "Mean reversion",
    description: "Compares the latest YES price with its recent mean and takes the opposing outcome when the move is extended.",
    posture: "Counter-trend aggressor",
  },
  MURMILLO: {
    architecture: "Conservative minimum lot",
    description: "Acts only during a narrow, stable window and uses the venue minimum quantity to limit exposure.",
    posture: "Low-risk observer",
  },
  FRESH: {
    architecture: "Temporary fallback burner",
    description: "An isolated burner used for the CP-003 pair-crossing proof while the named RETIARIUS wallet was unfunded.",
    posture: "Disclosed fallback",
  },
};
