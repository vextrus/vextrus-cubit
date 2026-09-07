"use client";
// The frame, told where it is. R-UI-031 makes the URL the source of truth for selection, and the
// address is a fact about the browser rather than about the layout that renders once above every
// area — so the pathname is read here, and the frame is handed the area it names.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";
import { REFUSALS, refusalOf, type RefusalCode } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import type { Density } from "@/core/prefs";
import { JobsProvider, type JobsFormat } from "@/ui/patterns/job-timeline";
import { AppShell, areaOf, isAreaHome, type ShellWorkspace } from "@/ui/shell";
import { fill, strings } from "@/ui/strings";
import { PaletteHost } from "./palette/palette-host";
import { paletteSearchAction } from "./palette/search-action";

/** A millisecond count as the whole seconds a person reads (job-timeline I-113, s-drawings I-92). */
const MS_PER_SECOND = 1000;

/**
 * The project an address is inside, and null for an address that names none. The frame reads it for
 * the same reason it reads the area — the URL is the source of truth about where a reader stands
 * (R-UI-031) — and the palette needs it to know whether `g` then `d` has a project to open.
 */
const PROJECT_SEGMENT = /^\/t\/[^/]+\/p\/([^/]+)(?:\/|$)/;

function projectOf(pathname: string | null): string | null {
  if (pathname === null) return null;
  const match = PROJECT_SEGMENT.exec(pathname);
  return match === null ? null : (match[1] ?? null);
}

export interface ShellFrameProps {
  workspace: ShellWorkspace;
  /** Every workspace the account holds — the switcher's own list (R-SPINE-003). */
  workspaces: readonly ShellWorkspace[];
  email: string | null;
  /** The stored mode the layout read for this account (R-UI-005); the frame publishes it. */
  density: Density;
  signOut: () => Promise<void>;
  children: ReactNode;
}

export function ShellFrame({ workspace, workspaces, email, density, signOut, children }: ShellFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Following an address is the router's, so a palette hit lands inside the same layout the reader
  // is already in — the frame is not torn down and rebuilt for a move within it.
  const navigate = useCallback((href: string): void => router.push(href), [router]);
  // The two things the job pattern cannot do for itself, bound here exactly once: `src/ui` holds no
  // value import of core (ARCH-01), so whole seconds and the refusal registry are handed down as
  // `JobsFormat` (job-timeline I-113). A code the register does not hold is not a refusal — it is a
  // word the seam sent that no entry answers, and inventing a card for it would put a sentence in a
  // person's mouth the taxonomy never wrote (I-110).
  const format = useMemo<JobsFormat>(
    () => ({
      seconds: (elapsedMs) => fill(strings.job_timeline_seconds, { seconds: formatUserFigure(String(Math.round(elapsedMs / MS_PER_SECOND))) }),
      refusal: (code) => (Object.prototype.hasOwnProperty.call(REFUSALS, code) ? refusalOf(code as RefusalCode) : null),
    }),
    [],
  );

  return (
    <JobsProvider format={format}>
      {/* The palette stands over every address inside the workspace (R-SPINE-050), so it wraps the
          frame rather than any one screen: the trigger is an occupant of the bar, and ⌘K, `?` and
          the go chords are answered wherever a reader happens to be. */}
      <PaletteHost tenantId={workspace.tenantId} projectId={projectOf(pathname)} search={paletteSearchAction} navigate={navigate}>
        <AppShell
          workspace={workspace}
          workspaces={workspaces}
          area={areaOf(pathname)}
          atAreaHome={isAreaHome(pathname, workspace.tenantId)}
          email={email}
          density={density}
          signOut={signOut}
        >
          {children}
        </AppShell>
      </PaletteHost>
    </JobsProvider>
  );
}
