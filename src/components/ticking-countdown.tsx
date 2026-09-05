"use client";

import { useCountdown } from "@/components/use-countdown";
import { formatCountdown } from "@/lib/format";

export function TickingCountdown({
  countdownSeconds,
  generatedAt,
  className = "",
}: {
  countdownSeconds: number | null;
  generatedAt: string;
  className?: string;
}) {
  const countdown = useCountdown(countdownSeconds, generatedAt);
  return (
    <span className={`mono ${className}`}>{formatCountdown(countdown)}</span>
  );
}
