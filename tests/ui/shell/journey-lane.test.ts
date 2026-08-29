/**
 * Public acceptance for AC-5's wiring — the half of "the gate's journey lines are green" that can
 * be judged without starting a browser, and the half that has bitten this tree before.
 *
 * The gate runs the journeys one invocation per journey and `scripts/e2e.mjs` turns `--journey X`
 * into Playwright's `--grep X` (tests/journeys/e2e-journey-tags-breaker.test.ts records the
 * settled reading). So `pnpm e2e --journey J-004` collecting anything at all is a fact about
 * titles, `toHaveScreenshot` resolving to a committed Linux baseline is a fact about
 * `snapshotPathTemplate` and the files beside it, and "J-000 stays green unchanged" is a fact
 * about what the new spec's titles do NOT say — plus the one merge hazard the standing lessons
 * name: a duplicate `webServer` key, which survives `git merge` and `pnpm verify` alike.
 *
 * The RUN itself — the journey walking the shell, axe clean at every checkpoint, the baselines
 * matching — is the gate's journeys stage, over the spec this increment delivers.
 *
 * This file lives under tests/ui/shell/** because that is the acceptance home the increment owns.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const SHELL_SPEC = "tests/e2e/shell.spec.ts";
const PLAYWRIGHT_CONFIG = "playwright.config.ts";
const BASELINE_DIR = "tests/e2e/baselines/design";
const CHECKPOINT_HELPER = "tests/e2e/support/checkpoint.ts";
const E2E_DIR = "tests/e2e";

/** The two spellings `playwright.config.ts`'s testMatch collects (guarded by its own test below). */
const SPEC_SUFFIXES = [".spec.ts", ".e2e.ts"] as const;

/** The journey this increment turns green, and the ones whose collection must not change. */
const OWN_JOURNEY = "J-004";
const OTHER_JOURNEYS = ["J-000", "J-001"] as const;

/** The checkpoints the Increment Spec names for J-004 — axe and a screenshot stand at each. */
const CHECKPOINTS = ["j004-shell-light", "j004-shell-dark", "j004-shell-onboarding", "j004-shell-deeplink"] as const;

/** V-E2E's comparison tolerance for the committed Linux baselines. */
const MAX_DIFF_PIXEL_RATIO = "0.002";

/** A `test(...)` or `test.describe(...)` title, as a spec file spells it. */
const TITLE = /\btest(?:\.describe)?(?:\.\w+)*\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;

function sourceOf(relative: string): string {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return readFileSync(absolute, "utf8");
}

function titlesIn(relative: string): string[] {
  return [...sourceOf(relative).matchAll(TITLE)].map((match) => match[2] ?? "");
}

/**
 * Every Playwright spec under `tests/e2e`, repo-relative, in either collected spelling.
 *
 * A scan, not a roster: which file carries a journey's tag is the tree's business, and a rename
 * that keeps the tag leaves the gate line collecting identically.
 */
function specsUnder(relative: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(REPO_ROOT, relative), { withFileTypes: true })) {
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) found.push(...specsUnder(child));
    else if (SPEC_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) found.push(child);
  }
  return found;
}

/**
 * Comment-stripped source: a promise made in a comment is not a promise the runner keeps.
 *
 * Scanned rather than regexed, because a glob is full of comment openers: `"**\/*.e2e.ts"` holds
 * both `/*` and `*\/`, and a regex stripper eats the journey lane's own testMatch alive.
 */
function code(relative: string): string {
  const source = sourceOf(relative);
  let stripped = "";
  let quote: string | null = null;
  let at = 0;
  while (at < source.length) {
    const here = source[at] ?? "";
    const next = source[at + 1] ?? "";
    if (quote !== null) {
      stripped += here;
      at += here === "\\" ? 2 : 1;
      if (here === "\\") stripped += next;
      else if (here === quote) quote = null;
      continue;
    }
    if (here === '"' || here === "'" || here === "`") {
      quote = here;
      stripped += here;
      at += 1;
      continue;
    }
    if (here === "/" && next === "/") {
      while (at < source.length && source[at] !== "\n") at += 1;
      continue;
    }
    if (here === "/" && next === "*") {
      at += 2;
      while (at < source.length && !(source[at] === "*" && source[at + 1] === "/")) at += 1;
      at += 2;
      continue;
    }
    stripped += here;
    at += 1;
  }
  return stripped;
}

