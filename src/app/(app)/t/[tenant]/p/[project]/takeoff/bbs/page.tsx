// S-BBS (R-TO-054): the pinned campaign's bill of bars, by member and bar mark, with every lap
// standing as its own component beside the bar it belongs to (AM-03(a)).
//
// Thin by design: the reading is `bbsViewOf`'s, what a reader may do here is L-ACT-03's own answer
// asked once, and this file only asks and hands both to the screen (ARCH-01, B-17).
import "./bbs.css";

import { permissionsHeld } from "@/core/acts";
import { forTenant } from "@/core/db";
import { reportFault } from "@/core/faults/report";
import { bbsViewOf } from "@/modules/takeoff/bbs-ui/server";
import type { BbsView } from "@/modules/takeoff/bbs-ui/view";
import { authorizePage } from "@/server/authorize-page";
import { strings } from "@/ui/strings";
import { uiInstrumentArmed } from "@/app/theme-resolver";
import { BbsScreen } from "./bbs-screen";
import { demonstrationOf, type Demonstration } from "./demonstration";

export const metadata = { title: strings.takeoff_nav_bbs };

/** The file route this screen answers at, as the fault seam and the state matrix both key it. */
const ROUTE = "/t/[tenant]/p/[project]/takeoff/bbs";

/** The one permission reading this schedule needs (Decision §2's denial table, I-bbs-1). */
const MEASURE = "MEASURE";

/**
 * The evidence instrument's state door (`?__state=`, `theme-resolver.ts`): what the address asked
 * this screen to stand in, or null for the ordinary read. The names it answers to are the SCREEN's
 * own, so every cell a reviewer is told about is a cell they can open (R-UI-050, AM-09 §4).
 */
function demanded(asked: string | readonly string[] | undefined): Demonstration | null {
  if (!uiInstrumentArmed() || typeof asked !== "string" || asked === "") return null;
  return demonstrationOf(asked);
}

export default async function ProjectBbs({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, project } = await params;
  // The choke point, asked by this page for itself (B-17, ARCH-02): session, then the workspace the
  // PROJECT is really in, then the read — never the segment a caller typed.
  const { tenantId, userId } = await authorizePage({ tenant, project });

  const demonstration = demanded((await searchParams)["__state"]);
  if (demonstration !== null) {
    return <BbsScreen view={null} tenantId={tenantId} projectId={project} permitted={false} reportId={null} demonstration={demonstration} />;
  }

  // A read that fails is a fault, not an empty grid: it is recorded once, at the one seam that mints
  // a report id, and the screen quotes that id beside its retry (ARCH-03, B-21).
  //
  // The guard has already admitted this reader to this project; what L-ACT-03 answers here is what
  // the SCREEN may show them (I-bbs-1), so it is asked beside the reading and under the same record.
  // `permitted` starts true so that a failure to answer it leaves the screen in `error` with nothing
  // read rather than in `denied`: a question this page could not ask is not a denial (R-UI-050).
  let view: BbsView | null = null;
  let permitted = true;
  let reportId: string | null = null;
  try {
    // BOTH answers, or neither: a schedule held while the permission behind it went unanswered would
    // be rendered to a reader whose MEASURE nobody could confirm, under a `permitted` that never
    // stopped being its own opening guess (R-UI-050, ARCH-02).
    const reading = await bbsViewOf({ tenantId, projectId: project });
    const holds = await forTenant({ tenantId }).transaction(async (tx) => (await permissionsHeld(tx, project, userId)).has(MEASURE));
    view = reading;
    permitted = holds;
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: userId, route: ROUTE, cause }).faultId;
  }

  return <BbsScreen view={view} tenantId={tenantId} projectId={project} permitted={permitted} reportId={reportId} />;
}
