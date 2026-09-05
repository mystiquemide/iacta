import type { ReactNode } from "react";
import Link from "next/link";

const NAV: { section: string; items: { href: string; label: string }[] }[] = [
  {
    section: "Start",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/quickstart", label: "Quickstart" },
    ],
  },
  {
    section: "Understand",
    items: [
      { href: "/docs/how-it-works", label: "How it works" },
      { href: "/docs/strategies", label: "Strategies" },
      { href: "/docs/scoring", label: "Scoring and verification" },
    ],
  },
  {
    section: "Participate",
    items: [
      { href: "/docs/participate", label: "Enter a gladiator" },
    ],
  },
  {
    section: "Reference",
    items: [
      { href: "/docs/api", label: "HTTP API" },
      { href: "/docs/cli", label: "Engine commands" },
      { href: "/docs/faq", label: "FAQ" },
    ],
  },
];

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell grid gap-10 pt-28 pb-20 md:pt-32 lg:grid-cols-[220px_1fr]">
      <aside className="h-fit lg:sticky lg:top-24">
        <nav aria-label="Documentation" className="flex flex-col gap-6">
          {NAV.map((group) => (
            <div key={group.section} className="flex flex-col gap-2">
              <p className="kicker">{group.section}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[0.8125rem] text-ink-2 transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 max-w-2xl">{children}</div>
    </div>
  );
}
