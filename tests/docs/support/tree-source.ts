/**
 * The tree's own files, and their code with comments blanked — the one home for the two questions
 * the document criteria ask ABOUT the source rather than of a run (B-17, ARCH-02).
 *
 * Two criteria owe a property no execution can show: AC-1's "no file but src/core/documents/typst.ts
 * spawns typst", and AC-2's "the renderer pin is read from package.json, never spelled in the seam".
 * Both are answered by reading, so both read through the tree's one lexical machine
 * (tests/support/source-lex.ts): a mention inside a comment is prose, and a `typst` in a string
 * literal is the command a spawn was handed. A second walker beside this one would be a second
 * answer to the same question.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { dialectOf, scanned } from "../../support/source-lex";
import { inTree, REPO_ROOT } from "./product";

/** Directories no scan of the tree's own source should descend into. */
const SKIPPED = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

/**
 * Every file under a root whose name ends as one of the given extensions, repo-relative.
 * A root that does not exist yet is no files, not an exception: the case that needed them fails on
 * the emptiness, naming what is missing.
 */
export function filesUnder(root: string, extensions: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory)) {
      if (SKIPPED.has(entry)) continue;
      const path = resolve(directory, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (extensions.some((extension) => entry.endsWith(extension))) found.push(relative(REPO_ROOT, path));
    }
  };
  walk(inTree(root));
  return found;
}

/**
 * The file with its COMMENTS blanked and its literals left standing: a spawn's command and a copied
 * digest are both literals, and a comment that mentions either is neither (Q-17).
 */
export function withoutComments(file: string): string {
  const source = readFileSync(inTree(file), "utf8");
  let masked = "";
  for (const character of scanned(source, dialectOf(file))) {
    masked += character.mode === "line" || character.mode === "block" ? " " : character.char;
  }
  return masked;
}
