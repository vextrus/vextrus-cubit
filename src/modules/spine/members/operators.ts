/**
 * drizzle's own comparison operators, taken off a handle rather than imported (SEAM-TENANT).
 *
 * "Driver and schema imports lint-banned outside `src/core/db.ts`" is the whole of the seam's
 * discipline, and `eq`/`and` live in `drizzle-orm` beside the driver. The relational reader
 * already hands them to every `where` callback — `findMany({ where: (row, { eq }) => … })` —
 * so a module above the seam never needs the import to read. Writing is where it would: an
 * UPDATE or a DELETE takes its condition as an argument, not as a callback.
 *
 * So the operators are captured from the one place the seam already offers them. `toSQL()`
 * builds the statement and does not run it, which is what makes this a compile-time-shaped
 * borrow rather than a wasted round trip: no connection is taken and no row is read.
 *
 * The alternative was widening `src/core/db.ts` to re-export them — a change to the seam
 * itself, for the convenience of one module above it.
 */
import type { ScopedDb } from '../../../core/db';

/** The relational reader's config for the table this borrows from. */
type QueryConfig = NonNullable<Parameters<ScopedDb['query']['tenants']['findFirst']>[0]>;

type WhereArgument = NonNullable<QueryConfig['where']>;

/**
 * `where` is either a condition or a callback that builds one; the callback's second argument
 * is the operator set. The conditional distributes over that union, so the condition arm
 * contributes `never` and what is left is the operators.
 */
type OperatorsOf<W> = W extends (fields: never, operators: infer O) => unknown ? O : never;

export type Operators = OperatorsOf<WhereArgument>;

/** A built condition, as `.where()` takes it — the return of the operators, not a new type. */
export type Condition = ReturnType<Operators['eq']>;

let captured: Operators | undefined;

/** The operator set, borrowed once per process. */
export function operators(db: ScopedDb): Operators {
  if (captured !== undefined) return captured;
  db.query.tenants
    .findFirst({
      columns: { id: true },
      where: (row, given) => {
        captured = given;
        return given.eq(row.id, row.id);
      },
    })
    .toSQL();
  if (captured === undefined) {
    throw new Error('the relational reader did not offer its operators');
  }
  return captured;
}
