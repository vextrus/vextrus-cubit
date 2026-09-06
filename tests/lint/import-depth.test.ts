// AC-1, AC-3 — `cubit/import-depth`: a module specifier that climbs three or more `../` segments
// and lands back inside the layered tree is a lint error, the tree is rewritten to the `@/` alias
// that replaces those climbs, and every vitest lane resolves that alias.
//
// The rule is judged the way the tree judges its other NEVERs (tests/toolchain/lint-law.test.ts and
// tests/lint/no-model-outside-seam.test.ts): the product's own `eslint.config.mjs` is loaded and
// driven — over `lintText` at virtual paths for the payloads, and over `lintFiles` for the real
// tree — so what is asserted is what `pnpm exec eslint src` would report, not what a hand-built
// config would.
//
// This file sits in tests/lint/ rather than tests/toolchain/: C-06 locks tests/toolchain/** to the
// files an increment's spec names, and this increment names none there.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const requireFromRoot = createRequire(join(REPO_ROOT, "noop.cjs"));
/** The compiler the tree already pins: a fixture's claims are read from its syntax, never its text. */
const ts = requireFromRoot("typescript") as typeof import("typescript");
type SyntaxNode = import("typescript").Node;

const RULE_NAME = "import-depth";
const RULE_ID = `cubit/${RULE_NAME}`;
const BOUNDARIES_ID = "cubit/boundaries";
const CONFIG_FILE = "eslint.config.mjs";
const PLUGIN_FILE = "scripts/eslint/index.mjs";
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
/** The climb the rule refuses: three `../` segments from PROBE land on `src/`, so the target is inside the tree. */
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
/** A vite/vitest alias, in either spelling the tool accepts. */
type AliasEntry = { find: string | RegExp; replacement: string };
type AliasConfig = Readonly<Record<string, string>> | readonly AliasEntry[] | undefined;
interface LaneConfig {
  readonly resolve?: { readonly alias?: AliasConfig };
  readonly test?: { readonly alias?: AliasConfig };
}

let linter: Linter;
let config: readonly ConfigBlock[] = [];
let cubitRuleNames: readonly string[] = [];

beforeAll(() => {
  const { ESLint } = requireFromRoot("eslint") as { ESLint: LinterCtor };
  config = (requireFromRoot(join(REPO_ROOT, CONFIG_FILE)) as { default: readonly ConfigBlock[] }).default;
  linter = new ESLint({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: config });
  const plugin = requireFromRoot(join(REPO_ROOT, PLUGIN_FILE)) as { cubit: { rules: Readonly<Record<string, unknown>> } };
  cubitRuleNames = Object.keys(plugin.cubit.rules);
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

/**
 * The block of the flat config that governs the layered tree, found by the ARCH-01 rule it already
 * binds rather than by its position — a block that moves is still the same block.
 */
function sourceBlock(): ConfigBlock | undefined {
  return config.find((block) => block.rules?.[BOUNDARIES_ID] !== undefined);
}

/** A module specifier at a real specifier site. */
interface SpecifierSite {
  readonly text: string;
  readonly line: number;
}

/**
 * @returns every specifier a source actually hands to a module-loading construct — static import
 * and re-export sources, `import()`, `require()` and `import x = require()`. Prose that spells the
 * same string is not a specifier and does not appear here: what a fixture claims is read from its
 * syntax, never from its text.
 */
function specifierSites(source: string, fileName: string): readonly SpecifierSite[] {
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, true, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const sites: SpecifierSite[] = [];
  const record = (node: SyntaxNode | undefined): void => {
    if (node === undefined || !ts.isStringLiteralLike(node)) return;
    sites.push({ text: node.text, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 });
  };
  const walk = (node: SyntaxNode): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) record(node.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) record(node.moduleReference.expression);
    else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require")) record(node.arguments[0]);
    }
    ts.forEachChild(node, walk);
  };
  walk(tree);
  return sites;
}

/** @returns true when this specifier is the shape the rule refuses: three or more `../`, landing inside src/. */
function climbsIntoSrc(specifier: string, fromVirtualPath: string): boolean {
  if (!/^(\.\.\/){3,}/.test(specifier)) return false;
  return posix.normalize(posix.join(posix.dirname(fromVirtualPath), specifier)).startsWith("src/");
}

