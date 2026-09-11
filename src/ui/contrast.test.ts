/**
 * The contrast floor, mechanically, on the TOKENS rather than on a screenshot (R-UI-012: "Text
 * ≥ 4.5:1, UI ≥ 3:1, both themes"; Design Direction 00 §1's contrast row, "Mechanical (axe)").
 *
 * axe grades what a rendered page happens to paint, one journey at a time, and only the pairings a
 * journey walks past. This grades the PROMISE: the alias layer says "`--ink-inverse` is the text on
 * an accent fill", "`--ink-muted` is captions on a panel", "`--line-focus` is the reticle on the
 * app ground" — and each of those sentences is a pairing whose ratio is computable from the token
 * source, in both themes, before anything renders. A pairing that fails here fails on every screen
 * that keeps the promise, which is what makes it worth catching here.
 *
 * Two floors, as the law states them:
 *   TEXT 4.5 — anything a reader reads as words or figures.
 *   UI 3.0 — what carries meaning as a shape: the reticle stroke, a selection outline, a status
 *            mark, and `--ink-disabled`, whose own definition in §4.1 is "≥ 3:1 floor".
 *
 * No colour literal is spelled here and none may be (R-UI-001): the values come from the token
 * tables, and a `var()` chain is followed to whatever it lands on.
 */
import { describe, expect, test } from "vitest";
import { darkTokens, lightTokens } from "./tokens";

/** The two floors, by what the pairing is for. */
const FLOOR = { text: 4.5, ui: 3 } as const;

type Surface = keyof typeof FLOOR;

/** One promise the alias layer makes: this ink, on this ground, is readable at this floor. */
interface Pairing {
  readonly ground: string;
  readonly ink: string;
  readonly kind: Surface;
  readonly promise: string;
}

/**
 * The pairings the design system actually promises (§4.1's "Use" column, §1's tables). This is a
 * closed list on purpose: it is the contract, and a pairing nobody promises is nobody's failure.
 */
const PAIRINGS: readonly Pairing[] = [
  // Filled controls. `--accent-fill` rather than `--accent` is the whole point of that alias: the
  // beam a control paints a LABEL on is not the beam a control draws a bar with (see tokens.ts).
  { ground: "--accent-fill", ink: "--ink-inverse", kind: "text", promise: "the label on a filled primary control" },
  { ground: "--accent-hover", ink: "--ink-inverse", kind: "text", promise: "the label on a hovered primary control" },
  { ground: "--accent-active", ink: "--ink-inverse", kind: "text", promise: "the label on a pressed primary control" },
  { ground: "--act", ink: "--ink-inverse", kind: "text", promise: "the label on a filled act control" },
  { ground: "--act-surface", ink: "--ink-act", kind: "text", promise: "act text on the act surface" },
  { ground: "--state-danger", ink: "--ink-inverse", kind: "text", promise: "the label on a filled danger control" },

  // The four state surfaces, each carrying its own state's ink.
  { ground: "--state-success-surface", ink: "--state-success", kind: "text", promise: "success text on the success surface" },
  { ground: "--state-warn-surface", ink: "--state-warn", kind: "text", promise: "warning text on the warning surface" },
  { ground: "--state-danger-surface", ink: "--state-danger", kind: "text", promise: "danger text on the danger surface" },
  { ground: "--state-info-surface", ink: "--state-info", kind: "text", promise: "info text on the info surface" },

  // Body ink on every ground a screen stands on.
  ...(["--surface-app", "--surface-panel", "--surface-sunken", "--surface-raised", "--surface-overlay", "--surface-hover", "--surface-active", "--surface-selected", "--accent-subtle"] as const).map(
    (ground): Pairing => ({ ground, ink: "--ink", kind: "text", promise: "primary text on a product surface" }),
  ),
  ...(["--surface-app", "--surface-panel", "--surface-sunken"] as const).map(
    (ground): Pairing => ({ ground, ink: "--ink-secondary", kind: "text", promise: "secondary text on a product surface" }),
  ),
  // §4.1 states the caption floor explicitly: "--ink-muted … (≥ 4.5:1 floor)".
  ...(["--surface-app", "--surface-panel", "--surface-sunken", "--surface-raised", "--surface-overlay"] as const).map(
    (ground): Pairing => ({ ground, ink: "--ink-muted", kind: "text", promise: "a caption on a product surface" }),
  ),
  ...(["--surface-app", "--surface-sunken"] as const).map(
    (ground): Pairing => ({ ground, ink: "--ink-code", kind: "text", promise: "a mono value in a table" }),
  ),
  ...(["--surface-app", "--surface-panel", "--surface-selected"] as const).map(
    (ground): Pairing => ({ ground, ink: "--ink-link", kind: "text", promise: "a link, and the active tool's label" }),
  ),
  // State ink used as text on the app ground — a refusal sentence, a warning line, a success note.
  ...(["--state-danger", "--state-warn", "--state-success", "--state-info"] as const).map(
    (ink): Pairing => ({ ground: "--surface-app", ink, kind: "text", promise: "a state sentence on the app ground" }),
  ),
  { ground: "--surface-inverse", ink: "--ink-inverse", kind: "text", promise: "the tooltip's inverted surface" },

  // Shapes that carry meaning without being words (R-UI-012's 3:1 leg).
  ...(["--surface-app", "--surface-panel"] as const).map(
    (ground): Pairing => ({ ground, ink: "--ink-disabled", kind: "ui", promise: "a disabled control's ink (§4.1: ≥ 3:1)" }),
  ),
  ...(["--surface-app", "--surface-panel", "--surface-sunken"] as const).map(
    (ground): Pairing => ({ ground, ink: "--line-focus", kind: "ui", promise: "the focus reticle's stroke (R-UI-012)" }),
  ),
  ...(["--surface-app", "--surface-panel"] as const).map(
    (ground): Pairing => ({ ground, ink: "--line-accent", kind: "ui", promise: "the selection outline and the active tool underline" }),
  ),
  ...(["--surface-app", "--surface-panel"] as const).map(
    (ground): Pairing => ({ ground, ink: "--accent", kind: "ui", promise: "a beam mark that carries no text — a bar, a dot, a handle" }),
  ),
  { ground: "--surface-app", ink: "--line-act", kind: "ui", promise: "the act border and the 7 px copper dot" },
  { ground: "--surface-app", ink: "--act", kind: "ui", promise: "the act mark on the app ground" },
  { ground: "--surface-app", ink: "--cov-4", kind: "ui", promise: "the coverage ramp's published step" },
  { ground: "--surface-app", ink: "--cov-3", kind: "ui", promise: "the coverage ramp's fourth step" },
];

