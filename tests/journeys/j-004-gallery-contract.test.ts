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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { stripComments } from "../ui/s-design/support/gallery-contract";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SPEC = "tests/e2e/journeys/j-004-gallery.spec.ts";
/** The journey's own page object — where its locators and helpers may live (test contract). */
const PAGE_OBJECT = "tests/e2e/pages/s-design.page.ts";
const CONFIG = "playwright.config.ts";
const BASELINES = ["tests/e2e/baselines/design/gallery-shell-light.png", "tests/e2e/baselines/design/gallery-shell-dark.png"];

/**
 * The tag the gate's other invocation greps for. Which FILES carry it is J-000's own surface to
 * arrange — a rename, a split or a consolidation there is lawful — so this suite names the tag and
 * derives the files, never the other way round (B-19).
 */
const OTHER_JOURNEY = "J-000";

/** The impacts Q-11 gates on — never widened to any impact, never narrowed away. */
const BLOCKING_IMPACTS = ["critical", "serious"];

/**
 * The impacts Q-11 does NOT gate on. Q-11 binds the GATE, never the vocabulary: these words are
 * read only where the axe result is compared or tested for membership, so a failure message, an
 * aria-label or a data attribute that happens to say "moderate" is nobody's defect.
 */
const NON_BLOCKING_IMPACTS = ["minor", "moderate"];

/** axe-core's own closed impact vocabulary — the only words the gate scan below reads. */
const AXE_IMPACTS = [...BLOCKING_IMPACTS, ...NON_BLOCKING_IMPACTS];

/** The four test ids the closed contract fixes, and the route the journey walks. */
const SHELL_TESTID = "gallery-shell";
const TESTIDS = [SHELL_TESTID, "gallery-barrel", "gallery-entry", "gallery-state"];
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

/* ------------------------------------------------------------------ reading what the spec binds */

/**
 * The journey's own sources: the spec, and the page object it is allowed to keep its locators and
 * helpers in. A helper that lives one file over is still the journey's, so both are read as one
 * body of code — otherwise a spec that delegates would be judged as a spec that does nothing.
 */
function journeySource(): string {
  const pageObject = readIfPresent(PAGE_OBJECT);
  return `${readCode(SPEC)}\n${pageObject === null ? "" : stripComments(pageObject)}`;
}

/** The text between a bracket opened just before `start` and its match, strings honoured. */
function balancedFrom(code: string, start: number): string {
  let depth = 1;
  let quote: string | null = null;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index] ?? "";
    if (quote !== null) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(start, index);
    }
  }
  return code.slice(start);
}

/**
 * The file's statements: split at every `;` and newline that stands outside all brackets and
 * strings, so a declaration keeps its whole initialiser — the `page.evaluate(async () => { … })`
 * that runs axe stays one statement with the name it was bound to.
 */
function statementsOf(code: string): string[] {
  const statements: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < code.length; index += 1) {
    const char = code[index] ?? "";
    current += char;
    if (quote !== null) {
      if (char === "\\") {
        current += code[index + 1] ?? "";
        index += 1;
      } else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (char === ";" || char === "\n")) {
      statements.push(current);
      current = "";
    }
  }
  statements.push(current);
  return statements.filter((statement) => statement.trim() !== "");
}

/** Every name a statement binds — declarations, destructurings, functions, class members. */
function declaredNames(statement: string): string[] {
  const names: string[] = [];
  for (const match of statement.matchAll(/\bfunction\s+(\w+)/g)) names.push(match[1] ?? "");
  for (const match of statement.matchAll(/\b(?:const|let|var)\s+(\w+)/g)) names.push(match[1] ?? "");
  for (const match of statement.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const bound = (part.split(":").pop() ?? "").trim();
      if (/^\w+$/.test(bound)) names.push(bound);
    }
  }
  for (const match of statement.matchAll(/\bget\s+(\w+)\s*\(/g)) names.push(match[1] ?? "");
  for (const match of statement.matchAll(/(\w+)\s*=[^=]/g)) names.push(match[1] ?? "");
  return names.filter((name) => name !== "");
}

