// AC-1, AC-3 — `cubit/import-depth`: a module specifier that climbs three or more `../` segments
// and lands back inside the layered tree is a lint error, the tree is rewritten to the `@/` alias
// that replaces those climbs, and every vitest lane resolves that alias.
//
// Everything here is observed by driving the product: the tree's own `eslint.config.mjs` is loaded
// and run — over `lintText` at virtual paths for the committed payloads, over `lintFiles` for the
// real tree — so what is asserted is what `pnpm exec eslint src` would report, never what a
// hand-built config would. What the rewritten tree imports is read the same way: through the
// product's own specifier reader (scripts/eslint/lib/specifiers.mjs), mounted beside the shipped
// config as a probe rule, so the specifiers judged are exactly the ones a rule sees — not strings
// found in a file.
//
// This file sits in tests/lint/ rather than tests/toolchain/: C-06 locks tests/toolchain/** to the
// files an increment's spec names, and this increment names none there.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const requireFromRoot = createRequire(join(REPO_ROOT, "noop.cjs"));

const RULE_NAME = "import-depth";
const RULE_ID = `cubit/${RULE_NAME}`;
const BOUNDARIES_ID = "cubit/boundaries";
const CONFIG_FILE = "eslint.config.mjs";
const PLUGIN_FILE = "scripts/eslint/index.mjs";
const SPECIFIERS_FILE = "scripts/eslint/lib/specifiers.mjs";
const CORPUS_ROOT = "tests/lint-fixtures";
const CORPUS = `${CORPUS_ROOT}/${RULE_NAME}`;
const MARKER = "RECORDED REASON";
const ALIAS = "@/";

/** The corpus files the increment spec declares, by the layered path each stands in for. */
const FIXTURES = {
  bad: { path: `${CORPUS}/src/modules/spine/deep/bad.ts`, virtualPath: "src/modules/spine/deep/bad.ts" },
  good: { path: `${CORPUS}/src/modules/spine/deep/good.ts`, virtualPath: "src/modules/spine/deep/good.ts" },
} as const;

/** The layered path a payload is read at unless a test names another one. */
const PROBE = "src/modules/spine/deep/probe.ts";
/** A path outside the layered tree, where the rule is bound but must stay silent. */
const OUTSIDE = "db/probe.ts";
/** The climb the rule refuses: three `../` from a `…/deep/` file land on `src/`, inside the tree. */
const CLIMB = "../../../core/x";

/** The vitest lanes that must resolve the alias the rewrite spells, and whether their root is the repo's. */
const LANES = [
  { config: "vitest.config.ts", rootIsRepo: true },
  { config: "db/__tests__/vitest.config.ts", rootIsRepo: true },
  { config: "tests/server/vitest.config.ts", rootIsRepo: false },
] as const;

interface LintMessage {
  readonly ruleId: string | null;
  readonly message: string;
  readonly line: number;
  readonly severity: number;
}
interface LintResult {
  readonly filePath: string;
  readonly messages: readonly LintMessage[];
}
interface Linter {
  lintText(text: string, options: { filePath: string }): Promise<readonly LintResult[]>;
  lintFiles(patterns: readonly string[]): Promise<readonly LintResult[]>;
}
type LinterCtor = new (options: { cwd: string; overrideConfigFile: boolean; overrideConfig: unknown }) => Linter;
interface ConfigBlock {
  readonly files?: readonly string[];
  readonly rules?: Readonly<Record<string, unknown>>;
}
/** What ESLint hands a rule, of which the probe below needs only the file it is visiting. */
interface ProbeContext {
  readonly filename: string;
}
/** The product's own specifier reader: every shape a module specifier can take, offered once each. */
type SpecifierVisitors = (context: ProbeContext, report: (specifier: { readonly value: string }) => void) => Record<string, unknown>;
/** A vite/vitest alias, in either spelling the tool accepts. */
type AliasEntry = { find: string | RegExp; replacement: string };
type AliasConfig = Readonly<Record<string, string>> | readonly AliasEntry[] | undefined;
interface LaneConfig {
  readonly resolve?: { readonly alias?: AliasConfig };
  readonly test?: { readonly alias?: AliasConfig };
}
/** A module specifier the src tree hands to a module-loading construct, and the file that spells it. */
interface Sighting {
  readonly file: string;
  readonly value: string;
}

