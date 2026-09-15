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
import { uiInstrumentArmed } from "@/app/theme-resolver";
import { demonstrationOf, type Demonstration } from "./demonstration";
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

/**
 * The evidence instrument's state door (`?__state=`, `theme-resolver.ts`): what the address asked
 * this screen to stand in, or null for the ordinary read. The names it answers to are the SCREEN'S
 * own eight — `SCHEDULES_STATES`, the vocabulary `schedules-screen[data-state]` wears and the
 * Decision §2 rules cell by cell — so every cell a reviewer is told about is a cell they can open,
 * and a name the screen never declared is answered rather than ignored (R-UI-050, AM-09 §4).
 *
 * What stands up is the SCREEN, driven by `./demonstration`'s reading and flags — never a stand-in
 * beside it, because a stand-in is a picture of the design and not the design. The door is armed by
 * name and shut everywhere else, so an installation that never opted in cannot be talked into it.
 */
function demanded(asked: string | readonly string[] | undefined, projectId: string): Demonstration | null {
  if (!uiInstrumentArmed() || typeof asked !== "string" || asked === "") return null;
  return demonstrationOf(asked, projectId);
}

export default async function ProjectSchedules({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, project } = await params;
  // The choke point, asked by this page for itself (B-17, ARCH-02): session, then the workspace the
  // PROJECT is really in, then the read. An address naming no project this session may have is an
  // absence, not an empty rail and not a permission short of one (R-UI-050 asks each state to say
  // the true thing).
  const { tenantId, userId } = await authorizePage({ tenant, project });

  // Asked for a state by name, on an installation that armed the instrument: the screen stands in
  // that state instead of in the one the read would put it in. The door is INSIDE authorization — an
  // address nobody may open opens nothing here either, whatever it asks for — and it neither reads
  // the store nor asks the seam for a permission, because nothing it shows came from either.
  const demonstration = demanded((await searchParams)["__state"], project);
  if (demonstration !== null) {
    return <SchedulesScreen view={null} tenantId={tenantId} projectId={project} permitted={{}} reportId={null} demonstration={demonstration} />;
  }

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
