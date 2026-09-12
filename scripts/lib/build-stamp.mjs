// When the journeys' build read its inputs (V-E2E, J0's finding).
//
// THE FAULT THIS FILE EXISTS FOR. `scripts/e2e-server.mjs` decided a build was current by comparing
// every input's mtime against `<distDir>/BUILD_ID` — a file Next writes when the build FINISHES. A
// build takes tens of seconds, so every edit made WHILE it ran landed with an mtime older than the
// marker: the very next run read "every input is older than the build" and served a bundle that had
// never seen the edit. The edit was then never rebuilt at all — not by that run and not by any run
// after it, because the marker only moves forward. A journey walking a screen the author had just
// changed walked the screen as it stood before, and reported green on a product that does not exist.
//
// THE CURE. The moment that decides staleness is the moment the build READ its inputs, which is its
// START, not its end. The build stamps `<distDir>/E2E_BUILD_START` with the millisecond it began,
// and an input at or after that instant is stale. "At" as well as "after": an mtime equal to the
// stamp is not provably older than the read, and the safe side of that tie is one more build.
//
// The stamp is written only when the build SUCCEEDED — a failed build leaves whatever stood before,
// and must not be able to declare itself current. A distDir built before this marker existed has no
// stamp, so BUILD_ID's own mtime is read instead: the old, end-of-build reading, which is wrong only
// in the direction it always was and is corrected by the first build this file stamps.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The marker's name, in one home (ARCH-02): the server writes it, the reader below reads it. */
export const STAMP_FILE = "E2E_BUILD_START";

/** Next's own end-of-build marker, read only as the fallback for a build made before the stamp. */
export const BUILD_ID_FILE = "BUILD_ID";

/**
 * Stamp a finished build with the instant it STARTED.
 * @param {string} distAbs absolute path of the built output directory
 * @param {number} startedMs `Date.now()` taken before the build was spawned
 */
export function writeBuildStamp(distAbs, startedMs) {
  writeFileSync(join(distAbs, STAMP_FILE), `${Math.floor(startedMs)}\n`, "utf8");
}

/**
 * The stamp a build left, or null when there is none (or it holds something that is not a moment).
 * @param {string} distAbs
 * @returns {number|null}
 */
export function readBuildStamp(distAbs) {
  const file = join(distAbs, STAMP_FILE);
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8").trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

/**
 * The instant this build read its inputs: its own stamp when it has one, else BUILD_ID's mtime for
 * a build made before the stamp existed. `null` when there is no build at all.
 * @param {string} distAbs
 * @returns {number|null}
 */
export function buildReadInputsAtMs(distAbs) {
  const stamp = readBuildStamp(distAbs);
  if (stamp !== null) return stamp;
  const marker = join(distAbs, BUILD_ID_FILE);
  return existsSync(marker) ? statSync(marker).mtimeMs : null;
}

/**
 * Is an input newer than the moment the build read it? An mtime EQUAL to the stamp counts as newer:
 * an edit landing in the same millisecond the build began may or may not have been read, and an
 * unnecessary rebuild is the only cheap side of that question.
 * @param {number} newestInputMs
 * @param {number} readInputsAtMs
 * @returns {boolean}
 */
export function inputIsStale(newestInputMs, readInputsAtMs) {
  return newestInputMs >= readInputsAtMs;
}
