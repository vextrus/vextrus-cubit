// The workspace's members screen (R-SPINE-003), read straight through the tenancy module: who
// belongs to this workspace, the role each membership carries, and every role movement the
// workspace's ledgers hold about them.
//
// The page is thin. It authenticates, mints the actor the module scopes every read by, asks the
// module its two questions, and resolves the two things a browser cannot: the address behind a
// folded key (I-58) and the closed roster of workspace roles, whose one home is the driver's file
// and therefore unreachable from a client bundle (I-55, B-17).
//
// Seeing the roster is itself a permission: a signed-in stranger to this workspace is refused rather
// than answered with an empty list, and that refusal renders here through the one renderer.
import "./members.css";

import { redirect } from "next/navigation";
import { WORKSPACE_ROLES } from "../../../../../../core/db";
import { refusalOf } from "../../../../../../core/errors";
import { refusalCodeOf } from "../../../../../../core/faults/refusal-marker";
import { membersOf, memberRoleHistory, type TenancyActor } from "../../../../../../modules/spine/tenancy";
import { presentedValue } from "../../../../../../server/auth/folded-key";
import { presentedSessionToken } from "../../../../../../server/shell/session";
import { sessionOf } from "../../../../../../server/shell/resolve";
import { RefusalState } from "../../../../../../ui/patterns/refusal-state";
import { shellHref } from "../../../../../../ui/shell";
import { strings } from "../../../../../../ui/strings";
import { MembersSection, type MembersRow } from "./members-section";
import { membersStrings } from "./strings";

export const metadata = { title: membersStrings.members_heading };

export default async function WorkspaceMembers({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const session = await sessionOf(await presentedSessionToken());
  // The frame's own layout redirects a sessionless request; reaching here without one at all is a
  // race with a session that ended, and the way back in is the same door.
  if (session === null) redirect("/sign-in");

  const actor: TenancyActor = { tenantId: tenant, userId: session.userId };
  try {
    const members = await membersOf(actor);
    const rows: MembersRow[] = await Promise.all(
      members.map(async (member) => ({
        userId: member.userId,
        label: labelOf(member.emailKey),
        role: member.workspaceRole,
        history: (await memberRoleHistory(actor, member.userId)).map((movement) => ({
          projectId: movement.projectId,
          direction: movement.entry.direction,
          role: movement.entry.role,
          occurredAt: movement.entry.occurredAt.toISOString(),
          // The label is resolved here, on the server: the fold's read-back is the server's own
          // (I-58), and a browser holds neither the key's home nor the right to read it.
          actorLabel: movement.entry.actor === null ? null : labelOf(movement.entry.actor.emailKey),
        })),
      })),
    );

    return <MembersSection tenantId={tenant} rows={rows} roles={WORKSPACE_ROLES} />;
  } catch (thrown) {
    const code = refusalCodeOf(thrown);
    if (code !== refusalOf("WORKSPACE_PERMISSION_NOT_HELD").code) throw thrown;
    return <MembersDenied tenantId={tenant} />;
  }
}

/**
 * The stranger's answer: the screen says which refusal it is, in the register's own words, and shows
 * no roster at all — an empty list would itself be an answer about a workspace they may not read.
 */
function MembersDenied({ tenantId }: { tenantId: string }) {
  return (
    <div className="cx-members">
      <header className="cx-members-header">
        <h1 className="cx-members-heading">{membersStrings.members_heading}</h1>
        <p className="cx-members-caption">{membersStrings.members_caption}</p>
      </header>
      <div className="cx-members-answer" data-testid="members-refusal">
        <RefusalState
          refusal={refusalOf("WORKSPACE_PERMISSION_NOT_HELD")}
          evidence={{ href: shellHref(tenantId, "projects"), label: strings.home_evidence_projects }}
        />
      </div>
    </div>
  );
}

/**
 * The person, as a reader recognises them (I-58): `users.email` holds the folded KEY an account is
 * looked up under, never the address, so the label is read back through the fold's one home. A
 * digest-keyed account has no address to show and is named as an unnamed member.
 */
function labelOf(emailKey: string | null): string {
  const presented = emailKey === null ? null : presentedValue(emailKey);
  return presented ?? membersStrings.members_member_unnamed;
}
