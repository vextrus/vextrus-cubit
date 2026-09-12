/**
 * The craft rubric's mechanical half, at the source (Design Direction 00 §7).
 *
 * The rubric scores twelve criteria per screen and eight of them can only be read from a rendered
 * DOM after `settled()` — those belong to the node that rebuilds the screens and takes the pictures.
 * Four can be read from the stylesheets a screen is drawn by, and those are the foundation's own:
 * C8 (tokens-only colour, the 4-pt grid, the type scale) and the half of C4/C5 that is a geometry
 * a stylesheet states outright. They are checked here, where a failure names the declaration that
 * caused it rather than a pixel in a picture.
 *
 * The scores are printed per screen, always — a number nobody sees is a number nobody improves —
 * and the two properties the foundation has just made true are asserted, so they cannot quietly
 * stop being true: no screen spells a colour, and no screen spells a primitive ramp position.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
// The one reader of "what does this stylesheet declare" (B-17): the shell's work-surface arithmetic
// reads the same way, and a second spelling of it would be the drift this suite exists to catch.
import { customPropertyValues, evaluateLengthFunctions, pixelsIn } from "../../support/stylesheet";
// The declaration reader is a real tokenizer (comments, strings, nested parens, multi-line values,
// one-line rules), not a line regex. Every check below reads DECLARATIONS; the reader it replaced
// read LINES, and a value that wrapped, a rule written on one line and a `;` inside a `url()` each
// walked straight past it — see tests/ui/craft/css-tokenizer.test.ts, which keeps the old reader as
// a payload and asserts what it missed.
import { readDeclarations } from "../../support/css-tokens";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

/**
 * The tokens that are a WHOLE shorthand — `--hairline` is `1px solid` a line colour — read out of
 * the token source rather than listed here, so a second such token joins this check by being
 * declared (B-17). A declaration that spells a width or a style beside one of these expands to
 * nonsense (`border-bottom: 1px solid 1px solid …`), which the browser drops on
 * the floor: the rule is simply not painted. `src/ui/primitives/data/data.css` shipped ten of them.
 */
const SHORTHAND_TOKENS: readonly string[] = [
  ...new Set(
    [...readFileSync(join(REPO_ROOT, "src/ui/tokens.css"), "utf8").matchAll(/--([a-z0-9-]+)\s*:\s*(\d+(?:\.\d+)?px\s+(?:solid|dashed|dotted)\b[^;]*);/g)].map((match) => match[1] ?? ""),
  ),
].filter((name) => name !== "");

/**
 * The token table every `var()` in a shipped sheet is resolved through. Without it this suite reads
 * only the numbers a stylesheet spells OUT LOUD, and this tree spells almost none of them: 245 of
 * the 245 `font-size` declarations under the old scan were `var(--text-*)`, so the type-scale check
 * ran over an empty array and passed by having nothing to judge.
 */
const VARS = customPropertyValues(
  readFileSync(join(REPO_ROOT, "src/ui/tokens.css"), "utf8"),
  readFileSync(join(REPO_ROOT, "src/ui/theme/globals.css"), "utf8"),
);

/** Every stylesheet a screen is drawn by: the app routes' own, one file per screen. */
function screenSheets(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) screenSheets(path, out);
    else if (entry.endsWith(".css")) out.push(path);
  }
  return out;
}

/** The numbers a declaration spells itself, with the token chain left unfollowed. */
const literalsIn = (value: string): number[] => pixelsIn(value.replace(/var\([^()]*(?:\([^()]*\))?[^()]*\)/g, " "));

const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left)(-|$)/;
/** R-UI-003's scale. A size off it is a size nobody chose. */
const TYPE_SCALE = new Set([12, 13, 14, 16, 20, 24, 32]);
/** R-UI-001's two row heights and §4.2's four control heights (§1, §4.2). */
const HEIGHTS = new Set([24, 28, 32, 36, 40, 48]);

/**
 * The heights that are lawfully off the C4 set, each with the reason it is not a control, a row or a
 * chrome — which is what C4 is about. A declaration is excused by the SELECTOR it stands under, not
 * by its file, so the same class moved to another sheet keeps its excuse and a different class in
 * the same sheet gets none. The roster is asserted from both sides below: an unexcused height fails,
 * and an excuse that no longer fires is dead wood and fails too.
 */
