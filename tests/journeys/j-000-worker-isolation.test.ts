/**
 * TWO PLAYWRIGHT WORKERS OF ONE LANE ARE TWO WALKS, NOT ONE WALK READ TWICE (P4b §1, §2).
 *
 * The golden run is memoised to a file so the next leg file restores it instead of paying four
 * minutes of prologue again. That file is shared state between processes, and under
 * `CUBIT_E2E_WORKERS=2` it was shared between WORKERS: keyed on the lane alone, dark's two workers
 * both read and wrote `j-000-golden-run.dark.json`, so m1-confirm-disciplines and m2-affirm-scale
 * ran concurrently against ONE tenant — and m1's "a confirmed group is no longer an offer" was
 * satisfied by the other worker's confirmation. A green nobody earned, and it is the same defect
 * `golden-run.ts` already records for the two LANES ("an act done once is done"), one level down.
 *
 * The second half of the same file: the run is written with `writeFileSync`, which truncates in
 * place, and read with an unguarded `JSON.parse` — so a reader that arrives mid-write meets zero
 * bytes and every leg in that file is red with `Unexpected end of JSON input`, a message that names
 * nothing. A run file is a CACHE: a torn or absent one is a lawful "walk it again", never an
 * exception out of `goldenRun()` (B-19 — a flake is a defect with a cause).
 *
 * This suite reads the source rather than the behaviour because the behaviour is a race between two
 * Playwright processes: what can be asserted here is that the key carries the worker and that the
 * write is atomic and the read is guarded. The probes are P4b's own (scratchpad/adv/p4b/probe.test.ts).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const GOLDEN_RUN = join(REPO_ROOT, "tests", "e2e", "journeys", "j-000", "golden-run.ts");
const JOURNEY_WORKER = join(REPO_ROOT, "tests", "e2e", "support", "worker.ts");

const source = (path: string): string => readFileSync(path, "utf8");

describe("P4b §1: the golden run is keyed per LANE and per WORKER", () => {
  it("names the worker in the run file it writes — two workers of one lane never share a run", () => {
    const src = source(GOLDEN_RUN);
    const key = /stateFile = \(\): string => join\(STATE_DIR, `([^`]*)`\)/.exec(src)?.[1] ?? "";
    expect(key, "the run file's name is derived in one expression, so this roster can read it").not.toBe("");
    expect(key, "two workers of one lane write and read one file under CUBIT_E2E_WORKERS=2 — key it on the worker too").toMatch(
      /workerIndex|parallelIndex|TEST_WORKER_INDEX/,
    );
    expect(key, "and on the lane, which is what keeps dark's acts out of light's project").toMatch(/project\.name/);
  });

  it("states, where the worker is spawned, what isolates one Playwright worker from another", () => {
    // A design this lane cannot have — one database per worker — is refused for a reason that lives
    // in the served product, not in a preference, so the reason is written where the sharing is done.
    const src = source(JOURNEY_WORKER);
    expect(src, "worker.ts's header names the unit of isolation this server can actually serve").toMatch(/TENANT/);
    expect(src, "and says why a per-worker DATABASE_URL is not one of them: one server, one URL").toMatch(/DATABASE_URL/);
    expect(src, "STORAGE_ROOT is stated rather than left to two defaults agreeing in silence").toMatch(/STORAGE_ROOT: journeyStorageRoot\(\)/);
  });
});

describe("P4b §2: the run file is written atomically and read defensively", () => {
  it("is written to a private name and renamed into place — a reader never meets a truncated file", () => {
    expect(source(GOLDEN_RUN), "writeFileSync truncates first; a concurrent restore() reads 0 bytes").toMatch(/renameSync/);
  });

  it("names the writer in the temporary it renames, so two writers never share the temporary either", () => {
    expect(source(GOLDEN_RUN), "`${file}.${process.pid}.tmp` — one writer, one temporary").toMatch(/\$\{file\}\.\$\{process\.pid\}\.tmp/);
  });

  it("answers a torn or absent run with null and a NAMED reason, never with an exception", () => {
    const restore = /async function restore\([\s\S]*?\n}/.exec(source(GOLDEN_RUN))?.[0] ?? "";
    expect(restore, "the restore is one function this roster can read").not.toBe("");
    expect(restore, "JSON.parse of a torn file throws out of goldenRun() with no cause named").toMatch(/catch/);
    expect(restore, "a cache miss is a fact about the run, and a fact nobody prints costs a session to find").toMatch(/walkedAgain|reason/);
  });
});
