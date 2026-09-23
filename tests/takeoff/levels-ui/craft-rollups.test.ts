// @vitest-environment jsdom
/**
 * S-Levels' craft amendments (docs/design/s-levels.md I-lev-1 … I-lev-4, session 7's look): a roll-up
 * states its figure at its kind's display precision with the exact sum in `data-value`; a partial
 * roll-up wears no coverage percentage nobody computed and says its code instead; a standing's code
 * is not printed beside the standing word that already says it; the rail's explanation is its
 * heading's Tooltip, not a paragraph; and the screen names itself with one clipped h1.
 */
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS, testIdSelector } from "@/ui/testids";
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
