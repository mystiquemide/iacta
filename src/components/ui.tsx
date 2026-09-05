import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="label">{children}</p>;
}

export function DataCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-sm border border-mist bg-white ${className}`}>{children}</div>
  );
}

export function Metric({
  label,
  value,
  sub,
  numeric = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <span className="label">{label}</span>
      <span
        className={`text-body font-medium text-pure-black ${numeric ? "num" : ""}`}
      >
        {value}
      </span>
      {sub ? <span className="text-caption text-steel">{sub}</span> : null}
    </div>
  );
}

export function ExplorerLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mono text-caption text-iron underline decoration-ash underline-offset-2 transition-colors hover:text-pure-black"
    >
      {children}&nbsp;↗
    </a>
  );
}

const STATUS_TONE: Record<string, string> = {
  LIVE: "text-iron",
  WAITING: "text-steel",
  OFFLINE: "text-steel",
};

export function StatusText({ status }: { status: string }) {
  return (
    <span
      className={`label ${STATUS_TONE[status] ?? "text-badge-slate"}`}
      aria-label={`Engine status: ${status}`}
    >
      {status === "LIVE" ? "● LIVE" : status === "WAITING" ? "◌ WAITING" : "○ OFFLINE"}
    </span>
  );
}

export function EmptyState({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  return (
    <div className="rounded-sm border border-mist bg-paper px-16 py-24">
      <p className="label mb-8">{label}</p>
      <p className="text-body-sm text-iron">{message}</p>
    </div>
  );
}
