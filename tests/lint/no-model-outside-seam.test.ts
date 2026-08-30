// AC1, AC2 — L-AI-01's seam ban made mechanical, before the seam exists: `callModel` in
// src/core/model is the one path to a model, so every other path to a model SDK — and every deep
// import into the seam's interior — is a lint error with a fixture test (B-18, Q-16).
//
// The rule is judged the way the tree judges its other NEVERs (tests/toolchain/lint-law.test.ts):
// the product's own `eslint.config.mjs` is loaded and driven over `lintText` at virtual paths, so
// what is asserted is what `pnpm exec eslint .` would report, not what a hand-built config would.
// The allowlist lives inside the rule, which is why this file also asserts that no config block
// mentions the seam directory: widening the binding must not be able to widen what is allowed.
//
// This file sits in tests/lint/ rather than tests/toolchain/ on purpose: C-06 locks
// tests/toolchain/** to the files an increment's spec names, and this increment names only
// lint-law.test.ts there.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const requireFromRoot = createRequire(join(REPO_ROOT, "noop.cjs"));
/** The compiler the tree already pins: a fixture's claims are read from its syntax, never its text. */
const ts = requireFromRoot("typescript") as typeof import("typescript");
type SyntaxNode = import("typescript").Node;

const RULE_NAME = "no-model-outside-seam";
const RULE_ID = `cubit/${RULE_NAME}`;
const RULE_FILE = `scripts/eslint/rules/${RULE_NAME}.mjs`;
const PLUGIN_FILE = "scripts/eslint/index.mjs";
const CONFIG_FILE = "eslint.config.mjs";
const LINT_LAW_FILE = "tests/toolchain/lint-law.test.ts";
const CORPUS_ROOT = "tests/lint-fixtures";
const CORPUS = `${CORPUS_ROOT}/${RULE_NAME}`;
const MARKER = "RECORDED REASON";

/** The layered path a payload is read at unless a test names another one (outside the seam). */
const PROBE = "src/modules/estimation/probe.ts";
/** The seam directory the rule allowlists — the one lawful home of a model handle (L-AI-01). */
const SEAM_DIR = "src/core/model";

/**
 * The SDK roster the increment spec declares as the rule's minimum: an entry ending in `/` is a
 * prefix, a bare entry matches exactly or with a subpath. A later increment may add to the roster
 * — nothing here asserts the rule knows only these, only that each declared entry is refused and
 * that none of them swallows a coincidental neighbour (B-19).
 */
const ROSTER: readonly string[] = [
  "@anthropic-ai/",
  "@openai/",
  "openai",
  "ai",
  "@ai-sdk/",
  "@google/genai",
  "@google/generative-ai",
  "@google-cloud/vertexai",
  "@aws-sdk/client-bedrock",
  "@azure/openai",
  "@azure-rest/ai-inference",
  "@openrouter/",
  "cohere-ai",
  "@mistralai/",
  "groq-sdk",
  "together-ai",
  "@huggingface/inference",
  "ollama",
  "langchain",
  "@langchain/",
  "replicate",
];

/** The globs the whole-tree ban block binds (C-06's toolchain surface, spec test contract). */
const WHOLE_TREE = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.mjs", "**/*.js"];

/** The rules that identify the whole-tree ban block, so the block is found by what it holds. */
const BAN_BLOCK_SIBLINGS = ["cubit/no-colour-literal", "cubit/no-db-outside-seam", "cubit/no-raw-intl"];

/** The corpus files the increment spec declares, by the layered path each stands in for. */
const FIXTURES = {
  bad: { path: `${CORPUS}/src/modules/estimation/bad.ts`, virtualPath: "src/modules/estimation/bad.ts" },
  good: { path: `${CORPUS}/src/modules/estimation/good.ts`, virtualPath: "src/modules/estimation/good.ts" },
  seam: { path: `${CORPUS}/allowed/src/core/model/good.ts`, virtualPath: `${SEAM_DIR}/good.ts` },
} as const;

/**
 * The bypass shapes bad.ts is declared to carry: a straight scoped import, a bare import, a
 * template-literal dynamic import, a hoisted const through import() and through require(),
 * require(), the globalThis spelling, the createRequire indirection and a deep seam import. A
 * minimum, never a ceiling — the corpus may grow.
 */
const DECLARED_PAYLOADS = 8;

