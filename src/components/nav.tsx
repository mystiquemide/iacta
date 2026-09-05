import Link from "next/link";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "/arena", label: "Arena" },
  { href: "/standings", label: "Standings" },
  { href: "/battles", label: "Battles" },
  { href: "/agents", label: "Agents" },
];

interface NavProps {
  engineStatus: string | null;
}

export function Nav({ engineStatus }: NavProps) {
  return (
    <header className="border-b border-mist bg-white">
      <div className="shell flex h-16 items-center justify-between gap-16">
        <Link
          href="/"
          aria-label="IACTA home"
          className="flex shrink-0 items-center text-pure-black"
        >
          <Logo height={20} />
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-24">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-body-sm font-medium text-graphite transition-colors hover:text-pure-black"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-16">
          <span className="label hidden sm:inline">
            {engineStatus === "LIVE"
              ? "Engine live"
              : engineStatus === "WAITING"
                ? "Engine waiting"
                : "Engine offline"}
          </span>
          <span className="label hidden lg:inline">Somnia Shannon</span>
          <a
            href="https://shannon-explorer.somnia.network"
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm font-medium text-graphite transition-colors hover:text-pure-black"
          >
            Explorer&nbsp;↗
          </a>
        </div>
      </div>
      <nav aria-label="Primary mobile" className="border-t border-mist md:hidden">
        <ul className="shell flex h-12 items-center gap-24">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-caption font-medium text-graphite"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
