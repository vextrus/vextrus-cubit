// ARCH-03, B-21: a refusal is an answer, not a fault — so the fault seam has to tell them apart
// before it records anything. This file is the one reader of that marker (ARCH-02); the closed
// taxonomy the codes belong to is not this seam's business, only whether a code is carried.

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
