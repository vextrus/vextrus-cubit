// S-Drawings-Sets (R-TO-005, L-REG-06): one set, whole — what it names now, every drawing the
// project holds with its revisions, and every revision this set has been pinned at.
//
// Thin by design: the set, the lineages and the reader's standing are answered by seams, and this
// file only asks and lays out what came back (ARCH-01, B-17). A set this project does not hold is
// an absence, which is Next's 404 rather than an empty browser.
import "../sets.css";

import { notFound, redirect } from "next/navigation";
import { projectsForHome } from "../../../../../../../../../modules/spine/projects";
import { drawingLineagesOf, holdsPinSet, setOf } from "../../../../../../../../../modules/takeoff/sets";
import { sessionOf } from "../../../../../../../../../server/shell/resolve";
import { presentedSessionToken } from "../../../../../../../../../server/shell/session";
import { SetBrowser } from "./set-browser";

export default async function ProjectDrawingSet({ params }: { params: Promise<{ tenant: string; project: string; set: string }> }) {
  const { tenant, project, set } = await params;
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) redirect("/sign-in");

  const workspace = await projectsForHome({ tenantId: tenant, userId: session.userId });
  if (!workspace.some((held) => held.projectId === project)) notFound();

  const scope = { tenantId: tenant, projectId: project };
  const [held, lineages, canPin] = await Promise.all([setOf(scope, set), drawingLineagesOf(scope), holdsPinSet(scope, session.userId)]);
  // A segment naming no set of this project names nothing, and is judged before anything renders.
  if (held === null) notFound();

  return <SetBrowser tenantId={tenant} projectId={project} set={held} lineages={lineages} canPin={canPin} />;
}
