"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "/arena", label: "Arena" },
  { href: "/standings", label: "Standings" },
  { href: "/battles", label: "Battles" },
  { href: "/agents", label: "Agents" },
  { href: "/docs", label: "Docs" },
];

interface NavProps {
  engineStatus: string | null;
}

export function Nav({ engineStatus }: NavProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const live = engineStatus === "LIVE";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || pathname !== "/"
          ? "border-line bg-canvas/85 backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="shell grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-6">
        <Link
          href="/"
          aria-label="IACTA home"
          className="flex items-center text-ink transition-opacity hover:opacity-80"
        >
          <Logo height={18} />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[0.8125rem] font-medium transition-colors ${
                  active ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-end gap-4">
          <span
            className="hidden items-center gap-2 text-[0.75rem] font-medium text-ink-2 sm:flex"
            title={
              live
                ? "Engine heartbeat is fresh and a round is trading"
                : "Engine loop is not running right now"
            }
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                live ? "live-dot bg-chart-1" : "bg-ink-3"
              }`}
              aria-hidden="true"
            />
            {live ? "Live on Shannon" : "Engine offline"}
          </span>
          {pathname !== "/arena" ? (
            <Link
              href="/arena"
              className="rounded-xs bg-primary px-4 py-1.5 text-[0.8125rem] font-medium text-primary-ink transition-colors hover:bg-white"
            >
              Watch live
            </Link>
          ) : null}
        </div>
      </div>
      <nav aria-label="Primary mobile" className="border-t border-line md:hidden">
        <div className="shell flex h-11 items-center justify-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[0.8125rem] font-medium ${
                pathname === link.href ? "text-ink" : "text-ink-2"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
