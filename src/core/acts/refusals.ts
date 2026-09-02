// The three answers this seam gives instead of writing (ARCH-03, B-21: a refusal is an answer, not
// a fault). Each travels as the settled core marker — an Error carrying a string `refusalCode`,
// built and read by `faults/refusal-marker.ts` alone (B-17) — and carries, as readable properties,
// the facts the law says the refusal names. The codes themselves belong to the closed taxonomy in
// `../errors` (R-SPINE-062, ARCH-02); the messages here are operator detail and stay out of it.
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import type { ActType, Permission } from "./law";

/** The actor kinds a context can name; only one of them may write to the act log (L-ACT-01). */
export type ActorKind = "human" | "machine" | "model";

/** The codes this seam answers with, each read off the closed taxonomy rather than agreed with by chance (Q-07). */
const PERMISSION_NOT_HELD: RefusalCode = "PERMISSION_NOT_HELD";
const CONSEQUENCES_NOT_CARRIED: RefusalCode = "CONSEQUENCES_NOT_CARRIED";
const ACT_CHANGES_NOTHING: RefusalCode = "ACT_CHANGES_NOTHING";
const PROJECT_WOULD_HAVE_NO_PRINCIPAL: RefusalCode = "PROJECT_WOULD_HAVE_NO_PRINCIPAL";
const ACTOR_NOT_HUMAN: RefusalCode = "ACTOR_NOT_HUMAN";

/**
 * L-ACT-03: "`PERMISSION_NOT_HELD` carries the act type and missing permission". The act type is
 * null on a read path, which has none to name.
 */
export function permissionNotHeld(actType: ActType | null, permission: Permission): Error {
  const moved = actType === null ? "this read" : actType;
  return refusal(PERMISSION_NOT_HELD, `${moved} needs ${permission}, which the actor's roles on this project do not bundle`, {
    actType,
    permission,
  });
}

/** L-ACT-02: "a commit whose digest is not the one current state produces refuses". */
export function consequencesNotCarried(actType: ActType, carried: string, current: string): Error {
  return refusal(CONSEQUENCES_NOT_CARRIED, `${actType} was committed with a digest the current state no longer produces`, {
    actType,
    carried,
    current,
  });
}

/**
 * L-ACT-01: an act is "a human write that CHANGES what the machine would derive" — a Consequence
 * whose subjects end as they began is not one. The seam answers so, rather than writing a record of
 * nothing and leaving the ledger's uniqueness belt to answer the caller with a driver error.
 */
export function actChangesNothing(actType: ActType, subjectIds: readonly string[]): Error {
  return refusal(ACT_CHANGES_NOTHING, `${actType} would leave every subject it names exactly as it found them, so there is no act to record`, {
    actType,
    subjectIds,
  });
}

/**
 * L-ACT-03: "the last PRINCIPAL cannot be removed (`PROJECT_WOULD_HAVE_NO_PRINCIPAL`)".
 * ADMINISTER_PROJECT is PRINCIPAL-only, so a project whose last effective PRINCIPAL was withdrawn
 * would be a project nobody could ever administer again — the refusal stands at the seam, and the
 * owner-installed trigger on the withdrawal ledger stands behind it.
 */
export function projectWouldHaveNoPrincipal(actType: ActType, projectId: string, subjectUserId: string): Error {
  return refusal(PROJECT_WOULD_HAVE_NO_PRINCIPAL, `${actType} would leave this project with no effective PRINCIPAL, and a project holds at least one at every moment`, {
    actType,
    projectId,
    subjectUserId,
  });
}

/** SEAM-ACT: the seam "refuses non-human actors by type" — L-ACT-01's log is human-only. */
export function actorNotHuman(actType: ActType, actorKind: ActorKind): Error {
  return refusal(ACTOR_NOT_HUMAN, `${actType} was attempted by a ${actorKind} actor; the act log is human-only`, {
    actType,
    actorKind,
  });
}
