/**
 * `pnpm db:drift` — schema drift on demand: `drizzle-kit generate` into a scratch
 * directory, with the tree left untouched, and a nonzero exit if the migrations no longer
 * describe the schema (V-VERIFY).
 *
 * The comparison itself lives in scripts/lib/schema-drift.mjs, because `pnpm verify` runs
 * exactly the same check as its db-drift stage: one implementation, two callers, so the
 * lane a developer runs cannot drift from the gate that judges them. This script is the
 * developer's handle on it and the contract line it prints.
 *
 * The check needs no database. It reads db/schema against the committed migration history
 * and asks drizzle-kit what SQL would be needed to close the gap; anything at all is drift.
 */
import { REPO, detail, say } from './lib/lane.mjs';
import { checkSchemaDrift } from './lib/schema-drift.mjs';

const startedAt = performance.now();
const result = checkSchemaDrift(REPO);
const ms = Math.round(performance.now() - startedAt);

if (result.ok) {
  say(`db:drift: ok (${ms}ms)`);
} else {
  detail(result.output);
  say('db:drift: FAIL DRIFT');
  process.exitCode = 1;
}
