'use server';

/**
 * The project panes' server actions (R-SPINE-010, R-SPINE-011, R-UI-021).
 *
 * Each one guards for itself. A client component's call is a request like any other — the
 * session can end, and the slug and project id in the URL are whatever the browser said — so
 * every act re-derives the tenant context from the cookie and reads the project back under the
 * tenant's own scope rather than trusting ids the page was rendered with. The idiom is the
 * tenant-settings actions', and so is the shape of the answer: a value, never an exception,
 * because a refusal is something the screen renders in place with its code and remedy
 * (R-UI-020) and a request that never completed is the error line.
 *
 * Editing and archiving are not acts (panes file Interpretation 1) and go straight to the
 * module. The assignment is one, so it goes through the act seam and nowhere else: preview
 * computes the Consequence and its digest, and confirm carries that digest back so the human
 * confirms the state they were shown (L-ACT-02).
 */
import { commitAct, previewAct, refusalCodeOf, ACT_TYPE } from '../../../../../../core/acts';
import type { ActRefusalCode, AssignParticipantRoleConsequence } from '../../../../../../core/acts';
import {
  archiveProject,
  participantRoster,
  projectContext,
  roleHistory,
  updateProject,
} from '../../../../../../modules/spine/projects';
import type { ParticipantView, RoleGrantView } from '../../../../../../modules/spine/projects';
import { tenantContext } from '../../../../../../server/session';

/** What a pane's act answers with: it worked, it was refused by code, or it did not complete. */
export type PaneOutcome<T = undefined> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ActRefusalCode | null };

/** The two lists the participants pane re-reads after an act moved them. */
export interface ParticipantsView {
  readonly roster: readonly ParticipantView[];
  readonly history: readonly RoleGrantView[];
}

/** What a preview hands the dialog: the server's typed Consequence, and the digest to carry. */
export interface PreviewedAssignment {
  readonly consequence: AssignParticipantRoleConsequence;
  readonly digest: string;
}

/** The R-SPINE-010 values the fields pane saves, as the wire carries them (strings, B-07). */
export interface ProjectFieldsInput {
  readonly name: string;
  readonly code: string;
  readonly client: string;
  readonly siteAddress: string;
  readonly district: string;
  readonly buildingType: string;
  readonly storeys: string;
  readonly gfaM2: string;
  readonly notes: string;
}

/** The context an act runs under, or nothing that could act at all. */
async function actorOn(tenantSlug: string) {
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out' || context === 'not-found') return null;
  return projectContext({ tenantId: context.tenantId, userId: context.session.userId });
}

export async function updateProjectAction(
  tenantSlug: string,
  projectId: string,
  input: ProjectFieldsInput,
): Promise<PaneOutcome> {
  const ctx = await actorOn(tenantSlug);
  if (ctx === null) return { ok: false, code: null };
  try {
    await updateProject(ctx, {
      projectId,
      name: input.name,
      code: input.code,
      client: input.client,
      siteAddress: input.siteAddress,
      district: input.district,
      buildingType: input.buildingType,
      storeys: input.storeys,
      targetGfaM2: input.gfaM2,
      notes: input.notes,
    });
    return { ok: true, value: undefined };
  } catch (error: unknown) {
    return { ok: false, code: refusalCodeOf(error) };
  }
}

export async function archiveProjectAction(
  tenantSlug: string,
  projectId: string,
  archived: boolean,
): Promise<PaneOutcome> {
  const ctx = await actorOn(tenantSlug);
  if (ctx === null) return { ok: false, code: null };
  try {
    await archiveProject(ctx, { projectId, archived });
    return { ok: true, value: undefined };
  } catch (error: unknown) {
    return { ok: false, code: refusalCodeOf(error) };
  }
}

/**
 * R-UI-021's first half: "the typed consequence … computed by the server". Nothing is written,
 * and the only refusal a preview makes is the seam's own, about authority — a preview that
 * refused the last-principal case could never be shown, and the dialog would have no digest to
 * confirm the refusal it is about to meet with (panes file Interpretation 3).
 */
export async function previewAssignmentAction(
  tenantSlug: string,
  projectId: string,
  userId: string,
  role: string,
): Promise<PaneOutcome<PreviewedAssignment>> {
  const ctx = await actorOn(tenantSlug);
  if (ctx === null) return { ok: false, code: null };
  try {
    const previewed = await previewAct(ctx, ACT_TYPE.ASSIGN_PARTICIPANT_ROLE, {
      projectId,
      userId,
      role,
    });
    return {
      ok: true,
      value: { consequence: previewed.consequence, digest: previewed.digest },
    };
  } catch (error: unknown) {
    return { ok: false, code: refusalCodeOf(error) };
  }
}

/** R-UI-021's second half: "confirm carries the digest", and the seam checks it against now. */
export async function commitAssignmentAction(
  tenantSlug: string,
  projectId: string,
  userId: string,
  role: string,
  digest: string,
): Promise<PaneOutcome<ParticipantsView>> {
  const ctx = await actorOn(tenantSlug);
  if (ctx === null) return { ok: false, code: null };
  try {
    await commitAct(ctx, ACT_TYPE.ASSIGN_PARTICIPANT_ROLE, { projectId, userId, role }, digest);
    return {
      ok: true,
      value: {
        roster: await participantRoster(ctx, { projectId }),
        history: await roleHistory(ctx, { projectId }),
      },
    };
  } catch (error: unknown) {
    return { ok: false, code: refusalCodeOf(error) };
  }
}
