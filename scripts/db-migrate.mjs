/**
 * `pnpm db:migrate` — the one migration lane: drizzle SQL migrations applied by the
 * migrate role against PostgreSQL 16 on 127.0.0.1:5544 (C-07, SEAM-TENANT).
 *
 * db/ arrives with the schema increment. Until then the lane announces itself rather than
 * exiting 0 in silence, which would be indistinguishable from a migration that ran.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('db:migrate');