interface LintMessage {
  readonly ruleId: string | null;
  readonly messageId?: string;
  readonly message: string;
  readonly line: number;
}
interface LintResult {
  readonly messages: readonly LintMessage[];
}
interface Linter {
  lintText(text: string, options: { filePath: string }): Promise<readonly LintResult[]>;
}
type LinterCtor = new (options: { cwd: string; overrideConfigFile: boolean; overrideConfig: unknown }) => Linter;
interface ConfigBlock {
  readonly files?: readonly string[];
  readonly ignores?: readonly string[];
  readonly rules?: Readonly<Record<string, unknown>>;
}
interface RuleModule {
  readonly meta?: { readonly messages?: Readonly<Record<string, string>> };
  readonly create?: unknown;
}

let linter: Linter;
let config: readonly ConfigBlock[] = [];
let ruleDefault: RuleModule | null = null;
let registered: unknown;

beforeAll(() => {
  const { ESLint } = requireFromRoot("eslint") as { ESLint: LinterCtor };
  config = (requireFromRoot(join(REPO_ROOT, CONFIG_FILE)) as { default: readonly ConfigBlock[] }).default;
  linter = new ESLint({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: config });
  // The rule and its registration are loaded defensively: a module the Builder has not written yet
  // has to read as a failed assertion naming the file, not as a collection death.
  if (existsSync(join(REPO_ROOT, RULE_FILE))) {
    ruleDefault = (requireFromRoot(join(REPO_ROOT, RULE_FILE)) as { default?: RuleModule }).default ?? null;
  }
  const plugin = requireFromRoot(join(REPO_ROOT, PLUGIN_FILE)) as { cubit: { rules: Readonly<Record<string, unknown>> } };
  registered = plugin.cubit.rules[RULE_NAME];
}, 120_000);

/** @returns everything the product's config reports for this source read at this layered path. */
async function lintAs(source: string, virtualPath: string): Promise<readonly LintMessage[]> {
  const results = await linter.lintText(source, { filePath: join(REPO_ROOT, virtualPath) });
  return results.flatMap((result) => [...result.messages]);
}

/** @returns only what the seam ban reports — other rules have their own suites. */
async function seamBan(source: string, virtualPath: string = PROBE): Promise<readonly LintMessage[]> {
  return (await lintAs(source, virtualPath)).filter((message) => message.ruleId === RULE_ID);
}

function importOf(specifier: string): string {
  return `import probe from "${specifier}";\nexport const used = probe;\n`;
}

/** @returns the specifiers a roster entry must refuse, and the neighbours it must not. */
function probesFor(entry: string): { fires: readonly string[]; silent: readonly string[] } {
  if (entry.endsWith("/")) return { fires: [`${entry}sdk`], silent: [`${entry.slice(0, -1)}-neighbour/sdk`] };
  return { fires: [entry, `${entry}/client`], silent: [`${entry}-neighbour`] };
}

/** @returns a corpus fixture's source — a fixture not yet committed fails as an assertion naming it. */
function readFixture(path: string): string {
  expect(existsSync(join(REPO_ROOT, path)), `${path} is missing — the ban has no committed proof`).toBe(true);
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

function spelled(messages: readonly LintMessage[]): string {
  if (messages.length === 0) return "nothing";
  return messages.map((message) => `${message.messageId ?? "?"}@${message.line}`).join(", ");
}

/** @returns the value an assertion just proved present, narrowed — the throw is unreachable. */
function found<T>(value: T | undefined, message: string): T {
  expect(value, message).toBeDefined();
  if (value === undefined) throw new Error(message);
  return value;
}

/** A module specifier at a real specifier site, with the span of its text inside the source. */
interface SpecifierSite {
  readonly text: string;
  /** Index of the first character of the specifier text (inside the quotes). */
  readonly start: number;
  readonly end: number;
}

/**
 * @returns every specifier a source actually hands to a module-loading construct — static import
 * and re-export sources, `import()`, `require()` and `import x = require()`. Prose that spells the
 * same string is not a specifier and does not appear here: what a fixture claims is read from its
 * syntax, never from its text.
 */
function specifierSites(source: string, fileName: string): readonly SpecifierSite[] {
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const sites: SpecifierSite[] = [];
  const record = (node: SyntaxNode | undefined): void => {
    if (node === undefined || !ts.isStringLiteralLike(node)) return;
    sites.push({ text: node.text, start: node.getStart(tree) + 1, end: node.getEnd() - 1 });
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

function spelledSites(sites: readonly SpecifierSite[]): string {
  if (sites.length === 0) return "nothing at all";
  return sites.map((site) => `"${site.text}"`).join(", ");
}

/** @returns the source with one specifier's text swapped, leaving the import site itself untouched. */
function withSpecifier(source: string, site: SpecifierSite, replacement: string): string {
  return `${source.slice(0, site.start)}${replacement}${source.slice(site.end)}`;
}

/**
 * @returns every object literal in a source that maps a slug to a rule id — a property whose value
 * is the key itself, plugin-qualified. Read from the syntax, so a mention in a comment or in an
 * unrelated string is not an entry.
 */
function ruleIdMaps(source: string, fileName: string): readonly Readonly<Record<string, string>>[] {
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const maps: Record<string, string>[] = [];
  const walk = (node: SyntaxNode): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const entries: Record<string, string> = {};
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) continue;
        const key = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : null;
        if (key !== null) entries[key] = property.initializer.text;
      }
      const qualified = Object.entries(entries).filter(([key, value]) => value === key || value.endsWith(`/${key}`));
      if (qualified.length >= 2) maps.push(Object.fromEntries(qualified));
    }
    ts.forEachChild(node, walk);
  };
  walk(tree);
  return maps;
}

