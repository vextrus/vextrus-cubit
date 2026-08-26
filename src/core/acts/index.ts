// SEAM-ACT: the act seam — the sole writer of the act log and of every human-authored
// project-domain state change. One door: it refuses a non-human actor by type, checks the permission
// map (L-ACT-03), requires the consequence digest (L-ACT-02) and writes the act row and the state
// change in one transaction or neither (L-ACT-01). Every transport over it is thin: authenticate,
// mint a ctx, call these two functions under these same guards — a transport-local digest or guard
// set is a defect, because two doors to one write must be provably the same door (B-17, ARCH-02).
import { acts, forTenant } from "../db";
import { assignParticipantRole, type AssignParticipantRoleInput } from "./assign-participant-role";
import { consequenceDigest, type Consequence } from "./consequence";
import { ACT_TYPES, type ActType } from "./law";
import { requirePermission } from "./participation";
import { actorNotHuman, consequencesNotCarried } from "./refusals";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

export { consequenceDigest, type Consequence, type ConsequenceSubject } from "./consequence";
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
export { permissionsHeld, rolesGranted } from "./participation";
export { type ActorKind } from "./refusals";
export { type ActRendering, type ActorCtx, type WrittenAct } from "./rendering";
export { type AssignParticipantRoleInput } from "./assign-participant-role";

/** Everything a caller may ask the seam to do: one member per act type the enum declares. */
export type ActInput = AssignParticipantRoleInput;

/**
 * L-ACT-02: "The pairs form a total map over the act-type enum (a type without a rendering is a
 * compile error)." The map is keyed by the enum itself and by nothing wider, which is what makes
 * that a compile error rather than a runtime hole.
 */
export const ACT_MAP: Readonly<{ [T in ActType]: ActRendering<Extract<ActInput, { type: T }>> }> = Object.freeze({
  ASSIGN_PARTICIPANT_ROLE: assignParticipantRole,
});

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
  return forTenant(ctx).transaction(async (tx) => {
    await requirePermission(tx, ctx, actType, input.projectId);
    return ACT_MAP[actType].preview(ctx, input, tx);
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
  const rendering = ACT_MAP[actType];
  return forTenant(ctx).transaction(async (tx) => {
    await requirePermission(tx, ctx, actType, input.projectId);

    const consequence = await rendering.preview(ctx, input, tx);
    const digest = consequenceDigest(consequence);
    if (digest !== carriedDigest) throw consequencesNotCarried(actType, carriedDigest, digest);

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
    await rendering.commit(ctx, input, act, tx);
    return { actId, consequenceDigest: digest, consequence };
  });
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
