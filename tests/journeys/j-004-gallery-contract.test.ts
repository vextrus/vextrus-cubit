/**
 * AC-3 and AC-4 — J-004 is a real journey, and its visual baselines bind (J-004, Q-06, Q-11).
 *
 * A journey and its baselines are Playwright's to execute; the gate runs `pnpm e2e --journey J-004`
 * and `pnpm e2e --journey J-000` itself, one invocation per journey. What a vitest suite can add —
 * and what an exit code alone can never catch — is that the journey the gate runs is the journey
 * the law asked for: collected by the config's grep, driving both themes, gating axe at serious and
 * critical rather than at nothing or at everything, and comparing against two committed baselines
 * that actually differ. A widened axe filter, a snapshot template that routed the captures
 * somewhere else, or two byte-identical baselines all exit 0 in the journey lane and are all
 * defects, so they are judged here.
 *
 * Nothing below transcribes the spec's prose: each assertion is a property the contract fixes,
 * read off whatever the increment ships.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { stripComments } from "../ui/s-design/support/gallery-contract";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SPEC = "tests/e2e/journeys/j-004-gallery.spec.ts";
const CONFIG = "playwright.config.ts";
const BASELINES = ["tests/e2e/baselines/design/gallery-shell-light.png", "tests/e2e/baselines/design/gallery-shell-dark.png"];
const SNAPSHOT_TEMPLATE = "tests/e2e/baselines/{arg}{ext}";

/** The journeys J-000 still owns after this increment — the files the gate's other invocation walks. */
const J000_SPECS = ["tests/e2e/j-000-golden-path.e2e.ts", "tests/e2e/journeys/j-000-smoke.spec.ts"];

/** The impacts Q-11 gates on — never widened to any impact, never narrowed away. */
const BLOCKING_IMPACTS = ["critical", "serious"];

/** The impacts Q-11 does NOT gate on; a roster that swept them in has widened the law. */
const NON_BLOCKING_IMPACTS = ["minor", "moderate"];

/** The four test ids the closed contract fixes, and the route the journey walks. */
const TESTIDS = ["gallery-shell", "gallery-barrel", "gallery-entry", "gallery-state"];
const ROUTE = "/design";

