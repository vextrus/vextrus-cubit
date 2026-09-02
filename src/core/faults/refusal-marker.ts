// ARCH-03, B-21: a refusal is an answer, not a fault — so the fault seam has to tell them apart
// before it records anything. This file is the one writer and the one reader of that marker
// (ARCH-02, B-17); the closed taxonomy the codes belong to is the registry's business, and a code
// is admitted here only by asking it.
import { refusalOf, type RefusalCode } from "../errors";

/**
 * An Error marked with a registered code, carrying `detail`'s own properties as readable facts —
 * the facts the law says that refusal names. The code is taken from the closed taxonomy
 * (R-SPINE-062): `refusalOf` answers only for a registered code, so a refusal built here is one the
 * registry can put a message and a remedy to. `message` is the operator's detail and stays out of
 * the registry.
 */
export function refusal<D extends object = object>(code: RefusalCode, message: string, detail?: D): Error & D {
  return Object.assign(new Error(message), { refusalCode: refusalOf(code).code }, detail);
}

/** The refusal code carried by a value or by its cause, or null when the failure is a plain one. */
export function refusalCodeOf(e: unknown): string | null {
  const own = codeOn(e);
  if (own !== null) return own;
  if (typeof e !== "object" || e === null) return null;
  return codeOn((e as { cause?: unknown }).cause);
}

/** True iff the value or its cause carries a string `refusalCode`. */
export function isRefusalMarked(e: unknown): boolean {
  return refusalCodeOf(e) !== null;
}

/** The marker is a string code, never any truthy value: `refusalCode: 7` marks nothing. */
function codeOn(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const code = (value as { refusalCode?: unknown }).refusalCode;
  return typeof code === "string" ? code : null;
}
