// What `pnpm e2e:clean` may take away (v22 Wave A, P2b finding 6).
//
// It matched every directory named `.next*` — which includes `.next-cubit`, the default distDir the
// journeys' own server builds into and SERVES FROM. A clean run beside a live journey run deleted
// the bundle out from under the server that was answering requests from it, and the journeys went
// red for a reason nothing in them explains. The default distDir is now kept unless `--all` says
// otherwise, a build younger than ten minutes is kept whatever its name, and a directory a live
// server holds (scripts/e2e-server.mjs writes a lock while it serves) is never taken at all.
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { DEFAULT_DIST_DIR, SERVER_LOCK, heldBy, holdDistDir } from "../../scripts/lib/dist.mjs";
import { sweepable } from "../../scripts/e2e-clean.mjs";

/** A dist directory with a BUILD_ID of the given age. */
function distDir(root: string, name: string, ageMs: number): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  const marker = join(dir, "BUILD_ID");
  writeFileSync(marker, "a-build\n");
  const when = new Date(Date.now() - ageMs);
  utimesSync(marker, when, when);
  return dir;
}

const HOUR_MS = 60 * 60_000;
const verdict = (targets: { name: string; take: boolean; why: string }[], name: string) => targets.find((target) => target.name === name);

describe("the journey lane's sweep keeps what is still in use", () => {
  test("a fresh build survives, however it is named, and a stale one does not", () => {
    const root = mkdtempSync(join(tmpdir(), "cubit-e2e-clean-"));
    distDir(root, ".next-stage-a", 3 * HOUR_MS);
    distDir(root, ".next-stage-b", 60_000);

    const targets = sweepable(root, {});
    expect(verdict(targets, ".next-stage-a")?.take, "a three-hour-old build nothing holds is exactly what this sweep is for").toBe(true);
    expect(verdict(targets, ".next-stage-b")?.take, "a build made a minute ago is a build a run is about to serve").toBe(false);
  });

  test("the default distDir is kept unless the caller says --all", () => {
    const root = mkdtempSync(join(tmpdir(), "cubit-e2e-clean-"));
    distDir(root, DEFAULT_DIST_DIR, 3 * HOUR_MS);

    expect(verdict(sweepable(root, {}), DEFAULT_DIST_DIR)?.take, "the sweep took the distDir a live e2e server serves from").toBe(false);
    expect(verdict(sweepable(root, { all: true }), DEFAULT_DIST_DIR)?.take, "--all is how a caller asks for the default distDir too").toBe(true);
  });

  test("a directory a live server holds is never taken, --all or not", () => {
    const root = mkdtempSync(join(tmpdir(), "cubit-e2e-clean-"));
    const held = distDir(root, ".next-stage-held", 3 * HOUR_MS);
    // The lock a serving process writes, naming a pid that is demonstrably alive: this one.
    writeFileSync(join(held, SERVER_LOCK), `${JSON.stringify({ pid: process.pid, port: 3211, at: new Date().toISOString() })}\n`);

    const targets = sweepable(root, { all: true });
    expect(verdict(targets, ".next-stage-held")?.take, "the sweep took a dist directory a live server is serving from").toBe(false);
    expect(verdict(targets, ".next-stage-held")?.why).toMatch(/serv|live|hold/i);
  });

  test("the server's own hold is what the sweep reads, and it is given back", () => {
    const root = mkdtempSync(join(tmpdir(), "cubit-e2e-clean-"));
    const serving = distDir(root, ".next-stage-serving", 3 * HOUR_MS);

    const release = holdDistDir(serving, 3211);
    expect(heldBy(serving), "the serving process did not say it was holding the directory").toBe(process.pid);
    expect(verdict(sweepable(root, { all: true }), ".next-stage-serving")?.take).toBe(false);

    release();
    expect(heldBy(serving), "the hold outlived the server").toBeNull();
    expect(verdict(sweepable(root, { all: true }), ".next-stage-serving")?.take, "a directory nobody serves from is the sweep's").toBe(true);
  });

  test("a lock left behind by a dead process holds nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "cubit-e2e-clean-"));
    const stale = distDir(root, ".next-stage-abandoned", 3 * HOUR_MS);
    // A pid that cannot be running: 0 is not a process, and this harness's own kill probe says so.
    writeFileSync(join(stale, SERVER_LOCK), `${JSON.stringify({ pid: 2 ** 31 - 1, port: 3211, at: new Date().toISOString() })}\n`);

    expect(verdict(sweepable(root, { all: true }), ".next-stage-abandoned")?.take, "a killed server's lock file locked the directory forever").toBe(true);
  });
});
