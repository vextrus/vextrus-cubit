/**
 * SEAM-ACT — the sole writer of the act log and of every human-authored state change.
 *
 * "It checks the permission map, requires the consequence digest, writes act + state in one
 * transaction, and refuses non-human actors by type." Four properties, and each of them is here
 * rather than in the callers, because a check the caller performs is a check the next caller
 * forgets:
 *
 *   - the permission map. `ACT_PERMISSIONS` says what an act moves and `ROLE_BUNDLES` says what
 *     a role may move; the actor's *current* role on the project decides. Somebody with no
 *     participation holds nothing, so they are refused by the same arithmetic rather than by a
 *     special case.
 *   - the digest. `commitAct` recomputes the Consequence from current state and refuses a digest
 *     that state does not produce (L-ACT-02) — so a human confirms what is, not what was.
 *   - one transaction. The write is a single data-modifying CTE (see participation.ts).
 *   - non-human actors, by type: `ActCtx` carries `actorId`, which comes from a session, and
 *     there is no parameter a machine could arrive through. Nothing is checked at run time
 *     because nothing can be passed.
 *
 * The renderings map is the second half of L-ACT-02's totality: "the pairs form a total map over
 * the act-type enum (a type without a rendering is a compile error)". `satisfies` is what makes
 * that a compile error and not a lookup that returns `undefined` at the first call.
 */
import { REFUSALS } from '../errors';
import { assignParticipantRole } from './assign-participant-role';
import { consequenceDigest } from './digest';
import { currentRoles, grantHistory, recordGrant } from './participation';
import type { ActCtx, ParticipantGrant } from './participation';
import { ActSeamRefusal } from './refusal';
import { ACT_PERMISSIONS, ACT_TYPE, ROLE, isActType, roleHolds } from './vocabulary';
import type { ActType } from './vocabulary';

/**
 * One act type's pair, as the seam holds it.
 *
 * The Consequence is `object` here and its own type inside the rendering: the seam digests it
 * and hands it back, and neither of those needs to know what it is. Both members are written as
 * methods so a rendering whose Consequence is narrower than `object` still fits the map —
 * TypeScript compares method parameters bivariantly, which is the whole reason for the shorthand.
 */
interface ActRendering {
  preview(ctx: ActCtx, input: unknown): Promise<object>;
  commit(ctx: ActCtx, consequence: object): Promise<{ actId: string }>;
}

/**
 * L-ACT-02's total map. One entry today — L-ACT-03's "ADMINISTER_PROJECT
 * (ASSIGN_PARTICIPANT_ROLE)" — and an act type founded in `ACT_TYPES` without an entry here does
 * not compile.
 */
const ACT_RENDERINGS = {
  ASSIGN_PARTICIPANT_ROLE: assignParticipantRole,
} satisfies Record<ActType, ActRendering>;

/** The typed value one act type's preview answers with, read off its own rendering. */
export type ConsequenceOf<T extends ActType> = Awaited<
  ReturnType<(typeof ACT_RENDERINGS)[T]['preview']>
>;

/** What a preview hands a caller: the Consequence, and the digest a commit must carry back. */
export interface Previewed<T extends ActType> {
  readonly consequence: ConsequenceOf<T>;
  readonly digest: string;
}

/** The project an act is performed on. Every act the seam renders names one. */
function projectOf(input: unknown): string {
  const named = (input ?? {}) as { projectId?: unknown };
  if (typeof named.projectId !== 'string' || named.projectId === '') {
    throw new TypeError('an act names the project it is performed on');
  }
  return named.projectId;
}

function renderingOf(actType: string): ActRendering {
  if (!isActType(actType)) {
    throw new TypeError(`${JSON.stringify(actType)} is not an act this tree can perform`);
  }
  return ACT_RENDERINGS[actType];
}

/**
 * L-ACT-03: "the permission check lives in the act seam", and it cuts on the actor's current
 * role on the project in question.
 *
 * An actor who takes no part in the project holds no role there, and a role holds only what its
 * bundle carries — so both refusals are the same sentence, and both name what was missing.
 */
async function checkPermission(ctx: ActCtx, actType: ActType, projectId: string): Promise<void> {
  const needed = ACT_PERMISSIONS[actType];
  const held = await currentRoles(ctx, projectId);
  const role = held.get(ctx.actorId);
  if (role !== undefined && roleHolds(role, needed)) return;
  throw new ActSeamRefusal(REFUSALS.PERMISSION_NOT_HELD.code, {
    actType,
    missingPermission: needed,
  });
}

/**
 * What this act would do, computed from current state and writing nothing (L-ACT-02).
 *
 * The Consequence a rendering computes is the whole of what the digest is taken over, so a
 * caller that shows it to a human and carries the digest back is confirming the state it showed.
 */
export async function previewAct<T extends ActType>(
  ctx: ActCtx,
  actType: T,
  input: unknown,
): Promise<Previewed<T>> {
  const rendering = renderingOf(actType);
  await checkPermission(ctx, actType, projectOf(input));
  const consequence = await rendering.preview(ctx, input);
  return { consequence: consequence as ConsequenceOf<T>, digest: consequenceDigest(consequence) };
}

/**
 * Perform the act (L-ACT-01, L-ACT-02).
 *
 * The order of the three refusals is the order of the questions. An actor who may not perform
 * the act is refused before any question about state is asked — the answer would tell them
 * something they are not entitled to know. Then the Consequence is recomputed, which is where a
 * rendering's own guard speaks (L-ACT-03's last principal). Only then is the caller's digest
 * compared: a digest that current state does not produce means the human confirmed a state that
 * is no longer there, and nothing is written.
 */
export async function commitAct<T extends ActType>(
  ctx: ActCtx,
  actType: T,
  input: unknown,
  digest: string,
): Promise<{ actId: string }> {
  const rendering = renderingOf(actType);
  await checkPermission(ctx, actType, projectOf(input));
  const consequence = await rendering.preview(ctx, input);
  if (consequenceDigest(consequence) !== digest) {
    throw new ActSeamRefusal(REFUSALS.CONSEQUENCES_NOT_CARRIED.code, { actType });
  }
  return rendering.commit(ctx, consequence);
}

/**
 * The bootstrap L-ACT-03 names: "project creation inserts its creator as PRINCIPAL in the same
 * transaction".
 *
 * No permission is checked, and there is none to check: the founder holds no role on a project
 * that has no participants yet, so a check would refuse every project ever created. What makes
 * this safe is that it is not an act a request can ask for — J-003 composes it into
 * `createPinnedProject`, whose caller has already been authorised to create a project at all.
 *
 * The founding is still an act, with a row in the log like any other (L-ACT-01: "assignment is
 * itself an act"), written by the same single statement so the participation, the grant and the
 * act arrive together or not at all.
 */
export async function foundPrincipal(ctx: ActCtx, projectId: string): Promise<{ actId: string }> {
  return recordGrant(ctx, ACT_TYPE.ASSIGN_PARTICIPANT_ROLE, {
    projectId,
    userId: ctx.actorId,
    role: ROLE.PRINCIPAL,
  });
}

/** R-SPINE-011's "role history visible": every grant this project has made, oldest first. */
export async function listParticipantHistory(
  ctx: ActCtx,
  projectId: string,
): Promise<readonly ParticipantGrant[]> {
  return grantHistory(ctx, projectId);
}