/** The value a token lands on after its `var()` chain — the colour it actually paints. */
function resolved(table: Record<string, string>, key: string, seen: readonly string[] = []): string {
  expect(seen, `${key} resolves in a cycle`).not.toContain(key);
  const value = table[key];
  expect(value, `${key} is not emitted by the token source — a pairing cannot promise what does not exist`).toBeDefined();
  const named = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(value ?? "");
  return named === null ? (value ?? "") : resolved(table, named[1] as string, [...seen, key]);
}

/** sRGB channel → linear light, as WCAG 2.1 defines it. */
function channel(byte: number): number {
  const unit = byte / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#rrggbb` value (WCAG 2.1). */
function luminance(colour: string): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  expect(hex, `"${colour}" is not a six-digit hex colour — every token in a pairing must land on one`).not.toBeNull();
  const digits = (hex as RegExpExecArray)[1] as string;
  const [red, green, blue] = [0, 2, 4].map((at) => channel(Number.parseInt(digits.slice(at, at + 2), 16)));
  return 0.2126 * (red as number) + 0.7152 * (green as number) + 0.0722 * (blue as number);
}

/** The WCAG contrast ratio between two token values in one theme. */
function ratio(table: Record<string, string>, ground: string, ink: string): number {
  const [lighter, darker] = [luminance(resolved(table, ground)), luminance(resolved(table, ink))].sort((a, b) => b - a);
  return ((lighter as number) + 0.05) / ((darker as number) + 0.05);
}

const THEMES: readonly (readonly [string, Record<string, string>])[] = [
  ["light", lightTokens],
  ["dark", darkTokens],
];

describe("R-UI-012: the contrast floor holds on the token source, in both themes", () => {
  test("every pairing the alias layer promises clears its floor", () => {
    const failures: string[] = [];
    for (const [theme, table] of THEMES) {
      for (const pairing of PAIRINGS) {
        const measured = ratio(table, pairing.ground, pairing.ink);
        if (measured + 1e-9 < FLOOR[pairing.kind]) {
          failures.push(
            `${theme}: ${pairing.ink} on ${pairing.ground} — ${pairing.promise} — measures ${measured.toFixed(2)}:1, below the ${FLOOR[pairing.kind]}:1 ${pairing.kind} floor`,
          );
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("the pairing list is the contract, so every token in it is emitted in both themes", () => {
    for (const [, table] of THEMES) {
      for (const pairing of PAIRINGS) {
        expect(table[pairing.ground], `${pairing.ground} is emitted`).toBeDefined();
        expect(table[pairing.ink], `${pairing.ink} is emitted`).toBeDefined();
      }
    }
  });

  test("the two beams are not one token: the fill a label sits on clears 4.5 where the mark alone does not", () => {
    // This is the finding the alias was introduced for, kept as an assertion rather than a comment:
    // in dark, the mark clears the UI floor and fails the text floor, and the fill clears both.
    const mark = ratio(darkTokens, "--accent", "--ink-inverse");
    const fill = ratio(darkTokens, "--accent-fill", "--ink-inverse");
    expect(mark, "the bare accent is a UI mark in dark — it clears 3:1").toBeGreaterThanOrEqual(FLOOR.ui);
    expect(mark, "…and it does NOT clear the text floor, which is why a label never sits on it").toBeLessThan(FLOOR.text);
    expect(fill, "the fill a label sits on clears the text floor in dark").toBeGreaterThanOrEqual(FLOOR.text);
  });
});
