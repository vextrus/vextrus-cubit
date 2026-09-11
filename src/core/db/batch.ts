// SEAM-DB's unit of work: a batch of rows is ONE statement in ONE transaction, not one of each per
// row (L-REG-05, ARCH-02).
//
// The seam opens a transaction for every statement issued outside one (`scopedClient`), because a
// scope armed on a pooled connection that the statement might not land on would scope nothing. That
// is right for a statement and ruinous for a batch: a rail writing the observations of one drawing
// row by row paid for a BEGIN, an arming and a COMMIT per row, and a drawing with two thousand
// observations paid for two thousand of each. The unit of work is the drawing on the rail, not the
// row, so the rows go in together and commit together — and a batch half of which is written is a
// batch nobody can tell from a whole one, which is the second reason (L-QTY-04).
//
// Nothing here decides WHAT is written; it decides that what a caller hands over in one call reaches
// the store in one statement.

/**
 * How many rows go in one statement. Postgres binds at most 65535 parameters per statement, so the
 * cap is a row count that keeps the widest table this seam holds inside that bind limit with room —
 * a batch past it is SPLIT rather than refused, because the caller's unit of work is the caller's.
 */
export const ROWS_PER_STATEMENT = 500;

/** The rows of one batch, in the statements they will be issued as — order preserved. */
export function inChunks<Row>(rows: readonly Row[], size: number = ROWS_PER_STATEMENT): readonly (readonly Row[])[] {
  if (size < 1) throw new Error("a statement carries at least one row (SEAM-DB)");
  const chunks: Row[][] = [];
  for (let at = 0; at < rows.length; at += size) chunks.push(rows.slice(at, at + size));
  return chunks;
}

/**
 * Write every row of a batch through `statement`, in as few statements as the bind limit allows.
 * Empty is empty: a batch of no rows issues NO statement, where a row-by-row loop over nothing still
 * cost a round trip to decide so.
 *
 * The caller hands the writer rather than a table, because what a batch does on conflict is the
 * caller's law and not this file's: one rail's observations are idempotent by key and another's
 * lines are not.
 */
export async function writeInBatches<Row>(rows: readonly Row[], statement: (chunk: readonly Row[]) => Promise<unknown>): Promise<number> {
  const chunks = inChunks(rows);
  for (const chunk of chunks) await statement(chunk);
  return chunks.length;
}
