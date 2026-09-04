/**
 * The ONE reading used by the few criteria of this sweep whose subject genuinely IS a file's text —
 * a comment that must tell the truth about the declarations beside it, a token that must appear
 * nowhere, a JSX attribute whose shape decides whether a form can be served without JavaScript.
 * Everything else in this suite is driven through the product and asserted on what it does.
 *
 * It derives from the tree's own lexical machine (`tests/support/source-lex`, B-17/ARCH-02): nothing
 * here re-implements a comment stripper or a quote scanner, nothing counts `../`, and nothing walks
 * a directory looking for files. Every call site carries a `// white-box: <AC-id> — <why>` marker
 * naming the criterion and why no run of the product can observe it.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { lexFile, type Lexed } from "../../support/source-lex";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

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
