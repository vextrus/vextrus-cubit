// SEAM-TENANT, B-17: the one spelling of a transaction-scoped advisory lock on a name. The hash the
// name is folded to is a fact both the seam's state lock and the jobs store's key lock depend on,
// and two spellings of it would be two locks that never contend.
//
// The two callers speak to the database differently — the state lock is issued through a typed
// handle and the key lock through the raw driver — so the lock is published in both forms from this
// one home, rather than rendered a second time beside the caller that needs text and parameters.
import { sql as statement, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { DriverParams } from "./sql";

/** The dialect the lock statement is rendered in for the driver, which takes text and parameters. */
const LOCK_DIALECT = new PgDialect();

/** The lock as a typed handle issues it: released when the transaction ends, whichever way it ends. */
export function advisoryXactLock(name: string): SQL {
  return statement`select pg_advisory_xact_lock(hashtextextended(${name}, 0))`;
}

/** The same lock, rendered for a caller that reaches the driver directly rather than through a handle. */
export function advisoryXactLockQuery(name: string): { text: string; params: DriverParams } {
  const rendered = LOCK_DIALECT.sqlToQuery(advisoryXactLock(name));
  return { text: rendered.sql, params: rendered.params as DriverParams };
}
