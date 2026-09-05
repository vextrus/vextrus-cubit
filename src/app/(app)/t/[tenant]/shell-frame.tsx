"use client";
// The frame, told where it is. R-UI-031 makes the URL the source of truth for selection, and the
// address is a fact about the browser rather than about the layout that renders once above every
// area — so the pathname is read here, and the frame is handed the area it names.
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { REFUSALS, refusalOf, type RefusalCode } from "../../../../core/errors";
import { formatUserFigure } from "../../../../core/format";
import type { Density } from "../../../../core/prefs";
import { JobsProvider, type JobsFormat } from "../../../../ui/patterns/job-timeline";
import { AppShell, areaOf, isAreaHome, type ShellWorkspace } from "../../../../ui/shell";
import { fill, strings } from "../../../../ui/strings";

/** A millisecond count as the whole seconds a person reads (job-timeline I-113, s-drawings I-92). */
const MS_PER_SECOND = 1000;

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
    </JobsProvider>
  );
}
