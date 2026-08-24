// J-000 stub honest + the recorded skips of the db and seed entrypoints. A command that exists
// runs; a lane that is not built says so in one unforgeable line and exits 0 (B-23, C-06).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRoot, pnpmRun, removeTree, scratchTree } from "./support/tree.mjs";

describe("J-000 stub honest", () => {
  let dir;

  beforeAll(() => {
    dir = scratchTree("stubs");
  }, 120_000);

  afterAll(() => dir && removeTree(dir));

  it("J-000: `pnpm e2e --journey J-000` exists, exits 0 and records the skip", () => {
    const run = pnpmRun(dir, ["e2e", "--journey", "J-000"]);
    expect(run.code, `pnpm e2e --journey J-000 exited ${run.code}\n${run.out}`).toBe(0);
    expect(run.lines, `no recorded skip line in\n${run.out}`).toContain("SKIP e2e: input root src/app absent");
  }, 300_000);

  it("AC-1-VERIFY-WHOLE: db:migrate, db:drift and seed record their skip and exit 0", () => {
    for (const [script, names] of [
      ["db:migrate", "db:migrate|db-migrate"],
      ["db:drift", "db:drift|db-drift"],
      ["seed", "seed"],
    ]) {
      const run = pnpmRun(dir, [script]);
      expect(run.code, `pnpm ${script} exited ${run.code}\n${run.out}`).toBe(0);
      const line = run.lines.find((l) => new RegExp(`^SKIP (${names}): input root src/server/db/schema absent$`).test(l));
      expect(line, `pnpm ${script} printed no recorded skip naming its absent input root\n${run.out}`).toBeTruthy();
    }
  }, 300_000);

  it("J-000: the skip disappears the moment the input root exists (B-23)", () => {
    const probe = scratchTree("stubs-armed");
    try {
      const before = pnpmRun(probe, ["e2e", "--journey", "J-000"], {}, 240_000);
      expect(before.lines).toContain("SKIP e2e: input root src/app absent");
      const undo = createRoot(probe, "src/app");
      try {
        const after = pnpmRun(probe, ["e2e", "--journey", "J-000"], {}, 240_000);
        expect(after.lines, "e2e kept printing its skip after src/app appeared (B-23)").not.toContain("SKIP e2e: input root src/app absent");
      } finally {
        undo();
      }
      const restored = pnpmRun(probe, ["e2e", "--journey", "J-000"], {}, 240_000);
      expect(restored.lines).toContain("SKIP e2e: input root src/app absent");
    } finally {
      removeTree(probe);
    }
  }, 900_000);
});
