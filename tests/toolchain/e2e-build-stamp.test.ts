// The journeys' build decides staleness against the moment it READ its inputs (J0's finding).
//
// `scripts/e2e-server.mjs` compared every input's mtime against `<distDir>/BUILD_ID`, which Next
// writes when the build FINISHES. A build takes tens of seconds, so a source edit made WHILE the
// build ran landed with an older mtime than the marker — and the next run read "every input is
// older than the build", reused the bundle, and served a product that had never seen the edit. It
// was never rebuilt by any later run either, because the end-of-build marker only moves forward.
//
// These tests walk that exact story on a temp dist directory: an edit made between the build's
// start and its end must be STALE, and an edit made before the start must not be.
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { BUILD_ID_FILE, STAMP_FILE, buildReadInputsAtMs, inputIsStale, readBuildStamp, writeBuildStamp } from "../../scripts/lib/build-stamp.mjs";

/** A dist directory whose BUILD_ID was written (i.e. the build FINISHED) at the given moment. */
function distDir(finishedMs: number): string {
  const dir = mkdtempSync(join(tmpdir(), "cubit-build-stamp-"));
  mkdirSync(dir, { recursive: true });
  const marker = join(dir, BUILD_ID_FILE);
  writeFileSync(marker, "a-build\n");
  const when = new Date(finishedMs);
  utimesSync(marker, when, when);
  return dir;
}

/** A build that took 30 s: it began here and Next stamped BUILD_ID here. */
const BUILD_MS = 30_000;
const FINISHED = Date.now();
const STARTED = FINISHED - BUILD_MS;

describe("the build's staleness is judged against when it read its inputs, not when it ended", () => {
  test("an edit made DURING the build is stale — the fault J0 found, in one reading", () => {
    const dir = distDir(FINISHED);
    writeBuildStamp(dir, STARTED);

    // The edit lands ten seconds into a thirty-second build: older than BUILD_ID, newer than start.
    const editedMs = STARTED + 10_000;
    expect(editedMs, "the edit is OLDER than the end-of-build marker — which is why the old reading missed it").toBeLessThan(FINISHED);

    const readAt = buildReadInputsAtMs(dir);
    expect(readAt, "the build publishes when it read its inputs").toBe(STARTED);
    expect(inputIsStale(editedMs, readAt as number), "an edit made while the build ran was never read by it, so the build is stale").toBe(true);
  });

  test("an edit made BEFORE the build began is not stale — the build read it", () => {
    const dir = distDir(FINISHED);
    writeBuildStamp(dir, STARTED);
    expect(inputIsStale(STARTED - 1, buildReadInputsAtMs(dir) as number), "an input older than the build's start was in the build").toBe(false);
  });

  test("an edit in the same millisecond the build began is stale — the safe side of the tie", () => {
    const dir = distDir(FINISHED);
    writeBuildStamp(dir, STARTED);
    expect(inputIsStale(STARTED, buildReadInputsAtMs(dir) as number), "an mtime equal to the stamp is not provably older than the read").toBe(true);
  });

  test("the stamp is a moment, written under one name, and read back as it was written", () => {
    const dir = distDir(FINISHED);
    writeBuildStamp(dir, STARTED);
    expect(readFileSync(join(dir, STAMP_FILE), "utf8").trim(), "the marker holds the millisecond and nothing else").toBe(String(STARTED));
    expect(readBuildStamp(dir)).toBe(STARTED);
  });

  test("a build made before the stamp existed falls back to BUILD_ID's mtime, and nothing throws", () => {
    const dir = distDir(FINISHED);
    expect(readBuildStamp(dir), "no stamp was ever written there").toBeNull();
    const readAt = buildReadInputsAtMs(dir) as number;
    expect(Math.round(readAt), "the old end-of-build reading, until the first stamped build replaces it").toBe(Math.round(FINISHED));
  });

  test("a distDir with no build at all reads null rather than a moment", () => {
    const dir = mkdtempSync(join(tmpdir(), "cubit-build-stamp-empty-"));
    expect(buildReadInputsAtMs(dir), "nothing was built there").toBeNull();
  });

  test("a stamp that holds something other than a moment is no stamp", () => {
    const dir = distDir(FINISHED);
    writeFileSync(join(dir, STAMP_FILE), "not-a-moment\n");
    expect(readBuildStamp(dir)).toBeNull();
    expect(buildReadInputsAtMs(dir), "and the fallback stands rather than a NaN comparison that is false either way").toBeGreaterThan(0);
  });
});
