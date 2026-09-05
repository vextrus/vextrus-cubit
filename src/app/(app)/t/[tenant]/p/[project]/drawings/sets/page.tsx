// S-Drawings-Sets (R-TO-005): the project's sets index, read straight through the module — one row
// per set with the revision it stands pinned at. The two address segments are passed on as they
// arrive (Next hands a dynamic segment already decoded).
//
// Thin by design: the sets, their counts and their digests are answered by the module's one door,
// and this file only asks and lays out what came back (ARCH-01, B-17).
import "./sets.css";

import { notFound, redirect } from "next/navigation";
import { projectHeld } from "../../../../../../../../modules/spine/projects";
import { holdsPinSet, setsOf } from "../../../../../../../../modules/takeoff/sets";
import { sessionOf } from "../../../../../../../../server/shell/resolve";
import { presentedSessionToken } from "../../../../../../../../server/shell/session";
import { SetsIndex } from "./sets-index";
import { sets } from "./strings";

export const metadata = { title: sets.sets_heading };

export default async function ProjectDrawingSets({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const session = await sessionOf(await presentedSessionToken());
  // The frame's own layout redirects a sessionless request; reaching here without one at all is a
  // race with a session that ended, and the way back in is the same door.
  if (session === null) redirect("/sign-in");

  // An address naming no project of this workspace is an absence, not an empty index and not a
  // permission short of PIN_SET (R-UI-050 asks each state to say the true thing). The question has
  // one home in the projects module, and one bounded read is its whole cost (B-17).
  if (!(await projectHeld({ tenantId: tenant }, project))) notFound();

  // I-101: what a reader may do here is the seam's own reading, asked once and disclosed by the
  // screen — a control that could only refuse is not rendered at all.
  const scope = { tenantId: tenant, projectId: project };
  const [held, canPin] = await Promise.all([setsOf(scope), holdsPinSet(scope, session.userId)]);

  return <SetsIndex tenantId={tenant} projectId={project} sets={held} canPin={canPin} />;
}
