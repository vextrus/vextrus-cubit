/**
 * What every script in this directory needs: where the repo is, how a contract line is
 * printed, and whether a lane's input exists yet.
 *
 * C-06: "a lane that does not exist yet is skipped with the recorded reason
 * LANE_NOT_YET_BUILT, never silently passed". The reason is a code, printed on stdout, so
 * that `2>/dev/null` keeps every contract line.
 */
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root — this file lives at scripts/lib/lane.mjs. */
export const REPO = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** The recorded reason itself. One code, spelled in one place. */
export const LANE_NOT_YET_BUILT = 'SKIP LANE_NOT_YET_BUILT';

/**
 * A contract line. stdout only: the gate reports stderr after stdout, so a contract that
 * mixed the two would read out of order, and `2>/dev/null` would eat half of it.
 */
export function say(line) {
  process.stdout.write(`${line}\n`);
}

/** Everything the machine says about a failure, kept off the contract stream. */
export function detail(text) {
  if (text.trim() === '') return;
  process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
}

/** A lane announcing that it is not built yet. Always exit 0: unbuilt is not broken. */
export function skipLane(script) {
  say(`${script}: ${LANE_NOT_YET_BUILT}`);
}

/**
 * Arming is a directory question and nothing else — never a config flag, never an env var.
 * A file that happens to be named like an input root is not an input root.
 */
export function hasInputDir(relative) {
  try {
    return statSync(join(REPO, relative)).isDirectory();
  } catch {
    return false;
  }
}
