// R-SPINE-041's ban, as a committed scan: nothing under `src/**` may name the spreadsheet library
// except the export seam itself (`src/core/exports/**`).
//
// "Excel (.xlsx) and CSV exports through one export seam" — and one seam is only one while one module
// knows how a workbook is written. Every other consumer asks `@/core/exports` for an artefact, so a
// second caller of the library is a second answer to formatting, escaping and determinism (B-17).
//
// It is a scan rather than an ESLint rule because `scripts/eslint/**` and `eslint.config.mjs` are
// locked outside a toolchain tag: the same mechanism SEAM-GATE's import ban and L-FRM-06's conversion
// factors are banned by, so there is one way of banning a spelling in this tree rather than three.
//
// What is judged is the MODULE SPECIFIER of a statement that reaches another module — the specifier
// of an `import`/`export … from` declaration, of a bare `import "…"`, of a dynamic `import("…")` and
// of a `require("…")` — never a run of characters on a line. The library named in prose (this comment
// names it four times) reaches nothing and is reported nowhere; the reading is the tree's one lexer's
// (Q-17, B-17).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
// white-box: AC-2 — a ban on naming a package has no runtime observable: a file that imports exceljs
// and one that asks the seam answer every call identically, so the text is the only subject there is.
// This is the shipped scanner the criterion drives, and it reads the imports it bans — through
// `scanned()`, the one lexical machine, so a comment and a literal are never read as code.
import { dialectOf, scanned } from "../../../../tests/support/source-lex";

/** The library this seam owns, at the specifier a reach spells it by. */
const LIBRARY = "exceljs";

/** The one module allowed to name it, as a layered address. */
const SEAM = "src/core/exports";

/** Directories a source scan never descends into: build output and installed packages. */
const UNREAD = new Set(["node_modules", ".git", ".next", "dist", "coverage", ".turbo"]);

/** The extensions product source is written in. */
const SOURCE = [".ts", ".tsx", ".mts", ".cts"];

/** The modes a module specifier is written in — a template states no import this tree ever spells. */
const QUOTED_MODES = new Set(["single", "double"]);

/**
 * The code that may stand between a reaching keyword and the specifier it reaches by: `from` ends an
 * `import`/`export` declaration, `import(` a dynamic one and `require(` a CommonJS one. The keyword
 * is required to stand on its own — `Array.from("…")` and `thing.import` reach nothing.
 */
const REACHES = /(?<![.\w$])(?:from|import|require)\s*\(?\s*$/u;

/** Enough code before a quote to decide the reading above — the longest keyword in it is seven. */
const TAIL = 32;

/** One reach at the library: the file that spelled it, the line, and the line as it is written. */
export type ExceljsImport = {
  readonly file: string;
  readonly line: number;
  readonly text: string;
};

/** Every source file under a root, in a stable order, build output and packages left unread. */
function sourceFilesUnder(root: string): string[] {
  const found: string[] = [];
  // Ordered by the bytes of the name, never by a collation: a scan's order is a machine's, and
  // `src/core/format.ts` is the tree's sole caller of `Intl` (L-FMT-01).
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const here = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!UNREAD.has(entry.name)) found.push(...sourceFilesUnder(here));
      continue;
    }
    if (entry.isFile() && SOURCE.some((extension) => entry.name.endsWith(extension))) found.push(here);
  }
  return found;
}

/**
 * The layered address a path stands at: everything from its last `src/` segment. A corpus payload
 * committed outside the tree is judged at the address its own layout gives it — the ban is about the
 * LAYER a file stands in, not about where its bytes happen to live — and a real source file already
 * IS its own address, so one reading names both.
 */
function addressOf(path: string): string {
  const posix = path.split("\\").join("/");
  const at = `/${posix}`.lastIndexOf("/src/");
  return at === -1 ? posix : `/${posix}`.slice(at + 1);
}

/** Is this file the seam itself — the one module, its writers and its own tests? */
function isTheSeam(address: string): boolean {
  return address === SEAM || address.startsWith(`${SEAM}/`);
}

/** Does this specifier reach the library — the package itself, or a module inside it? */
function reachesTheLibrary(specifier: string): boolean {
  return specifier === LIBRARY || specifier.startsWith(`${LIBRARY}/`);
}

/**
 * Every module specifier a source reaches another module by, with the line that spells it.
 *
 * The source is read through `scanned()` so what is judged is code and only code: the characters of a
 * comment and of a literal are blanked, which is what lets the keyword before a quote be looked for
 * in the text as written. A specifier is a quoted run whose code ends in a reach.
 */
function reachesOf(file: string, source: string): { specifier: string; line: number }[] {
  const reaches: { specifier: string; line: number }[] = [];
  let tail = "";
  let quoted: { text: string; line: number; reaching: boolean } | null = null;
  let line = 1;

  for (const { char, mode, edge } of scanned(source, dialectOf(file))) {
    if (QUOTED_MODES.has(mode)) {
      if (edge === "open") quoted = { text: "", line, reaching: REACHES.test(tail) };
      else if (quoted !== null && edge === null) quoted.text += char;
      else if (quoted !== null && edge === "close") {
        if (quoted.reaching) reaches.push({ specifier: quoted.text, line: quoted.line });
        quoted = null;
      }
    }
    // Only code is remembered, and only as much of it as a keyword can stand in: what precedes a
    // quote decides whether the quote is a module specifier at all.
    tail = `${tail}${mode === "code" ? char : " "}`.slice(-TAIL);
    if (char === "\n") line += 1;
  }
  return reaches;
}

/**
 * Every reach at the spreadsheet library from a file that is not the seam.
 *
 * The seam's own files are read and reported on never: they spell the very same import lawfully, and
 * a scan that fired on the characters rather than on the layer would ban the one module the seam
 * exists to be.
 */
export function scanExceljsImports(root: string): ExceljsImport[] {
  const found: ExceljsImport[] = [];
  for (const file of sourceFilesUnder(root)) {
    if (isTheSeam(addressOf(file))) continue;
    const source = readFileSync(file, "utf8");
    if (!source.includes(LIBRARY)) continue;
    const lines = source.split("\n");
    for (const reach of reachesOf(file, source)) {
      if (!reachesTheLibrary(reach.specifier)) continue;
      found.push({ file, line: reach.line, text: (lines[reach.line - 1] ?? "").trim() });
    }
  }
  return found;
}
