#!/usr/bin/env node
/**
 * pnpm method-hashes — the method-hash manifest stage of V-VERIFY.
 *
 * C-06: gate stages arm progressively during increment zero. No method lane
 * exists yet, so this prints its skip *by name with the recorded reason* and
 * never passes silently. The increment that lands the first method replaces the
 * body; the stage, the script and the package.json entry already exist.
 */
const STAGE = 'method-hashes';

console.log(`SKIP ${STAGE} LANE_NOT_YET_BUILT`);
