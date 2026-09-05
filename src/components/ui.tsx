import type { ReactNode } from "react";
import Link from "next/link";

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="kicker">{children}</p>;
}

export function PrimaryLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const external = href.startsWith("http");
  const cls = `inline-flex items-center justify-center rounded-xs bg-primary px-6 py-2.5 text-sm font-medium text-primary-ink transition-colors hover:bg-white ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function SecondaryLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const external = href.startsWith("http");
  const cls = `inline-flex items-center justify-center rounded-xs bg-surface-2 px-6 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-hover ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
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
      className="mono text-[0.75rem] text-ink-2 underline decoration-line-2 underline-offset-2 transition-colors hover:text-ink"
    >
      {children}&nbsp;↗
    </a>
  );
}

const STATUS_STYLE: Record<string, { dot: string; text: string }> = {
  LIVE: { dot: "live-dot bg-chart-1", text: "text-live-ink" },
  WAITING: { dot: "bg-ink-3", text: "text-ink-2" },
  OFFLINE: { dot: "bg-ink-3", text: "text-ink-3" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.OFFLINE;
  return (
    <span
      className={`inline-flex items-center gap-2 text-[0.75rem] font-medium ${style.text}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xs border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function WaitingPanel({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Panel className="p-6">
      <p className="kicker">{title}</p>
      <div className="mt-3 text-[0.8125rem] leading-relaxed text-ink-2">{children}</div>
    </Panel>
  );
}
