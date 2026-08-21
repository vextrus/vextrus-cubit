/**
 * The vocabulary the gate speaks.
 *
 * C-06: a lane that does not exist yet is skipped with the recorded reason
 * LANE_NOT_YET_BUILT — never silently passed. One module owns that literal so
 * that no script can drift into inventing its own wording.
 *
 * Everything a caller is contractually owed goes to stdout: the gate reports
 * stderr after stdout, and `pnpm verify 2>/dev/null` has to keep every line.
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The recorded reason. Never a config flag, never an env var. */
export const NOT_YET_BUILT = 'LANE_NOT_YET_BUILT';

/** Repository root, from this file's own location. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @param {string} relative */
export const at = (relative) => path.join(ROOT, relative);

/**
 * A lane's input root decides whether it is armed. That is the whole rule:
 * no flag, no environment variable, no list to keep in step by hand.
 *
 * The input root is a *directory* — `src/app`, `db/schema`, `cad/tests`. A
 * plain file of that name is not the lane's input, and arming a stage on one
 * would report FAIL for a tree that has nothing to check.
 *
 * @param {string} relative
 */
export const hasInput = (relative) =>
  statSync(at(relative), { throwIfNoEntry: false })?.isDirectory() === true;

/** The one place a contract line becomes bytes. @param {string} line */
export function say(line) {
  process.stdout.write(`${line}\n`);
}

/**
 * Announce that a lane is not built yet, and succeed. The caller's exit code
 * is 0 because nothing failed — the line is the evidence that nothing ran.
 *
 * @param {string} name the script's name, as package.json spells it
 */
export function skipLane(name) {
  say(`${name}: SKIP ${NOT_YET_BUILT}`);
  process.exitCode = 0;
}
