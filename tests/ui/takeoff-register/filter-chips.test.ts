// @vitest-environment jsdom
/**
 * s-takeoff I-442, I-443 — THE REGISTER'S FILTER CHIPS OPEN THEIR OPTIONS, AND A CLICK
 * TAKES ONE (session 8, walk-0's BLOCKS_DEMO on register-trace).
 *
 * WHY. A click on `Class · All classes` showed one empty `Filter…` box where the whole bar had been
 * and no option at all: the chip's popover stands below the control, over the grid, and the 36 px
 * bar it stands in was `overflow: hidden` — which both cut every option off and made the bar a
 * scroll box, so focusing the popover's field scrolled the bar until the field was all it showed.
 * The listbox was in the DOM (the Kind chip held 8 options) and `elementFromPoint` at it returned the
 * grid. Only the keyboard could filter, and only by a reader who knew to type blind.
 *
 * What a mount can hold to account is split as the craft suites split it: the LAYOUT half is a
 * stylesheet fact — jsdom lays nothing out — read from the sheets the screen is drawn by through the
 * craft rubric's own reader (`tests/support/stylesheet.ts`); the DOM half is the shipped workspace
 * over the shipped Combobox, driven as a reader drives it, pointer and keyboard. The e2e half — the
 * option hit-testable where it paints, taken by the pointer where it stands — is J-021's
 * (`tests/e2e/journeys/j-021-column-slice.spec.ts`), because only a browser lays the bar out.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { declarations, withoutComments, type Declaration } from "../../support/stylesheet";
import { aLine, aView, anObject, cleanup, copy, lineRows, mountRegister, one, takeoffStrings, userEvent, within, type ViewLine } from "./support/fixtures";

afterEach(() => cleanup());

// Resolved from this file's own path: under jsdom the global `URL` is the DOM's, which Node's
// `fileURLToPath` does not take.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sheet = (relative: string): string => readFileSync(join(REPO_ROOT, relative), "utf8");
const REGISTER_SHEET = sheet("src/app/(app)/t/[tenant]/p/[project]/takeoff/register/register.css");
const CORE_SHEET = sheet("src/ui/primitives/core/core.css");
const DATA_SHEET = sheet("src/ui/primitives/data/data.css");
const TOKENS_SHEET = sheet("src/ui/tokens.css");

/**
 * Every declaration of every rule whose selector list names `selector` as a whole selector —
 * inside a media query as much as outside one. `ruleBody` reads the FIRST rule only, and a clip
 * restated further down the sheet is exactly the regression this suite exists to catch.
 */
function declaredFor(css: string, selector: string): Declaration[] {
  const text = withoutComments(css);
  const out: Declaration[] = [];
  for (const block of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (block[1] as string).split(",").map((one) => one.trim());
    if (!selectors.includes(selector)) continue;
    // A body's lines count from its own `{`; the sheet's count from the top of the file.
    const opened = text.slice(0, (block.index ?? 0) + (block[1] as string).length).split("\n").length - 1;
    out.push(...declarations(block[2] as string).map((decl) => ({ ...decl, line: decl.line + opened })));
  }
  return out;
}

/** The overflow values that cut a descendant off — `hidden`, `clip`, and the two that scroll. */
const CLIPS = /\b(?:hidden|clip|auto|scroll)\b/;
const OVERFLOW_PROPS = ["overflow", "overflow-x", "overflow-y", "overflow-block", "overflow-inline"];

/** A stacking layer as the token table states it: `var(--z-x)` or `calc(var(--z-x) + n)`. */
function layerOf(value: string, tokens: Readonly<Record<string, number>>): number {
  const at = /^(?:calc\(\s*)?var\((--z-[a-z]+)\)\s*(?:\+\s*(\d+)\s*\)?)?$/.exec(value.trim());
  expect(at, `a z-index of this tree is a z token, alone or plus a step: \`${value}\``).not.toBeNull();
  const base = tokens[(at as RegExpExecArray)[1] as string];
  expect(base, `the token table states ${(at as RegExpExecArray)[1]}`).toBeTypeOf("number");
  return (base as number) + Number((at as RegExpExecArray)[2] ?? "0");
}

