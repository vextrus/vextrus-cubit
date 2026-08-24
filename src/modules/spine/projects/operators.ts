/**
 * drizzle's comparison operators and its `sql` tag, taken off a handle rather than imported
 * (SEAM-TENANT).
 *
 * "Driver and schema imports lint-banned outside `src/core/db.ts`" is the whole of the seam's
 * discipline, and `eq`/`and`/`sql` live in `drizzle-orm` beside the driver. The relational
 * reader already hands them to every `where` callback, so a module above the seam borrows them
 * from the one place the seam already offers them — the shape
 * `src/modules/spine/members/operators.ts` established and `src/core/acts/operators.ts`
 * repeated. `toSQL()` builds the statement and does not run it: no connection is taken and no
 * row is read.
 *
 * This module needs both halves. The writes (an UPDATE of the project row) take their
 * condition as an argument rather than as a callback, and the two participation reads are
 * joins and `distinct on` — shapes the relational reader does not compose.
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

/** One built statement — what `db.execute()` takes, named by what produces it. */
export type Statement = Parameters<ScopedDb['execute']>[0];

/** The `sql` tag itself, as this module passes it around. */
export type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Statement;

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

/** The `sql` tag, off the same borrow. */
export function sqlTag(db: ScopedDb): SqlTag {
  return operators(db).sql as unknown as SqlTag;
}

/**
 * The rows a statement came back with, however the driver hands them over: node-postgres
 * answers with a `QueryResult` carrying `rows`, and other drivers drizzle supports answer with
 * the array itself.
 */
export async function rowsOf(
  db: ScopedDb,
  statement: Statement,
): Promise<Record<string, unknown>[]> {
  const result: unknown = await db.execute(statement);
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const carried = (result as { rows?: unknown }).rows;
  return Array.isArray(carried) ? (carried as Record<string, unknown>[]) : [];
}
