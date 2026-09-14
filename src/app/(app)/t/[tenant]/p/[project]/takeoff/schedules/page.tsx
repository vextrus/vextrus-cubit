// S-Schedules (R-TO-034): the pinned revision's sheets, the schedules reconstructed off them, the
// member types those schedules named, and how each sheet's general notes stand.
//
// Thin by design: the reading is `schedulesViewOf`'s, what a reader may do here is L-ACT-03's own
// answer asked once, and this file only asks and hands both to the screen (ARCH-01, B-17).
import "./schedules.css";

import { permissionsHeld } from "@/core/acts";
import { forTenant } from "@/core/db";
import { reportFault } from "@/core/faults/report";
import { schedulesViewOf } from "@/modules/takeoff/schedules-ui/server";
import type { SchedulesView } from "@/modules/takeoff/schedules-ui/view";
import { authorizePage } from "@/server/authorize-page";
import { strings } from "@/ui/strings";
import { SchedulesScreen } from "./schedules-screen";

export const metadata = { title: strings.takeoff_nav_schedules };

/** The file route this screen answers at, as the fault seam and the state matrix both key it. */
const ROUTE = "/t/[tenant]/p/[project]/takeoff/schedules";

/**
 * The one permission the door on this screen moves (Decision §2's denial table). The reading is
 * L-ACT-03's own, so the screen discloses exactly what the act seam would enforce and never a second
 * opinion of it (B-17, I-50).
 */
const DOOR_PERMISSIONS = ["MEASURE"] as const;

async function permissionsFor(tenantId: string, projectId: string, userId: string): Promise<Record<string, boolean>> {
  const held = await forTenant({ tenantId }).transaction(async (tx) => permissionsHeld(tx, projectId, userId));
  return Object.fromEntries(DOOR_PERMISSIONS.map((permission) => [permission, held.has(permission)]));
}

export default async function ProjectSchedules({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  // The choke point, asked by this page for itself (B-17, ARCH-02): session, then the workspace the
  // PROJECT is really in, then the read. An address naming no project this session may have is an
  // absence, not an empty rail and not a permission short of one (R-UI-050 asks each state to say
  // the true thing).
  const { tenantId, userId } = await authorizePage({ tenant, project });

  const permitted = await permissionsFor(tenantId, project, userId);

  // A read that fails is a fault, not an empty rail: it is recorded once, at the one seam that mints
  // a report id, and the screen quotes that id beside its retry (ARCH-03, B-21).
  let view: SchedulesView | null = null;
  let reportId: string | null = null;
  try {
    view = await schedulesViewOf({ tenantId, projectId: project });
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: userId, route: ROUTE, cause }).faultId;
  }

  return <SchedulesScreen view={view} tenantId={tenantId} projectId={project} permitted={permitted} reportId={reportId} />;
}
