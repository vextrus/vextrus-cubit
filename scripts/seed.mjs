/**
 * `pnpm seed` — loads the demo tenant so a human can open the app and see a
 * project that looks like a real one.
 *
 * There is no schema to seed into yet (C-06).
 */
import { skipLane } from './lib/lane.mjs';

skipLane('seed');
