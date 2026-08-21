/**
 * `pnpm traceability` — writes docs/traceability.json from the test annotations, mapping
 * every requirement id to the tests that hold it.
 *
 * The JSON is gate-owned: the gate generates and commits it, so it never enters a
 * feature's ownership and never appears in a builder's diff. The script that makes it is
 * the toolchain's, which is why it ships here; it has no annotations to read until the
 * first product suite lands.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('traceability');
