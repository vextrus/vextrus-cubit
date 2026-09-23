// @vitest-environment jsdom
/**
 * S-Levels' craft amendments (docs/design/s-levels.md I-lev-1 … I-lev-4, session 7's look): a roll-up
 * states its figure at its kind's display precision with the exact sum in `data-value`; a partial
 * roll-up wears no coverage percentage nobody computed and says its code instead; a standing's code
 * is not printed beside the standing word that already says it; the rail's explanation is its
 * heading's Tooltip, not a paragraph; and the screen names itself with one clipped h1.
 *
 * And I-352 (the session-7 re-look): a roll-up column is headed by its kind in words; every agreed
 * storey height reads at the millimetre with the exact metres kept; and the count and the figure each
 * stand in a right-aligned slot, so a column of roll-ups reads down its figures. The slots are a
 * stylesheet fact jsdom cannot lay out, so they are read from the sheet through the craft rubric's
 * own reader (`tests/support/stylesheet.ts`).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS, testIdSelector } from "@/ui/testids";
import { declaredValue } from "../../support/stylesheet";
import {
  NONE,
  PARTIAL_DECLARED,
  RCC_CONCRETE,
  STOREY_HEIGHT_UNSTATED,
  TESTID,
  cleanup,
  hook,
  hooks,
  levelFixture,
  levelsStrings,
  mountLevels,
  rollup,
  spokenText,
  textOf,
  viewFixture,
} from "./support/levels-ui-view";

afterEach(() => {
  cleanup();
});

// Resolved from this file's own path: under jsdom the global `URL` is the DOM's, which Node's
// `fileURLToPath` does not take.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S-Levels states each roll-up as a figure a reader can read, and each fact once", () => {
  test("I-lev-1: a complete roll-up's face is its kind's display precision, exact in data-value", async () => {
    const level = await levelFixture({ label: "1F", ordinal: 1, rollups: [rollup({ kind: RCC_CONCRETE, lines: 26, value: "15.22476", coverage: "COMPLETE" })] });
    const mounted = await mountLevels({ view: viewFixture({ stack: [level] }) });
    const cell = hook(mounted.root, TESTID.rollup);
    const figure = cell.querySelector('[data-testid="quantity-text"]') as HTMLElement;
    expect(figure.getAttribute("data-value"), "the roll-up's exact sum stays on the element (I-241)").toBe("15.22476");
    expect(textOf(figure), "and its face is rcc.concrete's three places").toBe("15.225");
    expect(cell.querySelector(testIdSelector(TESTIDS.coverage.chip)), "a complete roll-up keeps its chip").not.toBeNull();
  });

  test("I-lev-1: a partial roll-up wears no 0% chip and says its code in words", async () => {
    const level = await levelFixture({
      label: "GF",
      ordinal: 0,
      rollups: [rollup({ kind: "rcc.rebar", unit: "kg", lines: 26, value: null, coverage: PARTIAL_DECLARED, code: "NOTE_READING_CONTESTED" })],
    });
    const mounted = await mountLevels({ view: viewFixture({ stack: [level] }) });
    const cell = hook(mounted.root, TESTID.rollup);
    expect(cell.querySelector(testIdSelector(TESTIDS.coverage.chip)), "no percentage is painted for a share nobody measured (R-UI-002)").toBeNull();
    expect(spokenText(cell), "the code is said in words").toContain("Note reading contested");
  });

  test("I-lev-2: a height nobody stated reads `Not stated` once, never `Not stated · Storey height unstated`", async () => {
    const level = await levelFixture({ label: "ROOF", ordinal: 7, rollups: [] });
    expect(level.standing, "the fixture is a level nobody has read").toBe(NONE);
    const mounted = await mountLevels({ view: viewFixture({ stack: [level] }) });
    const row = hook(mounted.root, TESTID.row);
    const standing = row.querySelector(".cx-levels-cell-standing") as HTMLElement;
    expect(standing.getAttribute("data-code"), "the code stays machine-readable on the cell").toBe(STOREY_HEIGHT_UNSTATED);
    expect(spokenText(standing), "and the standing word is the one fact said").toBe((await levelsStrings())["levels_standing_none"]);
  });

  test("I-352: a roll-up column is headed by its kind in words, and the key stays on the column's roll-ups", async () => {
    const level = await levelFixture({
      label: "GF",
      ordinal: 0,
      rollups: [rollup({ kind: RCC_CONCRETE, lines: 26, value: "16.828", coverage: "COMPLETE" }), rollup({ kind: "rcc.rebar", unit: "kg", lines: 26, value: null, coverage: PARTIAL_DECLARED, code: "NOTE_READING_CONTESTED" })],
    });
    const mounted = await mountLevels({ view: viewFixture({ stack: [level] }) });
    const headers = [...mounted.root.querySelectorAll<HTMLElement>('[role="columnheader"]')].map((header) => textOf(header));
    expect(headers, "`Concrete` and `Rebar`, as the register's Kind column says them — never `rcc.concrete`").toEqual(expect.arrayContaining(["Concrete", "Rebar"]));
    expect(headers.some((header) => header.includes("rcc.")), "no key heads a column").toBe(false);
    expect(hooks(mounted.root, TESTID.rollup).map((cell) => cell.getAttribute("data-kind")), "each roll-up keeps its stored kind").toEqual([RCC_CONCRETE, "rcc.rebar"]);
  });

  test("I-352: every agreed storey height reads at the millimetre, the exact metres kept on the element", async () => {
    const eleven = await levelFixture({ label: "GF", ordinal: 0, readings: [{ value: "3352.8", unit: "mm" }] });
    const ten = await levelFixture({ label: "1F", ordinal: 1, readings: [{ value: "3048", unit: "mm" }] });
    expect(eleven.canonicalMetres, "the fixture is F-RCC6-BNBC's eleven-foot ground storey").toBe("3.3528");
    const mounted = await mountLevels({ view: viewFixture({ stack: [eleven, ten] }) });
    const heights = hooks(mounted.root, TESTID.row).map((row) => row.querySelector<HTMLElement>(".cx-levels-cell-standing .cx-levels-height") as HTMLElement);
    expect(heights.map((figure) => figure.getAttribute("data-value")), "the exact metres stay on the figure (L-QTY-03)").toEqual(["3.3528", "3.048"]);
    expect(heights.map((figure) => textOf(figure)), "and both faces state three places — one precision down the column").toEqual(["3.353", "3.048"]);
  });

  test("I-352: the count and the figure each stand in a slot of their own, so the column reads down its figures", async () => {
    const level = await levelFixture({ label: "5F", ordinal: 5, rollups: [rollup({ kind: RCC_CONCRETE, lines: 26, value: "9.761", coverage: "COMPLETE" })] });
    const mounted = await mountLevels({ view: viewFixture({ stack: [level] }) });
    const cell = hook(mounted.root, TESTID.rollup);
    expect(cell.querySelector(".cx-levels-count"), "the count is its own slot").not.toBeNull();
    expect(cell.querySelector(".cx-levels-figure"), "and so is the figure").not.toBeNull();
    const sheet = readFileSync(join(REPO_ROOT, "src/app/(app)/t/[tenant]/p/[project]/takeoff/levels/levels.css"), "utf8");
    expect(declaredValue(sheet, ".cx-levels-count", "text-align"), "numerals right-aligned (R-UI-083)").toBe("end");
    expect(declaredValue(sheet, ".cx-levels-rollup > .cx-levels-figure", "justify-content"), "the figure flush right in its slot").toBe("flex-end");
    expect(declaredValue(sheet, ".cx-levels-rollup > .cx-levels-figure", "min-inline-size"), "a slot wider than `999.999`, inside the 240 px column at either density").toBe("8ch");
    expect(declaredValue(sheet, ".cx-levels-cell-standing > .cx-levels-height", "justify-content"), "and the storey height likewise").toBe("flex-end");
  });

  test("I-lev-3, I-lev-4: the rail's explanation is no paragraph, and the screen names itself with one h1", async () => {
    const level = await levelFixture({ label: "GF", ordinal: 0, rollups: [] });
    const mounted = await mountLevels({ view: viewFixture({ stack: [level] }) });
    const copy = await levelsStrings();
    expect(textOf(hook(mounted.root, TESTID.ranges)), "the hint is the heading's Tooltip, not text under it (R-UI-081)").not.toContain(copy["levels_ranges_hint"]);
    const headings = [...mounted.root.querySelectorAll("h1")];
    expect(headings.map((heading) => textOf(heading)), "one h1, the screen's own name").toEqual([copy["levels_heading"]]);
    expect(hooks(mounted.root, TESTID.row).length, "and the grid still stands").toBe(1);
  });
});
