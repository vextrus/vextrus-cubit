// V-DB (session 7): the database lane runs its batch in parallel, and the one suite that rewrites
// tracked source alone after it (scripts/lib/db-passes.mjs). drift-lane-breaker renames
// `tenants.name` in the seam. Twice in one day a suite loading the schema inside that window went
// red: once through the acceptance build (21e0e6d5), once through members-live's in-process import
// ("insert into tenants (…, "title", …)").
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { dbPasses, namesSuites, SOURCE_MUTATING_SUITES } from "../../scripts/lib/db-passes.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CONFIG = ["--config", "db/__tests__/vitest.config.ts"];

describe("the database lane's passes", () => {
  test("the lane as the gate runs it is the batch without the source-mutating suites, then each of them alone", () => {
    const passes = dbPasses(CONFIG);
    expect(passes, "one batch, then one pass per suite that rewrites tracked source").toHaveLength(1 + SOURCE_MUTATING_SUITES.length);
    expect(passes[0], "the batch keeps the lane's config and excludes every mutating suite by path").toEqual([...CONFIG, ...SOURCE_MUTATING_SUITES.flatMap((suite) => ["--exclude", suite])]);
    SOURCE_MUTATING_SUITES.forEach((suite, index) => {
      expect(passes[index + 1], `${suite} runs alone, under the same config`).toEqual([...CONFIG, suite]);
    });
  });

  test("a run that names its own suites is run as asked, in one pass", () => {
    expect(dbPasses([...CONFIG, "tests/takeoff/coverage/placeholder-lines.test.ts"])).toEqual([[...CONFIG, "tests/takeoff/coverage/placeholder-lines.test.ts"]]);
    expect(namesSuites([...CONFIG, "--reporter", "verbose"]), "a flag's value is not a file filter").toBe(false);
    expect(namesSuites([...CONFIG, "--reporter=verbose"]), "nor is a flag spelled with its value").toBe(false);
    expect(namesSuites(["-c", "db/__tests__/vitest.config.ts", "members"]), "a bare filter names suites").toBe(true);
  });

  test("the suites named as source-mutating exist, and are the ones that write the seam", () => {
    for (const suite of SOURCE_MUTATING_SUITES) {
      expect(existsSync(join(ROOT, suite)), `${suite} is a file of the tree`).toBe(true);
      const text = readFileSync(join(ROOT, suite), "utf8");
      expect(text, `${suite} writes tracked source, which is why it runs alone`).toMatch(/writeFileSync\((SEAM|BARREL)/);
    }
  });
});
