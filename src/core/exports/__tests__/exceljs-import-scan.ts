// R-SPINE-041's ban, as a committed scan: under `src/**`, only the export seam may name `exceljs`.
//
// "Excel (.xlsx) and CSV exports through one export seam" is a claim about the tree, not only about
// a module: a second caller of the spreadsheet library would be a second answer to how a workbook is
// escaped, formatted and made byte-deterministic, and the first consumer to reach past
// `@/core/exports` would take the determinism with it. So every consumer asks the seam for an
// artefact, and `src/core/exports/**` is the one address the library is spelled at.
//
// It is a scan rather than an ESLint rule because `scripts/eslint/**` and `eslint.config.mjs` are
// locked outside a toolchain tag: the same mechanism L-CAD-06's view-type spellings, L-FRM-06's
// conversion factors and SEAM-GATE's import ban are already banned by, so there is one way of
// banning a spelling in this tree rather than five (B-17). It is proved on the committed corpus
// `tests/lint-fixtures/export-seam/`, which `tests/toolchain/lint-law.test.ts` names (ARCH-01, Q-08).
//
// What is judged is the MODULE SPECIFIER of a statement that reaches another module — the specifier
// of an `import`/`export … from` declaration, of a bare `import "…"`, of a dynamic `import("…")` and
// of a `require("…")` — never a run of characters on a line. Prose naming the library is not a reach
// (Q-17), and neither is a plain string that merely spells it.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
// white-box: AC-2 — the ban IS a claim about source text ("an `exceljs` import anywhere under
// `src/**` outside `src/core/exports/**` is refused"): a file that reaches the library and one that
// does not answer every call identically, so there is no runtime observable to drive. This is the
// SHIPPED scanner the criterion drives, and it reads the tree it bans through the tree's one lexer.
import { dialectOf, lex, scanned } from "../../../../tests/support/source-lex";

/** The module the ban is about. A specifier is this exactly; `exceljs/lib/…` names it too. */
const LIBRARY = "exceljs";

/** The one address under `src/**` that may name it — the seam itself, its own suites included. */
export const EXPORT_SEAM_ROOT = "src/core/exports";

/** The layered root the ban governs: product source, and nothing else the repository holds. */
const SOURCE_ROOT = "src";

/**
 * Where a committed corpus payload stands when it is judged. A fixture under
 * `tests/lint-fixtures/<slug>/` is not product source where its bytes live — it exists to be
 * scanned — so it is judged at the layered address it names, `src/core/<slug>/`. That is what makes
 * the payload a file the ban governs and its lawful counterpart's `../exports` the seam itself.
 */
const CORPUS_ROOT = "tests/lint-fixtures";
const CORPUS_ADDRESS = "src/core";

/** Directories a scan of the tree never descends into: none of them is source this repository wrote. */
const NOT_SOURCE: readonly string[] = Object.freeze(["node_modules", ".next", ".git", "dist", "coverage"]);

/** One reach at the library: where it was written, the line that spells it, and that line's text. */
export type ExceljsImport = {
  /** The file as the caller named it — the path the scan was handed, not a virtual address. */
  readonly file: string;
  /** The line the module specifier stands on: a statement is reported where it names its module. */
  readonly line: number;
  /** The line itself, so a finding quotes what it fired on rather than only pointing at it. */
  readonly text: string;
  /** The specifier as written, so `exceljs` and `exceljs/lib/…` are told apart in the report. */
  readonly specifier: string;
};

/** A string literal as the lexer read it: what it holds, where it opened, and on which line. */
type Literal = { readonly text: string; readonly at: number; readonly line: number };

/**
 * Every string literal of a source text, with the place it opened at.
 *
 * The reading is the tree's one lexical machine's (`tests/support/source-lex`), which is what knows
 * that a `//` inside a URL opens no comment, that a quote inside a regular expression opens no
 * literal and that a quote in JSX copy is ordinary text. Only the positions are collected here,
 * because `lex()` publishes the literals without them and a finding names a line.
 */
function literalsOf(source: string, dialect: ReturnType<typeof dialectOf>): Literal[] {
  const literals: Literal[] = [];
  let open: { text: string; at: number; line: number } | null = null;
  let line = 1;
  for (const { index, char, mode, edge } of scanned(source, dialect)) {
    const inside = mode === "single" || mode === "double" || mode === "template";
    if (inside && (open === null || edge === "open")) open = { text: "", at: index, line };
    if (inside && edge === null && open !== null) open.text += char;
    if (!inside && open !== null) {
      literals.push(open);
      open = null;
    }
    if (char === "\n") line += 1;
  }
  if (open !== null) literals.push(open);
  return literals;
}

/**
 * Is the literal at this place a module specifier — the thing a statement reaches another module by?
 *
 * The code standing before it decides, read off the lexer's own mask so a comment or an earlier
 * literal can never be mistaken for it: `from` carries an `import`/`export … from` declaration, a
 * bare `import` carries both `import "…"` and `import("…")`, and `require` carries the CommonJS
 * spelling. A plain string that merely spells the library follows an `=`, a `(` of some other call or
 * a `,`, and reaches nothing.
 *
 * A loader wears more than one spelling, and each is a reach: `require.resolve("…")` asks the same
 * resolver the same question and hands the module's path to whatever wants it, and
 * `createRequire(import.meta.url)("…")` is a require built one line earlier. A ban that saw only the
 * bare spellings would be a ban with a door beside it, so the resolver's own name and a require made
 * on the spot are read as the loaders they are.
 */
