/**
 * The Q-07 register scan, whose semantics are law.
 *
 * A refusal-shaped name spelled in product source is one of exactly three things, and the scan
 * answers which — never a single undifferentiated bucket:
 *
 * - **orphan** — refusal-shaped, spelled in product source, and the registry does not hold it and
 *   no vocabulary declares it. The code exists in the tree and nowhere in the law.
 * - **spelled but not wired** — a registered code spelled as a bare literal in a file that does not
 *   import the register. The name agrees with the taxonomy today by coincidence, not by reading it.
 * - **foreign, declared** — a name `TRANSPORT_VOCABULARY` declares as somebody else's: a transport
 *   code, a vendor code, a rule-set name, an environment key. Declared once, never an orphan.
 *
 * Names are read off the syntax tree, never off the text: a code named in a comment is prose, and
 * prose spells nothing (Q-07). "Refusal-shaped" is the literal shape below, applied to every name a
 * file spells statically — a string literal, a template with nothing substituted into it, and a
 * concatenation or an interpolation whose parts are themselves static. Assembling a code from parts
 * is therefore the same spelling as writing it out, and buys nothing: no evasion idiom exists.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { REFUSALS } from "../../src/core/errors";
import { TRANSPORT_VOCABULARY } from "../../src/core/errors/transport-vocabulary";
import unitLaneConfig from "../../vitest.config";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The one home of the taxonomy: the file a spelling of a registered code has to be reading. */
const REGISTER = join(REPO_ROOT, "src", "core", "errors.ts");

/**
 * The scan's refusal shape — its own heuristic for the orphan domain, not a Bible word. Q-07 defines
 * an orphan as refusal-shaped and unregistered, and a one-word SCREAMING constant (`GET`, `UTC`,
 * `PDF`) cannot be told from an unregistered one-word code by shape alone, so the underscore
 * requirement stays for orphans. A REGISTERED code is a refusal code by definition (R-SPINE-062;
 * L-AI-02 fixes `UNSOURCED` and `MALFORMED` without an underscore) and is admitted as a spelling
 * wherever the register's own names are asked after, whatever this shape says of it.
 */
export const REFUSAL_SHAPE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/** The extensions the layered tree is written in. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts"];

/** Directories no scan of source descends into. */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "coverage", "test-results", "playwright-report"]);

/**
 * The one corpus the exercise question is withheld from: this register itself. Were it counted, the
 * register test would exercise every code it names and the question would answer itself. Everything
 * else about "does a lane run this file" is asked of the lane's own config, never of a list here.
 */
const NOT_AN_EXERCISE = ["tests/refusal-register"];

/** One finding: the name, and the file that spells it. */
export type RefusalFinding = {
  code: string;
  file: string;
};

/** The three classifications, kept apart (Q-07). */
export type RefusalScan = {
  orphans: RefusalFinding[];
  unwired: RefusalFinding[];
  foreign: RefusalFinding[];
};

const registeredCodes = (): Set<string> => new Set(Object.keys(REFUSALS));

const declaredForeign = (): Set<string> => new Set(TRANSPORT_VOCABULARY.flatMap((entry) => [...entry.codes]));

/** How a finding names its file: repo-relative where the file is in the tree, absolute otherwise. */
function displayPath(file: string): string {
  const inside = relative(REPO_ROOT, file);
  return inside.startsWith("..") ? file : inside.split(sep).join("/");
}

/**
 * Is this path test-side, and so outside the orphan domain entirely? Q-07 defines an orphan as a
 * refusal-shaped code spelled in PRODUCT source, and defines "exercised" as being named in a test —
 * the clause partitions test files out of the domain it judges, or every exercising test would
 * create the orphan it exists to clear. A `__tests__` directory segment names test scaffolding as
 * plainly as a `*.test.*` basename does: acceptance support modules carry ordinary basenames and
 * live beside the cases that import them (settled by arbitration on this increment).
 */
const isTestFile = (name: string): boolean =>
  name.includes(".test.") || name.split(/[/\\]/).includes("__tests__");

/**
 * One glob as a regular expression over a repo-relative POSIX path, in the grammar the lane's globs
 * are written in: a doubled star followed by a separator spans any number of directories including
 * none, a doubled star alone spans anything, and `*` and `?` stop at a separator.
 */
