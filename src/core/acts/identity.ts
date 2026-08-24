/**
 * The shape of the ids an act names (SEAM-ACT).
 *
 * A project id and a user id reach the database as `uuid` columns, and a string that is not one
 * raises `22P02 invalid input syntax for type uuid` from inside the driver. That error is neither
 * a refusal a caller can branch on nor something the seam should be spelling at a client: it
 * reads as a broken server, when what happened is that somebody hand-wrote or deep-linked an id
 * that names nothing.
 *
 * So the seam answers it itself, with the same `TypeError` it already raises for an id that is
 * missing or empty — an input the seam cannot act on at all, told apart from the state refusals
 * L-ACT-02 and L-ACT-03 name. `src/core/db.ts` refuses a malformed tenant id at the same border
 * and for the same reason; this is that rule applied to the ids an act carries.
 */

/** The canonical spelling of a uuid, in either case — the one Postgres' `uuid` type accepts. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An id the database could hold: a string, and a uuid. */
export function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * The id, or the seam's own complaint about it. `what` is the sentence the caller reads — it
 * names the thing the id was supposed to identify rather than the column it would have reached.
 */
export function requireIdentity(value: unknown, what: string): string {
  if (!isIdentity(value)) {
    throw new TypeError(`${what} (given ${JSON.stringify(value)})`);
  }
  return value;
}
