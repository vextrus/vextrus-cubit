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

/**
 * A field the door needs, arriving blank on a door that *creates* an account or *sets* a password.
 * Sign-in answers CREDENTIALS_NOT_VALID for the same blank because there it is true — nothing is
 * named — but a person creating an account has no account for a credential to fail to match, and
 * telling them to reset a password they have not got is false in every word (R-SPINE-007).
 */
export function detailNotGiven(field: string): Error {
  return refusal("DETAIL_NOT_GIVEN", `"${field}" arrived blank on a door that requires it`, { field });
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

/** ARCH-03, B-21: no live session, so the request was not carried out — the remedy is signing in. */
export function signedOut(): Error {
  return refusal("SIGNED_OUT", "the request presented no live session", {});
}