const NOT_A_CONTROL: Readonly<Record<string, string>> = {
  ".cx-gallery-scroll": "a gallery demo box — the viewport a scroll area is DEMONSTRATED in, not a control anybody operates",
  ".cx-gallery-resizable": "the same, for the resizable pane: the box exists so a reader can see the handle move",
  ".cx-gallery-table": "the same, for the table: a fixed demo viewport is what makes the sticky header visible at all",
  ".cx-home-pause": "the visually-hidden idiom (1 px clipped) — a live-region pause a reader hears and nobody sees",
  ".cx-viewer-hidden": "the visually-hidden idiom again, in the viewer's own sheet",
  ".cx-viewer-layer-swatch": "a colour swatch glyph beside a layer name — a mark, not a control height",
  // The primitives joined this scan on 2026-09-12 (see `screens` below). A primitive's own furniture
  // is not a control height: these five are a status dot, a switch's travelling thumb, a hairline
  // rule, a tree's indent and a scrollbar — none of them anything a finger is asked to hit.
  ".cx-act-dot": "a 7 px status dot inside an act row — a mark, not a control",
  ".cx-switch-thumb": "the switch's thumb, sized from the switch it travels inside (`--icon-lg` less its inset)",
  '.cx-separator[data-orientation="horizontal"]': "a 1 px rule — the separator IS the hairline, and a hairline is not a control",
  ".cx-tree-spacer": "one level of a tree's indent, which is a measure of depth and not a control",
  '.cx-scrollarea-bar[data-orientation="horizontal"]': "a scrollbar's thickness, which the platform's own scrollbars are also drawn at",
  // The rest of the tree joined this scan on 2026-09-12 — patterns, the shell, the jobs tray, the
  // icons and `src/modules` had never been read by it. Nine literal heights came with it; four were
  // FIXED (three skeleton bones now state `--text-body`, the partition swatch `--space-3`), and
  // these five are what remains, each a mark, a region or the visually-hidden idiom.
  ".cx-jobs-tray-dot": "an 8 px job-state dot in the tray's header — a mark beside a word, like `.cx-act-dot`",
  ".cx-job-timeline-marker": "the 8 px dot a timeline step hangs on; the rule that joins two of them is drawn from its centre",
  ".cx-dropzone-zone": "a drop TARGET — a region a file is dragged into, sized to be a place rather than a control (§4.2 fixes control heights, not regions)",
  ".cx-dropzone-door-input": "the visually-hidden idiom (1 px clipped): the real `<input type=file]` the zone forwards its click to",
  '.cx-shell-rail[data-collapsed="true"] .cx-shell-switcher-name, .cx-shell-rail[data-collapsed="true"] .cx-shell-rail-chevron, .cx-shell-rail[data-collapsed="true"] .cx-shell-nav-label':
    "the visually-hidden idiom again: a collapsed rail keeps its labels in the accessibility tree at 1 px rather than dropping them from the DOM",
};

/**
 * The spacings that are lawfully off the 4-pt grid, each with its reason — the same roster shape as
 * `NOT_A_CONTROL`, asserted from both sides. Every entry is a HAIRLINE-scale nudge: 1 px is the rule
 * the product draws its borders with, and a control that must sit flush against one is offset by the
 * rule's own width, not by a grid step. The grid governs layout, and a layout step of 1 px is what
 * this check exists to catch.
 */
const NOT_A_SPACING: Readonly<Record<string, string>> = {
  '.cx-btn[data-variant="ghost"]': "a ghost button carries no border, so it is padded by the 1 px its bordered siblings spend on one — the two line up",
  ".cx-switch-thumb": "the thumb's 2 px inset inside its track, which is the track's own rule doubled",
  ".cx-tabs-trigger": "the active tab is pulled 1 px down to sit ON the tab strip's rule rather than above it",
  ".cx-scrollarea-bar": "1 px of padding around a scrollbar's thumb, so the thumb does not touch the rail's edge",
  // The five that came with the widened scan. Each is a CENTRING offset — half of the mark's own
  // size, or half of a hairline — and half of an odd number of pixels is not a layout step. The
  // grid governs where things are PLACED; it cannot govern the arithmetic that puts a 12 px glyph's
  // centre on the point it marks.
  ".cx-viewer-snap-glyph, .cx-viewer-snap-pick": "a 12 px snap glyph is pulled back by half its own size so its centre sits on the snap point, not its corner",
  '.cx-viewer-snap-glyph[data-kind="midpoint"]': "the same centring, restated for the midpoint glyph, which is drawn at a different inline offset",
  ".cx-job-timeline-step:not(:last-child)::after": "the rule between two 8 px markers is centred on them: (8 − 1) ÷ 2, the marker's radius less half the rule's own width",
  ".cx-shell-inspector-handle": "the resize handle straddles the inspector's 1 px seam, so it is pulled back by the seam's width doubled",
};

