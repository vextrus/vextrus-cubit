/**
 * The readings the sweep's source-shaped criteria ask for, derived from the ONE lexical machine
 * (`tests/support/source-lex`, B-17/ARCH-02): nothing here re-implements a comment stripper or a
 * quote scanner, and nothing counts `../` or parses TypeScript with the compiler.
 *
 * Only criteria whose subject IS the text — "this module imports nothing from that barrel", "this
 * comment tells the truth about a count", "this token appears nowhere outside a comment" — read a
 * file through here. Every call site carries a `// white-box: <AC-id> — <why>` marker; behaviour is
 * driven through the product, never inferred from its source.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { dialectOf, lexFile, type Lexed } from "../../support/source-lex";

/** The checkout these suites judge. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * A repo-relative file, read as text. A file the Builder has not written yet fails as an assertion
 * naming it — the same contract `productModule` keeps — never as an unreadable ENOENT.
 */
export function sourceOf(relative: string): string {
  const path = join(REPO_ROOT, relative);
  expect(existsSync(path), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return readFileSync(path, "utf8");
}

/** A repo-relative file, in the three readings the lexer derives (comments / strings / code). */
export function lexed(relative: string): Lexed {
  return lexFile(relative, sourceOf(relative));
}

/** One static import statement: what it binds, and the specifier it binds it from. */
export interface ImportRecord {
  /** The clause between `import` and `from`, or "" for a side-effect import. */
  readonly clause: string;
  /** The module specifier, exactly as written. */
  readonly specifier: string;
}

/**
 * Every static import of a file. The `import` keywords are located in the CODE channel — so a word
 * written in prose or inside a literal is never mistaken for one — and the specifier is then read at
 * that same index of the original source, because the code channel blanks string literals by design.
 */
export function importsOf(relative: string): ImportRecord[] {
  const source = sourceOf(relative);
  const { code } = lexed(relative);
  const found: ImportRecord[] = [];
  for (const match of code.matchAll(/\bimport\b/g)) {
    const at = match.index;
    const after = code.charAt(at + "import".length);
    // `import(` is a dynamic import and `import.meta` is not an import statement at all.
    if (after === "(" || after === ".") continue;
    const rest = source.slice(at);
    const bound = /^import\s+([\s\S]*?)\s+from\s*(['"])([^'"]+)\2/.exec(rest);
    if (bound !== null) {
      found.push({ clause: bound[1] ?? "", specifier: bound[3] ?? "" });
      continue;
    }
    const bare = /^import\s*(['"])([^'"]+)\1/.exec(rest);
    if (bare !== null) found.push({ clause: "", specifier: bare[2] ?? "" });
  }
  return found;
}

/** Whether the file's dialect was read as JSX — a guard against judging a `.ts` for JSX tags. */
export function isJsx(relative: string): boolean {
  return dialectOf(relative) === "tsx";
}
