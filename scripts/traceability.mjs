/**
 * `pnpm traceability` — reads the Bible-clause annotations off the test suite
 * and writes docs/traceability.json: clause → the tests that hold it up.
 *
 * The JSON file is gate-owned. The gate runs this script and commits its
 * output; no increment commits the file, and .gitignore keeps that honest
 * (C-10). Until tests carry clause annotations there is nothing to trace, so
 * the lane skips with its reason rather than writing an empty map.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('traceability');
