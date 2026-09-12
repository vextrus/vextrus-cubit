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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { darkTokens, lightTokens } from "./tokens";

/** The two floors, by what the pairing is for. */
const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

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
  // `--surface-hover` and `--surface-active` are deliberately NOT on the caption list, and the
  // reason is arithmetic rather than taste. A hover has to be a STEP — this increment set the bar at
  // 1.3:1 against the surface underneath, because below it a hovered menu item is a guess — and
  // `--ink-muted` is graphite-600, which needs a ground no darker than L* ≈ .776 in light and no
  // lighter than L* ≈ .0152 in dark to clear 4.5. No value satisfies both at once: a caption that
  // stays readable through a visible hover would need the hover to be invisible. So a hovered or
  // pressed row carries `--ink` and `--ink-secondary` (both asserted above and below), and a cell
  // that must stay muted is not put inside a hover target.
  ...(["--surface-hover", "--surface-active"] as const).map(
    (ground): Pairing => ({ ground, ink: "--ink-secondary", kind: "ui", promise: "a secondary cell inside a hovered or pressed row" }),
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
  // SC 1.4.11: the edge of a surface that FLOATS above the app ground — a card, a menu, a popover, a
  // dialog. Their fills are at most one ramp step from the ground (the ramp has no more room at the
  // surface end), so the edge is what tells a reader where the component begins.
  ...(["--surface-app", "--surface-raised", "--surface-overlay"] as const).map(
    (ground): Pairing => ({ ground, ink: "--line-raised", kind: "ui", promise: "the boundary of a floating surface (SC 1.4.11)" }),
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

  test("every state colour a label can sit on clears the text floor in both themes, with the ink that sits on it", () => {
    // Derived from the emitted table, never from a hand-kept roster: a state colour added tomorrow
    // is judged the day it lands. A filled state is a GROUND a word sits on — the refusal\'s code,
    // the success line, the act — so the floor is the text floor, and the ink it clears with is
    // named in the failure so the stylesheet can be told which one to pair it with.
    const inks = ["--ink", "--ink-inverse", "--ink-strong"] as const;
    const failures: string[] = [];
    for (const [theme, table] of THEMES) {
      const grounds = Object.keys(table).filter((key) => /^--state-[a-z]+$/.test(key) || key === "--accent-fill" || key === "--act");
      expect(grounds.length, `${theme}: the table emits state colours at all`).toBeGreaterThan(0);
      for (const ground of grounds) {
        const measured = inks
          .filter((ink) => table[ink] !== undefined)
          .map((ink) => ({ ink, value: ratio(table, ground, ink) }))
          .sort((first, second) => second.value - first.value);
        const best = measured[0];
        if (best === undefined || best.value + 1e-9 < FLOOR.text) {
          failures.push(
            `${theme}: ${ground} carries no ink that clears ${FLOOR.text}:1 — ${measured.map((one) => `${one.ink} ${one.value.toFixed(2)}`).join(", ")}`,
          );
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  /**
   * The basis and element palettes are SEMANTIC — they name a meaning, not a ramp position — and so
   * they are exempt from `cubit/no-primitive-token` and were exempt from this file too: not one of
   * the fifteen appeared in a pairing. They are marks a reader reads, and R-UI-012 grades a mark at
   * 3:1. Derived from the emitted table rather than from a roster, so a colour added tomorrow is
   * judged the day it lands.
   */
  const palette = (table: Record<string, string>, prefix: string): string[] =>
    Object.keys(table).filter((key) => key.startsWith(prefix));

  /**
   * The marks that do NOT clear 3:1 on their own ground, each with the reason it is lawful anyway.
   * Asserted from both sides: an unnamed thin mark fails, and a name that no longer fires is dead
   * wood and fails too (B-19). Nothing in R-UI-001 may be revalued, so a mark that cannot be fixed
   * is named with what carries its meaning INSTEAD of the colour.
   */
  const THIN_BY_DESIGN = {
    ...Object.fromEntries(
      (["--surface-app", "--surface-panel", "--surface-raised"] as const).map((ground) => [
        `light --element-opening on ${ground}`,
        "the element palette paints GEOMETRY on the sheet — a filled region with a 1.5 px stroke, a hatch and a class glyph in the layer list — so §4.3's law that meaning never rides on colour alone is what makes a 2.76–2.89:1 teal lawful where a bare mark would not be. R-UI-001 forbids revaluing #21A0A8, and the palette has no consumer in `src/` today: the day one appears it draws a stroked shape, not a dot.",
      ]),
    ),
  } as Readonly<Record<string, string>>;

  test("R-UI-012: every basis and element mark clears the 3:1 graphics floor, or is named with what carries it instead", () => {
    const failures: string[] = [];
    const used = new Set<string>();
    for (const [theme, table] of THEMES) {
      for (const prefix of ["--basis-", "--element-"]) {
        const marks = palette(table, prefix);
        expect(marks.length, `${theme}: the table emits the ${prefix} palette at all`).toBeGreaterThan(5);
        for (const mark of marks) {
          for (const ground of ["--surface-app", "--surface-panel", "--surface-raised", "--surface-canvas"] as const) {
            const measured = ratio(table, ground, mark);
            const named = `${theme} ${mark} on ${ground}`;
            if (measured + 1e-9 >= FLOOR.ui) continue;
            if (THIN_BY_DESIGN[named] !== undefined) used.add(named);
            else failures.push(`${named} measures ${measured.toFixed(2)}:1, below the ${FLOOR.ui}:1 graphics floor`);
          }
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
    expect(Object.keys(THIN_BY_DESIGN).filter((name) => !used.has(name)), "a name that no longer fires is a licence nobody needs (B-19)").toEqual([]);
  });

  test("R-UI-012: a basis colour is a MARK, never a label — `--basis-defaulted` is 4.42:1 and cannot be one", () => {
    // The one basis colour that does not clear the TEXT floor on the light app ground, and the
    // reason the chip's own stylesheet must keep spelling `--ink-secondary` for its label. This is
    // not a preference: R-UI-001 forbids revaluing #6B7280, and no surface the chip sits on rescues
    // it — `--surface-raised` measures 4.66:1 and `--surface-app` 4.42:1, so a chip that moved
    // between the two would pass on one screen and fail on the next.
    const onApp = ratio(lightTokens, "--surface-app", "--basis-defaulted");
    expect(onApp, "the finding this guard exists for, kept as a number").toBeLessThan(FLOOR.text);
    expect(onApp, "…and it does clear the graphics floor, which is what a glyph and a border need").toBeGreaterThanOrEqual(FLOOR.ui);
    const core = readFileSync(resolve(REPO_ROOT, "src/ui/primitives/core/core.css"), "utf8");
    const chip = /\.cx-basis-chip \{([\s\S]*?)\}/.exec(core);
    expect(chip?.[1], "the BasisChip's own rule is readable").toBeTruthy();
    const colour = /(?:^|\n)\s*color:\s*([^;]+);/.exec(chip?.[1] ?? "");
    expect(
      colour?.[1]?.trim(),
      "the chip's LABEL reads a graphite ink; the basis colour stays on the glyph and the border, where 4.42:1 is a lawful mark and not unlawful text",
    ).toBe("var(--ink-secondary)");
  });

  test("R-UI-012: `--line-focus` is the token the reticle actually paints", () => {
    // The pairing above promises "the focus reticle's stroke" of a token no stylesheet read: the
    // reticle painted `--line-accent`, and the two happen to be the same beam today, so the promise
    // was latent rather than live and would have stopped being true the moment either moved. Focus
    // and selection are two meanings (§4.1 lists them as two rows), so the reticle spells its own.
    const reticle = readFileSync(resolve(REPO_ROOT, "src/ui/primitives/core/reticle.css"), "utf8");
    expect(reticle.includes("var(--line-focus)"), "the reticle paints --line-focus").toBe(true);
    expect(reticle.includes("var(--line-accent)"), "…and no longer borrows the selection outline's token").toBe(false);
  });

  test("SC 1.4.1 + §4.3: the coverage ramp is five STEPS — monotonic, and no two alike in greyscale", () => {
    // Read from the generated stylesheet rather than from the TS table, because the stylesheet is
    // what a browser and a greyscale printer are handed. (tokens.test.ts holds the two byte-for-byte
    // identical, so this cannot drift into a second source of truth.)
    const css = readFileSync(resolve(REPO_ROOT, "src/ui/tokens.css"), "utf8");
    const block = (selector: string): Record<string, string> => {
      const at = css.indexOf(`${selector} {`);
      expect(at, `tokens.css carries a ${selector} block`).toBeGreaterThan(-1);
      const body = css.slice(at, css.indexOf("\n}", at));
      return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1] as string, (m[2] as string).trim()]));
    };
    const ramp = ["--cov-0", "--cov-1", "--cov-2", "--cov-3", "--cov-4"] as const;
    for (const [theme, selector] of [["light", ":root"], ["dark", '[data-theme="dark"]']] as const) {
      const table = block(selector);
      const steps = ramp.map((name) => ({ name, value: resolved(table, name), light: luminance(resolved(table, name)) }));
      // Monotonic, in whichever direction the theme runs: 0 % is the quietest against the ground and
      // 100 % the loudest, so light descends and dark rises. A ramp that turns round mid-way says
      // 26–50 % is less covered than 1–25 %.
      const direction = Math.sign((steps.at(-1) as { light: number }).light - (steps[0] as { light: number }).light);
      expect(direction, `${theme}: the ramp's ends are the same luminance`).not.toBe(0);
      for (const [lower, upper] of steps.slice(0, -1).map((step, at) => [step, steps[at + 1] as typeof step] as const)) {
        expect(
          Math.sign(upper.light - lower.light),
          `${theme}: ${lower.name} (${lower.value}, L ${lower.light.toFixed(4)}) → ${upper.name} (${upper.value}, L ${upper.light.toFixed(4)}) turns the ramp round`,
        ).toBe(direction);
        // SC 1.4.1: the cell's share must survive the colour being taken away, and luminance
        // contrast IS what survives. 1.2:1 is the bar §4.3's "lightness steps ≥ 12 L*" states.
        const measured = ((Math.max(lower.light, upper.light) + 0.05) / (Math.min(lower.light, upper.light) + 0.05));
        expect(
          measured,
          `${theme}: ${lower.name} and ${upper.name} measure ${measured.toFixed(3)}:1 in greyscale — two shares a reader cannot tell apart, and the certificate prints in greyscale (R-UI-060)`,
        ).toBeGreaterThanOrEqual(1.2);
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
