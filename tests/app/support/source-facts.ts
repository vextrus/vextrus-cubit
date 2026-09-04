/**
 * What the src/app suites need to ask OF A FILE rather than of a running screen: which modules it
 * imports, what its comments say, and what its code says once comments and literals are out of the
 * way. Every reading is derived from the one lexer (`tests/support/source-lex`, B-17) — nothing here
 * re-derives a comment stripper — and the module under test is loaded by path so a file the product
 * does not provide yet fails as a named absence rather than as a collection death.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { dialectOf, lexFile, scanned } from "../../support/source-lex";

/** A repo-relative path, resolved against the checkout the suite is running in. */
export function repoPath(relative: string): string {
  return resolve(process.cwd(), relative);
}

/** The text of a file the criteria name, or a failure that says which file the product still owes. */
export function sourceOf(relative: string): string {
  const absolute = repoPath(relative);
  if (!existsSync(absolute)) throw new Error(`${relative} is missing from the tree — the product does not provide it yet`);
  return readFileSync(absolute, "utf8");
}

/** A product module by repo-relative path: absent means "not written yet", never "cannot collect". */
export async function productModule<T>(relative: string): Promise<T> {
  const absolute = repoPath(relative);
  if (!existsSync(absolute)) throw new Error(`${relative} is missing from the tree — the product does not provide it yet`);
  return (await import(pathToFileURL(absolute).href)) as T;
}

/** The file masked down to its code: comments, literals and rendered JSX copy blanked out. */
export function codeOf(relative: string): string {
  return lexFile(relative, sourceOf(relative)).code;
}

/** Every comment of the file, whitespace-normalised. */
export function commentsOf(relative: string): readonly string[] {
  return lexFile(relative, sourceOf(relative)).comments;
}

/**
 * The file with its comments blanked and everything else left where it stands. A selector or an
 * import specifier IS a quoted literal, so the code mask cannot answer questions about one; this
 * reading can, and a phrase written in prose still cannot be mistaken for a phrase written in code.
 * Offsets are preserved, so an index into this string is an index into the file.
 */
export function withoutComments(relative: string): string {
  const source = sourceOf(relative);
  const chars = source.split("");
  for (const { index, char, mode } of scanned(source, dialectOf(relative))) {
    if (mode === "line" || mode === "block") chars[index] = char === "\n" ? "\n" : " ";
  }
  return chars.join("");
}

/** One import statement: where it reads from, and the names it binds. */
export interface ImportLine {
  readonly specifier: string;
  readonly names: readonly string[];
}

/**
 * Every static import of a module, read off the code mask (so an `import` written in prose or in a
 * literal is not one) with the specifier read back from the source at the same offsets (so the
 * literal the mask blanked is still legible). `import(…)` and `import.meta` are not statements.
 */
export function importsOf(relative: string): readonly ImportLine[] {
  const source = sourceOf(relative);
  const code = lexFile(relative, source).code;
  const lines: ImportLine[] = [];
  const keyword = /\bimport\b/g;
  for (let match = keyword.exec(code); match !== null; match = keyword.exec(code)) {
    const start = match.index;
    const after = code.charAt(start + "import".length);
    if (after === "(" || after === ".") continue;
    const semicolon = code.indexOf(";", start);
    const end = semicolon === -1 ? code.length : semicolon;
    const clause = code.slice(start, end);
    const from = clause.search(/\bfrom\b(?![\s\S]*\bfrom\b)/);
    const specifierAt = start + (from === -1 ? "import".length : from + "from".length);
    const specifier = source.slice(specifierAt, end).trim().replace(/^["'`]/, "").replace(/["'`]$/, "");
    // A statement whose specifier does not read as one path is not an import statement at all.
    if (specifier === "" || /[\s{}();]/.test(specifier)) continue;
    const bound = from === -1 ? "" : clause.slice("import".length, from);
    const names = bound
      .replace(/[{}*]/g, " ")
      .split(",")
      .map((part) => part.trim().split(/\s+/).at(-1) ?? "")
      .filter((name) => name !== "" && name !== "type");
    lines.push({ specifier, names });
  }
  return lines;
}
