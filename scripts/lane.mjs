/**
 * The unbuilt lanes that have no script file of their own — dev, build, start, worker,
 * test:db, test:golden, test:docs, test:perf. `node scripts/lane.mjs <script>` announces
 * the lane by the name the caller typed (C-06).
 *
 * Flipping one of these into a real lane is a change to package.json and to this
 * directory, so it rides an increment whose spec is tagged `toolchain` and names them.
 */
import { skipLane } from './lib/lane.mjs';

const [script] = process.argv.slice(2);

if (script === undefined) {
  process.stderr.write('lane: usage — node scripts/lane.mjs <package.json script name>\n');
  process.exitCode = 2;
} else {
  skipLane(script);
}
