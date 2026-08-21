/**
 * `pnpm e2e [--journey <J>]` — the Playwright journeys against the e2e build on 3211
 * (C-07), with visual baselines and axe checks.
 *
 * tests/e2e/ and the journeys arrive with the screen increments. The journey argument is
 * accepted now so the caller's habit does not change when the lane is built; until then
 * every invocation announces the lane rather than reporting a pass nobody ran.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('e2e');
