/**
 * Breaker acceptance for the journey lane's collection (V-E2E, J-001, B-20).
 *
 * The gate runs the journeys one invocation per journey — `pnpm e2e --journey J-000` and
 * `pnpm e2e --journey J-001` — and `scripts/e2e.mjs` turns each `--journey X` into Playwright's
 * `--grep X` (scripts/e2e.mjs:13-15, 23). `playwright.config.ts` sets no config-level `grep` and no
 * projects, so those two regexes are the whole of what the gate executes: a spec whose title chain
 * carries neither tag is run by nothing.
 *
 * The reading is settled: "Under V-E2E's per-journey grep gate, every Playwright spec — breaker specs
 * included — must carry the J-nnn tag of the journey whose screens it exercises in its title, so the
 * journeys stage collects it; a browser-level breaker for S-Auth belongs to J-001." The rejected
 * alternative is named in the same ruling: "that breaker specs may live untagged in
 * tests/e2e/journeys/ and count as acceptance by mere presence".
 *
 * So an untagged spec is not merely unrun — it is a guarantee the branch believes it has and does
 * not. This file is the check that makes that visible without a browser: it reads the specs' own
 * title literals and asks, of each file, whether any gate invocation could collect it. It asserts
 * nothing about which tag a file should carry, about a file's contents, or about journey coverage —
 * only that a spec sitting in the journeys directory is reachable by the gate that is supposed to
 * run it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const JOURNEY_DIR = join(REPO_ROOT, "tests/e2e/journeys");

/** The journeys the gate invokes, and therefore the greps a title must satisfy to be run at all. */
const GATE_JOURNEYS = ["J-000", "J-001"] as const;

/** A `test(...)` or `test.describe(...)` title, as the file spells it. */
const TITLE = /\btest(?:\.describe)?(?:\.\w+)*\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;

function specFiles(): string[] {
  return readdirSync(JOURNEY_DIR)
    .filter((name) => name.endsWith(".spec.ts"))
    .sort();
}

function titlesIn(file: string): string[] {
  const source = readFileSync(join(JOURNEY_DIR, file), "utf8");
  return [...source.matchAll(TITLE)].map((match) => match[2] ?? "");
}

describe("BREAKER — every journey spec is reachable by the gate that runs the journeys", () => {
  test("tests/e2e/journeys holds spec files to judge", () => {
    expect(specFiles().length, "the increment opens the e2e lane, so tests/e2e/journeys holds specs").toBeGreaterThan(0);
  });

  for (const file of specFiles()) {
    test(`${file} carries a journey tag the gate greps for`, () => {
      const titles = titlesIn(file);
      expect(titles.length, `no test or describe title could be read out of tests/e2e/journeys/${file}`).toBeGreaterThan(0);

      const tagged = titles.filter((title) => GATE_JOURNEYS.some((journey) => title.includes(journey)));
      expect(
        tagged.length,
        `tests/e2e/journeys/${file} carries none of the tags the gate greps for (${GATE_JOURNEYS.join(", ")}), so ` +
          `neither \`pnpm e2e --journey J-000\` nor \`pnpm e2e --journey J-001\` collects it and the guarantee it ` +
          `encodes is enforced by nothing. The settled reading is that every Playwright spec — breaker specs ` +
          `included — must carry the J-nnn tag of the journey whose screens it exercises, and that specs may not ` +
          `"live untagged in tests/e2e/journeys/ and count as acceptance by mere presence" (V-E2E, J-001, B-20). ` +
          `Its titles are: ${JSON.stringify(titles)}`,
      ).toBeGreaterThan(0);
    });
  }
});
