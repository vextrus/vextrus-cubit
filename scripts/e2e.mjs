/**
 * `pnpm e2e [--journey <J>]` — drives the journeys in tests/e2e against a
 * production build on E2E_PORT (C-07).
 *
 * tests/e2e does not exist in the toolchain increment: the journeys arrive
 * with the shell and the first screens. Arguments are accepted and reported
 * back to nobody until then — `pnpm e2e --journey J-000` skips like the rest.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('e2e');
