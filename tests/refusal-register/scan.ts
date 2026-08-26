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
 * prose spells nothing (Q-07). "Refusal-shaped" is the literal shape below, applied to string
 * literals and to templates with nothing substituted into them — a name assembled from parts is not
 * a spelling of anything, which is why no evasion idiom exists to write.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { REFUSALS } from "../../src/core/errors";
import { TRANSPORT_VOCABULARY } from "../../src/core/errors/transport-vocabulary";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The one home of the taxonomy: the file a spelling of a registered code has to be reading. */
const REGISTER = join(REPO_ROOT, "src", "core", "errors.ts");

/** Q-07's refusal shape, verbatim. */
export const REFUSAL_SHAPE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/** The extensions the layered tree is written in. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts"];

/** Directories no scan of source descends into. */
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "coverage", "test-results", "playwright-report"]);

/**
 * The corpora the exercise question is asked of, as repo-relative directories the walk stays out of:
 * this register itself — else the register test would exercise every code it names and the question
 * would answer itself — and the lint corpus, whose files are deliberate payload no lane executes.
 */
const NOT_AN_EXERCISE = ["tests/refusal-register", "tests/lint-fixtures", "tests/e2e"];

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

const isTestFile = (name: string): boolean => name.includes(".test.");

const isSourceName = (name: string): boolean => SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension)) && !name.endsWith(".d.ts");

/** Every source file under a root, in a stable order, minus the directories nothing is scanned in. */
function sourceFilesUnder(root: string, accept: (name: string) => boolean): string[] {
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
      } else if (entry.isFile() && isSourceName(entry.name) && accept(entry.name)) {
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

/** The refusal-shaped names a file spells as a literal — the only spelling Q-07 counts as one. */
function literalNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  eachNode(source, (node) => {
    if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) return;
    if (REFUSAL_SHAPE.test(node.text)) names.add(node.text);
  });
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

/** Does this file read the register — is it wired to the taxonomy, or only in agreement with it? */
function importsRegister(file: string, source: ts.SourceFile): boolean {
  if (resolve(file) === REGISTER) return true;
  return specifiers(source).some((specifier) => {
    if (!specifier.startsWith(".")) return false;
    const base = resolve(dirname(file), specifier);
    return [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, join(base, "index.ts")].some((candidate) => candidate === REGISTER);
  });
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

  for (const file of sourceFilesUnder(root, (name) => !isTestFile(name))) {
    const source = parse(file);
    const names = literalNames(source);
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
 * when a comment mentions it (Q-07).
 */
export async function exercisedNames(roots: readonly string[]): Promise<Map<string, string[]>> {
  const excluded = NOT_AN_EXERCISE.map((directory) => join(REPO_ROOT, directory));
  const spoken = new Map<string, string[]>();
  const record = (code: string, file: string): void => {
    const already = spoken.get(code);
    if (already === undefined) spoken.set(code, [file]);
    else if (!already.includes(file)) already.push(file);
  };

  for (const root of roots) {
    for (const file of sourceFilesUnder(root, isTestFile)) {
      if (excluded.some((directory) => resolve(file).startsWith(directory + sep))) continue;
      const source = parse(file);
      const where = displayPath(file);
      eachNode(source, (node) => {
        const name = ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : null;
        if (name !== null && REFUSAL_SHAPE.test(name)) record(name, where);
      });
    }
  }
  return spoken;
}
