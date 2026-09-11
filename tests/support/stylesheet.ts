/**
 * Reading a stylesheet mechanically: the declarations a sheet states, and the numbers inside them.
 *
 * This is the reader `tests/ui/craft/mechanical.test.ts` introduced for the craft rubric's
 * source-readable half ("the rubric's mechanical half, read from the stylesheets a screen is drawn
 * by"). It lives here rather than inside that suite because a second check now reads the same way —
 * the shell's work-surface arithmetic, read from the grid the frame is actually drawn by — and two
 * spellings of "what does this sheet declare" would be exactly the drift B-17 forbids.
 */
import { readDeclarations } from "./css-tokens";

/**
 * A sheet with its comments blanked, line for line — what the browser is told, as opposed to what
 * the author also wrote down. A check that reads authored text must read this: a rule NAMED in a
 * comment is not a rule declared.
 */
export const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

export interface Declaration {
  prop: string;
  value: string;
  line: number;
}

/**
 * Every `prop: value` a sheet states, with the line it stands on — read by the tokenizer in
 * `tests/support/css-tokens.ts`, never by a line regex.
 *
 * The line regex this delegation replaced was wrong in three ways at once, and each one was a HOLE
 * rather than a false alarm: a value wrapped onto a second line was never seen, a one-line rule
 * (`.x { height: 33px; }`) was skipped entirely, and a `;` inside a string or a `url(data:…)` split
 * a declaration in half. Every check built on this reader — the craft rubric's mechanical half, the
 * shell's work-surface arithmetic — inherited all three, so each of them was quietly reading part
 * of a stylesheet and reporting on the whole of it.
 */
export function declarations(css: string): Declaration[] {
  return readDeclarations(css).map((decl) => ({ prop: decl.prop, value: decl.value, line: decl.line }));
}

/** A length a declaration states outright, in px; a `var()` states no number and is not one. */
export const pixelsIn = (value: string): number[] =>
  [...value.matchAll(/(?<![\w-])(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));

/**
 * The declarations of ONE rule, found by the exact selector text it is written under. The selector
 * is matched as a whole line so `.cx-shell` never answers with `.cx-shell-body`'s body, which is the
 * mistake a substring search makes on a tree whose class names all share a prefix.
 */
export function ruleBody(css: string, selector: string): Declaration[] | null {
  const text = withoutComments(css);
  const at = new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`).exec(text);
  if (at === null) return null;
  const opened = text.indexOf("{", at.index);
  const closed = text.indexOf("}", opened);
  if (opened === -1 || closed === -1) return null;
  return declarations(text.slice(opened + 1, closed));
}

/** One declaration of a rule, by property; null where the rule does not state it. */
export function declaredValue(css: string, selector: string, prop: string): string | null {
  const body = ruleBody(css, selector);
  if (body === null) return null;
  const found = body.filter((decl) => decl.prop === prop).at(-1);
  return found === undefined ? null : found.value;
}

/**
 * The custom properties a `:root`-ish block declares, as a table. Every block whose selector matches
 * is merged in source order, which is what the cascade does with them at one specificity.
 */
export function customProperties(css: string, selectorPattern: RegExp): Record<string, string> {
  const text = withoutComments(css);
  const table: Record<string, string> = {};
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] as string).trim();
    if (!selectorPattern.test(selector)) continue;
    for (const decl of (match[2] as string).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      table[decl[1] as string] = (decl[2] as string).trim();
    }
  }
  return table;
}

/**
 * A length a declaration states, resolved through the `var()` chain the token table holds. A name
 * the table does not carry resolves to nothing, which a caller must treat as a failure rather than
 * as a zero: a chrome height nobody declared is not a chrome height of 0.
 */
export function resolvePx(value: string, table: Record<string, string>, seen: string[] = []): number | null {
  const trimmed = value.trim();
  const direct = /^(-?\d+(?:\.\d+)?)px$/.exec(trimmed);
  if (direct !== null) return Number(direct[1]);
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const named = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(trimmed);
  if (named === null) return null;
  const key = named[1] as string;
  if (seen.includes(key)) return null;
  const next = table[key];
  return next === undefined ? null : resolvePx(next, table, [...seen, key]);
}

/**
 * The tracks of a `grid-template-*` value: the top-level terms, with `minmax(…)`'s own commas left
 * inside it. `minmax(0, 1fr)` is one track, not two.
 */
export function gridTracks(value: string): string[] {
  const tracks: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth === 0 && /\s/.test(ch)) {
      if (current !== "") tracks.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current !== "") tracks.push(current);
  return tracks;
}
