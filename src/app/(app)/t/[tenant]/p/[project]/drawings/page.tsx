// S-Drawings (R-TO-004): the project's sheet index, read straight through the module — one card per
// sheet of every drawing's current record, and the groups the machine offers to confirm a discipline
// through. The two address segments are passed on as they arrive.
//
// Thin by design: every proposal, every counter and every membership is answered by a seam, and this
// file only asks and lays out what came back (ARCH-01, B-17).
import "./drawings.css";

import { redirect } from "next/navigation";
import { permissionsHeld } from "../../../../../../../core/acts";
import { forTenant } from "../../../../../../../core/db";
import { drawingsAwaitingIngestOf, offeredGroupsOf, sheetIndexOf } from "../../../../../../../modules/takeoff/sheets";
import { sessionOf } from "../../../../../../../server/shell/resolve";
import { presentedSessionToken } from "../../../../../../../server/shell/session";
import { SheetIndex } from "./sheet-index";
import { drawings } from "./strings";

export const metadata = { title: drawings.drawings_heading };

/** The permission a confirmation moves (L-ACT-03), asked of the reader before anything renders. */
const MEASURE = "MEASURE";

export default async function ProjectDrawings({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const session = await sessionOf(await presentedSessionToken());
  // The frame's own layout redirects a sessionless request; reaching here without one at all is a
  // race with a session that ended, and the way back in is the same door.
  if (session === null) redirect("/sign-in");

  const scope = { tenantId: tenant, projectId: project };
  const [cards, groups, awaitingIngest, canConfirm] = await Promise.all([
    sheetIndexOf(scope),
    offeredGroupsOf(scope),
    drawingsAwaitingIngestOf(scope),
    holdsMeasure(tenant, project, session.userId),
  ]);

  return (
    <SheetIndex
      tenantId={tenant}
      projectId={project}
      cards={cards}
      groups={groups}
      canConfirm={canConfirm}
      awaitingIngest={awaitingIngest}
    />
  );
}

/**
 * Whether this reader may confirm a discipline here (I-90). The reading is L-ACT-03's own — the
 * roles a person holds on the project, minus the withdrawals that countermand them — so the screen
 * discloses exactly what the seam would enforce, and never a second opinion of it (B-17).
 */
async function holdsMeasure(tenantId: string, projectId: string, userId: string): Promise<boolean> {
  return forTenant({ tenantId }).transaction(async (tx) => (await permissionsHeld(tx, projectId, userId)).has(MEASURE));
}
