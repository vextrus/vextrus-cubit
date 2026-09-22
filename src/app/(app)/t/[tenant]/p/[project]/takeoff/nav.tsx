"use client";
// The takeoff lane's TABS ROW (Design Direction 00 §3.2: "tabs row | Register · Coverage (area tabs,
// 32 px) + right: pinned revision `IdChip` + the one primary (Measure)").
//
// One row, and the only thing above the filter bar: the lane's areas on the left, and on the right
// whatever the surface a reader is standing on has put there.
//
// IT IS MOUNTED IN THE FRAME'S TOOL TRACK, NOT DRAWN INSIDE `shell-main` (Direction §1, §3.1). The
// row is chrome: its height is the grid's (`--toolbar-h`), and a lane that drew a 40 px strip of its
// own inside main would spend the work surface's own height on it — and `shell-main` carries 24 px
// of padding besides, which would put the grid's first row 128 px below the top of main and fail the
// hard rule of §3.2 (§7 C2: within 116). In the track it is above main entirely, and the grid's
// first row sits 88 px down at both viewports. The row is 32 rather than 40 because 32 is what the
// frame's second track IS (§4.2) — the Direction's own number for every band of chrome above a work
// surface, and one row is one row. The entry for the address in the
// browser says so with `aria-current="page"` (s-project I-125: a link row states where the reader is
// standing when it is the reader's own screen). The address is read from the router rather than
// passed as a flag, so a nav entry cannot claim to be current while the reader stands somewhere else.
//
// WHY THE RIGHT-HAND SIDE IS A SLOT. The row is the LANE's (it is drawn above every takeoff surface,
// by the lane's layout), and the pinned revision and the Measure door are the REGISTER's — a fact
// and an act that belong to one surface. A screen three levels below a layout cannot hand it a prop,
// so the row publishes a slot and the screen mounts into it, which is the shape the frame's own three
// slots already settled (`src/ui/shell/slots.tsx`). A surface that mounts nothing leaves the right
// side empty and the row is still one row: nothing is drawn to state an absence (R-UI-080).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useShellToolbar } from "@/ui/shell";
import { strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";

export interface TakeoffNavEntry {
  readonly testId: string;
  readonly label: string;
  readonly href: string;
}

/** Where the row's right half is drawn: the element the lane's row renders for it, once mounted. */
const TabsHostContext = createContext<HTMLElement | null>(null);

/**
 * What a takeoff surface mounts its own half of the row through: hand it the node, or null, and
 * RENDER what comes back. A screen rendered outside the lane finds no host and this answers null,
 * so no component is ever made to know whether it is inside the lane (the inspector slot's own law,
 * `useInspector`).
 *
 * THE HALF IS DRAWN IN PLACE, NOT HANDED OVER. It was handed over — an effect set the node on the
 * row's state on mount and null on unmount — and the register hydrates through a window of about a
 * hundred milliseconds in which two of it stand in the frame (the streamed HTML and the client
 * tree, both `data-state="ready"`); with that ordering, a customer's SECOND visit to the register
 * (a stored grid furniture is what moved it) had no Measure door and no revision chip (session 5's
 * M3 leg, runs 8 and 9). A portal has no ordering to get wrong: the surface renders its node into
 * the host element of the row its own tree drew, in the same commit as the rest of the surface,
 * and it is gone the moment the surface is — a revision chip outliving the screen that named it
 * would be one surface's fact drawn over another's.
 */
export function useTakeoffTabsAside(aside: ReactNode | null): ReactNode {
  const host = useContext(TabsHostContext);
  return host === null || aside === null ? null : createPortal(aside, host);
}

export function TakeoffTabs({ entries, children }: { entries: readonly TakeoffNavEntry[]; children?: ReactNode }) {
  const here = usePathname();
  // The host is state, set by the aside element's own ref when the frame draws the row: a surface
  // rendered before the row is drawn portals in the moment the host exists, and never before.
  const [host, setHost] = useState<HTMLElement | null>(null);

  // Memoised on what it shows: mounting a slot is state in the frame, so a row with a new identity
  // every render would re-render the frame on every render of the surface inside it. The right half
  // is an empty host the surfaces draw into, so nothing a surface shows re-makes the row.
  const row = useMemo(
    () => (
      <div className="cx-takeoff-tabs">
        <nav className="cx-takeoff-nav" data-testid={TESTIDS.takeoff.nav} aria-label={strings.takeoff_nav_label}>
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
        <div className="cx-takeoff-tabs-aside" ref={setHost} />
      </div>
    ),
    [entries, here],
  );
  useShellToolbar(row);

  return <TabsHostContext.Provider value={host}>{children}</TabsHostContext.Provider>;
}
