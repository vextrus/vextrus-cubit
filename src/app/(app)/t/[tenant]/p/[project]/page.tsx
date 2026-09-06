// S-Project (R-SPINE-013, R-AI-005): the project home. A thin server page — it composes the four
// doors that already answer about a project and hands the screen one answer.
//
// I-130: existence and membership are one answer. A segment that names no project this workspace
// holds — a segment that is no uuid included, judged inside the projects module's own door — is an
// absent address, answered by `notFound()` and never by a refusal code; so it is asked first, and
// alone, before any of the four reads runs for a project nobody has.
//
// I-129: only the roster can refuse. Its L-ACT-03 guard denies a signed-in member who neither
// participates nor administers the workspace, and that answer stands in the roster's own place while
// the header, the areas, the quick actions, the AI cost and the recent activity all answer.
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { RefusalCode } from "../../../../../../core/errors";
import { refusalCodeOf } from "../../../../../../core/faults/refusal-marker";
import { projectAiSpendOf } from "../../../../../../modules/ai/spend";
import { getAuditSurfaces } from "../../../../../../modules/spine/audit";
import { projectParticipants } from "../../../../../../modules/spine/participants";
import { projectHeld, projectsForHome } from "../../../../../../modules/spine/projects";
import { presentedValue } from "../../../../../../server/auth/folded-key";
import { sessionOf } from "../../../../../../server/shell/resolve";
import { presentedSessionToken } from "../../../../../../server/shell/session";
import { strings } from "../../../../../../ui/strings";
import { namedWorkspaceRead } from "../../reads";
import { ProjectHome, type ProjectHomeRoster } from "./home/project-home";

/**
 * The project this address names, read once per request (React's `cache`, the memoisation home
 * `../../reads.ts` already established): the page renders from it and the tab's own name is read
 * off it, so naming the tab costs no second query.
 */
const projectRow = cache(async (tenantId: string, userId: string, projectId: string) => {
  const held = await projectsForHome({ tenantId, userId, actorKind: "human" });
  return held.find((candidate) => candidate.projectId === projectId) ?? null;
});

/**
 * A deep-linked, bookmarkable address names what it is standing on (R-UI-031): the tab, the history
 * entry and the shell's route announcer all read this, so the home of a project is titled with the
 * project's own stored name — data, rendered verbatim as data, never a sentence about it.
 */
export async function generateMetadata({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const presented = await presentedSessionToken();
  const session = await sessionOf(presented);
  if (session === null) return {};
  // The same membership door the body asks, and for the same reason: metadata is resolved
  // independently of what the layout renders, so a denial surface in the body would not stop a
  // title from naming a project of a workspace this account does not hold. It also answers no
  // membership for a segment that is no uuid, which is why nothing below reaches the tenant seam
  // with one (SEAM-TENANT).
  if ((await namedWorkspaceRead(presented, tenant)) === null) return {};
  const row = await projectRow(tenant, session.userId, project);
  return row === null ? {} : { title: row.name };
}

export default async function ProjectHomePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const presented = await presentedSessionToken();
  const session = await sessionOf(presented);
  // The frame's own layout redirects a sessionless request; reaching here without one at all is a
  // race with a session that ended, and the way back in is the same door.
  if (session === null) redirect("/sign-in");

  // The layout renders the denial surface in place of the frame for a workspace this session does
  // not hold — but the router renders layout and page concurrently, so that guard alone would let
  // four tenant-scoped reads run for a workspace the caller may not have. The same memoised door
  // the frame asks is asked here first, so an address naming no membership (a segment that is no
  // uuid included) reads nothing at all; what this page would have returned is discarded.
  if ((await namedWorkspaceRead(presented, tenant)) === null) return null;

  if (!(await projectHeld({ tenantId: tenant }, project))) notFound();

  const ctx = { tenantId: tenant, userId: session.userId, actorKind: "human" as const };
  const [row, spend, surfaces, participants] = await Promise.all([
    projectRow(tenant, session.userId, project),
    projectAiSpendOf({ tenantId: tenant, projectId: project }),
    getAuditSurfaces(ctx, project),
    rosterOf(ctx, project),
  ]);

  // The row itself, from the workspace's own reading of its projects. It was held a moment ago; a
  // project archived away between the two reads is an address that no longer names one.
  if (row === null) notFound();

  return (
    <ProjectHome
      data={{
        tenantId: tenant,
        projectId: project,
        project: row,
        // C-BK-BOOKS derives a district's zones from the book pinned to the project; no book is
        // pinned on this tree, so the roster is empty and the screen says why it is (I-133).
        zones: [],
        participants,
        spend,
        recentActs: surfaces.acts,
      }}
    />
  );
}

/**
 * The roster, or the refusal that stands in its place (I-129). A code the register knows is this
 * screen's partial answer; anything else is a fault and rises to the boundary untouched (ARCH-03).
 */
async function rosterOf(ctx: { tenantId: string; userId: string; actorKind: "human" }, projectId: string): Promise<ProjectHomeRoster> {
  try {
    const roster = await projectParticipants(ctx, { projectId });
    return {
      roster: roster.map((row) => ({
        userId: row.member.userId,
        // I-51: `users.email` holds the folded key, so the address is read back out of it by the
        // fold's own reader — a digest-keyed account has no address and is named as unnamed.
        label: (row.member.emailKey === null ? null : presentedValue(row.member.emailKey)) ?? strings.spine_participants_member_unnamed,
        roles: row.roles,
      })),
    };
  } catch (thrown) {
    const code = refusalCodeOf(thrown);
    if (code !== "PERMISSION_NOT_HELD") throw thrown;
    return { refusal: code satisfies RefusalCode };
  }
}
