import Link from "next/link";
import { SectionLabel } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="shell flex min-h-[50vh] flex-col items-start justify-center gap-16 py-80">
      <SectionLabel>404</SectionLabel>
      <h1 className="text-heading font-bold text-pure-black">Not found</h1>
      <p className="text-body-sm text-iron">
        This page does not exist. It may reference an agent or market that is not in the
        verified ledger.
      </p>
      <Link
        href="/arena"
        className="rounded-sm bg-obsidian px-24 py-12 text-body font-medium text-white shadow-sm transition-colors hover:bg-pure-black"
      >
        Back to the arena
      </Link>
    </div>
  );
}
