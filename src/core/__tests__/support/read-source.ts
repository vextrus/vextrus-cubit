/**
 * Test support for the acceptance files that judge a module's TEXT rather than its behaviour — the
 * nits in this increment's debt rows are comments and spellings, and a comment is not observable
 * through a call.
 *
 * Every scan here reads the CODE with the comments taken out, because a scan that reads comments
 * grades prose: a Builder explaining "the UUID shape now comes from the seam" in a comment must not
 * fail a check that bans re-spelling one. Comments are found the way this codebase writes them —
 * `/* … *\/` blocks and whole-line `//` — which is the shape every file in `src/core` uses.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout this suite runs against. `support/` sits two levels under `src/core`. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** A module's source, asserted to be there at all so a missing file names itself. */
export function sourceOf(relative: string, why: string): string {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — ${why}`).toBe(true);
  return readFileSync(abs, "utf8");
}

/** The same source with block comments and whole-line `//` comments removed. */
export function codeOf(relative: string, why: string): string {
  return withoutComments(sourceOf(relative, why));
}

/** Everything the file says in comments, and nothing it says in code. */
export function commentsOf(relative: string, why: string): string {
  const source = sourceOf(relative, why);
  const blocks = source.match(/\/\*[\s\S]*?\*\//g) ?? [];
  const lines = source.split("\n").filter((line) => line.trimStart().startsWith("//"));
  return [...blocks, ...lines].join("\n");
}

/** Strip the two comment shapes this tree writes, leaving line structure intact. */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}
