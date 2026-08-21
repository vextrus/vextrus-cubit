/**
 * The method-hash manifest (V-VERIFY).
 *
 * Every calculation method in src/core/methods carries a hash of its own
 * source; the manifest records them, and verify fails when a method changes
 * without its hash — a silently edited formula is the one change no reviewer
 * can see. src/core/methods does not exist yet, so verify's method-hashes
 * stage skips and so does this script when it is run on its own.
 */
import { skipLane } from './lib/lane.mjs';

skipLane('method-hashes');
