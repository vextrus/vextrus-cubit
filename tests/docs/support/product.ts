/**
 * The one way the document-seam acceptance reaches the product (ARCH-02, B-17).
 *
 * Every suite here judges a seam that does not exist until the increment lands, and a bare
 * `import` of an absent module kills the whole file at collection: one red for six criteria, named
 * after the importer rather than after the thing that is missing. The module is therefore reached
 * by path at the moment a case needs it, and its absence is that case's failure, naming the file
 * the product does not provide yet.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout this suite runs in — tests/docs/support/ is three levels under it. */
export const REPO_ROOT: string = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

/** An absolute path inside the checkout, for a file named the way the spec names it. */
export function inTree(relative: string): string {
  return resolve(REPO_ROOT, relative);
}

/**
 * A product module by repo-relative path. The specifier is a value rather than a literal, so a
 * module that is not written yet is an assertion about the tree instead of a compile error in a
 * test — and the case that needed it fails naming the path.
 */
/**
 * Text as a reader reads it: every run of whitespace is one space. A PDF sets a line in as many
 * pieces as its kerning asks for, so a phrase is present whatever the producer's spacing was —
 * what a criterion asserts is the words, never the producer's choice of where to break them.
 */
export function squashed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

export async function productModule<T>(relative: string): Promise<T> {
  const absolute = inTree(relative);
  expect(existsSync(absolute), `${relative} is not in the tree yet — the document seam does not provide it`).toBe(true);
  return (await import(absolute)) as T;
}