function mentions(text: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(text);
}

/**
 * The names whose value flows from an axe run inside the page. The seed is the statement that runs
 * axe in the browser — `evaluate` around a `.run(` on axe — and taint spreads to anything declared
 * from a statement that reads a tainted name, so `blockingViolations` → `violations` → the array an
 * assertion counts is one traceable chain (the shape tests/e2e/j-000-golden-path.e2e.ts already
 * uses). A hardcoded empty array is bound to nothing and never joins the set.
 */
function axeResultNames(code: string): { runsInPage: boolean; tainted: Set<string> } {
  const statements = statementsOf(code);
  const tainted = new Set<string>();
  let runsInPage = false;

  for (const statement of statements) {
    if (!/\bevaluate\s*\(/.test(statement)) continue;
    if (!/\.\s*run\s*\(/.test(statement)) continue;
    if (!/\baxe\b/i.test(statement)) continue;
    runsInPage = true;
    for (const name of declaredNames(statement)) tainted.add(name);
  }

  for (let pass = 0; pass < 8; pass += 1) {
    const before = tainted.size;
    for (const statement of statements) {
      if (![...tainted].some((name) => mentions(statement, name))) continue;
      for (const name of declaredNames(statement)) tainted.add(name);
    }
    if (tainted.size === before) break;
  }
  return { runsInPage, tainted };
}

/**
 * The statements the axe result flows through: the run itself, and everything that reads a value
 * derived from it. This is the surface Q-11 binds — whatever these statements select violations by
 * is what decides which impacts block — and it is the only surface the impact scan below reads.
 */
function gatingStatements(code: string): string[] {
  const { tainted } = axeResultNames(code);
  return statementsOf(code).filter(
    (statement) =>
      (/\bevaluate\s*\(/.test(statement) && /\.\s*run\s*\(/.test(statement) && /\baxe\b/i.test(statement)) ||
      [...tainted].some((name) => mentions(statement, name)),
  );
}

/**
 * The impacts a statement names in a *gating* position — compared against something called impact,
 * or handed to a membership test. A roster spelled as an array is judged by the roster loop below;
 * this catches the bespoke filter that never spells one (`v.impact !== "minor"`, `set.has("moderate")`).
 */
function widenedImpactsIn(statement: string): string[] {
  const positions = [
    // an impact compared against a literal, either way round
    /[\w$.]*[Ii]mpact\b\s*(?:===?|!==?)\s*(["'`])([^"'`]*)\1/g,
    /(["'`])([^"'`]*)\1\s*(?:===?|!==?)\s*[\w$.]*[Ii]mpact\b/g,
    // a literal handed to a membership test…
    /\.\s*(?:includes|has|indexOf|lastIndexOf)\s*\(\s*(["'`])([^"'`]*)\1/g,
    // …or a literal, or the tail of a roster of them, that IS the membership test's receiver
    /(["'`])([^"'`]*)\1\s*\]?\s*\.\s*(?:includes|has|indexOf|lastIndexOf)\s*\(/g,
  ];
  const found: string[] = [];
  for (const pattern of positions) {
    for (const match of statement.matchAll(pattern)) {
      const word = match[2] ?? "";
      if (AXE_IMPACTS.includes(word) && !BLOCKING_IMPACTS.includes(word)) found.push(word);
    }
  }
  return found;
}

/** Every `expect(<subject>)` whose matcher is one of `matchers`, with the subject and the arguments. */
function expectations(code: string, matchers: string[]): { subject: string; args: string }[] {
  const found: { subject: string; args: string }[] = [];
  const matcher = new RegExp(`^\\s*(?:\\.(?!not\\b)\\w+\\s*)*\\.\\s*(?:${matchers.join("|")})\\s*\\(`);
  for (const match of code.matchAll(/\bexpect\s*\(/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const subject = balancedFrom(code, start);
    const after = code.slice(start + subject.length + 1);
    const tail = matcher.exec(after);
    if (tail === null) continue;
    found.push({ subject, args: balancedFrom(after, tail[0].length) });
  }
  return found;
}

/** The names that hold a `gallery-shell` locator — the region AC-4 says the capture must be of. */
function shellLocatorNames(code: string): Set<string> {
  const names = new Set<string>();
  // The id must be inside the locator call itself: a `gallery-shell` that is only the name of a
  // screenshot file says nothing about what the capture was taken of.
  const locatesShell = new RegExp(`\\b(?:getByTestId|locator)\\s*\\(\\s*[^)]{0,60}${SHELL_TESTID}`);
  for (const statement of statementsOf(code)) {
    if (!locatesShell.test(statement)) continue;
    for (const name of declaredNames(statement)) names.add(name);
  }
  return names;
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

function testDirOf(configCode: string): string {
  return stringProperty(configCode, "testDir") ?? "tests/e2e";
}

function testMatchGlobs(configCode: string): string[] {
  return [...configCode.matchAll(/\btestMatch\s*:\s*(\[[\s\S]*?\])/g)].flatMap((match) => stringArrays(match[1] ?? "")).flat();
}

function collectsSpec(configCode: string, specPath: string): boolean {
  const testDir = testDirOf(configCode);
  const relative = specPath.startsWith(`${testDir}/`) ? specPath.slice(testDir.length + 1) : specPath;
  return testMatchGlobs(configCode).some((glob) => globToRegExp(glob).test(relative));
}

/**
 * Every spec file the config collects, as repo-relative paths: the tree under `testDir`, walked,
 * filtered by the config's own `testMatch` globs. A config `grep` would not narrow this — the gate
 * invokes `--grep <journey>` on the command line, and Playwright's CLI grep replaces the config's —
 * so which of these files a given invocation runs is decided by their titles alone, below.
 */
function collectedSpecs(configCode: string): string[] {
  const testDir = testDirOf(configCode);
  const globs = testMatchGlobs(configCode);
  const root = join(REPO_ROOT, testDir);
  const found: string[] = [];
  const walk = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(join(directory, entry.name), relative);
      else if (globs.some((glob) => globToRegExp(glob).test(relative))) found.push(`${testDir}/${relative}`);
    }
  };
  if (existsSync(root)) walk(root, "");
  return found.sort();
}

/** The collected specs whose own titles mark them as a journey's — what `--grep <journey>` runs. */
function specsTagged(configCode: string, journey: string): string[] {
  return collectedSpecs(configCode).filter((spec) =>
    titlesIn(stripComments(readFileSync(join(REPO_ROOT, spec), "utf8"))).some((title) => title.includes(journey)),
  );
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

  test("AC-3: playwright.config.ts collects the J-004 spec", () => {
    const configCode = readCode(CONFIG);
    expect(
      collectsSpec(configCode, SPEC),
      `${SPEC} is matched by a testMatch entry — a spec the config does not collect is green by omission`,
    ).toBe(true);
  });

  test("AC-3: the gate's other invocation still walks a collected, J-000-tagged surface", () => {
    const configCode = readCode(CONFIG);
    // Which files J-000 is written in is J-000's own business — this increment adds a route and
    // changes nothing it walks. What must hold is that `pnpm e2e --journey J-000` still finds
    // something: at least one collected spec whose titles carry the tag the grep looks for.
    const otherJourney = specsTagged(configCode, OTHER_JOURNEY);
    expect(
      otherJourney.length,
      `\`pnpm e2e --journey ${OTHER_JOURNEY}\` becomes \`--grep ${OTHER_JOURNEY}\`, and an unmatched grep exits 1: after this increment at least one spec the config collects must still carry that tag. Collected specs: ${JSON.stringify(collectedSpecs(configCode))}`,
    ).toBeGreaterThan(0);
    // …and it is a surface of its own: this increment's spec answers to J-004, never to the grep
    // that runs the other journey.
    expect(
      otherJourney.includes(SPEC),
      `${SPEC} is J-004's spec — carrying ${OTHER_JOURNEY} in a title would smuggle it into the other invocation`,
    ).toBe(false);
  });

  test("AC-3: the journey drives /design and both document themes", () => {
    const code = journeySource();
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
    const code = journeySource();
    for (const testid of TESTIDS) {
      expect(code, `the journey drives the ${testid} hook the Design Decision fixes`).toContain(testid);
    }
  });
});

describe("AC-3 — axe runs from the checkout, and gates exactly at serious and critical (Q-11)", () => {
  test("AC-3: axe is injected from the checkout's own axe-core, and the journey adds no package", () => {
    const code = journeySource();
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
    const code = journeySource();
    const spells = (word: string): boolean => code.includes(`"${word}"`) || code.includes(`'${word}'`) || code.includes(`\`${word}\``);

    for (const impact of BLOCKING_IMPACTS) {
      expect(spells(impact), `the journey names ${impact} as an impact it blocks on (Q-11)`).toBe(true);
    }
    // However the roster is spelled — an array as tests/e2e/j-000-golden-path.e2e.ts spells it, or a
    // comparison — an array that names one blocking impact names both and nothing else.
    for (const roster of stringArrays(code).filter((array) => array.some((item) => BLOCKING_IMPACTS.includes(item)))) {
      expect([...roster].sort(), "the blocking-impact roster is serious and critical — no more, no fewer (Q-11)").toEqual(BLOCKING_IMPACTS);
    }
    // …and the gate that spells no roster at all is judged where it lives: inside the statements the
    // axe result flows through, an impact named in a comparison or a membership test is one the
    // journey blocks on, and Q-11 admits exactly two of them.
    const gating = gatingStatements(code);
    expect(gating.length, "the axe result reaches statements this scan can read — otherwise it grades nothing").toBeGreaterThan(0);
    const widened = gating.flatMap((statement) =>
      widenedImpactsIn(statement).map((impact) => `${impact} — in: ${statement.trim().slice(0, 90)}`),
    );
    expect(
      widened,
      `these statements select the violations the journey counts, and gating on an impact beyond ${BLOCKING_IMPACTS.join(" and ")} widens Q-11's law without a signature — the helper that does it is itself the defect`,
    ).toEqual([]);
  });

  test("AC-3: the zero asserted is axe's own answer, running inside the page", () => {
    const code = journeySource();
    expect(code, "impact is what selects the violations that block — not their bare number").toContain("impact");
    expect(code, "the axe result's violations are what is read").toContain("violations");

    const { runsInPage, tainted } = axeResultNames(code);
    expect(
      runsInPage,
      `the journey must RUN axe in the browser — a page.evaluate whose body calls axe's own run(), as tests/e2e/j-000-golden-path.e2e.ts does. Injecting the bundle and never running it leaves Q-11 unenforced, and the run exits 0 either way`,
    ).toBe(true);

    // Either idiom binds the same law: a count compared to zero, or the selected violations
    // compared to the empty array as tests/e2e/j-000-golden-path.e2e.ts does — but the value
    // compared must be the one axe answered, traced through whatever filtered it.
    const zeroes = expectations(code, ["toHaveLength", "toBe", "toEqual", "toStrictEqual"]).filter((expectation) =>
      /^\s*(?:0|\[\s*\])\s*$/.test(expectation.args.split(",")[0] ?? ""),
    );
    expect(zeroes.length, "the journey asserts a count of exactly 0 somewhere").toBeGreaterThan(0);

    const bound = zeroes.filter((expectation) => [...tainted].some((name) => mentions(expectation.subject, name)));
    expect(
      bound.length,
      `the "= 0" that gates the journey must be axe's own result — a value declared from the run and narrowed by impact. None of the zero assertions read one: ${JSON.stringify(zeroes.map((expectation) => expectation.subject.trim().slice(0, 60)))}, while the values that flow from axe are ${JSON.stringify([...tainted])}`,
    ).toBeGreaterThan(0);

    // …and the narrowing that produced it is the impact filter, not a slice of something else.
    const narrowedByImpact = bound.some((expectation) =>
      statementsOf(code).some(
        (statement) =>
          statement.includes("impact") &&
          declaredNames(statement).some((name) => mentions(expectation.subject, name) && tainted.has(name)),
      ) || expectation.subject.includes("impact"),
    );
    expect(narrowedByImpact, "the violations counted are the ones impact selected (Q-11: serious and critical, never any-impact)").toBe(true);
  });
});

/* --------------------------------------------- routing a capture to the file it is compared with */

/**
 * A stand-in for a value the spec interpolates into a capture name at run time — `${theme}` in
 * `gallery-shell-${theme}.png`. One name spelled once stands for one file per theme, so the routing
 * below is read as a pattern rather than as a single path.
 */
const INTERPOLATED = String.fromCharCode(0);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The top-level comma-separated pieces of an argument list, strings and brackets honoured. */
function topLevelArgs(args: string): string[] {
  const pieces: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index] ?? "";
    if (quote !== null) {
      current += char;
      if (char === "\\") {
        current += args[index + 1] ?? "";
        index += 1;
      } else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) {
      pieces.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  pieces.push(current);
  return pieces.map((piece) => piece.trim()).filter((piece) => piece !== "");
}

/** A quoted or template string as a path segment, each `${…}` standing in as INTERPOLATED. */
function literalSegment(piece: string): string | null {
  const quote = piece[0] ?? "";
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  if (piece.length < 2 || piece[piece.length - 1] !== quote) return null;
  const body = piece.slice(1, -1);
  return quote === "`" ? body.replace(/\$\{[^}]*\}/g, INTERPOLATED) : body;
}

/** What a bare identifier was declared as, so a name lifted into a constant still resolves. */
function boundTo(code: string, identifier: string): string | null {
  const match = new RegExp(`\\b(?:const|let|var)\\s+${identifier}\\s*=\\s*([^;\\n]+)`).exec(code);
  return match === null ? null : (match[1] ?? "").trim().replace(/,$/, "");
}

/**
 * The `{arg}` path segments a `toHaveScreenshot` call names, or null when the name is not spelled
 * where the capture is made. Playwright joins an array of segments with "/" and sanitises the
 * separators out of a single string, so both spellings are read here as the segments they become.
 */
function captureSegments(code: string, args: string): string[] | null {
  let first = topLevelArgs(args)[0] ?? "";
  if (/^[A-Za-z_$][\w$]*$/.test(first)) first = boundTo(code, first) ?? first;
  const pieces = first.startsWith("[") ? topLevelArgs(first.slice(1, -1)) : [first];
  const segments: string[] = [];
  for (const piece of pieces) {
    const segment = literalSegment(piece);
    if (segment === null) return null;
    segments.push(segment);
  }
  return segments.length === 0 ? null : segments;
}

/**
 * Where Playwright writes that capture: the config's own template with `{arg}` (the name without
 * its extension) and `{ext}` filled in. A placeholder the config spells and this substitution does
 * not fill — a platform or project suffix — survives into the pattern as literal text, so a routed
 * path that carries one matches no committed baseline, which is exactly what it would mean.
 */
function routedPattern(template: string, segments: string[]): RegExp {
  const joined = segments.join("/");
  const dot = joined.lastIndexOf(".");
  const ext = dot === -1 ? "" : joined.slice(dot);
  const arg = dot === -1 ? joined : joined.slice(0, dot);
  const routed = template.split("{arg}").join(arg).split("{ext}").join(ext);
  return new RegExp(`^${escapeRegExp(routed).split(INTERPOLATED).join("[^/]+")}$`);
}

describe("AC-4 — the shell captures are routed, committed, and actually differ (Q-06)", () => {
  test("AC-4: the capture is OF the gallery-shell region, with animations disabled", () => {
    const code = journeySource();
    const captures = expectations(code, ["toHaveScreenshot"]);
    expect(captures.length, "the shell region is captured with toHaveScreenshot").toBeGreaterThan(0);

    const shellNames = shellLocatorNames(code);
    const ofTheShell = captures.filter(
      (capture) => capture.subject.includes(SHELL_TESTID) || [...shellNames].some((name) => mentions(capture.subject, name)),
    );
    expect(
      ofTheShell.length,
      `the subject of toHaveScreenshot must be the ${SHELL_TESTID} locator itself — a full-page capture beside an unused shell locator satisfies "both appear in the file" while capturing the wrong region (Q-06). Captured subjects: ${JSON.stringify(captures.map((capture) => capture.subject.trim().slice(0, 60)))}; locators that hold the shell: ${JSON.stringify([...shellNames])}`,
    ).toBeGreaterThan(0);

    for (const capture of ofTheShell) {
      expect(
        /animations\s*:\s*(["'`])disabled\1/.test(capture.args),
        `the shell capture disables animations in its own options, so it is deterministic: ${capture.args.trim().slice(0, 80)}`,
      ).toBe(true);
      expect(
        capture.args.includes(SHELL_TESTID),
        `the capture is named for the region it takes — a name carrying "${SHELL_TESTID}" and the theme, wherever the config's snapshotPathTemplate then routes it (Q-06): ${capture.args.trim().slice(0, 80)}`,
      ).toBe(true);
    }
  });

  test("AC-4: the snapshotPathTemplate routes the shell captures onto the committed baselines", () => {
    const configCode = readCode(CONFIG);
    expect(occurrences(configCode, "snapshotPathTemplate"), "exactly one snapshotPathTemplate key — the lane says where a baseline lives in one place").toBe(1);
    const template = stringProperty(configCode, "snapshotPathTemplate");
    expect(
      template,
      `${CONFIG} names a snapshotPathTemplate: without one Playwright writes into its own per-spec *-snapshots directory and Q-06 compares against nothing committed`,
    ).not.toBeNull();

    // AC-4 fixes a ROUTING rule, and neither half of it can be read alone — the template's text is
    // the lane's to settle, and so is the name the spec passes; what must hold is that composing
    // them lands on the files the increment commits. Reading either half as a literal would grade a
    // spelling instead of the rule (B-19), and would call a capture correct while Playwright wrote
    // it somewhere nothing compares.
    const code = journeySource();
    const captures = expectations(code, ["toHaveScreenshot"]);
    expect(captures.length, "the journey captures the shell with toHaveScreenshot").toBeGreaterThan(0);

    const routed: { args: string; pattern: RegExp }[] = [];
    const unreadable: string[] = [];
    for (const capture of captures) {
      const segments = captureSegments(code, capture.args);
      if (segments === null) unreadable.push(capture.args.trim().slice(0, 60));
      else routed.push({ args: capture.args.trim().slice(0, 60), pattern: routedPattern(template ?? "", segments) });
    }
    expect(
      routed.length,
      `at least one capture names its snapshot where the capture is made — as a string, a template string or an array of path segments — so the file it is compared against can be read: ${JSON.stringify(unreadable)}`,
    ).toBeGreaterThan(0);

    for (const capture of routed) {
      expect(
        BASELINES.some((baseline) => capture.pattern.test(baseline)),
        `"${template}" with the name ${capture.args} routes a capture to ${capture.pattern.source}, which is none of the committed baselines ${JSON.stringify(BASELINES)} — a capture written anywhere else is compared against nothing, and the run still exits 0 (Q-06)`,
      ).toBe(true);
    }
    for (const baseline of BASELINES) {
      expect(
        routed.some((capture) => capture.pattern.test(baseline)),
        `${baseline} is committed evidence, so the template and the names the journey passes must route a capture onto it — otherwise it is a file nothing compares (Q-06). Routes: ${JSON.stringify(routed.map((capture) => capture.pattern.source))}`,
      ).toBe(true);
    }

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