function globToRegExp(glob: string): RegExp {
  let pattern = "";
  let index = 0;
  while (index < glob.length) {
    if (glob.startsWith("**/", index)) {
      pattern += "(?:.*/)?";
      index += 3;
      continue;
    }
    if (glob.startsWith("**", index)) {
      pattern += ".*";
      index += 2;
      continue;
    }
    const char = glob.charAt(index);
    index += 1;
    if (char === "*") pattern += "[^/]*";
    else if (char === "?") pattern += "[^/]";
    else pattern += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${pattern}$`);
}

const globs = (patterns: string | readonly string[] | undefined): RegExp[] =>
  (typeof patterns === "string" ? [patterns] : (patterns ?? [])).map(globToRegExp);

/**
 * "Executed" answered by the lane, not by a list: a file is exercised only if the unit lane's own
 * `include` collects it and its `exclude` does not drop it (Q-07 — a name in a lane nothing runs
 * exercises nothing). Read off `vitest.config.ts` itself, so a glob changed there changes this.
 */
const LANE_INCLUDE = globs(unitLaneConfig.test?.include);
const LANE_EXCLUDE = globs(unitLaneConfig.test?.exclude);

/** Does an armed lane collect this file — and is it a corpus the exercise question is asked of? */
export function isExecutedTest(file: string): boolean {
  const where = relative(REPO_ROOT, file);
  if (where.startsWith("..")) return false;
  const posix = where.split(sep).join("/");
  if (NOT_AN_EXERCISE.some((directory) => posix === directory || posix.startsWith(`${directory}/`))) return false;
  return LANE_INCLUDE.some((glob) => glob.test(posix)) && !LANE_EXCLUDE.some((glob) => glob.test(posix));
}

const isSourceName = (name: string): boolean => SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension)) && !name.endsWith(".d.ts");

/** Every source file under a root, in a stable order, minus the directories nothing is scanned in. */
function sourceFilesUnder(root: string, accept: (path: string) => boolean): string[] {
  const absolute = resolve(root);
  if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`the scan was pointed at "${root}", which is not a directory — there is nothing to read there`);
  }
  const found: string[] = [];
  const walk = (directory: string): void => {
    // Code-point order, not the platform's collation: a stable walk order is all this needs, and
    // the tree's sole caller of the locale machinery is the format seam (LAW-FMT).
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(path);
      } else if (entry.isFile() && isSourceName(entry.name) && accept(path)) {
        found.push(path);
      }
    }
  };
  walk(absolute);
  return found;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function eachNode(source: ts.SourceFile, visit: (node: ts.Node) => void): void {
  const descend = (node: ts.Node): void => {
    visit(node);
    node.forEachChild(descend);
  };
  source.forEachChild(descend);
}

/**
 * The text a node spells statically, or null when the value is only known at run time. A literal, a
 * template with nothing substituted, and a concatenation or interpolation of such parts all spell
 * one name — the parts an expression is written in are a matter of typography, not of meaning.
 */
function staticText(node: ts.Node): string | null {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return staticText(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticText(node.left);
    const right = staticText(node.right);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) {
      const substituted = staticText(span.expression);
      if (substituted === null) return null;
      text += substituted + span.literal.text;
    }
    return text;
  }
  return null;
}

/**
 * The name a declaration spells as an unquoted key, or null. `{ SOME_CODE: … }` and `"SOME_CODE": …`
 * are the same spelling to a reader, and quoting is typography — so the scan reads both.
 */
function declaredKey(node: ts.Node): string | null {
  if (!ts.isPropertyAssignment(node) && !ts.isPropertySignature(node) && !ts.isEnumMember(node) && !ts.isMethodDeclaration(node)) return null;
  return node.name !== undefined && ts.isIdentifier(node.name) ? node.name.text : null;
}

/**
 * The refusal-shaped names a file spells — every static spelling, and nothing a comment says. A
 * registered code is a spelling whatever its shape, so a bare `UNSOURCED` in a file that does not
 * import the register is still found "spelled but not wired" (Q-07).
 */
function literalNames(source: ts.SourceFile, registered: ReadonlySet<string>): Set<string> {
  const names = new Set<string>();
  const add = (text: string | null): void => {
    if (text !== null && (REFUSAL_SHAPE.test(text) || registered.has(text))) names.add(text);
  };
  const walk = (node: ts.Node): void => {
    const text = staticText(node);
    if (text !== null) {
      // The parts of one spelling are not spellings of their own, so a folded name ends the descent.
      add(text);
      return;
    }
    // Text a screen paints is a spelling: `<span>SOME_CODE</span>` shows a user the same name a
    // string literal would, and a screen-local refusal block is exactly the shape R-UI-020 refuses.
    if (ts.isJsxText(node)) {
      add(node.text.trim());
      return;
    }
    // A key is a spelling, but only the key — the value under it is spelled in its own right.
    add(declaredKey(node));
    node.forEachChild(walk);
  };
  source.forEachChild(walk);
  return names;
}

/** Every module specifier a file reaches for, however it reaches — import, export-from, dynamic. */
function specifiers(source: ts.SourceFile): string[] {
  const found: string[] = [];
  const take = (node: ts.Node | undefined): void => {
    if (node !== undefined && ts.isStringLiteralLike(node)) found.push(node.text);
  };
  eachNode(source, (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) take(node.moduleSpecifier);
    else if (ts.isImportTypeNode(node)) take(node.argument.kind === ts.SyntaxKind.LiteralType ? (node.argument as ts.LiteralTypeNode).literal : undefined);
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")) take(node.arguments[0]);
  });
  return found;
}

/** One `paths` entry, split at its wildcard: `"@/*": ["./src/*"]` reads prefix `@/`, suffix `""`. */
type PathAlias = { prefix: string; suffix: string; targets: readonly string[] };

/**
 * The module aliases tsconfig declares, read from the file so the scan resolves a specifier the way
 * the compiler does. `@/core/errors` is this tree's established idiom for reaching src, and an alias
 * import is an import (Q-07): a file wired through one is wired.
 */
function pathAliases(): { baseUrl: string; aliases: PathAlias[] } {
  const read = ts.readConfigFile(join(REPO_ROOT, "tsconfig.json"), ts.sys.readFile);
  const options: unknown = (read.config as { compilerOptions?: unknown } | undefined)?.compilerOptions;
  const { baseUrl, paths } = (options ?? {}) as { baseUrl?: string; paths?: Record<string, string[]> };
  const aliases: PathAlias[] = [];
  for (const [pattern, targets] of Object.entries(paths ?? {})) {
    const star = pattern.indexOf("*");
    if (star === -1) aliases.push({ prefix: pattern, suffix: "", targets });
    else aliases.push({ prefix: pattern.slice(0, star), suffix: pattern.slice(star + 1), targets });
  }
  return { baseUrl: resolve(REPO_ROOT, baseUrl ?? "."), aliases };
}

const { baseUrl: ALIAS_BASE, aliases: PATH_ALIASES } = pathAliases();

/** Every path a specifier could name from this file — relative resolution, then each alias. */
function specifierBases(file: string, specifier: string): string[] {
  if (specifier.startsWith(".")) return [resolve(dirname(file), specifier)];
  const bases: string[] = [];
  for (const { prefix, suffix, targets } of PATH_ALIASES) {
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    if (specifier.length < prefix.length + suffix.length) continue;
    const matched = specifier.slice(prefix.length, specifier.length - suffix.length);
    for (const target of targets) bases.push(resolve(ALIAS_BASE, target.replace("*", matched)));
  }
  return bases;
}

/** Does this file read the register — is it wired to the taxonomy, or only in agreement with it? */
function importsRegister(file: string, source: ts.SourceFile): boolean {
  if (resolve(file) === REGISTER) return true;
  return specifiers(source).some((specifier) =>
    specifierBases(file, specifier).some((base) =>
      [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, join(base, "index.ts")].some((candidate) => candidate === REGISTER),
    ),
  );
}

/**
 * Classify every refusal-shaped literal in the non-test source under `root`. The law it classifies
 * against is always this tree's own — the registry and the vocabulary table — whatever `root` is,
 * so a fixture corpus is judged by exactly the rules the product tree is judged by.
 */
export async function scanRefusals(root: string): Promise<RefusalScan> {
  const registered = registeredCodes();
  const foreignNames = declaredForeign();
  const scan: RefusalScan = { orphans: [], unwired: [], foreign: [] };

  for (const file of sourceFilesUnder(root, (path) => !isTestFile(relative(root, path)))) {
    const source = parse(file);
    const names = literalNames(source, registered);
    if (names.size === 0) continue;
    const wired = importsRegister(file, source);
    const where = displayPath(file);
    for (const code of names) {
      if (registered.has(code)) {
        if (!wired) scan.unwired.push({ code, file: where });
      } else if (foreignNames.has(code)) {
        scan.foreign.push({ code, file: where });
      } else {
        scan.orphans.push({ code, file: where });
      }
    }
  }
  return scan;
}

/**
 * Which refusal-shaped names the executed test corpus actually names, and where. A name counts when
 * a test spells it — as a literal, or as the identifier or property a test reads it by — and never
 * when a comment mentions it (Q-07). A registered code counts whatever its shape: the clause
 * conditions exercise on the lane and on being a name, never on an underscore count.
 */
export async function exercisedNames(roots: readonly string[]): Promise<Map<string, string[]>> {
  const spoken = new Map<string, string[]>();
  const registered = registeredCodes();
  const record = (code: string, file: string): void => {
    const already = spoken.get(code);
    if (already === undefined) spoken.set(code, [file]);
    else if (!already.includes(file)) already.push(file);
  };

  for (const root of roots) {
    for (const file of sourceFilesUnder(root, isExecutedTest)) {
      const source = parse(file);
      const where = displayPath(file);
      eachNode(source, (node) => {
        const name = ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : null;
        if (name !== null && (REFUSAL_SHAPE.test(name) || registered.has(name))) record(name, where);
      });
    }
  }
  return spoken;
}

/**
 * Q-07's admission, in one place: a registered code is admitted when an executed test names it, or
 * when a deferral names it with an owner — and a code with neither is returned here, unadmitted.
 * The two branches are independent, so the deferral half can be proved on a corpus that names
 * nothing (which is the only condition under which that half is what does the admitting).
 */
export function unadmittedCodes(
  codes: readonly string[],
  spoken: ReadonlyMap<string, readonly string[]>,
  deferrals: Readonly<Record<string, string>>,
): string[] {
  return codes.filter((code) => {
    const exercised = spoken.get(code) ?? [];
    const deferral = deferrals[code] ?? "";
    return exercised.length === 0 && deferral.trim().length === 0;
  });
}
