import type { ReactNode } from "react";

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mono overflow-x-auto rounded-xs border border-line bg-surface-2 px-4 py-3 text-[0.75rem] leading-relaxed text-ink-2">
      <code>{children}</code>
    </pre>
  );
}

export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "warn";
  title: string;
  children: ReactNode;
}) {
  const tone =
    kind === "warn"
      ? "border-live/60 bg-live/10"
      : "border-line bg-surface-2";
  return (
    <div className={`rounded-xs border px-4 py-3 ${tone}`}>
      <p className="text-[0.75rem] font-semibold uppercase tracking-widest text-ink-2">
        {title}
      </p>
      <div className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

export function DocHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 text-xl font-semibold tracking-tight text-ink">
      {children}
    </h2>
  );
}

export function DocH3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 text-[0.9375rem] font-semibold tracking-tight text-ink">
      {children}
    </h3>
  );
}

export function DocP({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-2">{children}</p>;
}

export function FieldTable({
  rows,
}: {
  rows: { name: string; type: string; note: string }[];
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xs border border-line">
      <table className="w-full min-w-[560px] text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-line bg-surface-2/50">
            <th className="kicker px-4 py-2 font-medium">Field</th>
            <th className="kicker px-4 py-2 font-medium">Type</th>
            <th className="kicker px-4 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-line/60 last:border-b-0">
              <td className="mono px-4 py-2.5 text-ink">{row.name}</td>
              <td className="mono px-4 py-2.5 text-ink-3">{row.type}</td>
              <td className="px-4 py-2.5 text-ink-2">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
