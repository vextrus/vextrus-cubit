// S-Drawings-Sets (R-TO-005): the project's sets index, read straight through the module — one row
// per set with the revision it stands pinned at. The two address segments are passed on as they
// arrive (Next hands a dynamic segment already decoded).
//
// Thin by design: the sets, their counts and their digests are answered by the module's one door,
// and this file only asks and lays out what came back (ARCH-01, B-17).
import "./sets.css";

import { holdsPinSet, setsOf } from "@/modules/takeoff/sets";
import { authorizePage } from "@/server/authorize-page";
import { SetsIndex } from "./sets-index";
import { sets } from "./strings";

export const metadata = { title: sets.sets_heading };

export default async function ProjectDrawingSets({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  // The choke point, asked by this page for itself (B-17, ARCH-02): session, then the workspace the
  // PROJECT is really in — never the segment, which is a value the caller wrote — then the read.
  // `projectHeld` answered a different question: "is that project in that workspace", which is true
  // of a workspace the caller has never been a member of, and it armed the row policy with the
  // segment on the way. The reads below are scoped by what the guard answered, and the permission
  // this screen discloses is read for the account the guard resolved.
  // An address naming no project this session may have is an absence, not an empty index and not a
  // permission short of PIN_SET (R-UI-050 asks each state to say the true thing).
  const { tenantId, userId } = await authorizePage({ tenant, project });

  // I-101: what a reader may do here is the seam's own reading, asked once and disclosed by the
  // screen — a control that could only refuse is not rendered at all.
  const scope = { tenantId, projectId: project };
  const [held, canPin] = await Promise.all([setsOf(scope), holdsPinSet(scope, userId)]);

  return <SetsIndex tenantId={tenantId} projectId={project} sets={held} canPin={canPin} />;
}
