#!/usr/bin/env node
// A LAWFUL RE-TAKE OF THE PICTURES A RUN MOVED — never `--update-snapshots`.
//
// After a `pnpm e2e` that came back red on pictures, Playwright leaves, beside each failed
// comparison under test-results/, the picture it expected, the one it took and their diff. This
// reads that evidence: for every `<name>-actual.png` with an `<name>-expected.png` beside it, it
// names the baseline the picture belongs to, says WHERE the two differ (the bands of rows that
// moved, from `<name>-diff.png`), and — only with `--write` — copies the run's own capture over the
// baseline. The dry run is the default, because a re-take is a decision a reader makes after
// reading the bands: a picture a lawful change moved is the gate's to re-take, in its own
// `baseline:` commit naming the proof (B-20, AM-09 §4); a picture that moved for a cause the
// change did not intend is a defect, and copying it would freeze the defect.
//
//   pnpm e2e:retake            # list every moved picture with its bands
//   pnpm e2e:retake -- --write # copy the captures over their baselines; then commit `baseline:`
//
// Session 3 did this by hand over six rounds; the mapping and the bands are the part worth keeping.
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { bandLine, decodePng, diffBands } from "./probe/lib/png.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const RESULTS = "test-results";
const BASELINES = "tests/e2e/baselines";

/**
 * Every file under a directory, depth first.
 * @param {string} dir
 * @param {string[]} [out]
 * @returns {string[]}
 */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/**
 * The baseline a run's capture belongs to. A failed comparison lives at
 * `test-results/<test-dir>-<project>/<sub…>/<name>-actual.png`, and the baseline the lane compared
 * it with is `tests/e2e/baselines/design-<project>/<sub…>/<name>.png` (capture-geometry.ts's
 * SNAPSHOT_PATH_TEMPLATE). Null where the path is not a capture of a failed comparison.
 * @param {string} actual a path relative to the results root, forward-slashed
 * @param {(path: string) => boolean} exists
 */
export function baselineFor(actual, exists) {
  const parts = actual.split("/");
  const file = parts[parts.length - 1];
  const testDir = parts[0];
  if (parts.length < 2 || file === undefined || testDir === undefined || !file.endsWith("-actual.png")) return null;
  const project = /-(dark|light)$/.exec(testDir)?.[1];
  if (project === undefined) return null;
  const name = file.slice(0, -"-actual.png".length);
  const sub = parts.slice(1, -1);
  const expected = [RESULTS, testDir, ...sub, `${name}-expected.png`].join("/");
  if (!exists(expected)) return null;
  return {
    baseline: [BASELINES, `design-${project}`, ...sub, `${name}.png`].join("/"),
    expected,
    actual: [RESULTS, testDir, ...sub, `${name}-actual.png`].join("/"),
    diff: [RESULTS, testDir, ...sub, `${name}-diff.png`].join("/"),
  };
}

/** Every moved picture the last run left, with its baseline and its diff bands. */
export function movedPictures(root = ROOT) {
  const results = join(root, RESULTS);
  /** @param {string} path */
  const exists = (path) => existsSync(join(root, path));
  /** @type {Array<NonNullable<ReturnType<typeof baselineFor>> & {bands: ReturnType<typeof diffBands> | null}>} */
  const moved = [];
  for (const file of walk(results)) {
    const rel = relative(results, file).split(sep).join("/");
    const mapped = baselineFor(rel, exists);
    if (mapped === null) continue;
    let bands = null;
    if (exists(mapped.diff)) {
      try {
        const diff = diffBands(decodePng(readFileSync(join(root, mapped.diff))));
        bands = diff;
      } catch {
        bands = null;
      }
    }
    moved.push({ ...mapped, bands });
  }
  return moved.sort((a, b) => (a.baseline < b.baseline ? -1 : a.baseline > b.baseline ? 1 : 0));
}

/**
 * The command. Dry by default; `--write` copies. Answers the count written.
 * @param {{write?: boolean, out?: (line: string) => void, root?: string}} [options]
 */
export function retake(options = {}) {
  const out = options.out ?? ((line) => process.stdout.write(line));
  const root = options.root ?? ROOT;
  const moved = movedPictures(root);
  if (moved.length === 0) {
    out("e2e:retake — no moved picture under test-results (a failed comparison leaves an -expected.png beside its -actual.png)\n");
    return 0;
  }
  for (const picture of moved) {
    out(`${picture.baseline}\n`);
    if (picture.bands === null) out("  (no diff picture — the sizes differ, or the diff was not written)\n");
    else if (picture.bands.bands.length === 0) out("  differing=0\n");
    else for (const band of picture.bands.bands) out(`  ${bandLine(band)}\n`);
    if (options.write === true) {
      const target = join(root, picture.baseline);
      if (!existsSync(dirname(target))) {
        out(`  REFUSED — ${dirname(picture.baseline)} does not exist; a picture is re-taken where it stood, never minted\n`);
        continue;
      }
      copyFileSync(join(root, picture.actual), target);
      out(`  written from ${basename(picture.actual)}\n`);
    }
  }
  out(options.write === true ? `e2e:retake — ${moved.length} picture(s) written; commit them in a \`baseline:\` commit naming the run that proves them\n` : `e2e:retake — ${moved.length} moved picture(s); re-run with --write to copy the captures over their baselines\n`);
  return moved.length;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  retake({ write: process.argv.includes("--write") });
}
