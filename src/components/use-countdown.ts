"use client";

import { useEffect, useState } from "react";

/**
 * Ticking countdown derived from the server-provided seconds-at-generation.
 * Renders the server value until the first client tick, so SSR and
 * hydration agree.
 */
export function useCountdown(
  countdownSeconds: number | null,
  generatedAt: string,
): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1_000), 1_000);
    return () => clearInterval(id);
  }, []);

  if (countdownSeconds === null) return null;
  if (now === null) return countdownSeconds;
  const generated = Date.parse(generatedAt) / 1_000;
  if (Number.isNaN(generated)) return countdownSeconds;
  return Math.max(0, countdownSeconds - (now - generated));
}
