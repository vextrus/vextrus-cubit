/**
 * `pnpm gen:fixtures` — regenerates the committed fixture corpora from the
 * generators under fixtures/gen/ (drawings, ledgers, document payloads).
 *
 * This increment ships the skeleton only: fixtures/gen/README.md states the
 * contract every generator must meet, and the generators themselves land with
 * the increments that need their fixtures (C-06, B-15).
 */
import { skipLane } from './lib/lane.mjs';

skipLane('gen:fixtures');
