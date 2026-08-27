// The answers the identity doors give instead of a session (ARCH-03, B-21: a refusal is an answer,
// not a fault). Each travels as the settled core marker — an Error carrying a string `refusalCode`,
// which `core/faults/refusal-marker.ts` is the one reader of — and the codes themselves belong to
// the closed taxonomy in `core/errors` (R-SPINE-062, ARCH-02). The messages here are operator
// detail: what a user reads is the registered entry, rendered by the one renderer.
import { refusalOf, type RefusalCode } from "../../core/errors";

/** An Error marked with a registered code and the facts the operator needs beside it. */
function refusal<D extends object>(code: RefusalCode, message: string, detail: D): Error & D {
  return Object.assign(new Error(message), { refusalCode: refusalOf(code).code }, detail);
}

/**
 * R-SPINE-001: a wrong password and an address with no account are the same answer. The door never
 * says which addresses exist, so the operator detail names the door rather than the outcome.
 */
export function credentialsNotValid(): Error {
  return refusal("CREDENTIALS_NOT_VALID", "the address and password presented do not identify an account", {});
}

/** A mailed token that was never issued, has expired, or has already been spent (R-SPINE-001). */
export function tokenNotValid(purpose: string): Error {
  return refusal("TOKEN_NOT_VALID", `the ${purpose} token presented is unknown, expired or already consumed`, { purpose });
}

/**
 * R-SPINE-002's second door on the same address, answered by the seam rather than by the unique
 * index behind it: a constraint violation reaches the caller as an unmarked fault, and a person who
 * simply already has an account deserves an answer.
 */
export function accountAlreadyExists(): Error {
  return refusal("ACCOUNT_ALREADY_EXISTS", "an account already exists for the address this sign-up names", {});
}

/** R-SPINE-001's rate limit, refused before the work is attempted rather than after it fails. */
export function rateLimited(door: string, retryAfterMs: number): Error {
  return refusal("RATE_LIMITED", `${door} was called more often than its window allows, so this attempt was not tried`, { door, retryAfterMs });
}

/**
 * R-SPINE-001: a mailed link is only a link if it points back at an address this deployment actually
 * answers at, and the only party entitled to name that address is the deployment itself. A request's
 * `Host` is written by whoever sent it, so building the link from one hands a caller the power to
 * mail somebody else a link to a host of their choosing. A deployment that has named no address can
 * therefore send nothing, and the door says so instead of mailing a link that leads nowhere.
 */
export function linkNotSendable(purpose: string): Error {
  return refusal("LINK_NOT_SENDABLE", `the deployment named no address of its own, so no ${purpose} link can be built`, { purpose });
}

/** ARCH-03, B-21: no live session, so the request was not carried out — the remedy is signing in. */
export function signedOut(): Error {
  return refusal("SIGNED_OUT", "the request presented no live session", {});
}
