/**
 * Support for the src/ui debt sweep's acceptance: the two things every criterion below the
 * behaviour line needs — a product module loaded by absolute path (so a module the sweep has not
 * written yet names itself rather than killing collection), and a stylesheet read as rule blocks.
 *
 * Comment stripping is NOT re-derived here: `src/core/__tests__/support/read-source.ts` is this
 * tree's one home for "the code with the comments taken out" (B-17, ARCH-02), and the suites that
 * scan code import `codeOf`/`commentsOf` from there.
 *
 * The checkout's root is `process.cwd()` rather than a path derived from this module's own URL: a
 * jsdom suite is served a non-file `import.meta.url`, and vitest runs every worker at the config's
 * root, which is the checkout in both environments.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect } from "vitest";

/** The checkout this suite runs against. */
export const REPO_ROOT = process.cwd();

/** An absolute path inside the checkout. */
export function repoPath(relative: string): string {
  return join(REPO_ROOT, relative);
}

/**
 * Import a product module by repo-relative path, asserting it exists first: a file the sweep owes
 * fails as an assertion naming the file, never as an unresolved import. The caller declares the
 * shape it expects, which is the interface the criterion asks for and nothing wider.
 */
export async function productModule<T>(relative: string, why: string): Promise<T> {
  const abs = repoPath(relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — ${why}`).toBe(true);
  return (await import(abs)) as T;
}

/**
 * Every file under a repo-relative directory, recursively, whose name ends in one of the given
 * suffixes — repo-relative and code-point sorted. A scan that reads one directory level answers
 * about a tree it never walked, which is how a "this appears nowhere else" claim goes hollow.
 */
export function filesUnder(directory: string, suffixes: readonly string[]): string[] {
  const root = repoPath(directory);
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (suffixes.some((suffix) => name.endsWith(suffix))) found.push(relative(REPO_ROOT, abs));
    }
  };

  expect(existsSync(root) && statSync(root).isDirectory(), `${directory} is a directory of the checkout`).toBe(true);
  walk(root);
  return found.sort();
}

/** One rule of a stylesheet: the selector as authored (whitespace collapsed) and its declarations. */
export interface CssRule {
  readonly selector: string;
  readonly declarations: readonly string[];
}

/** One declaration, split at its first colon. */
export interface CssDeclaration {
  readonly property: string;
  readonly value: string;
}

/** CSS holds one comment shape; strings inside it never carry a block delimiter. */
function withoutCssComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ");
}

const collapse = (text: string): string => text.replace(/\s+/g, " ").replace(/'/g, '"').trim();

/**
 * Every rule in a stylesheet, blocks split by balanced braces so a rule nested inside an at-rule
 * (`@media`, `@supports`) is read like any other. Declaration lists are returned as authored,
 * whitespace collapsed; the at-rule's own prelude is never returned as a selector.
 */
export function cssRules(text: string): CssRule[] {
  return rulesOf(withoutCssComments(text));
}

/** The rules of one block of stylesheet text; an at-rule contributes the rules of its body. */
function rulesOf(source: string): CssRule[] {
  const rules: CssRule[] = [];
  let preludeStart = 0;
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (char === "{") {
      let depth = 1;
      let cursor = index + 1;
      while (cursor < source.length && depth > 0) {
        if (source[cursor] === "{") depth += 1;
        else if (source[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      const prelude = collapse(source.slice(preludeStart, index));
      const body = source.slice(index + 1, Math.max(index + 1, cursor - 1));
      if (prelude.startsWith("@")) for (const nested of rulesOf(body)) rules.push(nested);
      else rules.push({ selector: prelude, declarations: declarationList(body) });
      index = cursor;
      preludeStart = index;
      continue;
    }
    if (char === "}") {
      index += 1;
      preludeStart = index;
      continue;
    }
    index += 1;
  }

  return rules;
}

/** A block's declarations, semicolon-separated, empties dropped. */
function declarationList(body: string): string[] {
  return body
    .split(";")
    .map((part) => collapse(part))
    .filter((part) => part.length > 0 && !part.includes("{"));
}

/** A declaration split into property and value. */
export function declarationParts(declaration: string): CssDeclaration {
  const colon = declaration.indexOf(":");
  if (colon < 0) return { property: collapse(declaration), value: "" };
  return { property: collapse(declaration.slice(0, colon)), value: collapse(declaration.slice(colon + 1)) };
}

/** Every rule whose selector is exactly the one asked for, whitespace and quote style normalised. */
export function rulesFor(text: string, selector: string): CssRule[] {
  const wanted = collapse(selector);
  return cssRules(text).filter((rule) => rule.selector === wanted);
}
