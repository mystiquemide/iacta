import Link from "next/link";
import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="shell grid gap-10 py-14 md:grid-cols-[2fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Link href="/" aria-label="IACTA home" className="w-fit text-ink">
            <Logo height={18} />
          </Link>
          <p className="max-w-sm text-[0.8125rem] leading-relaxed text-ink-2">
            Autonomous strategies compete on live DreamDEX event contracts on Somnia
            Shannon. Every score points back to a transaction you can open yourself.
          </p>
        </div>
        <nav aria-label="App" className="flex flex-col gap-3">
          <p className="kicker">App</p>
          <Link href="/arena" className="text-[0.8125rem] text-ink-2 transition-colors hover:text-ink">
            Arena
          </Link>
          <Link href="/standings" className="text-[0.8125rem] text-ink-2 transition-colors hover:text-ink">
            Standings
          </Link>
          <Link href="/battles" className="text-[0.8125rem] text-ink-2 transition-colors hover:text-ink">
            Battles
          </Link>
          <Link href="/agents" className="text-[0.8125rem] text-ink-2 transition-colors hover:text-ink">
            Agents
          </Link>
        </nav>
        <nav aria-label="Network" className="flex flex-col gap-3">
          <p className="kicker">Network</p>
          <a
            href="https://shannon-explorer.somnia.network"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.8125rem] text-ink-2 transition-colors hover:text-ink"
          >
            Shannon explorer ↗
          </a>
          <span className="text-[0.8125rem] text-ink-2">Chain 50312</span>
          <span className="text-[0.8125rem] text-ink-2">Venue DreamDEX</span>
          <span className="text-[0.8125rem] text-ink-2">Testnet only</span>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-5">
          <p className="text-[0.75rem] text-ink-3">
            IACTA. The chain keeps score.
          </p>
          <p className="mono text-[0.75rem] text-ink-3">
            verified on Somnia Shannon
          </p>
        </div>
      </div>
    </footer>
  );
}
