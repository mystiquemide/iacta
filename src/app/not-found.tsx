import { PrimaryLink } from "@/components/ui";
import { Kicker } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="shell flex min-h-[60vh] flex-col items-start justify-center gap-4 pt-20">
      <Kicker>404</Kicker>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Not found</h1>
      <p className="max-w-md text-[0.875rem] leading-relaxed text-ink-2">
        This page does not exist. It may reference an agent or market that is not
        in the verified ledger.
      </p>
      <PrimaryLink href="/arena" className="mt-2">
        Back to the arena
      </PrimaryLink>
    </div>
  );
}