function isSpecifier(code: string, at: number): boolean {
  const before = code.slice(0, at).replace(/\s+$/u, "");
  const call = before.endsWith("(") ? before.slice(0, -1).replace(/\s+$/u, "") : before;
  return /\bfrom$/u.test(before) || LOADER.test(call) || LOADER_MADE_HERE.test(call);
}

/** The loaders named outright: `import`, `require`, and the resolver `require` carries. */
const LOADER = /\b(?:import|require)(?:\.resolve)?$/u;

/** A require built on the spot and called at once — `createRequire(…)("…")`, `require(…)( … )`. */
const LOADER_MADE_HERE = /\b(?:createRequire|require)\s*\([^()]*\)$/u;

/** Does this specifier reach the library — as itself, or as one of its own deep modules? */
function namesTheLibrary(specifier: string): boolean {
  return specifier === LIBRARY || specifier.startsWith(`${LIBRARY}/`);
}

/**
 * The layered address a path stands at, or `null` for a path that is not product source at all.
 *
 * A real source file already IS its own address, read from its last `src/` segment so the checkout's
 * own location plays no part. A corpus payload is judged at the address its slug names, which is what
 * puts it under the ban the seam is exempt from.
 */
function virtualPathOf(path: string): string | null {
  const posix = path.split("\\").join("/");
  const under = `/${posix}`.lastIndexOf(`/${SOURCE_ROOT}/`);
  if (under !== -1) return `/${posix}`.slice(under + 1);
  const corpus = `/${posix}`.lastIndexOf(`/${CORPUS_ROOT}/`);
  if (corpus !== -1) return `${CORPUS_ADDRESS}/${`/${posix}`.slice(corpus + 1 + CORPUS_ROOT.length + 1)}`;
  return null;
}

/** Is this address the seam's own — the one place under `src/**` the library may be named? */
function insideTheSeam(address: string): boolean {
  return address === EXPORT_SEAM_ROOT || address.startsWith(`${EXPORT_SEAM_ROOT}/`);
}

/**
 * Every TypeScript file under a directory, in a stable order so a report reads the same twice.
 *
 * The order is over code points, not a collation: a path is a machine's identifier and the report is
 * read by a diff, so what is wanted is the same order on every machine. Collation is a person's
 * reading order and has one home in this tree (L-FMT-01), which is not here.
 */
// white-box: AC-2 — "nothing over the real `src/**` tree outside `src/core/exports/**`" is a claim
// about every file that stands there, so the scanner has to enumerate them; a directory listing is
// the only way to learn which files exist, and no product call reveals it.
function sourceFilesUnder(directory: string): string[] {
  // white-box: AC-2 — the walk's one read: the entries of a directory under src/, named above.
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    .flatMap((entry) => {
      const here = join(directory, entry.name);
      // white-box: AC-2 — the walk descends, so the ban is proved over the whole layered tree.
      if (entry.isDirectory()) return NOT_SOURCE.includes(entry.name) ? [] : sourceFilesUnder(here);
      return entry.isFile() && /\.tsx?$/u.test(entry.name) ? [here] : [];
    });
}

/**
 * Every reach at `exceljs` from a file the ban governs, under the directory named.
 *
 * A file the seam owns is read and reported on never: the seam spells the very same imports
 * lawfully, so a scan that fired on the characters rather than on the layer would ban the one caller
 * R-SPINE-041 exists to have. A file that stands at no layered address — anything outside `src/**`
 * and outside a committed corpus — is not product source and is not judged.
 */
export function scanExceljsImports(root: string): readonly ExceljsImport[] {
  const found: ExceljsImport[] = [];
  // white-box: AC-2 — every file under the root the criterion names, enumerated by the walk above.
  for (const file of sourceFilesUnder(root)) {
    const address = virtualPathOf(file);
    if (address === null || insideTheSeam(address)) continue;
    // white-box: AC-2 — a ban on reaching a module has no runtime observable: a file that imports
    // the library and one that does not answer every call identically, so the text is the only
    // subject there is. This is the shipped scanner the criterion drives, and it reads the imports
    // it bans.
    const source = readFileSync(file, "utf8");
    // A file that does not spell the library at all cannot reach it, and lexing the whole tree
    // character by character to learn that is work the scan can simply not do.
    if (!source.includes(LIBRARY)) continue;
    const lines = source.split("\n");
    const dialect = dialectOf(file);
    // The code half of the file, blanked of comments and literals with every other index left where
    // it was, so an index into it is an index into the file. `lex()` publishes exactly this reading.
    const { code } = lex(source, dialect);
    for (const literal of literalsOf(source, dialect)) {
      if (!namesTheLibrary(literal.text) || !isSpecifier(code, literal.at)) continue;
      found.push({ file, line: literal.line, text: (lines[literal.line - 1] ?? "").trim(), specifier: literal.text });
    }
  }
  return Object.freeze(found);
}
