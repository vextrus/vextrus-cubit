/**
 * `/t/{tenantSlug}/p/{projectId}/settings/participants` — the roster, assignment by act, and
 * the role history (R-SPINE-011, R-UI-021, L-ACT-03, J-003; panes file §3–§6).
 *
 * Server-rendered whole: nothing streams under `/t`, the guard answers before any byte, and the
 * roster, the history and the workspace's members are three reads taken here. Viewing needs only
 * tenant membership (Interpretation 4) — the act's own authority is the seam's question, asked
 * when the reader previews one.
 *
 * The roster and the history are never empty (Interpretation 7): every project is founded by a
 * grant, so the creator is on both from the project's first moment.
 */
import { notFound, redirect } from 'next/navigation';
import { ParticipantsPane } from './participants-pane';
import { ROLE } from '../../../../../../../core/acts';
import { listMembers } from '../../../../../../../modules/spine/members';
import {
  participantRoster,
  projectContext,
  readProject,
  roleHistory,
} from '../../../../../../../modules/spine/projects';
import { SIGN_IN_PATH, tenantContext } from '../../../../../../../server/session';

/**
 * §4: the six roles a human may pick, in the order the design offers them — the vocabulary's
 * own names, never spelled here (Q-07 reads a screaming-snake literal as a refusal code).
 */
const ROLE_CHOICES: readonly string[] = [
  ROLE.PRINCIPAL,
  ROLE.MEASURER,
  ROLE.REVIEWER,
  ROLE.LEAD,
  ROLE.ESTIMATOR,
  ROLE.BID_MANAGER,
];

export default async function ProjectParticipantsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const ctx = projectContext({ tenantId: context.tenantId, userId: context.session.userId });
  const project = await readProject(ctx, { projectId });
  if (project === null) notFound();

  const [roster, history, members] = await Promise.all([
    participantRoster(ctx, { projectId }),
    roleHistory(ctx, { projectId }),
    listMembers({ tenantId: context.tenantId, userId: context.session.userId }),
  ]);

  return (
    <ParticipantsPane
      tenantSlug={context.slug}
      projectId={project.id}
      readerEmail={context.session.email}
      members={members.map((member) => ({ userId: member.userId, email: member.email }))}
      roles={ROLE_CHOICES}
      defaultRole={ROLE.MEASURER}
      roster={roster}
      history={history}
    />
  );
}