function readIfPresent(file: string): string | null {
  const path = join(REPO_ROOT, file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function readCode(file: string): string {
  const source = readIfPresent(file);
  expect(source, `${file} is missing — the increment owes it`).not.toBeNull();
  return stripComments(source ?? "");
}

/** Every `test(...)` / `test.describe(...)` title, as the file spells it. */
function titlesIn(code: string): string[] {
  return [...code.matchAll(/\btest(?:\.describe)?(?:\.\w+)*\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2] ?? "");
}

/** Every array-of-strings literal in a file, as its member strings. */
function stringArrays(code: string): string[][] {
  const arrays: string[][] = [];
  for (const match of code.matchAll(/\[\s*((?:(["'])(?:\\.|(?!\2).)*\2\s*,?\s*)+)\]/g)) {
    const body = match[1] ?? "";
    arrays.push([...body.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)].map((item) => item[2] ?? ""));
  }
  return arrays;
}

/** The value of a single-line `key: "…"` property, or null. */
function stringProperty(code: string, key: string): string | null {
  const match = new RegExp(`\\b${key}\\s*:\\s*(["'\`])((?:\\\\.|(?!\\1).)*)\\1`).exec(code);
  return match === null ? null : (match[2] ?? null);
}

function occurrences(code: string, key: string): number {
  return [...code.matchAll(new RegExp(`\\b${key}\\s*:`, "g"))].length;
}

/** A Playwright testMatch glob as a regex over the path relative to testDir. */
function globToRegExp(glob: string): RegExp {
  let pattern = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index] ?? "";
    if (char === "*" && glob[index + 1] === "*") {
      const slash = glob[index + 2] === "/";
      pattern += slash ? "(?:.*/)?" : ".*";
      index += slash ? 2 : 1;
      continue;
    }
    if (char === "*") pattern += "[^/]*";
    else if (char === "?") pattern += "[^/]";
    else pattern += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${pattern}$`);
}

function collectsSpec(configCode: string, specPath: string): boolean {
  const testDir = stringProperty(configCode, "testDir") ?? "tests/e2e";
  const relative = specPath.startsWith(`${testDir}/`) ? specPath.slice(testDir.length + 1) : specPath;
  const matchArrays = [...configCode.matchAll(/\btestMatch\s*:\s*(\[[\s\S]*?\])/g)].flatMap((match) => stringArrays(match[1] ?? ""));
  return matchArrays.flat().some((glob) => globToRegExp(glob).test(relative));
}

describe("AC-3 — the gate collects J-004, and J-004 drives /design in both themes", () => {
  test("AC-3: the spec exists and carries a title the --journey J-004 grep collects", () => {
    const code = readCode(SPEC);
    const titles = titlesIn(code);
    expect(titles.length, `no test or describe title could be read out of ${SPEC}`).toBeGreaterThan(0);
    expect(
      titles.filter((title) => title.includes("J-004")).length,
      `\`pnpm e2e --journey J-004\` becomes Playwright's \`--grep J-004\`, so an untagged spec is run by nothing. Titles: ${JSON.stringify(titles)}`,
    ).toBeGreaterThan(0);
  });

  test("AC-3: playwright.config.ts still collects J-004 and both J-000 spellings", () => {
    const configCode = readCode(CONFIG);
    for (const spec of [SPEC, ...J000_SPECS]) {
      expect(collectsSpec(configCode, spec), `${spec} is matched by a testMatch entry — a spec the config does not collect is green by omission`).toBe(true);
    }
  });

  test("AC-3: J-000's specs are still in the tree and still carry their tag", () => {
    for (const spec of J000_SPECS) {
      const code = readCode(spec);
      expect(
        titlesIn(code).filter((title) => title.includes("J-000")).length,
        `${spec} still carries its J-000 tag — this increment adds a route and changes nothing J-000 walks`,
      ).toBeGreaterThan(0);
    }
  });

  test("AC-3: the journey drives /design and both document themes", () => {
    const code = readCode(SPEC);
    expect(code, `the journey walks ${ROUTE}`).toContain(ROUTE);
    expect(code, "the dark pass is driven by prefers-color-scheme emulation, not by a click on a theme control").toContain("emulateMedia");
    expect(/\bcolorScheme\b/.test(code), "the lever is colorScheme, so the machine's own theme is never consulted").toBe(true);
    expect(/\breload\s*\(/.test(code), "the emulated pass reloads so the document's resolver runs again").toBe(true);
    expect(code, "the theme is read off html[data-theme], not inferred from the emulation that was asked for").toContain("data-theme");
    for (const theme of ["light", "dark"]) {
      expect(
        code.includes(`"${theme}"`) || code.includes(`'${theme}'`) || code.includes(`\`${theme}\``),
        `the journey names the ${theme} theme it asserts html[data-theme] carries`,
      ).toBe(true);
    }
  });

  test("AC-3: the journey asserts every barrel is populated and every entry holds states", () => {
    const code = readCode(SPEC);
    for (const testid of TESTIDS) {
      expect(code, `the journey drives the ${testid} hook the Design Decision fixes`).toContain(testid);
    }
  });
});

describe("AC-3 — axe runs from the checkout, and gates exactly at serious and critical (Q-11)", () => {
  test("AC-3: axe is injected from the checkout's own axe-core, and the journey adds no package", () => {
    const code = readCode(SPEC);
    expect(code, "axe comes from the copy already installed, resolved through createRequire").toContain("createRequire");
    expect(code, "the resolved file is axe-core's built bundle").toContain("axe-core/axe.min.js");
    expect(/readFileSync\s*\(/.test(code), "the bundle is read off disk and added as an init script").toBe(true);

    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})]);
    const specifiers = [...code.matchAll(/\bfrom\s*(["'])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2] ?? "");
    const resolved = [...code.matchAll(/\.resolve\s*\(\s*(["'])((?:\\.|(?!\1).)*)\1/g)].map((match) => match[2] ?? "");
    for (const specifier of [...specifiers, ...resolved]) {
      if (specifier.startsWith(".") || specifier.startsWith("node:")) continue;
      const parts = specifier.split("/");
      const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? "");
      expect(declared.has(name), `${specifier} resolves to "${name}", which package.json must already declare — the journey adds no package`).toBe(true);
    }
  });

  test("AC-3: the impacts gated on are exactly serious and critical, never widened", () => {
    const code = readCode(SPEC);
    const spells = (word: string): boolean => code.includes(`"${word}"`) || code.includes(`'${word}'`) || code.includes(`\`${word}\``);

    for (const impact of BLOCKING_IMPACTS) {
      expect(spells(impact), `the journey names ${impact} as an impact it blocks on (Q-11)`).toBe(true);
    }
    for (const widened of NON_BLOCKING_IMPACTS) {
      expect(spells(widened), `gating on ${widened} widens Q-11's law without a signature, and the helper that does it is itself the defect`).toBe(false);
    }
    // However the roster is spelled — an array as tests/e2e/j-000-golden-path.e2e.ts spells it, or a
    // comparison — an array that names one blocking impact names both and nothing else.
    for (const roster of stringArrays(code).filter((array) => array.some((item) => BLOCKING_IMPACTS.includes(item)))) {
      expect([...roster].sort(), "the blocking-impact roster is serious and critical — no more, no fewer (Q-11)").toEqual(BLOCKING_IMPACTS);
    }
  });

  test("AC-3: the violations counted are the ones impact selected, and the count asserted is zero", () => {
    const code = readCode(SPEC);
    expect(code, "impact is what selects the violations that block — not their bare number").toContain("impact");
    expect(code, "the axe result's violations are what is read").toContain("violations");
    expect(
      // Either idiom binds the same law: a count compared to zero, or the selected violations
      // compared to the empty array as tests/e2e/j-000-golden-path.e2e.ts does.
      /(?:toHaveLength|toBe|toEqual|toStrictEqual)\s*\(\s*(?:0|\[\s*\])\s*\)/.test(code),
      "the selected violations are asserted to number exactly 0, in both themes",
    ).toBe(true);
  });
});

describe("AC-4 — the shell captures are routed, committed, and actually differ (Q-06)", () => {
  test("AC-4: the spec captures the gallery-shell region with animations disabled", () => {
    const code = readCode(SPEC);
    expect(/toHaveScreenshot\s*\(/.test(code), "the shell region is captured with toHaveScreenshot").toBe(true);
    expect(/animations\s*:\s*(["'`])disabled\1/.test(code), "captures run with animations disabled so they are deterministic").toBe(true);
    expect(code, "the capture is the gallery-shell locator, not the whole page").toContain("gallery-shell");
  });

  test("AC-4: playwright.config.ts gains snapshotPathTemplate and nothing else doubles", () => {
    const configCode = readCode(CONFIG);
    expect(occurrences(configCode, "snapshotPathTemplate"), "exactly one snapshotPathTemplate key").toBe(1);
    expect(stringProperty(configCode, "snapshotPathTemplate"), "the template routes captures under tests/e2e/baselines, platform-suffix-free").toBe(SNAPSHOT_TEMPLATE);
    expect(
      occurrences(configCode, "webServer"),
      "exactly one webServer key — a merge has left this config with two before, and the later one silently wins",
    ).toBe(1);
  });

  test("AC-4: both baselines are committed PNGs and are not byte-identical", () => {
    const bytes = BASELINES.map((file) => {
      const path = join(REPO_ROOT, file);
      expect(existsSync(path), `${file} is committed — Q-06 has nothing to compare against without it`).toBe(true);
      expect(statSync(path).size, `${file} is not empty`).toBeGreaterThan(0);
      const buffer = readFileSync(path);
      expect(buffer.subarray(1, 4).toString("latin1"), `${file} is a PNG`).toBe("PNG");
      return buffer;
    });
    const [light, dark] = bytes;
    expect(
      light !== undefined && dark !== undefined && light.equals(dark),
      "the two baselines differ: the theme flips token values, so a dark capture identical to the light one means the emulation never reached the page",
    ).toBe(false);
  });
});