const zTokens = (): Record<string, number> => {
  const table: Record<string, number> = {};
  for (const found of withoutComments(TOKENS_SHEET).matchAll(/(--z-[a-z]+)\s*:\s*(\d+)\s*;/g)) table[found[1] as string] = Number(found[2]);
  return table;
};

describe("I-442: the bar a chip stands in never cuts off what the chip opens", () => {
  test("the filter bar and every box of this screen between it and main clip nothing — and the bar is still one 36 px line", () => {
    for (const selector of [".cx-register", ".cx-register-filters", ".cx-register-filter"]) {
      for (const decl of declaredFor(REGISTER_SHEET, selector).filter((one) => OVERFLOW_PROPS.includes(one.prop))) {
        expect(decl.value, `${selector} { ${decl.prop}: ${decl.value} } (line ${decl.line}) would cut a chip's options off below the bar — and make the bar a scroll box its focused field scrolls away`).not.toMatch(CLIPS);
      }
    }
    const bar = declaredFor(REGISTER_SHEET, ".cx-register-filters");
    expect(bar.filter((one) => one.prop === "overflow").at(-1)?.value, "the bar states that it lets its chips' popovers out").toBe("visible");
    expect(bar.filter((one) => one.prop === "height").at(-1)?.value, "and stays the 36 px bar §3.2 draws").toBe("36px");
    expect(
      bar.filter((one) => one.prop === "flex-wrap" || one.prop === "flex-flow").map((one) => one.value),
      "held to one line by the flex row itself, never by a clip",
    ).not.toContainEqual(expect.stringMatching(/\bwrap\b/));
  });

  test("the chip's popover stands against the chip, on the overlay layer, above every layer the grid stacks", () => {
    const popover = declaredFor(CORE_SHEET, ".cx-combobox-popover");
    expect(popover.filter((one) => one.prop === "position").at(-1)?.value, "positioned against the chip's own box").toBe("absolute");
    const tokens = zTokens();
    const layer = layerOf(popover.filter((one) => one.prop === "z-index").at(-1)?.value ?? "", tokens);
    const grid = declarations(withoutComments(DATA_SHEET))
      .filter((one) => one.prop === "z-index")
      .map((one) => ({ at: one.line, layer: layerOf(one.value, tokens) }));
    expect(grid.length, "the grid stacks its sticky header, footer and frozen column").toBeGreaterThan(0);
    // The grid's own column chooser is itself an overlay; every OTHER layer is its sticky furniture.
    const sticky = grid.filter((one) => one.layer < tokens["--z-overlay"]!);
    for (const held of sticky) expect(layer, `the popover outranks the grid's layer at data.css:${held.at}`).toBeGreaterThan(held.layer);
  });
});

/* ------------------------------------------------------------------------------ the DOM half */

/** Two classes on two levels: a column on each storey and a beam on the ground floor. */
function twoClasses(): { view: ReturnType<typeof aView>; lines: ViewLine[] } {
  const lines = [
    aLine({ lineId: "line-C1-GF", objectKey: "col-C1-GF", class: "column", level: "GF" }),
    aLine({ lineId: "line-C1-1F", objectKey: "col-C1-1F", class: "column", level: "1F" }),
    aLine({ lineId: "line-B1-GF", objectKey: "beam-B1-GF", class: "beam", level: "GF", value: "0.45" }),
  ];
  const objects = [
    anObject({ objectKey: "col-C1-GF", mark: "C1", level: "GF", class: "column" }),
    anObject({ objectKey: "col-C1-1F", mark: "C1", level: "1F", class: "column" }),
    anObject({ objectKey: "beam-B1-GF", mark: "B1", level: "GF", class: "beam" }),
  ];
  return { view: aView({ objects, lines }), lines };
}

const CHIPS = ["class", "kind", "level", "basis", "coverage"] as const;
const chip = (root: HTMLElement, name: (typeof CHIPS)[number]): HTMLElement => one(root, `register-filter-${name}`);
const count = (root: HTMLElement): string => (one(root, "register-lines-count").textContent ?? "").trim();
const said = (template: string, shown: number, total: number): string => template.replace("{shown}", String(shown)).replace("{total}", String(total));