/** @returns the corpus directories the tree carries today — the slugs a closed set can claim. */
function corpusSlugs(): readonly string[] {
  const root = join(REPO_ROOT, CORPUS_ROOT);
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((entry) => statSync(join(root, entry)).isDirectory());
}

describe("AC1: the rule exists, is registered and is bound, with the allowlist inside it", () => {
  test("AC1: the rule module default-exports a rule with messageIds sdk and transport", () => {
    expect(existsSync(join(REPO_ROOT, RULE_FILE)), `${RULE_FILE} is missing — L-AI-01's ban has no home`).toBe(true);
    expect(typeof ruleDefault?.create, `${RULE_FILE} does not default-export an ESLint rule module`).toBe("function");
    expect(Object.keys(ruleDefault?.meta?.messages ?? {}).sort(), `${RULE_FILE} does not declare both branches`).toEqual(
      expect.arrayContaining(["sdk", "transport"]),
    );
  });

  test("AC1: the cubit plugin registers that module under no-model-outside-seam", () => {
    expect(registered, `${PLUGIN_FILE} does not register cubit.rules["${RULE_NAME}"]`).toBeDefined();
    expect(
      Object.is(registered, ruleDefault),
      `cubit.rules["${RULE_NAME}"] is not the module ${RULE_FILE} exports — the rule has two homes (ARCH-02)`,
    ).toBe(true);
  });

  test("AC1: the whole-tree ban block binds it at error", () => {
    const block = config.find((entry) => BAN_BLOCK_SIBLINGS.every((rule) => entry.rules?.[rule] !== undefined));
    expect(block, `no config block binds ${BAN_BLOCK_SIBLINGS.join(", ")} — the whole-tree ban block moved`).toBeDefined();
    expect(block?.rules?.[RULE_ID], `${CONFIG_FILE} does not bind ${RULE_ID} at "error" beside the other whole-tree bans`).toBe("error");
    const uncovered = WHOLE_TREE.filter((glob) => !(block?.files ?? []).includes(glob));
    expect(uncovered, "the block binding the seam ban does not reach every file kind the tree owns").toEqual([]);
  });

  test("AC1: the allowlist is granted by the rule, not by the config", async () => {
    const leaking = config
      .flatMap((entry) => [...(entry.files ?? []), ...(entry.ignores ?? [])])
      .filter((pattern) => pattern.includes("core/model"));
    expect(
      leaking,
      `${CONFIG_FILE} names the seam directory — the allowlist belongs inside the rule, so widening the binding cannot widen what is allowed`,
    ).toEqual([]);
    // The exemption is then shown to be real and to come from somewhere else: the same payload is
    // refused outside the seam and clean inside it, while no glob in the config distinguishes them.
    const payload = importOf("@anthropic-ai/sdk");
    expect((await seamBan(payload, PROBE)).length, `the ban did not reach ${PROBE}, so this test judges no allowlist`).toBeGreaterThan(0);
    const inside = await seamBan(payload, `${SEAM_DIR}/transport.ts`);
    expect(inside.map((message) => message.message), `the seam's own directory is refused a model handle — ${SEAM_DIR}/ is where callModel lives`).toEqual([]);
  });

  test.each(ROSTER)("AC1: the roster refuses %s and not its neighbours", async (entry) => {
    const { fires, silent } = probesFor(entry);
    for (const specifier of fires) {
      const messages = await seamBan(importOf(specifier));
      expect(
        messages.map((message) => message.messageId),
        `importing "${specifier}" at ${PROBE} reported ${spelled(messages)} — a model SDK outside src/core/model is a lint error (L-AI-01)`,
      ).toContain("sdk");
    }
    for (const specifier of silent) {
      const messages = await seamBan(importOf(specifier));
      expect(messages.map((message) => message.message), `"${specifier}" is not a model SDK, and the roster matched it anyway`).toEqual([]);
    }
  });

  test("AC1: a type-only import is refused exactly as a value import is", async () => {
    const value = await seamBan(importOf("openai"));
    expect(value.length, "the control payload did not fire, so this test judges nothing").toBeGreaterThan(0);
    const typeOnly = await seamBan(`import type { Model } from "openai";\nexport type Alias = Model;\n`);
    expect(
      typeOnly.map((message) => message.messageId),
      "an `import type` from a model SDK was allowed — a type-only path to the SDK is still a path outside the seam",
    ).toContain("sdk");
  });

  test.each(["../../core/model/transport", "@/core/model/registry", "src/core/model/nested/deep"])(
    "AC1: the transport branch refuses the deep seam import %s",
    async (specifier) => {
      const messages = await seamBan(importOf(specifier));
      expect(
        messages.map((message) => message.messageId),
        `"${specifier}" reaches inside the seam — only the barrel is a lawful path (L-AI-01)`,
      ).toContain("transport");
    },
  );

  test.each(["../../core/model", "@/core/model", "openai-mock", "vitest"])("AC1: %s stays lawful outside the seam", async (specifier) => {
    const control = await seamBan(importOf("../../core/model/transport"));
    expect(control.length, "the control payload did not fire, so this test judges nothing").toBeGreaterThan(0);
    const messages = await seamBan(importOf(specifier));
    expect(
      messages.map((message) => message.message),
      `"${specifier}" was refused — callModel through the barrel is the path L-AI-01 grants, and a coincidental name is not a model SDK`,
    ).toEqual([]);
  });

  test("AC1: both messages are readable reasons", async () => {
    const sdk = (await seamBan(importOf("@anthropic-ai/sdk"))).map((message) => message.message);
    expect(sdk.length, "no sdk message to read").toBeGreaterThan(0);
    for (const message of sdk) {
      expect(message, "the sdk message does not name callModel").toContain("callModel");
      expect(message, "the sdk message does not name the seam").toContain(SEAM_DIR);
      expect(message, "the sdk message does not cite the clause it enforces").toContain("L-AI-01");
    }
    const transport = (await seamBan(importOf("../../core/model/transport"))).map((message) => message.message);
    expect(transport.length, "no transport message to read").toBeGreaterThan(0);
    for (const message of transport) {
      expect(message, "the transport message does not name the seam").toContain(SEAM_DIR);
      expect(message, "the transport message does not cite the clause it enforces").toContain("L-AI-01");
    }
  });
});

