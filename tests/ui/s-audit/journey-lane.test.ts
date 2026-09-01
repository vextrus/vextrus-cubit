/**
 * Public acceptance for AC-4's wiring — the half of "the J-003 lane runs S-Audit" that can be judged
 * without starting a browser, and the half this tree has been bitten by before.
 *
 * The gate runs the journeys one invocation per journey, and `scripts/e2e.mjs` turns `--journey X`
 * into Playwright's `--grep X` (tests/journeys/e2e-journey-tags-breaker.test.ts records the settled
 * reading; Playwright exits 1 on an unmatched grep). So `pnpm e2e --journey J-003` collecting the new
 * spec at all is a fact about its titles and about `playwright.config.ts`'s collection; the
 * checkpoint resolving to a committed Linux baseline is a fact about `snapshotPathTemplate` and the
 * bytes beside it; and "J-000 stays green" is a fact about what the new spec's titles do NOT say.
 *
 * The RUN itself — the journey signing in, reaching a project, opening the route, axe clean at the
 * checkpoint and the baseline matching — is the gate's journeys stage over the spec this increment
 * delivers. Nothing here re-implements it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, sourceOf } from "./support/decision";

const AUDIT_SPEC = "tests/e2e/audit.spec.ts";
const PAGE_OBJECT = "tests/e2e/pages/s-audit.page.ts";
const CHECKPOINT_HELPER = "tests/e2e/support/checkpoint.ts";
const PLAYWRIGHT_CONFIG = "playwright.config.ts";
const TAGS_BREAKER = "tests/journeys/e2e-journey-tags-breaker.test.ts";
const BIBLE = "docs/specs/cubit.bible.xml";
const BASELINE = "tests/e2e/baselines/design/s-audit/explorer.png";

/** The journey this increment opens S-Audit on, and the one whose collection must not change. */
const OWN_JOURNEY = "J-003";
const UNCHANGED_JOURNEY = "J-000";

/** The checkpoint the Increment Spec names, as path segments so `{arg}` carries the directory. */
const CHECKPOINT_SEGMENTS = ["s-audit", "explorer.png"] as const;

/** A `test(...)` or `test.describe(...)` title, as a spec file spells it. */
const TITLE = /\btest(?:\.describe)?(?:\.\w+)*\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;

