// S-Takeoff (R-TO-050): the register workspace, read straight through the module's own door — one
// object tree, the lines measured from it, and everything that produced no line beside them.
//
// Thin by design: the reading is `registerViewOf`'s, what a reader may do here is L-ACT-03's own
// answer asked once, and this file only asks and hands both to the screen (ARCH-01, B-17).
import "./register.css";

import { permissionsHeld } from "@/core/acts";
import { forTenant } from "@/core/db";
import { reportFault } from "@/core/faults/report";
import { registerViewOf } from "@/modules/takeoff/register-ui/server";
import type { RegisterView } from "@/modules/takeoff/register-ui/view";
import { projectHeld } from "@/modules/spine/projects";
import { sessionOf } from "@/server/shell/resolve";
import { presentedSessionToken } from "@/server/shell/session";
import { strings } from "@/ui/strings";
import { notFound, redirect } from "next/navigation";
import { RegisterScreen } from "./register-screen";

export const metadata = { title: strings.takeoff_register_heading };

/** The permission every door on this screen moves (L-ACT-03), disclosed rather than discovered. */
const MEASURE = "MEASURE" as const;

/**
 * Whether this reader may record a reading, repudiate an object or queue a measure run here. The
 * reading is L-ACT-03's own, so the screen discloses exactly what the act seam would enforce and
 * never a second opinion of it (B-17, I-50).
 */
async function holdsMeasure(tenantId: string, projectId: string, userId: string): Promise<boolean> {
  return forTenant({ tenantId }).transaction(async (tx) => (await permissionsHeld(tx, projectId, userId)).has(MEASURE));
}

export default async function ProjectRegister({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const session = await sessionOf(await presentedSessionToken());
  // The frame's own layout redirects a sessionless request; reaching here without one at all is a
  // race with a session that ended, and the way back in is the same door.
  if (session === null) redirect("/sign-in");

  // An address naming no project of this workspace is an absence, not an empty register and not a
  // permission short of MEASURE (R-UI-050 asks each state to say the true thing).
  if (!(await projectHeld({ tenantId: tenant }, project))) notFound();

  const permitted = await holdsMeasure(tenant, project, session.userId);

  // A read that fails is a fault, not an empty register: it is recorded once, at the one seam that
  // mints a report id, and the screen quotes that id beside its retry (ARCH-03, B-21).
  let view: RegisterView | null = null;
  let reportId: string | null = null;
  try {
    view = await registerViewOf({ tenantId: tenant, projectId: project });
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: session.userId, route: "/t/[tenant]/p/[project]/takeoff/register", cause }).faultId;
  }

  return <RegisterScreen view={view} projectId={project} permitted={permitted} reportId={reportId} />;
}