/** 5 with nothing to say, one point off per finding, floored at 0 — the rubric's own anchors (§7). */
const scoreOf = (findings: number): number => Math.max(0, 5 - findings);

interface Screen {
  name: string;
  c8Grid: string[];
  c8Type: string[];
  /** Heights off the C4 set that NO exception excuses — the findings the score is taken from. */
  c4Heights: string[];
  /** Which exceptions this sheet actually used, so a dead one can be found. */
  excused: string[];
  /** The same, for the 4-pt grid's own roster. */
  excusedSpacing: string[];
  colour: string[];
  /** Declarations that re-spell what a shorthand token already carries — invalid, so unpainted. */
  compound: string[];
  /** How many lengths the readers actually returned, so an empty check cannot look like a pass. */
  measured: number;
}

function measure(file: string): Screen {
  const css = readFileSync(file, "utf8");
  const name = relative(REPO_ROOT, file);
  const screen: Screen = { name, c8Grid: [], c8Type: [], c4Heights: [], excused: [], colour: [], compound: [], excusedSpacing: [], measured: 0 };
  for (const decl of readDeclarations(css)) {
    const under = decl.scope.at(-1) ?? "";
    const where = `${name}:${decl.line} ${under} { ${decl.prop}: ${decl.value} }`;
    if (SPACING.test(decl.prop) || decl.prop === "font-size" || decl.prop === "height" || decl.prop === "min-height") {
      screen.measured += pixelsIn(decl.value, VARS).length;
    }
    if (SPACING.test(decl.prop)) {
      for (const px of pixelsIn(decl.value, VARS)) {
        if (Math.abs(px) % 4 === 0) continue;
        if (NOT_A_SPACING[under] !== undefined) screen.excusedSpacing.push(under);
        else screen.c8Grid.push(where);
      }
    }
    if (decl.prop === "font-size") {
      for (const px of pixelsIn(decl.value, VARS)) if (!TYPE_SCALE.has(px)) screen.c8Type.push(`${where} — ${px}px`);
    }
    if (decl.prop === "height" || decl.prop === "min-height") {
      // A height stated ENTIRELY in tokens is a height somebody chose: `var(--icon-md)` is the icon
      // scale, `var(--stat-h)` is §4.2's stat tile, `var(--space-5)` is a chip on the 4-pt grid.
      // C4 is about the other kind — `height: 10px` — where a number was picked in a stylesheet and
      // belongs to no scale at all. So the check reads the LITERALS a declaration spells, after the
      // token chain and `calc()` are folded, and an all-token height is lawful by construction.
      const chosenByTheTokenLayer = literalsIn(decl.value).length === 0;
      for (const px of chosenByTheTokenLayer ? [] : pixelsIn(decl.value, VARS)) {
        if (HEIGHTS.has(px)) continue;
        if (NOT_A_CONTROL[under] !== undefined) screen.excused.push(under);
        else screen.c4Heights.push(where);
      }
    }
    // C8's first half is already a lint (cubit/no-colour-literal, cubit/no-primitive-token); this
    // reads the same property from the file so the score prints beside the others.
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/.test(decl.value)) screen.colour.push(where);
    if (/var\(\s*--(?:graphite|beam)-[0-9]+\s*\)/.test(decl.value)) screen.colour.push(where);
    for (const token of SHORTHAND_TOKENS) {
      const used = new RegExp(`var\\(\\s*--${token}\\s*[,)]`).test(decl.value);
      if (used && decl.value.trim().replace(/\s+/g, " ") !== `var(--${token})`) screen.compound.push(`${where} — --${token} already carries its width and style`);
    }
  }
  return screen;
}

