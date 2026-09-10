// S-Coverage (R-TO-052, X-3): the residue as a heat grid — what this campaign measured, what it did
// not, and why — read straight through the coverage module's own door.
//
// Thin by design: the reading is `coverageViewOf`'s, what a reader may do here is L-ACT-03's own
// answer asked once, and this file only asks and hands both to the screen (ARCH-01, B-17).
import "./coverage.css";

import { permissionsHeld } from "@/core/acts";
import { forTenant } from "@/core/db";
import { reportFault } from "@/core/faults/report";
import { CELL_PARAM } from "@/modules/takeoff/coverage";
import { coverageViewOf } from "@/modules/takeoff/coverage/server";
import { COVERAGE_COPY } from "@/modules/takeoff/coverage/copy";
import type { CoverageView } from "@/modules/takeoff/coverage/view";
import { projectHeld } from "@/modules/spine/projects";
import { sessionOf } from "@/server/shell/resolve";
import { presentedSessionToken } from "@/server/shell/session";
import { notFound, redirect } from "next/navigation";
import { CoverageScreen } from "./coverage-screen";

export const metadata = { title: COVERAGE_COPY.takeoff_coverage_heading };

/** The permission the two doors on this screen move (L-ACT-03), disclosed rather than discovered. */
const SET_BILL_BOUNDARY = "SET_BILL_BOUNDARY" as const;

/**
 * Whether this reader may move a boundary here. The reading is L-ACT-03's own, so the screen
 * discloses exactly what the act seam would enforce and never a second opinion of it (B-17, I-50).
 */
async function holdsBoundary(tenantId: string, projectId: string, userId: string): Promise<boolean> {
  return forTenant({ tenantId }).transaction(async (tx) => (await permissionsHeld(tx, projectId, userId)).has(SET_BILL_BOUNDARY));
}

/** The cell the address names, where it names one — a stale address selects nothing (I-193). */
function cellNamed(asked: Record<string, string | string[] | undefined>): string | null {
  const held = asked[CELL_PARAM];
  const named = Array.isArray(held) ? held[0] : held;
  return named === undefined || named === "" ? null : named;
}

export default async function ProjectCoverage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, project } = await params;
  const session = await sessionOf(await presentedSessionToken());
  // The frame's own layout redirects a sessionless request; reaching here without one at all is a
  // race with a session that ended, and the way back in is the same door.
  if (session === null) redirect("/sign-in");

  // An address naming no project of this workspace is an absence, not an empty grid and not a
  // permission short of SET_BILL_BOUNDARY (R-UI-050 asks each state to say the true thing).
  if (!(await projectHeld({ tenantId: tenant }, project))) notFound();

  const permitted = await holdsBoundary(tenant, project, session.userId);

  // A read that fails is a fault, not an empty residue: it is recorded once, at the one seam that
  // mints a report id, and the screen quotes that id beside its retry (ARCH-03, B-21).
  let view: CoverageView | null = null;
  let reportId: string | null = null;
  try {
    view = await coverageViewOf({ tenantId: tenant, projectId: project });
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: session.userId, route: "/t/[tenant]/p/[project]/takeoff/coverage", cause }).faultId;
  }

  return <CoverageScreen view={view} projectId={project} permitted={permitted} reportId={reportId} initialCell={cellNamed(await searchParams)} />;
}