let ESLintCtor: LinterCtor;
let linter: Linter;
let config: readonly ConfigBlock[] = [];
let cubitRuleNames: readonly string[] = [];
let specifierVisitors: SpecifierVisitors;

beforeAll(() => {
  ESLintCtor = (requireFromRoot("eslint") as { ESLint: LinterCtor }).ESLint;
  config = (requireFromRoot(join(REPO_ROOT, CONFIG_FILE)) as { default: readonly ConfigBlock[] }).default;
  linter = new ESLintCtor({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: config });
  const plugin = requireFromRoot(join(REPO_ROOT, PLUGIN_FILE)) as { cubit: { rules: Readonly<Record<string, unknown>> } };
  cubitRuleNames = Object.keys(plugin.cubit.rules);
  specifierVisitors = (requireFromRoot(join(REPO_ROOT, SPECIFIERS_FILE)) as { specifierVisitors: SpecifierVisitors }).specifierVisitors;
}, 120_000);

/** @returns everything the product's config reports for this source read at this layered path. */
async function lintAs(source: string, virtualPath: string): Promise<readonly LintMessage[]> {
  const results = await linter.lintText(source, { filePath: join(REPO_ROOT, virtualPath) });
  return results.flatMap((result) => [...result.messages]);
}

/** @returns only what the depth rule reports — the other rules have their own suites. */
async function depthRule(source: string, virtualPath: string = PROBE): Promise<readonly LintMessage[]> {
  return (await lintAs(source, virtualPath)).filter((message) => message.ruleId === RULE_ID);
}

function spelled(messages: readonly LintMessage[]): string {
  if (messages.length === 0) return "nothing";
  return messages.map((message) => `${message.ruleId ?? "(parse)"}@${message.line}`).join(", ");
}

function importing(specifier: string, binding = "x"): string {
  return `import { ${binding} } from "${specifier}";\nexport const used${binding} = ${binding};\n`;
}

/**
 * The block of the flat config that governs the layered tree, found by the ARCH-01 rule it already
 * binds rather than by its position — a block that moves is still the same block.
 */
function sourceBlock(): ConfigBlock | undefined {
  return config.find((block) => block.rules?.[BOUNDARIES_ID] !== undefined);
}

/**
 * Every module specifier the src tree actually hands to a module-loading construct — import,
 * re-export, `import()`, `require()` and the rest — collected by mounting a probe rule beside the
 * shipped config and letting ESLint walk the tree. The reader is the product's own
 * (scripts/eslint/lib/specifiers.mjs, the one `cubit/import-depth` reads), so a specifier spelled in
 * a comment or in an unrelated string is not one of these, and a specifier at a site the rule cannot
 * see is not one either.
 */
async function specifiersUnderSrc(): Promise<readonly Sighting[]> {
  const seen: Sighting[] = [];
  const probe = {
    meta: { type: "problem", schema: [] as readonly unknown[] },
    create(context: ProbeContext): Record<string, unknown> {
      return specifierVisitors(context, (specifier) => {
        seen.push({ file: context.filename, value: specifier.value });
      });
    },
  };
  const probing = new ESLintCtor({
    cwd: REPO_ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      ...config,
      { files: ["src/**/*.ts", "src/**/*.tsx"], plugins: { probe: { rules: { collect: probe } } }, rules: { "probe/collect": "error" } },
    ],
  });
  await probing.lintFiles([join(REPO_ROOT, "src")]);
  return seen;
}