describe("AC2: the corpus proves it through the real config", () => {
  test.each(Object.entries(FIXTURES))("AC2: the corpus holds its %s fixture", (_name, fixture) => {
    expect(existsSync(join(REPO_ROOT, fixture.path)), `${fixture.path} is missing — the ban has no committed proof`).toBe(true);
  });

  test("AC2: bad.ts fires on every marked payload line, in both branches", async () => {
    const source = readFixture(FIXTURES.bad.path);
    const messages = await seamBan(source, FIXTURES.bad.virtualPath);
    const marked = source
      .split("\n")
      .map((text, index) => ({ line: index + 1, text }))
      .filter((entry) => entry.text.includes(MARKER));
    expect(marked.length, `bad.ts carries fewer than the ${DECLARED_PAYLOADS} declared bypass shapes`).toBeGreaterThanOrEqual(DECLARED_PAYLOADS);
    const reportedLines = new Set(messages.map((message) => message.line));
    const silent = marked.filter((entry) => !reportedLines.has(entry.line)).map((entry) => `${entry.line}: ${entry.text.trim()}`);
    expect(silent, `a payload committed to prove ${RULE_ID} fires was not reported — it reported ${spelled(messages)}`).toEqual([]);
    const branches = new Set(messages.map((message) => message.messageId));
    expect([...branches].sort(), "bad.ts does not exercise both branches of the ban").toEqual(expect.arrayContaining(["sdk", "transport"]));
  });

  test("AC2: good.ts reaches the seam through the barrel and lints clean under every rule", async () => {
    const source = readFixture(FIXTURES.good.path);
    // What the fixture claims is read from its syntax, not from its text: a specifier mentioned in a
    // comment is not a path to anything, and a lawful counterpart that imports nothing proves nothing.
    const sites = specifierSites(source, FIXTURES.good.virtualPath);
    const barrel = found(
      sites.find((site) => /(^|\/)core\/model$/.test(site.text)),
      `good.ts hands no module-loading construct a specifier ending at the seam barrel — it loads ${spelledSites(sites)}, so it proves nothing about the lawful path`,
    );
    const neighbour = found(
      sites.find((site) =>
        ROSTER.some((entry) => !entry.endsWith("/") && site.text.startsWith(entry) && site.text !== entry && !site.text.startsWith(`${entry}/`)),
      ),
      `good.ts loads no package whose name merely starts like a roster entry — it loads ${spelledSites(sites)}, so it proves nothing about a coincidental neighbour`,
    );
    // Each site is then shown to be a site the ban actually reads: the same import, one segment
    // deeper into the seam, and the same neighbour cut back to the roster entry it starts with, both
    // fire. A comment holding the same characters could not do that.
    const deepened = await seamBan(withSpecifier(source, barrel, `${barrel.text}/transport`), FIXTURES.good.virtualPath);
    expect(
      deepened.map((message) => message.messageId),
      `deepening good.ts's "${barrel.text}" to "${barrel.text}/transport" reported ${spelled(deepened)} — the barrel is not being loaded at a site the ban reads`,
    ).toContain("transport");
    const rosterEntry = found(
      ROSTER.filter((entry) => !entry.endsWith("/")).find((entry) => neighbour.text.startsWith(entry)),
      `"${neighbour.text}" no longer starts with a roster entry`,
    );
    const narrowed = await seamBan(withSpecifier(source, neighbour, rosterEntry), FIXTURES.good.virtualPath);
    expect(
      narrowed.map((message) => message.messageId),
      `cutting good.ts's "${neighbour.text}" back to "${rosterEntry}" reported ${spelled(narrowed)} — the neighbour is not being loaded at a site the ban reads, so its lawfulness proves nothing`,
    ).toContain("sdk");
    const messages = await lintAs(source, FIXTURES.good.virtualPath);
    expect(messages.map((message) => `${message.ruleId ?? "(parse)"}@${message.line}`), "a rule fired on the lawful counterpart").toEqual([]);
  });

  test("AC2: the allowed/ mirror is clean inside the seam and would fire outside it", async () => {
    const source = readFixture(FIXTURES.seam.path);
    const outside = await seamBan(source, PROBE);
    expect(
      outside.length,
      `${FIXTURES.seam.path} carries no payload the ban would refuse elsewhere — an empty file cannot prove an allowlist`,
    ).toBeGreaterThan(0);
    const inside = await lintAs(source, FIXTURES.seam.virtualPath);
    expect(
      inside.map((message) => `${message.ruleId ?? "(parse)"}@${message.line}`),
      `a rule fired inside ${SEAM_DIR}/ — the seam directory is where a model handle is made (L-AI-01)`,
    ).toEqual([]);
  });

  test("AC2: lint-law's closed rule set claims the corpus", () => {
    const source = readFixture(LINT_LAW_FILE);
    // The entry is read out of the object literal it has to live in, never out of the file's text: a
    // commented-out line spelling the pair leaves the closed set exactly as closed as it was.
    const slugs = new Set(corpusSlugs());
    const closedSets = ruleIdMaps(source, LINT_LAW_FILE).filter(
      (map) => Object.keys(map).filter((key) => key !== RULE_NAME && slugs.has(key)).length >= 2,
    );
    expect(
      closedSets.length,
      `${LINT_LAW_FILE} holds no object mapping corpus slugs to rule ids — the closed set moved, and this test judges nothing`,
    ).toBeGreaterThan(0);
    const claiming = closedSets.filter((map) => map[RULE_NAME] === RULE_ID);
    expect(
      claiming.length,
      `${LINT_LAW_FILE}'s closed rule set does not map ${RULE_NAME} to ${RULE_ID} — it maps ${closedSets
        .map((map) => Object.keys(map).join("/"))
        .join(" and ")}, so nothing requires the corpus to exist`,
    ).toBeGreaterThan(0);
  });
});
