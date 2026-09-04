// SEAM-ACT: the act seam — the sole writer of the act log and of every human-authored
// project-domain state change. One door: it refuses a non-human actor by type, checks the permission
// map (L-ACT-03), requires the consequence digest (L-ACT-02) and writes the act row and the state
// change in one transaction or neither (L-ACT-01). Every transport over it is thin: authenticate,
// mint a ctx, call these two functions under these same guards — a transport-local digest or guard
// set is a defect, because two doors to one write must be provably the same door (B-17, ARCH-02).
import { acts, forTenant, holdStateLock, type TenantTx } from "../db";
import { assignParticipantRole, type AssignParticipantRoleInput } from "./assign-participant-role";
import { confirmDiscipline, type ConfirmDisciplineInput } from "./confirm-discipline";
import { consequenceDigest, movesNothing, type Consequence } from "./consequence";
import { ACT_TYPES, type ActType } from "./law";
import { requirePermission } from "./participation";
import { actChangesNothing, actorNotHuman, consequencesNotCarried } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

export { consequenceDigest, type Consequence, type ConsequenceRendering, type ConsequenceSubject } from "./consequence";
export {
  ACT_PERMISSION,
  ACT_TYPES,
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  isRole,
  permissionsOf,
  type ActType,
  type Permission,
  type Role,
} from "./law";
export { actsHeldBy } from "./held";
export { effectiveGrants, holdersOf, permissionsHeld, rolesGranted, type RoleGrant } from "./participation";
export { permissionNotHeld, projectWouldHaveNoPrincipal, type ActorKind } from "./refusals";
export { type ActRendering, type ActorCtx, type WrittenAct } from "./rendering";
export { directionOf, type AssignDirection, type AssignParticipantRoleInput } from "./assign-participant-role";
export { GROUP_KINDS, groupNotOffered, type ConfirmDisciplineInput, type GroupKind, type OfferedGroupKey } from "./confirm-discipline";

/** Everything a caller may ask the seam to do: one member per act type the enum declares. */
export type ActInput = AssignParticipantRoleInput | ConfirmDisciplineInput;

/**
 * L-ACT-02: "The pairs form a total map over the act-type enum (a type without a rendering is a
 * compile error)." The map is keyed by the enum itself and by nothing wider, which is what makes
 * that a compile error rather than a runtime hole.
 */
export const ACT_MAP: Readonly<{ [T in ActType]: ActRendering<Extract<ActInput, { type: T }>> }> = Object.freeze({
  ASSIGN_PARTICIPANT_ROLE: assignParticipantRole,
  CONFIRM_DISCIPLINE: confirmDiscipline,
});

/**
 * One act type's pair, bound to the very input it renders. `ACT_MAP[type]` alone is a union of
 * renderings and `input` a union of inputs, and nothing tells the compiler the two came off the same
 * member — so the pairing is made here, once, where narrowing the input narrows the rendering with
 * it. The `default` arm takes `never`: an input added to `ActInput` with no case reaches it as
 * something else and fails to compile, which is the second half of L-ACT-02's totality.
 */
type BoundRendering = {
  preview(ctx: ActorCtx, tx: TenantTx): Promise<Consequence>;
  commit(ctx: ActorCtx, act: WrittenAct, tx: TenantTx): Promise<void>;
};

function bind<TInput>(rendering: ActRendering<TInput>, input: TInput): BoundRendering {
  return {
    preview: (ctx, tx) => rendering.preview(ctx, input, tx),
    commit: (ctx, act, tx) => rendering.commit(ctx, input, act, tx),
  };
}

function renderingFor(input: ActInput): BoundRendering {
  switch (input.type) {
    case "ASSIGN_PARTICIPANT_ROLE":
      return bind(ACT_MAP[input.type], input);
    case "CONFIRM_DISCIPLINE":
      return bind(ACT_MAP[input.type], input);
    default:
      return unrendered(input);
  }
}

/** The compile error itself: an input with no case above arrives here as something other than `never`. */
function unrendered(input: never): never {
  throw new Error(`${JSON.stringify(input)} names no act this seam renders — L-ACT-02's map is total over the closed enum`);
}

