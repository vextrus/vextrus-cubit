// The three answers this seam gives instead of writing (ARCH-03, B-21: a refusal is an answer, not
// a fault). Each travels as the settled core marker — an Error carrying a string `refusalCode`,
// which `faults/refusal-marker.ts` is the one reader of — and carries, as readable properties, the
// facts the law says the refusal names. The codes themselves belong to the closed taxonomy in
// `../errors` (R-SPINE-062, ARCH-02); the messages here are operator detail and stay out of it.
import { refusalOf, type RefusalCode } from "../errors";
import type { ActType, Permission } from "./law";

/** The actor kinds a context can name; only one of them may write to the act log (L-ACT-01). */
export type ActorKind = "human" | "machine" | "model";

/** An Error marked with a registered code and the facts that refusal is required to carry. */
function refusal<D extends object>(code: RefusalCode, message: string, detail: D): Error & D {
  return Object.assign(new Error(message), { refusalCode: refusalOf(code).code }, detail);
}

/**
 * L-ACT-03: "`PERMISSION_NOT_HELD` carries the act type and missing permission". The act type is
 * null on a read path, which has none to name.
 */
export function permissionNotHeld(actType: ActType | null, permission: Permission): Error {
  const moved = actType === null ? "this read" : actType;
  return refusal("PERMISSION_NOT_HELD", `${moved} needs ${permission}, which the actor's roles on this project do not bundle`, {
    actType,
    permission,
  });
}

/** L-ACT-02: "a commit whose digest is not the one current state produces refuses". */
export function consequencesNotCarried(actType: ActType, carried: string, current: string): Error {
  return refusal("CONSEQUENCES_NOT_CARRIED", `${actType} was committed with a digest the current state no longer produces`, {
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
  return refusal("ACT_CHANGES_NOTHING", `${actType} would leave every subject it names exactly as it found them, so there is no act to record`, {
    actType,
    subjectIds,
  });
}

/** SEAM-ACT: the seam "refuses non-human actors by type" — L-ACT-01's log is human-only. */
export function actorNotHuman(actType: ActType, actorKind: ActorKind): Error {
  return refusal("ACTOR_NOT_HUMAN", `${actType} was attempted by a ${actorKind} actor; the act log is human-only`, {
    actType,
    actorKind,
  });
}
