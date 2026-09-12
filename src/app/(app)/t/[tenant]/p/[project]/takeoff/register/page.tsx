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
import { authorizePage } from "@/server/authorize-page";
import { strings } from "@/ui/strings";
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
  // The choke point, asked by this page for itself (B-17, ARCH-02): session, then the workspace the
  // PROJECT is really in — never the segment, which is a value the caller wrote — then the read.
  // `projectHeld` answered a different question: "is that project in that workspace", which is true
  // of a workspace the caller has never been a member of, and it armed the row policy with the
  // segment on the way. The reads below are scoped by what the guard answered, and the permission
  // this screen discloses is read for the account the guard resolved.
  // An address naming no project this session may have is an absence, not an empty register and not
  // a permission short of MEASURE (R-UI-050 asks each state to say the true thing).
  const { tenantId, userId } = await authorizePage({ tenant, project });

  const permitted = await holdsMeasure(tenantId, project, userId);

  // A read that fails is a fault, not an empty register: it is recorded once, at the one seam that
  // mints a report id, and the screen quotes that id beside its retry (ARCH-03, B-21).
  let view: RegisterView | null = null;
  let reportId: string | null = null;
  try {
    view = await registerViewOf({ tenantId, projectId: project });
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: userId, route: "/t/[tenant]/p/[project]/takeoff/register", cause }).faultId;
  }

  return <RegisterScreen view={view} tenantId={tenantId} projectId={project} permitted={permitted} reportId={reportId} />;
}