describe("Design Direction 00 §7: the rubric's mechanical checks, at the source", () => {
  // BOTH homes of the product's CSS. Until 2026-09-12 this suite read `src/app` only, so C8 was
  // blind to the primitives every screen is BUILT from — and ten invalid `border` declarations sat
  // in `src/ui/primitives/data/data.css` unseen while the rubric scored C8 = 5.
  // EVERY sheet the product ships. Until 2026-09-12 this read `src/app` and `src/ui/primitives`
  // only, and thirteen shipped stylesheets — all of `src/ui/patterns/**`, the shell, the jobs tray,
  // the icons, `src/modules/**` — were scanned by nothing at all. Four `font-size: 10px`
  // declarations sat in the command palette and the consequence dialog while C8 scored 5.
  // The token source and the theme root are excluded: they DECLARE the scale this suite judges
  // against, so a scale value in them is the law rather than an offence.
  const DECLARES_THE_SCALE = new Set([join(REPO_ROOT, "src/ui/tokens.css"), join(REPO_ROOT, "src/ui/theme/globals.css")]);
  const screens = [
    ...screenSheets(join(REPO_ROOT, "src/app")),
    ...screenSheets(join(REPO_ROOT, "src/ui")),
    ...screenSheets(join(REPO_ROOT, "src/modules")),
  ]
    .filter((file) => !DECLARES_THE_SCALE.has(file))
    .sort()
    .map(measure);

  test("§7: the per-screen mechanical scores", () => {
    expect(screens.length, "the app draws its screens from stylesheets this check can read").toBeGreaterThan(8);
    // The scan is asserted to COVER the tree, not merely to run: a sheet added under any of the
    // three homes joins by existing, and a sheet that stops being scanned fails here by name.
    const shipped = new Set(
      [join(REPO_ROOT, "src/app"), join(REPO_ROOT, "src/ui"), join(REPO_ROOT, "src/modules")]
        .flatMap((dir) => screenSheets(dir))
        .filter((file) => !DECLARES_THE_SCALE.has(file)),
    );
    expect(new Set(screens.map((s) => join(REPO_ROOT, s.name))), "every shipped stylesheet is scanned").toEqual(shipped);
    // …and that the readers actually read. A check whose input is empty cannot fail, which is how
    // four 10 px font sizes shipped under a green C8 (see `pixelsIn`).
    const counted = screens.reduce((total, s) => total + s.measured, 0);
    expect(counted, "the px readers return numbers — an assertion over an empty array is not a check").toBeGreaterThan(400);
    const rows = screens
      .map((s) => {
        const c8 = scoreOf(s.c8Grid.length + s.c8Type.length + s.colour.length);
        const c4 = scoreOf(s.c4Heights.length);
        return { name: s.name, C8: c8, "C4 (geometry)": c4, mean: Number(((c8 + c4) / 2).toFixed(1)) };
      })
      .sort((a, b) => a.mean - b.mean);
    // Printed, always: the rubric's numbers are the screen's next three fixes, and a number nobody
    // sees is a number nobody improves (§7). The full twelve are the Surveyor's, from the DOM.
    console.table(rows);
  });

  test("C4: every height a screen states outright is a control, row or chrome height", () => {
    // This is the assertion this suite did not make. `c4Heights` was computed, fed to console.table
    // and asserted against NOTHING: the column printed a score nobody could fail, which is worse
    // than printing nothing, because it looked like a check. §1 and §4.2 fix the six heights the
    // product is drawn at; a seventh is a height nobody chose, and it fails here by name.
    const offences = screens.flatMap((s) => s.c4Heights);
    expect(offences, `a height off the C4 set {${[...HEIGHTS].join(", ")}} — add the control to the scale, or name it in NOT_A_CONTROL with its reason (§1, §4.2)`).toEqual([]);
  });

  test("C4/C8: every declared exception is still earning its place", () => {
    const used = new Set(screens.flatMap((s) => s.excused));
    const dead = Object.keys(NOT_A_CONTROL).filter((selector) => !used.has(selector));
    expect(dead, "an exception that no longer fires is a licence nobody needs — delete it (B-19)").toEqual([]);
    const usedSpacing = new Set(screens.flatMap((s) => s.excusedSpacing));
    const deadSpacing = Object.keys(NOT_A_SPACING).filter((selector) => !usedSpacing.has(selector));
    expect(deadSpacing, "the same, for the grid's own roster").toEqual([]);
  });

  test("C8: no screen spells a colour, and no screen spells a position on a primitive ramp", () => {
    const offences = screens.flatMap((s) => s.colour);
    expect(offences, "colour lives in the token source; a screen reads a semantic alias (R-UI-001, §4)").toEqual([]);
  });

  test("C8: no declaration re-spells what a shorthand token already carries (the rule would not paint)", () => {
    expect(SHORTHAND_TOKENS, "the token source declares at least one whole-shorthand token for this check to read").toContain("hairline");
    const offences = screens.flatMap((s) => s.compound);
    expect(offences, "`1px solid var(--hairline)` expands to `1px solid 1px solid …` — invalid, so the border is never drawn (R-UI-001, §4)").toEqual([]);
  });

  test("C8: every spacing a screen states outright is on the 4-pt grid", () => {
    const offences = screens.flatMap((s) => s.c8Grid);
    expect(offences, "the grid is 4 pt; a padding off it is a padding nobody chose (§4.2)").toEqual([]);
  });

  test("C8: every font size a screen states outright is on R-UI-003's scale", () => {
    const offences = screens.flatMap((s) => s.c8Type);
    expect(offences, "a size off the scale is a size nobody chose (R-UI-003)").toEqual([]);
  });
});