/** The PNG signature, so "a committed baseline" means an image and not a placeholder. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function titlesIn(relative: string): string[] {
  return [...sourceOf(relative).matchAll(TITLE)].map((match) => match[2] ?? "");
}

describe("AC-4 — the J-003 lane collects the S-Audit journey", () => {
  test("AC-4: tests/e2e/audit.spec.ts exists and its titles carry the J-003 tag the gate greps for", () => {
    const titles = titlesIn(AUDIT_SPEC);
    expect(titles.length, `no test or describe title could be read out of ${AUDIT_SPEC}`).toBeGreaterThan(0);
    expect(
      titles.filter((title) => title.includes(OWN_JOURNEY)).length,
      `${AUDIT_SPEC} carries no "${OWN_JOURNEY}" in any title, so \`pnpm e2e --journey ${OWN_JOURNEY}\` collects nothing of it — and Playwright exits 1 on a grep that matches no test. Its titles are: ${JSON.stringify(titles)}`,
    ).toBeGreaterThan(0);
  });

  test("AC-4: playwright collects it — the lane's testDir and testMatch reach this file", () => {
    const config = sourceOf(PLAYWRIGHT_CONFIG);
    expect(/testDir\s*:\s*["']tests\/e2e["']/.test(config), `${PLAYWRIGHT_CONFIG} must keep testDir at tests/e2e — ${AUDIT_SPEC} lives under it`).toBe(true);
    expect(/testMatch\s*:[^\n]*\*\*\/\*\.spec\.ts/.test(config), `${PLAYWRIGHT_CONFIG}'s testMatch must collect the *.spec.ts spelling ${AUDIT_SPEC} is written in`).toBe(true);
    // The merge hazard the standing lessons name: a duplicate key survives `git merge` and tsc alike.
    expect((config.match(/^\s*webServer\s*:/gm) ?? []).length, `${PLAYWRIGHT_CONFIG} declares webServer once — a duplicate key silently wins and the journeys walk another server`).toBe(1);
  });

  test("AC-4: it does not claim J-000 — that journey's collection is unchanged by this increment", () => {
    expect(
      titlesIn(AUDIT_SPEC).filter((title) => title.includes(UNCHANGED_JOURNEY)),
      `${AUDIT_SPEC} must not carry "${UNCHANGED_JOURNEY}" in a title: \`pnpm e2e --journey ${UNCHANGED_JOURNEY}\` would then also run this spec, and the golden path is not what this increment opens`,
    ).toEqual([]);
  });

  test("AC-4: the journey drives the audit route through its own page object", () => {
    expect(existsSync(join(REPO_ROOT, PAGE_OBJECT)), `${PAGE_OBJECT} is missing — the test contract names it as this journey's page object`).toBe(true);
    const spec = sourceOf(AUDIT_SPEC);
    expect(spec.includes("/audit"), `${AUDIT_SPEC} must open the audit route — it is the screen the checkpoint stands on`).toBe(true);
  });
});

describe("AC-4 — the checkpoint stands: axe and a committed Linux baseline", () => {
  test("AC-4: the spec runs axe at its checkpoint through the lane's one checkpoint helper", () => {
    expect(existsSync(join(REPO_ROOT, CHECKPOINT_HELPER)), `${CHECKPOINT_HELPER} is the lane's home for "axe on every checkpoint page" (V-E2E)`).toBe(true);
    const spec = sourceOf(AUDIT_SPEC);
    expect(/from\s+["'][^"']*support\/checkpoint["']/.test(spec), `${AUDIT_SPEC} must import the checkpoint helper — it is where axe runs, and V-E2E puts axe on every checkpoint page`).toBe(true);
    expect(/\bcheckpoint\s*\(/.test(spec), `${AUDIT_SPEC} must call checkpoint(page, testInfo, name) at the checkpoint it declares`).toBe(true);
  });

  test("AC-4: the visual comparison names its baseline as path segments, so {arg} carries the directory", () => {
    const spec = sourceOf(AUDIT_SPEC);
    const segments = new RegExp(`toHaveScreenshot\\s*\\(\\s*\\[\\s*["']${CHECKPOINT_SEGMENTS[0]}["']\\s*,\\s*["']${CHECKPOINT_SEGMENTS[1].replace(".", "\\.")}["']\\s*\\]`);
    expect(
      segments.test(spec),
      `${AUDIT_SPEC} must compare at toHaveScreenshot(["${CHECKPOINT_SEGMENTS[0]}", "${CHECKPOINT_SEGMENTS[1]}"], …) — a slash inside a single name is sanitised away, and snapshotPathTemplate's {arg} is what carries the directory`,
    ).toBe(true);
    expect(/\bmask\s*:/.test(spec), `${AUDIT_SPEC}'s comparison must mask its volatile regions (V-E2E: per-journey masks) — the project name and the dates are not stable across runs`).toBe(true);
  });

  test("AC-4: the Linux baseline the checkpoint compares against is committed, and is a PNG", () => {
    const absolute = join(REPO_ROOT, BASELINE);
    expect(existsSync(absolute), `${BASELINE} is missing — V-E2E compares against baselines committed for Linux, and an absent baseline makes the first run write one instead of judging`).toBe(true);
    const bytes = readFileSync(absolute);
    expect(bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC), `${BASELINE} is not a PNG`).toBe(true);
    expect(bytes.length, `${BASELINE} is too small to picture a 1440-wide screen`).toBeGreaterThan(4096);
  });

  test("AC-4: the baseline sits where snapshotPathTemplate resolves it", () => {
    const template = /snapshotPathTemplate\s*:\s*["']([^"']+)["']/.exec(sourceOf(PLAYWRIGHT_CONFIG))?.[1] ?? "";
    expect(template, `${PLAYWRIGHT_CONFIG} must declare snapshotPathTemplate — it is where a journey's baseline lives`).not.toBe("");
    const resolved = template.replace("{arg}", CHECKPOINT_SEGMENTS.join("/").replace(/\.png$/, "")).replace("{ext}", ".png");
    expect(resolved, `the committed baseline must be the file the template resolves the checkpoint to`).toBe(BASELINE);
  });
});

describe("AC-4 — the journey-tag roster admits J-003 (B-20)", () => {
  test(`AC-4: the Bible declares ${OWN_JOURNEY} as a journey`, () => {
    expect(new RegExp(`<journey\\s+id="${OWN_JOURNEY}"`).test(sourceOf(BIBLE)), `${BIBLE} must declare ${OWN_JOURNEY} — the gate's roster is the law's, not a test's opinion`).toBe(true);
  });

  test(`AC-4: GATE_JOURNEYS in the tag breaker admits ${OWN_JOURNEY}, so a J-003 spec is not judged unreachable`, () => {
    const breaker = sourceOf(TAGS_BREAKER);
    const spelledOut = new RegExp(`["']${OWN_JOURNEY}["']`).test(breaker);
    const derivedFromTheBible = breaker.includes("cubit.bible.xml") && breaker.includes("<journey");
    expect(
      spelledOut || derivedFromTheBible,
      `${TAGS_BREAKER}'s GATE_JOURNEYS neither names ${OWN_JOURNEY} nor derives the roster from ${BIBLE}. This increment opens ${OWN_JOURNEY}, and B-20 puts the re-baseline of the acceptance the old roster froze on the branch that changes it — a roster that answers "unreachable" for a lawfully tagged spec reds \`pnpm verify\` for a fact about the file's age.`,
    ).toBe(true);
  });

  test("AC-4: every spec sitting in the journeys directory still carries a tag the roster admits", () => {
    // The breaker's own guarantee, re-asked here over the tree as it now stands: this increment
    // widens what the gate runs, and a widening that stranded an existing spec would be a defect of
    // this branch rather than of that spec.
    const directory = join(REPO_ROOT, "tests/e2e/journeys");
    expect(existsSync(directory) && statSync(directory).isDirectory(), "tests/e2e/journeys holds the tagged journey specs").toBe(true);
    const roster = [...sourceOf(BIBLE).matchAll(/<journey\s+id="(J-\d+)"/g)].map((match) => match[1] ?? "");
    expect(roster, `the roster read from ${BIBLE} must include ${OWN_JOURNEY}`).toContain(OWN_JOURNEY);

    for (const file of readdirSync(directory).filter((name) => name.endsWith(".spec.ts")).sort()) {
      const titles = titlesIn(`tests/e2e/journeys/${file}`);
      expect(
        titles.some((title) => roster.some((journey) => title.includes(journey))),
        `tests/e2e/journeys/${file} carries none of the journey tags the Bible declares (${roster.join(", ")}), so no gate invocation collects it`,
      ).toBe(true);
    }
  });
});
