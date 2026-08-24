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

/**
 * One built statement — what `db.execute()` takes, named by what produces it.
 *
 * Taken off the reader rather than off the tag: the relational config's `where` collapses to
 * `never` once `KnownKeysOnly` has narrowed it against an unresolved selection, so the operator
 * set carries no readable type here (`src/modules/spine/members/operators.ts` survives that only
 * because it never reads a property off what it captured). `execute`'s own parameter is the same
 * value from the other end, and it is the type this seam actually needs to honour.
 */
export type Statement = Parameters<ScopedDb['execute']>[0];

/** The tag itself, as the seam passes it around. */
export type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Statement;

/** The shape borrowed off the reader — the one operator this seam uses, and nothing else. */
interface BorrowedOperators {
  sql: SqlTag;
}

let captured: SqlTag | undefined;

/** The `sql` tag, borrowed once per process. */
export function sqlTag(db: ScopedDb): SqlTag {
  if (captured !== undefined) return captured;
  db.query.tenants
    .findFirst({
      columns: { id: true },
      where: (_row, given) => {
        captured = (given as BorrowedOperators).sql;
        // No condition: the borrow is the point, and a built statement is never run.
        return undefined;
      },
    })
    .toSQL();
  if (captured === undefined) {
    throw new Error('the relational reader did not offer its operators');
  }
  return captured;
}
