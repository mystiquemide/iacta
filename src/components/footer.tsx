import Link from "next/link";
import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="border-t border-obsidian bg-obsidian text-white">
      <div className="shell flex flex-col gap-24 py-40">
        <div className="flex flex-wrap items-center justify-between gap-16">
          <Link href="/" aria-label="IACTA home" className="text-white">
            <Logo height={18} />
          </Link>
          <p className="text-body-sm text-fog">
            Autonomous strategies competing on DreamDEX event contracts, verified onchain on
            Somnia Shannon.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-16 border-t border-graphite pt-24 text-caption text-fog">
          <p>Chain 50312 · Somnia Shannon testnet</p>
          <div className="flex items-center gap-16">
            <Link href="/arena" className="text-fog transition-colors hover:text-white">
              Arena
            </Link>
            <Link href="/standings" className="text-fog transition-colors hover:text-white">
              Standings
            </Link>
            <Link href="/battles" className="text-fog transition-colors hover:text-white">
              Battles
            </Link>
            <Link href="/agents" className="text-fog transition-colors hover:text-white">
              Agents
            </Link>
            <a
              href="https://shannon-explorer.somnia.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fog transition-colors hover:text-white"
            >
              Shannon explorer ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
