/**
 * The method-hash manifest (V-VERIFY): every measurement method's source hashed, so a
 * formula cannot change without the change being declared and the golden vectors moving
 * with it.
 *
 * verify runs this as its method-hashes stage, armed by the presence of src/core/methods.
 * The manifest's shape is the methods increment's to define; if that directory appears
 * before the manifest is wired, this refuses out loud rather than reporting a hash of
 * nothing — a stage that arms and then passes silently is the failure C-06 forbids.
 */
import { hasInputDir, say, skipLane } from './lib/lane.mjs';

const INPUT = 'src/core/methods';

if (!hasInputDir(INPUT)) {
  skipLane('method-hashes');
} else {
  process.stderr.write(
    `method-hashes: ${INPUT} exists, but no manifest is wired. The increment that adds the ` +
      'measurement methods must deliver the manifest and its check, and its spec must be ' +
      'tagged `toolchain` and name this file (C-06).\n',
  );
  say('method-hashes: FAIL manifest not wired');
  process.exitCode = 1;
}