describe("I-443: a QS filters the register with a click, and the keyboard reaches every chip", () => {
  test("a click on a chip opens its options in the chip's own box, the other four chips stand, and a click takes one", async () => {
    const { view, lines } = twoClasses();
    const root = await mountRegister(view);
    const template = copy(await takeoffStrings(), "takeoff_register_lines_count");
    const user = userEvent.setup();
    expect(count(root), "at rest every line stands").toBe(said(template, lines.length, lines.length));

    const classChip = chip(root, "class");
    await user.click(classChip);
    expect(classChip.getAttribute("aria-expanded"), "the chip says it is open").toBe("true");
    const listbox = within(root).getByRole("listbox");
    expect(classChip.closest(".cx-combobox")?.contains(listbox), "the options stand in the chip's own box — positioned against the chip, not somewhere else on the page").toBe(true);
    for (const name of CHIPS) expect(chip(root, name).isConnected, `the ${name} chip still stands in the bar while one is open`).toBe(true);

    const classes = [...new Set(lines.map((line) => line.class))];
    const offered = within(listbox)
      .getAllByRole("option")
      .map((option) => option.getAttribute("data-value"));
    expect(offered.sort(), "the chip offers its all-option and every class the register holds").toEqual(["", ...classes].sort());

    const beam = listbox.querySelector<HTMLElement>('[role="option"][data-value="beam"]') as HTMLElement;
    const beamSaid = (beam.textContent ?? "").trim();
    await user.click(beam);

    const kept = lines.filter((line) => line.class === "beam");
    expect(count(root), "the count line states the set the filter keeps").toBe(said(template, kept.length, lines.length));
    expect(
      lineRows(root).map((row) => row.getAttribute("data-line")),
      "and the grid shows exactly it",
    ).toEqual(kept.map((line) => line.lineId));
    expect(classChip.getAttribute("aria-label")?.endsWith(` ${beamSaid}`), "the chip reads the option it was given").toBe(true);
    expect(classChip.getAttribute("data-chosen"), "and marks itself as narrowing").toBe("true");
    expect(within(root).queryByRole("listbox"), "taking the option closed the list").toBeNull();
    expect(document.activeElement, "and left the reader on the chip, not at the top of the page").toBe(classChip);
  });

  test("the keyboard alone walks the bar: Tab to the next chip, Enter opens it, ↓ and Enter take, and the reader stays on the chip", async () => {
    const { view, lines } = twoClasses();
    const root = await mountRegister(view);
    const template = copy(await takeoffStrings(), "takeoff_register_lines_count");
    const user = userEvent.setup();

    await user.click(chip(root, "class"));
    await user.keyboard("{Escape}");
    expect(document.activeElement, "Esc closes the class chip onto itself").toBe(chip(root, "class"));

    await user.tab();
    expect(document.activeElement, "Tab from the class chip lands on the kind chip, the bar's next stop").toBe(chip(root, "kind"));
    await user.tab();
    expect(document.activeElement, "and the next Tab on the level chip").toBe(chip(root, "level"));

    await user.keyboard("{Enter}");
    expect(within(root).getByRole("listbox"), "Enter opens the level chip's options").toBeTruthy();
    await user.keyboard("1F");
    await user.keyboard("{ArrowDown}{Enter}");

    const kept = lines.filter((line) => line.level === "1F");
    expect(count(root), "the level the reader typed and took narrows the register").toBe(said(template, kept.length, lines.length));
    expect(chip(root, "level").getAttribute("data-chosen"), "and the chip holds it").toBe("true");
    expect(document.activeElement, "and the reader stands on the chip they narrowed, ready for the next Tab").toBe(chip(root, "level"));
  });

  test("a chip left open by Tab closes behind the reader, and the step lands on the next chip", async () => {
    const { view } = twoClasses();
    const root = await mountRegister(view);
    const user = userEvent.setup();

    await user.click(chip(root, "level"));
    expect(within(root).getByRole("listbox"), "the level chip is open").toBeTruthy();
    await user.tab();
    expect(within(root).queryByRole("listbox"), "Tab left no list standing over the grid").toBeNull();
    expect(chip(root, "level").getAttribute("aria-expanded"), "and the chip says so").toBe("false");
    expect(document.activeElement, "the step went on to the next chip in the bar").toBe(chip(root, "basis"));
  });
});