describe("AC-5: the shell journey is collected by the gate line that runs it", () => {
  test("AC-5: tests/e2e/shell.spec.ts carries J-004 in its titles", () => {
    const titles = titlesIn(SHELL_SPEC);
    expect(titles.length, `no test or describe title could be read out of ${SHELL_SPEC}`).toBeGreaterThan(0);
    expect(
      titles.filter((title) => title.includes(OWN_JOURNEY)).length,
      `\`pnpm e2e --journey ${OWN_JOURNEY}\` is a \`--grep ${OWN_JOURNEY}\`: without the tag in a title the gate line collects nothing and exits 1. Titles are: ${JSON.stringify(titles)}`,
    ).toBeGreaterThan(0);
  });

  test("AC-5: it claims no other journey's tag, so J-000 and J-001 still collect exactly what they collected", () => {
    for (const title of titlesIn(SHELL_SPEC)) {
      for (const journey of OTHER_JOURNEYS) {
        expect(title.includes(journey), `${SHELL_SPEC} titles must not carry ${journey}: \`pnpm e2e --journey ${journey}\` would then walk the shell too, which is not "unchanged" (AC-5). Title: ${JSON.stringify(title)}`).toBe(false);
      }
    }
  });

  /**
   * `--journey J-000` is a `--grep J-000` over whatever the config's globs collect, so "stays green
   * unchanged" is a claim about titles surviving somewhere, never about which file holds them: a
   * rename or a consolidation that keeps the tag leaves the gate line collecting identically. What
   * this increment must not do is leave J-000 with nothing to grep (an unmatched grep exits 1) — or
   * hand J-000 the shell, which is what the paired assertion below refuses.
   */
  test("AC-5: J-000 still has journeys of its own to collect, and the shell is not one of them", () => {
    const journey = OTHER_JOURNEYS[0];
    const collected = specsUnder(E2E_DIR);
    expect(collected.length, `${E2E_DIR} holds no Playwright spec in either collected spelling — the journey lane collects nothing at all`).toBeGreaterThan(0);
    const tagged = collected.filter((file) => titlesIn(file).some((title) => title.includes(journey)));
    expect(
      tagged.length,
      `no spec under ${E2E_DIR} carries ${journey} in a title any more, so \`pnpm e2e --journey ${journey}\` greps nothing and exits 1; those journeys stay exactly as they are (out of scope). Scanned: ${JSON.stringify(collected)}`,
    ).toBeGreaterThan(0);
    expect(tagged.includes(SHELL_SPEC), `${SHELL_SPEC} is this increment's journey; carrying ${journey} would make \`--journey ${journey}\` walk the shell, which is not "unchanged" (AC-5)`).toBe(false);
  });

  test("AC-5: the journey lane still collects both spellings, from one webServer", () => {
    const config = code(PLAYWRIGHT_CONFIG);
    const testMatch = /testMatch\s*:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? "";
    expect(testMatch.includes("*.spec.ts"), `playwright.config.ts must keep collecting *.spec.ts — ${SHELL_SPEC} is collected by nothing otherwise (V-E2E)`).toBe(true);
    expect(testMatch.includes("*.e2e.ts"), "…and *.e2e.ts, which is how J-000's golden path is spelled").toBe(true);
    // A merge can leave two `webServer` keys behind; the later one silently wins, dropping the env
    // the journeys' database is named in (standing lesson, 2026-08-27).
    expect((config.match(/^\s*webServer\s*:/gm) ?? []).length, "playwright.config.ts declares exactly one webServer").toBe(1);
  });
});

