// Reading a named field off a wire body: one behaviour, one home (ARCH-02, B-17).
//
// Every lane in this directory is handed the same thing by tRPC — an `unknown` a caller wrote — and
// every lane has to ask the same three questions of it: is it a bag at all, does it carry the field,
// and is that field a string. The home is this file rather than any one lane's router, because a
// lane that imported a generic transport helper from a SIBLING lane would depend on that lane for a
// reason that has nothing to do with it, and the next lane would copy the pair rather than reach
// across. The lane naming itself in the message is a parameter, so no lane needs a variant.
//
// It knows nothing about tRPC, sessions or any lane's shape: what a field MEANS is the lane's, and
// what a caller may do with it is the module's.

/** The bag a caller sent, or an empty one — a body that is not an object supplies no field. */
export function bagOf(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

/** A required string field of a wire body, or the lane's own complaint that it is not there. */
export function text(input: unknown, name: string, lane: string): string {
  const value = bagOf(input)[name];
  if (typeof value !== "string") throw new Error(`${lane}: "${name}" is required and must be a string`);
  return value;
}

/**
 * A string field a caller may leave out, as null when they did. A field present but of another type
 * is not a value this reader invents an answer for: it is the caller's mistake and is named as one,
 * exactly as `text` names a missing one.
 */
export function optionalText(input: unknown, name: string, lane: string): string | null {
  const value = bagOf(input)[name];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${lane}: "${name}" must be a string when it is stated`);
  return value;
}
