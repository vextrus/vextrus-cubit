// S-Drawings-Sets (R-TO-005, L-REG-06): one set, whole — what it names now, every drawing the
// project holds with its revisions, and every revision this set has been pinned at.
//
// Thin by design: the set, the lineages and the reader's standing are answered by seams, and this
// file only asks and lays out what came back (ARCH-01, B-17). A set this project does not hold is
// an absence, which is Next's 404 rather than an empty browser.
import "../sets.css";

import { notFound, redirect } from "next/navigation";
import { projectHeld } from "../../../../../../../../../modules/spine/projects";
import { drawingLineagesOf, holdsPinSet, setOf } from "../../../../../../../../../modules/takeoff/sets";
import { sessionOf } from "../../../../../../../../../server/shell/resolve";
import { presentedSessionToken } from "../../../../../../../../../server/shell/session";
import { sets as setsStrings } from "../strings";
import { SetBrowser } from "./set-browser";

/**
 * The tab and the history entry name the set, the way every shell screen names itself: a person with
 * several sets open tells them apart by the only thing that distinguishes them. A name is not
 * published to a request carrying no session, and an address naming no set the reader holds falls
 * back to the screen's own name.
 *
 * This runs beside the page, on the same request, so it asks for the one thing it needs: `setOf` is
 * already scoped to the address and already refuses a reader who may not have it, and asking
 * existence a second time here would be the same question answered twice per render (B-17).
 */
export async function generateMetadata({ params }: { params: Promise<{ tenant: string; project: string; set: string }> }): Promise<{ title: string }> {
  const { tenant, project, set } = await params;
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) return { title: setsStrings.sets_heading };

  const held = await setOf({ tenantId: tenant, projectId: project }, set);
  return { title: held?.name ?? setsStrings.sets_heading };
}

export default async function ProjectDrawingSet({ params }: { params: Promise<{ tenant: string; project: string; set: string }> }) {
  const { tenant, project, set } = await params;
  const session = await sessionOf(await presentedSessionToken());
  if (session === null) redirect("/sign-in");

  if (!(await projectHeld({ tenantId: tenant }, project))) notFound();

  const scope = { tenantId: tenant, projectId: project };
  const [held, lineages, canPin] = await Promise.all([setOf(scope, set), drawingLineagesOf(scope), holdsPinSet(scope, session.userId)]);
  // A segment naming no set of this project names nothing, and is judged before anything renders.
  if (held === null) notFound();

  return <SetBrowser tenantId={tenant} projectId={project} set={held} lineages={lineages} canPin={canPin} />;
}
