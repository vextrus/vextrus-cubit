"use client";
// The takeoff lane's own navigation (docs/design/s-takeoff.md § 1): a row of links, one per surface
// the lane holds — today exactly the register, and inc-216 extends it with Coverage.
//
// The entry for the address in the browser says so with `aria-current="page"` (s-project I-125: a
// link row states where the reader is standing when it is the reader's own screen). The address is
// read from the router rather than passed as a flag, so a nav entry cannot claim to be current
// while the reader stands somewhere else.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { strings } from "@/ui/strings";

export interface TakeoffNavEntry {
  readonly testId: string;
  readonly label: string;
  readonly href: string;
}

export function TakeoffNav({ entries }: { entries: readonly TakeoffNavEntry[] }) {
  const here = usePathname();
  return (
    <nav className="cx-takeoff-nav" data-testid="takeoff-nav" aria-label={strings.takeoff_nav_label}>
      {entries.map((entry) => (
        <Link
          key={entry.testId}
          className="cx-takeoff-nav-link cx-reticle"
          data-testid={entry.testId}
          href={entry.href}
          aria-current={here === entry.href ? "page" : undefined}
        >
          {entry.label}
        </Link>
      ))}
    </nav>
  );
}
