/**
 * The readings AC-1 and AC-2 take OF A FILE rather than of a running screen: which name a file has
 * bound React's effect to, whether it calls a name at all, and whether a unit test actually loads and
 * mounts the hook it stands beside.
 *
 * Mechanics only — nothing here judges the product, and every reading is derived from the file handed
 * in rather than from a spelling transcribed at one moment (B-19): an effect renamed at the import
 * site is still the effect, and a test that mounts its hook by a path rather than by an import still
 * mounts it. Every reading goes through the one lexer seam (`tests/app/support/source-facts`, B-17).
 */
import { dirname, resolve } from "node:path";
import { codeOf, importsOf, withoutComments } from "../../../app/support/source-facts";

/** React's own effect: the thing AC-1 says the screen no longer runs, whatever it is called locally. */
export const EFFECT = "useEffect";

/** What a unit test puts a hook under, and where it takes that from (the declared test dependency). */
export const MOUNT_LIBRARY = "@testing-library/react";
export const MOUNTERS = ["renderHook", "render"];

/**
 * Every spelling under which a file could call React's `useEffect`: the name itself, the local name
 * any import binds it to (`import { useEffect as runOnMount }` is still an effect), and the member
 * access a default or namespace import of `react` reaches it through.
 *
 * Import specifiers are quoted literals, which the code mask blanks; this reading keeps the literals
 * and blanks the comments, so a sentence about effects still cannot be mistaken for a statement.
 */
export function effectSpellings(relative: string): string[] {
  const text = withoutComments(relative);
  const spellings = new Set<string>([EFFECT]);
  const named = new RegExp(`\\b${EFFECT}\\b(?:\\s+as\\s+([A-Za-z_$][\\w$]*))?`, "g");
  const statement = /\bimport\b([^;]*?)\bfrom\b\s*(["'])([^"']*)\2/g;
  for (let match = statement.exec(text); match !== null; match = statement.exec(text)) {
    const clause = match[1] ?? "";
    const specifier = match[3] ?? "";
    for (const binding of clause.matchAll(named)) spellings.add(binding[1] ?? EFFECT);
    if (!/(^|[./])react$/.test(specifier)) continue;
    // `import React from "react"` and `import * as React from "react"` both reach it as a member.
    for (const bound of clause.replace(/\{[^}]*\}/g, " ").matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (bound[1] !== "as" && bound[1] !== "type") spellings.add(`${bound[1] ?? ""}.${EFFECT}`);
    }
  }
  return [...spellings];
}

/** Whether code calls a name — dotted spellings included, a longer identifier not mistaken for it. */
export function calls(code: string, name: string): boolean {
  const path = name
    .split(".")
    .map((part) => part.replace(/\$/g, "\\$"))
    .join("\\s*\\.\\s*");
  return new RegExp(`(?<![\\w$.])${path}\\s*\\(`).test(code);
}

/** The effect calls a file makes under any of its own spellings — empty where it runs none. */
export function effectCalls(relative: string): string[] {
  const code = codeOf(relative);
  return effectSpellings(relative).filter((name) => calls(code, name));
}

/**
 * The hook a module publishes, read off its own basename: `use-hit-testing.ts` → `useHitTesting`.
 * The roster AC-2 enumerates is asserted against this derivation, so the naming a tenth hook is
 * judged by is the naming the nine the criterion names already keep (B-19).
 */
export function hookNameOf(module: string): string {
  return module.replace(/\.ts$/, "").replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Whether a test file loads the module it stands beside: either it imports it by a relative specifier
 * that resolves to that file, or it hands the module's repo-relative path to a loader — both are how
 * the suites take a hook, and neither is satisfied by a file that only stands in the right place.
 */
export function loads(testPath: string, module: string, root: string): boolean {
  const home = dirname(resolve(root, testPath));
  const target = resolve(root, module).replace(/\.ts$/, "");
  const imported = importsOf(testPath).some(
    (line) => line.specifier.startsWith(".") && resolve(home, line.specifier).replace(/\.ts$/, "") === target,
  );
  // A path handed to a loader is a quoted literal, which the code mask blanks; this reading keeps it.
  const spelled = withoutComments(testPath);
  return imported || spelled.includes(module) || spelled.includes(module.replace(/\.ts$/, ""));
}

/** The mounters a test both takes from the testing library and calls — empty where it mounts nothing. */
export function mountersIn(testPath: string): string[] {
  const code = codeOf(testPath);
  return importsOf(testPath)
    .filter((line) => line.specifier === MOUNT_LIBRARY)
    .flatMap((line) => line.names)
    .filter((name) => MOUNTERS.includes(name) && calls(code, name));
}
