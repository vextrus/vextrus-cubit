/**
 * drizzle's `sql` template tag, taken off a handle rather than imported (SEAM-TENANT).
 *
 * "Driver and schema imports lint-banned outside `src/core/db.ts`" is the whole of the seam's
 * discipline, and `sql` lives in `drizzle-orm` beside the driver. The relational reader already
 * hands the operator set to every `where` callback — `findMany({ where: (row, { sql }) => … })`
 * — so the tag can be borrowed from the one place the seam already offers it, exactly as
 * `src/modules/spine/members/operators.ts` borrows `eq` and `and`.
 *
 * `toSQL()` builds the statement and does not run it, which is what makes this a borrow rather
 * than a wasted round trip: no connection is taken and no row is read.
 *
 * The act seam needs the tag rather than the query builder because L-ACT-01's "act row and state
 * change commit in one transaction or neither" is written here as one data-modifying CTE — a
 * single statement, which the scoped pool runs in a transaction of its own. Two builder calls
 * would be two statements, and a pool that hands each of them a connection would keep the act
 * and drop the state.
 */
import type { ScopedDb } from '../db';

/** The relational reader's config for the table this borrows from. */
type QueryConfig = NonNullable<Parameters<ScopedDb['query']['tenants']['findFirst']>[0]>;

type WhereArgument = NonNullable<QueryConfig['where']>;

/**
 * `where` is either a condition or a callback that builds one; the callback's second argument
 * is the operator set. The conditional distributes over that union, so the condition arm
 * contributes `never` and what is left is the operators.
 */
type OperatorsOf<W> = W extends (fields: never, operators: infer O) => unknown ? O : never;

type Operators = OperatorsOf<WhereArgument>;

/** The tag itself, as the seam passes it around. */
export type SqlTag = Operators['sql'];

/** One built statement — what `db.execute()` takes, named by what produces it. */
export type Statement = ReturnType<SqlTag>;

let captured: Operators | undefined;

/** The `sql` tag, borrowed once per process. */
export function sqlTag(db: ScopedDb): SqlTag {
  if (captured !== undefined) return captured.sql;
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
  return captured.sql;
}
