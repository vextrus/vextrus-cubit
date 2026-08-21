/**
 * `pnpm db:drift` — schema drift on demand: `drizzle-kit generate` into a scratch
 * directory, with the tree left untouched, and a nonzero exit if the migrations no longer
 * describe the schema (V-VERIFY).
 *
 * verify runs the same check as its db-drift stage, armed by the presence of db/schema.
 * The script itself is the developer's handle on it, and both are unbuilt until the
 * schema increment lands.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('db:drift');
