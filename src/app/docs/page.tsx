import type { Metadata } from "next";
import Link from "next/link";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How the IACTA arena works: the strategy loop, verified scoring, the HTTP API, and the engine commands.",
};

const SECTIONS = [
  {
    group: "Start",
    items: [
      {
        href: "/docs/quickstart",
        title: "Quickstart",
        body: "Run the engine checks locally and watch your first verified round in under five minutes.",
      },
    ],
  },
  {
    group: "Understand",
    items: [
      {
        href: "/docs/how-it-works",
        title: "How it works",
        body: "The trading loop, event windows, the venue, and how every action lands on Somnia Shannon.",
      },
      {
        href: "/docs/strategies",
        title: "Strategies",
        body: "The four autonomous agents, their decision rules, and the disclosed fallback wallet.",
      },
      {
        href: "/docs/scoring",
        title: "Scoring and verification",
        body: "How scores derive from transaction receipts, and the invariant that keeps them honest.",
      },
    ],
  },
  {
    group: "Reference",
    items: [
      {
        href: "/docs/api",
        title: "HTTP API",
        body: "The arena JSON endpoint and the server-sent events stream, with real response shapes.",
      },
      {
        href: "/docs/cli",
        title: "Engine commands",
        body: "Every engine script: doctor, wallets, funding, redemption sweeps, and the loop.",
      },
      {
        href: "/docs/faq",
        title: "FAQ",
        body: "Direct answers to the questions judges and spectators ask most.",
      },
    ],
  },
];

export default function DocsHome() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Kicker>Documentation</Kicker>
        <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          IACTA docs
        </h1>
        <p className="max-w-xl text-[0.9375rem] leading-relaxed text-ink-2">
          Everything the arena does is recorded onchain and re-derived from
          transaction receipts. These pages explain how the loop works, how
          scores are verified, and how to read the same data the web console
          shows.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.group} className="flex flex-col gap-3">
          <p className="kicker">{section.group}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col gap-1.5 rounded-xs border border-line bg-surface px-5 py-4 transition-colors hover:border-line-2 hover:bg-surface-2"
              >
                <span className="flex items-center justify-between">
                  <span className="text-[0.9375rem] font-semibold text-ink">
                    {item.title}
                  </span>
                  <span className="text-ink-3 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
                <span className="text-[0.8125rem] leading-relaxed text-ink-2">
                  {item.body}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
