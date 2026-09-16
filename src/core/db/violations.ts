// What the driver's report of a refused write SAYS, read in one place (B-17, ARCH-02).
//
// A store refusal a person can reach — two acts confirming one view, two sightings deriving one
// identity — arrives as a driver error carrying an SQLSTATE and the name of the constraint that
// refused it. Which constraint refused is the whole of the judgement: a unique index on a minted
// secret colliding is an outage an operator must see, and a unique index on a human's second
// statement of the same fact is that person being told somebody was ahead of them (ARCH-03, B-21).
// So a caller buckles its answer to the constraint BY NAME, and a constraint added inside the same
// transaction later stays a fault until somebody decides what it answers.
//
// Nothing here imports the driver: what is read is the shape the report has, whether the error came
// from the ORM (which carries the driver's own error as `cause`) or from the driver itself.

/** A unique index refusing a second row (Postgres' own state). */
export const UNIQUE_VIOLATION = "23505";

/** The report a refused write carries, as far as naming what refused needs to know. */
type Reported = { readonly code?: unknown; readonly constraint_name?: unknown; readonly cause?: unknown };

/** Is this failure the named constraint refusing a write, under the given SQLSTATE? */
export function violatesConstraint(failure: unknown, constraint: string, sqlstate: string = UNIQUE_VIOLATION): boolean {
  for (let reported: unknown = failure, depth = 0; typeof reported === "object" && reported !== null && depth < 4; depth += 1) {
    const said = reported as Reported;
    if (said.code === sqlstate && said.constraint_name === constraint) return true;
    reported = said.cause;
  }
  return false;
}
