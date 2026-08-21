/**
 * `pnpm db:migrate` — applies db/migrations to the lane's database.
 *
 * The schema increment builds db/schema and db/migrations; until then there is
 * nothing to apply, and saying so out loud is the point (C-06).
 */
import { skipLane } from './lib/lane.mjs';

skipLane('db:migrate');
