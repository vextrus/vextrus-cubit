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

/** The lengths a declaration states LITERALLY, in px. A `var()` states no number and is not one. */
const literalPixels = (value: string): number[] => [
  ...[...value.matchAll(/(?<![\w-])(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])),
  // The root font size is never re-based (globals.css says so outright: "pinning `html` would
  // rebase every rem"), so a rem in this tree is exactly 16 px and is a length like any other.
  ...[...value.matchAll(/(?<![\w-])(-?\d+(?:\.\d+)?)rem/g)].map((m) => Number(m[1]) * 16),
];

/**
 * `calc()` and its siblings, folded to the one length they state where that is arithmetic this
 * reader can do, and dropped where it is not.
 *
 * `height: calc(var(--toolbar-h) - var(--space-1))` states ONE height — 28 px — and a reader that
 * returns [32, 4] reports two heights the stylesheet never asks for, one of which is off every set.
 * Where the expression mixes units the browser resolves at layout (`%`, `vw`, `dvh`, `fr`) or picks
 * between candidates (`min`/`max`/`clamp`), no single length is STATED and the group is dropped
 * whole, rather than emitting the operands as if each were a declaration of its own.
 */
export function evaluateLengthFunctions(value: string): string {
  const relative = /%|\b(?:v[wh]|dv[wh]|sv[wh]|lv[wh]|fr|em|ch|ex)\b/;
  let text = value;
  for (let guard = 0; guard < 10; guard += 1) {
    const at = /\b(calc|min|max|clamp)\(/.exec(text);
    if (at === null) break;
    const open = at.index + at[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let cursor = open; cursor < text.length; cursor += 1) {
      if (text[cursor] === "(") depth += 1;
      else if (text[cursor] === ")") {
        depth -= 1;
        if (depth === 0) {
          close = cursor;
          break;
        }
      }
    }
    if (close === -1) break;
    const inner = text.slice(open + 1, close);
    const folded = at[1] === "calc" && !relative.test(inner) ? foldCalc(inner) : null;
    text = text.slice(0, at.index) + (folded === null ? " " : `${folded}px`) + text.slice(close + 1);
  }
  return text;
}

/** The arithmetic of one `calc()` body, in px, or null where it is not plain arithmetic. */
function foldCalc(body: string): number | null {
  const arithmetic = body.replace(/(-?\d+(?:\.\d+)?)px/g, "$1").replace(/\bcalc\b/g, "");
  if (!/^[\s\d.+\-*/()]+$/.test(arithmetic)) return null;
  try {
    // eslint-disable-next-line no-new-func -- the guard above admits digits and the five operators only
    const value: unknown = new Function(`"use strict"; return (${arithmetic});`)();
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * A table of `--name` → every value the tree declares it as, for `pixelsIn` to resolve through.
 * A name may carry more than one value — `--row-h` is `--row-compact` under one density attribute
 * and `--row-comfortable` under the other — and both are real, so both are returned and both are
 * judged. Built from whatever stylesheets the caller hands it (tokens.css and globals.css, in
 * practice), so a token added tomorrow joins the scan by being declared (B-17).
 */
export function customPropertyValues(...sheets: string[]): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  for (const css of sheets) {
    for (const match of withoutComments(css).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
      const name = match[1] as string;
      const value = (match[2] as string).trim();
      const seen = table[name] ?? (table[name] = []);
      if (!seen.includes(value)) seen.push(value);
    }
  }
  return table;
}

/**
 * The lengths a declaration resolves to, in px.
 *
 * Without a table this reads only the literals, which is what every caller wanted until 2026-09-12
 * and what the craft rubric's C8 checks were silently getting: this tree spells almost nothing
 * literally — `font-size: var(--text-13)`, `padding: var(--space-2)` — so the type check ran over
 * an EMPTY array (0 of 245 font sizes carried a number) and passed by having nothing to judge.
 * With a table, a `var(--x)` is followed to every value `--x` is declared as, `calc()` included, and
 * the numbers inside come back. A name that resolves to no length still contributes nothing, which
 * is right: `var(--font-ui)` is not a measurement.
 */
export function pixelsIn(value: string, vars?: Readonly<Record<string, readonly string[]>>): number[] {
  if (vars === undefined) return literalPixels(evaluateLengthFunctions(value));
  const out: number[] = [];
  for (const expansion of expand(value, vars, [])) out.push(...literalPixels(evaluateLengthFunctions(expansion)));
  return [...new Set(out)];
}

/**
 * One declaration's value with every `var()` substituted — as MANY strings, because a name may be
 * declared more than once: `--row-h` is `--row-compact` under one density and `--row-comfortable`
 * under the other, and both are a height the product is really drawn at. Substitution happens before
 * `calc()` is folded, which is the only order that works: `calc(var(--space-3) + 1px)` states 13 px,
 * and a reader that folds first sees arithmetic it cannot do and throws the whole group away.
 */
function expand(value: string, vars: Readonly<Record<string, readonly string[]>>, seen: readonly string[]): string[] {
  const at = /var\(\s*(--[a-z0-9-]+)\s*(?:,([^()]*(?:\([^()]*\))?[^()]*))?\)/.exec(value);
  if (at === null) return [value];
  const name = at[1] as string;
  const fallback = at[2];
  const declared = seen.includes(name) ? [] : (vars[name] ?? []);
  const candidates = declared.length > 0 ? declared : [fallback ?? " "];
  const out: string[] = [];
  for (const candidate of candidates) {
    const next = value.slice(0, at.index) + candidate + value.slice(at.index + at[0].length);
    // 64 expansions is far more than any real declaration needs and keeps a pathological token
    // graph from turning a unit test into a combinatorial one.
    for (const done of expand(next, vars, [...seen, name])) if (out.length < 64) out.push(done);
  }
  return out;
}

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
