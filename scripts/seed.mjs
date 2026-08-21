/**
 * `pnpm seed` — plants the demonstration tenant, its project and its pinned drawing set,
 * so a fresh machine has something true to look at.
 *
 * Seed data is a later increment's; there is no schema to seed into yet.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('seed');