/** An act the seam has written, as its caller reads it back. */
export type CommittedAct = {
  readonly actId: string;
  readonly consequenceDigest: string;
  readonly consequence: Consequence;
};

/**
 * What the act would do, computed from the state one transaction read (L-ACT-02). The preview
 * writes nothing: the actor is shown a Consequence, and carries its digest back to `commit`.
 */
export async function preview(ctx: ActorCtx, input: ActInput): Promise<Consequence> {
  const actType = declaredActType(input.type);
  requireHumanActor(ctx, actType);
  const rendering = renderingFor(input);
  return forTenant(ctx).transaction(async (tx) => {
    await requirePermission(tx, ctx, actType, input.projectId);
    return rendering.preview(ctx, tx);
  });
}

/**
 * The act, performed. The consequence is recomputed inside the transaction that writes it, so the
 * digest the actor carries is checked against the state the write itself will see; the act row and
 * the state change land together or not at all (L-ACT-01).
 */
export async function commit(ctx: ActorCtx, input: ActInput, carriedDigest: string): Promise<CommittedAct> {
  const actType = declaredActType(input.type);
  requireHumanActor(ctx, actType);
  const rendering = renderingFor(input);
  return forTenant(ctx).transaction(async (tx) => {
    await requirePermission(tx, ctx, actType, input.projectId);

    // The guard is only as good as the read it compares: under READ COMMITTED two commits racing on
    // one project would each recompute a Consequence the other is about to invalidate, agree with
    // their own digest, and both write — so each act would claim an `after` that is not the state
    // that resulted. The lock is taken on the project's state before it is read, and held until the
    // transaction ends, which is what makes "the digest is the one CURRENT state produces" true at
    // the moment of the write rather than only at the moment of the read (L-ACT-02).
    await holdStateLock(tx, projectState(ctx, input));

    const consequence = await rendering.preview(ctx, tx);
    const digest = consequenceDigest(consequence);
    if (digest !== carriedDigest) throw consequencesNotCarried(actType, carriedDigest, digest);
    // A carried digest can agree with the current state and still describe nothing happening — a
    // role already held, granted again. That is not an act, and the seam says so by name rather than
    // writing the act row and letting the ledger's uniqueness belt refuse the caller (L-ACT-01).
    if (movesNothing(consequence)) throw actChangesNothing(actType, consequence.subjects.map((subject) => subject.subjectId));

    const written = await tx
      .insert(acts)
      .values({
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        actorId: ctx.userId,
        actType,
        subjects: consequence.subjects.map((subject) => subject.subjectId),
        consequenceDigest: digest,
      })
      .returning({ actId: acts.actId });
    const actId = written[0]?.actId;
    if (actId === undefined) throw new Error(`the act log accepted no row for ${actType} — an act nobody can point at is not a record (L-ACT-01)`);

    const act: WrittenAct = { actId, consequenceDigest: digest };
    await rendering.commit(ctx, act, tx);
    return { actId, consequenceDigest: digest, consequence };
  });
}

/**
 * The state a commit's Consequence is computed from, named so it can be locked: every act moves
 * some part of one project in one tenant, and the writers of one project take their turns.
 */
function projectState(ctx: ActorCtx, input: ActInput): string {
  return `${ctx.tenantId}:${input.projectId}`;
}

/** L-ACT-01: the log is human-only, and the seam refuses a non-human actor by type (SEAM-ACT). */
function requireHumanActor(ctx: ActorCtx, actType: ActType): void {
  if (ctx.actorKind !== "human") throw actorNotHuman(actType, ctx.actorKind);
}

/**
 * The act type, as a member of the closed enum. A caller that names something else has named no act,
 * which is a mistake in the caller rather than an answer the product gives anyone (ARCH-03).
 */
function declaredActType(type: string): ActType {
  const declared = ACT_TYPES.find((candidate) => candidate === type);
  if (declared === undefined) throw new Error(`"${type}" is not an act type — L-ACT-02's map is total over the closed enum`);
  return declared;
}
