/**
 * `pnpm db:drift` — generates a migration into a scratch directory and fails
 * if anything comes out, which is how the gate proves the committed schema and
 * the committed migrations still agree (V-VERIFY).
 *
 * The scratch directory is .cubit-scratch/, gitignored, so the tree is exactly
 * as clean after the check as before it.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('db:drift');
