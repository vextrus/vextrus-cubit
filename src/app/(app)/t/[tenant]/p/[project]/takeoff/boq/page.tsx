// S-BOQ (R-TO-053): the pinned campaign's published lines, grouped into L-BD-08's sections, priced
// by nobody and signed by nobody (AM-05).
//
// Thin by design: the reading is `boqViewOf`'s, what a reader may do here is L-ACT-03's own answer
// asked once, and this file only asks and hands both to the screen (ARCH-01, B-17).
import "./boq.css";

import { permissionsHeld } from "@/core/acts";
import { forTenant } from "@/core/db";
import { BOQ_DRAFT } from "@/core/documents/kinds/boq-draft-law";
import { listDocuments } from "@/core/documents/store";
import { reportFault } from "@/core/faults/report";
import { boqViewOf } from "@/modules/takeoff/boq/server";
import type { BoqView } from "@/modules/takeoff/boq/view";
import { authorizePage } from "@/server/authorize-page";
import { strings } from "@/ui/strings";
import { uiInstrumentArmed } from "@/app/theme-resolver";
import { BoqScreen } from "./boq-screen";
import { demonstrationOf, type Demonstration } from "./demonstration";

export const metadata = { title: strings.takeoff_nav_boq };

/** The file route this screen answers at, as the fault seam and the state matrix both key it. */
const ROUTE = "/t/[tenant]/p/[project]/takeoff/boq";

/** The one permission the door on this screen moves (Decision §2's denial table, L-ACT-03, I-50). */
const MEASURE = "MEASURE";

/**
 * The evidence instrument's state door (`?__state=`, `theme-resolver.ts`): what the address asked
 * this screen to stand in, or null for the ordinary read. The names it answers to are the SCREEN's
 * own, so every cell a reviewer is told about is a cell they can open, and a name the screen never
 * declared is answered rather than ignored (R-UI-050, AM-09 §4).
 */
function demanded(asked: string | readonly string[] | undefined, projectId: string): Demonstration | null {
  if (!uiInstrumentArmed() || typeof asked !== "string" || asked === "") return null;
  return demonstrationOf(asked, projectId);
}

export default async function ProjectBoq({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, project } = await params;
  // The choke point, asked by this page for itself (B-17, ARCH-02): session, then the workspace the
  // PROJECT is really in, then the read.
  const { tenantId, userId } = await authorizePage({ tenant, project });

  const demonstration = demanded((await searchParams)["__state"], project);
  if (demonstration !== null) {
    return <BoqScreen view={null} tenantId={tenantId} projectId={project} permitted={false} reportId={null} documentId={null} demonstration={demonstration} />;
  }

  const permitted = await forTenant({ tenantId }).transaction(async (tx) => (await permissionsHeld(tx, project, userId)).has(MEASURE));

  // A read that fails is a fault, not an empty rail: it is recorded once, at the one seam that mints
  // a report id, and the screen quotes that id beside its retry (ARCH-03, B-21).
  let view: BoqView | null = null;
  let reportId: string | null = null;
  try {
    view = await boqViewOf({ tenantId, projectId: project });
  } catch (cause) {
    reportId = reportFault({ requestId: crypto.randomUUID(), actor: userId, route: ROUTE, cause }).faultId;
  }

  return (
    <BoqScreen
      view={view}
      tenantId={tenantId}
      projectId={project}
      permitted={permitted}
      reportId={reportId}
      documentId={await issuedDraftOf(tenantId, project)}
    />
  );
}

/**
 * The newest draft this project has issued, where one exists. It is read HERE rather than watched in
 * the browser because the documents list is the store's own answer to "what was filed" (R-SPINE-040):
 * a render that succeeds re-reads this page, and the link it offers is the row the store now holds —
 * never an id the screen minted for itself (B-17).
 */
async function issuedDraftOf(tenantId: string, projectId: string): Promise<string | null> {
  const listed = await forTenant({ tenantId }).transaction((tx) => listDocuments(tx, projectId));
  return listed.find((document) => document.kind === BOQ_DRAFT)?.id ?? null;
}