describe("AC-5: the shell's visual baselines are committed and compared as V-E2E requires", () => {
  test("AC-5: playwright.config.ts routes screenshots to tests/e2e/baselines", () => {
    const config = code(PLAYWRIGHT_CONFIG);
    const template = /snapshotPathTemplate\s*:\s*(["'`])((?:\\.|(?!\1).)*)\1/.exec(config)?.[2] ?? "";
    expect(template.length, "playwright.config.ts must add a snapshotPathTemplate — it is what makes toHaveScreenshot resolve under tests/e2e/baselines/ (interfaces)").toBeGreaterThan(0);
    expect(template.includes("baselines"), `the template must route baselines under tests/e2e/baselines/ — it reads ${JSON.stringify(template)}`).toBe(true);
  });

  test("AC-5: a light and a dark shell baseline are committed for Linux", () => {
    const directory = join(REPO_ROOT, BASELINE_DIR);
    expect(existsSync(directory), `${BASELINE_DIR} must hold the committed Linux baselines the journey compares against (AC-5)`).toBe(true);
    const images = readdirSync(directory).filter((name) => name.toLowerCase().endsWith(".png"));
    for (const theme of ["light", "dark"]) {
      const forTheme = images.filter((name) => name.startsWith("shell-") && name.toLowerCase().includes(theme));
      expect(forTheme.length, `${BASELINE_DIR} must hold a committed shell-*${theme}*.png baseline (the ${theme} checkpoint) — it holds ${JSON.stringify(images)}`).toBeGreaterThan(0);
      for (const image of forTheme) {
        expect(statSync(join(directory, image)).size, `${BASELINE_DIR}/${image} is empty — an empty baseline compares against nothing`).toBeGreaterThan(0);
      }
    }
  });

  test("AC-5: the shell is compared with toHaveScreenshot at maxDiffPixelRatio 0.002", () => {
    const spec = code(SHELL_SPEC);
    const config = code(PLAYWRIGHT_CONFIG);
    expect((spec.match(/toHaveScreenshot\s*\(/g) ?? []).length, "the light and the dark checkpoint each compare a visual baseline (V-E2E)").toBeGreaterThanOrEqual(2);
    const tolerance = new RegExp(`maxDiffPixelRatio\\s*:\\s*${MAX_DIFF_PIXEL_RATIO.replace(".", "\\.")}\\b`);
    expect(tolerance.test(spec) || tolerance.test(config), `V-E2E fixes the comparison at maxDiffPixelRatio ${MAX_DIFF_PIXEL_RATIO}; neither ${SHELL_SPEC} nor ${PLAYWRIGHT_CONFIG} states it`).toBe(true);
  });
});

describe("AC-5: axe stands at every named checkpoint, at the impacts Q-11 blocks on", () => {
  test("AC-5: the spec stands at all four J-004 checkpoints", () => {
    const spec = code(SHELL_SPEC);
    for (const checkpoint of CHECKPOINTS) {
      expect(spec.includes(checkpoint), `the Increment Spec names ${checkpoint} as a J-004 checkpoint; ${SHELL_SPEC} must stand at it`).toBe(true);
    }
  });

  test("AC-5: it judges them with the shared checkpoint helper, never with an axe filter of its own", () => {
    const spec = code(SHELL_SPEC);
    expect(/from\s+["'][^"']*support\/checkpoint["']/.test(spec), `${SHELL_SPEC} must run its checkpoints through ${CHECKPOINT_HELPER} — the one place the blocking impacts are defined (Q-11)`).toBe(true);
    expect(/from\s+["']axe-core["']/.test(spec), `${SHELL_SPEC} must not run axe itself: "a helper or journey that gates on any-impact has widened the law without a signature and is itself the defect" (Q-11)`).toBe(false);

    // …and the helper still blocks on exactly serious and critical, neither widened nor narrowed.
    const helper = code(CHECKPOINT_HELPER);
    expect(helper.includes("serious") && helper.includes("critical"), `${CHECKPOINT_HELPER} blocks on serious and critical impacts (Q-11)`).toBe(true);
  });
});