/** @returns a corpus fixture's source — a fixture not yet committed fails as an assertion naming it. */
function readFixture(path: string): string {
  expect(existsSync(join(REPO_ROOT, path)), `${path} is missing — the rule has no committed proof`).toBe(true);
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

/** @returns every `.ts`/`.tsx` file under a directory of the checkout, absolute, in a stable order. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) return sourceFiles(abs);
      return abs.endsWith(".ts") || abs.endsWith(".tsx") ? [abs] : [];
    });
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
    const messages = await depthRule(`import { x } from "${CLIMB}";\nexport const used = x;\n`);
    expect(
      messages.length,
      `importing "${CLIMB}" at ${PROBE} reported ${spelled(await lintAs(`import { x } from "${CLIMB}";\nexport const used = x;\n`, PROBE))} — a climb of three or more \`../\` back into the layered tree is a lint error, and \`${ALIAS}core/x\` is its spelling`,
    ).toBeGreaterThan(0);
  });

  test("AC-1: the corpus's bad fixture carries the climb and is refused on marked lines", async () => {
    const source = readFixture(FIXTURES.bad.path);
    // What the fixture claims is read from its syntax, not its text: a comment spelling `../../../`
    // is not a path to anything, and a payload that never climbs would prove nothing.
    const sites = specifierSites(source, FIXTURES.bad.virtualPath);
    const climbs = sites.filter((site) => climbsIntoSrc(site.text, FIXTURES.bad.virtualPath));
    expect(
      climbs.map((site) => site.text),
      `${FIXTURES.bad.path} hands no module-loading construct a three-\`../\` climb landing inside src/ — it loads ${sites.map((site) => `"${site.text}"`).join(", ") || "nothing at all"}`,
    ).not.toEqual([]);

    const messages = await lintAs(source, FIXTURES.bad.virtualPath);
    const refused = messages.filter((message) => message.ruleId === RULE_ID);
    expect(refused.length, `${FIXTURES.bad.path} reported ${spelled(messages)} — the payload committed to prove ${RULE_ID} fires was not refused`).toBeGreaterThan(0);
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
    const sites = specifierSites(source, FIXTURES.good.virtualPath);
    expect(sites.length, `${FIXTURES.good.path} loads no module at all — a lawful counterpart that imports nothing proves nothing`).toBeGreaterThan(0);
    expect(
      sites.filter((site) => climbsIntoSrc(site.text, FIXTURES.good.virtualPath)).map((site) => site.text),
      `${FIXTURES.good.path} carries the very climb the rule refuses — it cannot be the lawful counterpart`,
    ).toEqual([]);
    const messages = await lintAs(source, FIXTURES.good.virtualPath);
    expect(messages.map((message) => `${message.ruleId ?? "(parse)"}@${message.line}`), "a rule fired on the lawful counterpart").toEqual([]);
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
    "AC-3: at least one module specifier under src/ is spelled through the alias",
    () => {
      // white-box: AC-3 — the criterion is a property of the delivered source text itself (the
      // spelling the climbs were rewritten to); no behaviour of the product reports which specifier
      // shape its own files were authored with. Read from the syntax, so a mention in a comment is
      // not an import.
      const files = sourceFiles(join(REPO_ROOT, "src"));
      expect(files.length, "src/ holds no TypeScript at all").toBeGreaterThan(0);
      const aliased = files.find((file) =>
        specifierSites(readFileSync(file, "utf8"), file).some((site) => site.text.startsWith(ALIAS)),
      );
      expect(
        aliased,
        `no file under src/ imports through the \`${ALIAS}\` alias — the climbs the rule refuses are rewritten to it, they are not merely deleted`,
      ).toBeDefined();
    },
    300_000,
  );

  test.each(LANES)("AC-3: $config resolves `@/` to the repo's src", async ({ config: relative, rootIsRepo }) => {
    expect(existsSync(join(REPO_ROOT, relative)), `${relative} is missing`).toBe(true);
    const loaded = (await import(join(REPO_ROOT, relative))) as { default: LaneConfig | ((env: { command: string; mode: string }) => LaneConfig | Promise<LaneConfig>) };
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
