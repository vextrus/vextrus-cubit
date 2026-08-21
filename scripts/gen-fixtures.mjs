/**
 * `pnpm gen:fixtures` — regenerates the fixture corpus from its generators: golden
 * vectors, document payloads, EntityGraph mirrors, the model-call replay fixtures.
 *
 * C-06 delivers the generators' skeleton with the toolchain (fixtures/gen/README.md); the
 * generators themselves belong to the increments whose data they generate, so this lane
 * announces itself until the first one lands.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('gen:fixtures');
