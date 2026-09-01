// The project's participants screen (R-SPINE-011), read straight through the module: who holds
// which role, the record of how that came to be, and the workspace's members a role may be given
// to. The two address segments are passed on as they arrive.
//
// I-50: L-ACT-03's one seam guard refuses the read to a signed-in member who neither participates
// nor administers the workspace. The workspace membership itself holds, so the frame stays — the
// header renders, then the refusal, and nothing else. A rail of controls that would all refuse is
// theatre.
//
// I-51: `users.email` holds the folded KEY the doors look an account up under, not the address
// itself, so the label is read back out of it by the fold's own reader — the mechanism's one home
// (B-17). A digest-keyed account has no address to show and is named as an unnamed member.
import "./participants.css";

import { redirect } from "next/navigation";
import { refusalOf, type RefusalCode } from "../../../../../../../../core/errors";
import { refusalCodeOf } from "../../../../../../../../core/faults/refusal-marker";
import { assignableSubjects, projectParticipants, roleHistory, type MemberIdentity } from "../../../../../../../../modules/spine/participants";
import { presentedValue } from "../../../../../../../../server/auth/folded-key";
import { presentedSessionToken } from "../../../../../../../../server/shell/session";
import { sessionOf } from "../../../../../../../../server/shell/resolve";
import { RefusalState } from "../../../../../../../../ui/patterns/refusal-state";
import { shellHref } from "../../../../../../../../ui/shell";
import { strings } from "../../../../../../../../ui/strings";
import { ParticipantsSection, type ParticipantsMember } from "./participants-section";

export const metadata = { title: strings.spine_participants_heading };

export default async function ProjectParticipantsSettings({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  const session = await sessionOf(await presentedSessionToken());
  // The frame's own layout redirects a sessionless request; reaching here without one at all is a
  // race with a session that ended, and the way back in is the same door.
  if (session === null) redirect("/sign-in");

  const ctx = { tenantId: tenant, userId: session.userId, actorKind: "human" as const };
  try {
    const [roster, history, subjects] = await Promise.all([
      projectParticipants(ctx, { projectId: project }),
      roleHistory(ctx, { projectId: project }),
      assignableSubjects(ctx),
    ]);

    return (
      <ParticipantsSection
        tenantId={tenant}
        projectId={project}
        roster={roster.map((row) => ({ ...named(row.member), roles: row.roles }))}
        history={history.map((entry) => ({
          direction: entry.direction,
          role: entry.role,
          subject: named(entry.subject),
          actor: entry.actor === null ? null : named(entry.actor),
          occurredAt: entry.occurredAt.toISOString(),
        }))}
        subjects={subjects.map(named)}
      />
    );
  } catch (thrown) {
    const code = refusalCodeOf(thrown);
    if (code !== "PERMISSION_NOT_HELD") throw thrown;
    return <ParticipantsDenied tenantId={tenant} />;
  }
}

/** I-50's branch: the frame and the header stand, and one banner refusal says why nothing else does. */
function ParticipantsDenied({ tenantId }: { tenantId: string }) {
  const code: RefusalCode = "PERMISSION_NOT_HELD";
  return (
    <div className="cx-participants">
      <header className="cx-participants-header">
        <h1 className="cx-participants-heading">{strings.spine_participants_heading}</h1>
        <p className="cx-participants-caption">{strings.spine_participants_caption}</p>
      </header>
      <div className="cx-participants-denied" data-testid="participants-refusal">
        <p className="cx-participants-denied-line">{strings.spine_participants_denied_permission}</p>
        <p className="cx-participants-denied-line">{strings.spine_participants_denied_holder}</p>
        <RefusalState refusal={refusalOf(code)} evidence={{ href: shellHref(tenantId, "projects"), label: strings.home_evidence_projects }} />
      </div>
    </div>
  );
}

/** The person, as a reader recognises them: the address behind the key, or the unnamed-member line. */
function named(member: MemberIdentity): ParticipantsMember {
  const presented = member.emailKey === null ? null : presentedValue(member.emailKey);
  return { userId: member.userId, label: presented ?? strings.spine_participants_member_unnamed };
}