/** @returns a corpus fixture's source — a fixture not yet committed fails as an assertion naming it. */
function readFixture(path: string): string {
  expect(existsSync(join(REPO_ROOT, path)), `${path} is missing — the rule has no committed proof`).toBe(true);
  // white-box: AC-1 — the fixture's text is the LINTER'S INPUT, not the assertion: the flat config
  // ignores tests/lint-fixtures/**, so lintText at the fixture's virtual path is the only surface
  // that can see the committed corpus (tests/toolchain/lint-law.test.ts reads it exactly this way).
  // The one property of the text asserted below is Q-08's own — the `// RECORDED REASON` marker on a
  // reported line, which has no runtime observable at all.
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

/** @returns the alias table a lane's config declares, in whichever of the two homes it uses. */
function aliasEntries(lane: LaneConfig): readonly AliasEntry[] {
  const table = lane.resolve?.alias ?? lane.test?.alias;
  if (table === undefined) return [];
  if (Array.isArray(table)) return table as readonly AliasEntry[];
  return Object.entries(table as Readonly<Record<string, string>>).map(([find, replacement]) => ({ find, replacement }));
}

/** @returns what a lane's alias table turns this specifier into, or null when no entry claims it. */
function applyAlias(entries: readonly AliasEntry[], specifier: string): { rewritten: string; replacement: string } | null {
  for (const entry of entries) {
    if (typeof entry.find === "string") {
      if (specifier === entry.find || specifier.startsWith(entry.find)) {
        return { rewritten: `${entry.replacement}${specifier.slice(entry.find.length)}`, replacement: entry.replacement };
      }
    } else if (entry.find.test(specifier)) {
      return { rewritten: specifier.replace(entry.find, entry.replacement), replacement: entry.replacement };
    }
  }
  return null;
}

describe("AC-1: the rule exists, is bound, and fires", () => {
  test("AC-1: a three-`../` climb into src/ reports cubit/import-depth through the shipped config", async () => {
    const source = importing(CLIMB);
    const messages = await depthRule(source);
    expect(
      messages.length,
      `importing "${CLIMB}" at ${PROBE} reported ${spelled(await lintAs(source, PROBE))} — a climb of three or more \`../\` back into the layered tree is a lint error, and \`${ALIAS}core/x\` is its spelling`,
    ).toBeGreaterThan(0);
  });

  test("AC-1: the corpus's bad fixture is refused, on lines carrying the recorded reason", async () => {
    const source = readFixture(FIXTURES.bad.path);
    const messages = await lintAs(source, FIXTURES.bad.virtualPath);
    const refused = messages.filter((message) => message.ruleId === RULE_ID);
    expect(refused.length, `${FIXTURES.bad.path} reported ${spelled(messages)} — the payload committed to prove ${RULE_ID} fires was not refused`).toBeGreaterThan(0);

    // The payload is a climb the rule resolved, not a coincidence of the file: read at a path
    // outside the layered tree the very same source is left alone, because the target of a climb
    // from there is not inside src/.
    const outside = (await lintAs(source, OUTSIDE)).filter((message) => message.ruleId === RULE_ID);
    expect(
      outside.map((message) => message.message),
      `${FIXTURES.bad.path} is refused even when read at ${OUTSIDE} — its payload is not a climb the rule resolves, so it proves nothing about where a specifier lands`,
    ).toEqual([]);

    // Q-08: a deliberate payload is recorded, never blocking — and the locked lint-law suite reads
    // the same marker off the same lines.
    const lines = source.split("\n");
    const unmarked = messages
      .filter((message) => !(lines[message.line - 1] ?? "").includes(MARKER))
      .map((message) => `${message.line} (${message.ruleId ?? "parse error"}): ${(lines[message.line - 1] ?? "").trim()}`);
    expect(unmarked, `a reported line in ${FIXTURES.bad.path} carries no '// ${MARKER} <CODE>' marker (Q-08)`).toEqual([]);
  });

  test("AC-1: the corpus's good fixture reports nothing at all", async () => {
    const source = readFixture(FIXTURES.good.path);
    const messages = await lintAs(source, FIXTURES.good.virtualPath);
    expect(messages.map((message) => `${message.ruleId ?? "(parse)"}@${message.line}`), "a rule fired on the lawful counterpart").toEqual([]);

    // Silence is only worth reading where the rule is live: the same fixture with the refused climb
    // appended, at the same path, is refused. An empty file could not do that.
    const refused = await depthRule(`${source}\n${importing(CLIMB, "deepProbe")}`, FIXTURES.good.virtualPath);
    expect(
      refused.length,
      `appending "${CLIMB}" to ${FIXTURES.good.path} changed nothing at ${FIXTURES.good.virtualPath} — the rule is not live there, so the fixture's silence proves nothing`,
    ).toBeGreaterThan(0);
  });

  test("AC-1: the plugin roster claims the corpus slug, which is what keeps lint-law green", () => {
    // tests/toolchain/lint-law.test.ts is locked and needs no edit: its ruleOf() falls back to
    // `cubit/<slug>` for any slug the plugin exports, so a corpus directory named after the rule is
    // judged automatically — and a corpus named anything else reds "a corpus directory proves no rule".
    expect(
      cubitRuleNames,
      `${PLUGIN_FILE} does not register cubit.rules["${RULE_NAME}"] — it registers ${cubitRuleNames.join(", ")}, so the corpus directory would prove no rule`,
    ).toContain(RULE_NAME);
    expect(existsSync(join(REPO_ROOT, CORPUS)), `${CORPUS} is missing — the corpus directory must be named after the rule it fires`).toBe(true);
  });
});

describe("AC-3: the tree obeys the rule and every lane resolves the alias", () => {
  test("AC-3: the block that binds cubit/boundaries binds cubit/import-depth at error", () => {
    const block = sourceBlock();
    expect(block, `no config block binds ${BOUNDARIES_ID} — the SOURCE block moved`).toBeDefined();
    expect(
      block?.rules?.[RULE_ID],
      `${CONFIG_FILE}'s SOURCE block does not bind ${RULE_ID} at "error" beside ${BOUNDARIES_ID} — the depth rule governs the layered tree and nothing else`,
    ).toBe("error");
  });

  test(
    "AC-3: `eslint src` is clean with the rule armed",
    async () => {
      // The silence below only means something if the rule is armed over src/ — a rule that does not
      // exist reports nothing on every tree there is.
      expect(sourceBlock()?.rules?.[RULE_ID], `${RULE_ID} is not armed, so a clean src/ proves nothing`).toBe("error");
      const results = await linter.lintFiles([join(REPO_ROOT, "src")]);
      expect(results.length, "linting src/ read no files at all").toBeGreaterThan(0);
      const climbs = results.flatMap((result) =>
        result.messages.filter((message) => message.ruleId === RULE_ID).map((message) => `${result.filePath.slice(REPO_ROOT.length + 1)}:${message.line}`),
      );
      expect(climbs, `a module specifier under src/ still climbs three or more \`../\` back into the tree — ${ALIAS} is its spelling now`).toEqual([]);
      const errors = results.flatMap((result) =>
        result.messages
          .filter((message) => message.severity === 2)
          .map((message) => `${result.filePath.slice(REPO_ROOT.length + 1)}:${message.line} ${message.ruleId ?? "(parse)"}`),
      );
      expect(errors, "`pnpm exec eslint src` does not exit 0 on the rewritten tree").toEqual([]);
    },
    300_000,
  );

  test(
    "AC-3: the src tree loads modules through the alias",
    async () => {
      const seen = await specifiersUnderSrc();
      expect(seen.length, "the probe rule was handed no specifier at all under src/ — this test judges nothing").toBeGreaterThan(0);
      const aliased = seen.filter((sighting) => sighting.value.startsWith(ALIAS));
      expect(
        aliased.length,
        `no module-loading construct under src/ is handed a \`${ALIAS}\` specifier — the climbs the rule refuses are rewritten to the alias, they are not merely deleted`,
      ).toBeGreaterThan(0);
    },
    300_000,
  );

  test.each(LANES)("AC-3: $config resolves `@/` to the repo's src", async ({ config: relative, rootIsRepo }) => {
    expect(existsSync(join(REPO_ROOT, relative)), `${relative} is missing`).toBe(true);
    const loaded = (await import(join(REPO_ROOT, relative))) as {
      default: LaneConfig | ((env: { command: string; mode: string }) => LaneConfig | Promise<LaneConfig>);
    };
    const lane = typeof loaded.default === "function" ? await loaded.default({ command: "serve", mode: "test" }) : loaded.default;
    const entries = aliasEntries(lane);
    const applied = applyAlias(entries, `${ALIAS}core/errors`);
    expect(
      applied,
      `${relative} declares no alias claiming "${ALIAS}core/errors" — it declares ${entries.map((entry) => String(entry.find)).join(", ") || "no alias at all"}, so every product file spelled through \`${ALIAS}\` is unresolvable in this lane`,
    ).not.toBeNull();
    expect(
      resolve(REPO_ROOT, applied!.rewritten),
      `${relative} maps "${ALIAS}core/errors" to "${applied!.rewritten}", which is not the repo's src/core/errors`,
    ).toBe(join(REPO_ROOT, "src", "core", "errors"));
    if (!rootIsRepo) {
      // This lane's `root` is its own directory, so a relative replacement would be resolved against
      // that directory and land outside the tree.
      expect(
        isAbsolute(applied!.replacement),
        `${relative} sets root to its own directory, so its alias replacement "${applied!.replacement}" must be an absolute path to the repo's src/`,
      ).toBe(true);
    }
  });
});
