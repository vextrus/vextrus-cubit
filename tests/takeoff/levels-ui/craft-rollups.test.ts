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
 *
 * And session 8's walk (I-433 … I-435): the Foundation's piles, caps, blinding and excavation roll
 * up on a row of their own beneath the stack instead of vanishing from it; no `100%` stands over a
 * roll-up that may be leaving lines out; the roll-up columns share the width the grid is measured at,
 * so three kinds stand in view at 1280 and 1440; and the height form refuses an empty figure or an
 * empty source on the field, pressing no door.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { rollupWidthOf } from "@/modules/takeoff/levels-ui/index";
import { rollupsOf, rowsOfLines, type RolledLine } from "@/modules/takeoff/levels-ui/rollups";
import { TESTIDS, testIdSelector } from "@/ui/testids";
import { declaredValue } from "../../support/stylesheet";
import {
  AUTHOR_STOREY_HEIGHT,
  COMPLETE,
  NONE,
  PARTIAL_DECLARED,
  RCC_CONCRETE,
  STOREY_HEIGHT_UNSTATED,
  TESTID,
  cleanup,
  doorBank,
  fireEvent,
  hook,
  hooks,
  levelFixture,
  levelsStrings,
  mountLevels,
  rollup,
  spokenText,
  textOf,
  viewFixture,
  type RollupShape,
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

/* ------------------------------------------------------------------ session 8: C5's fixtures */

/** The grid's width at 1440 × 900 and 1280 × 800 with nothing selected, measured on the running screen. */
const GRID_AT_1440 = 1092;
const GRID_AT_1280 = 1012;
/** What the grid keeps clear at its trailing edge for the table's own tools (I-434, the s-bbs allowance). */
const TRAILING = 40;

/**
 * The region the screen measures, stubbed to a width: jsdom lays nothing out, so `clientWidth` reads
 * 0 everywhere and the shared stubs answer only the DataTable's viewport. The previous getter is kept
 * and answered for every other element, and put back after.
 */
function gridMeasuredAt(width: number): () => void {
  const home = [HTMLElement.prototype, Element.prototype].find((proto) => Object.getOwnPropertyDescriptor(proto, "clientWidth") !== undefined) ?? Element.prototype;
  const before = Object.getOwnPropertyDescriptor(home, "clientWidth");
  Object.defineProperty(home, "clientWidth", {
    configurable: true,
    get(this: Element): number {
      if (this.classList.contains("cx-levels-grid")) return width;
      return (before?.get?.call(this) as number | undefined) ?? 0;
    },
  });
  return () => {
    if (before !== undefined) Object.defineProperty(home, "clientWidth", before);
  };
}

/** The widths the grid's column headers are drawn at, in order, as the table styles them. */
function headerWidths(root: HTMLElement): number[] {
  return [...root.querySelectorAll<HTMLElement>('[role="columnheader"]')].map((header) => Number.parseFloat(header.style.width));
}

/** `count` stored lines of one kind, COMPLETE at `each` but for the last, which takes up the rest of `total`. */
function linesSumming(o: { kind: string; unit: string; count: number; each: string; last: string; place: RolledLine["place"] }): RolledLine[] {
  return Array.from({ length: o.count }, (_, at) => ({
    place: o.place,
    kind: o.kind,
    unit: o.unit,
    coverage: COMPLETE,
    value: at === o.count - 1 ? o.last : o.each,
    omitted: [],
  }));
}

/** `count` partial lines of one kind, each declaring its omission under `code`. */
function partialLines(o: { kind: string; unit: string; count: number; code: string; place: RolledLine["place"] }): RolledLine[] {
  return Array.from({ length: o.count }, () => ({ place: o.place, kind: o.kind, unit: o.unit, coverage: PARTIAL_DECLARED, value: null, omitted: [{ code: o.code }] }));
}

const FDN_ID = "00000000-0000-4000-8000-00000000f0d0";
const GF_ID = "00000000-0000-4000-8000-0000000000f0";
const ON_FDN: RolledLine["place"] = { levelId: FDN_ID, levelSlot: null, levelLabel: null };
const IN_FOUNDATION: RolledLine["place"] = { levelId: null, levelSlot: "FOUNDATION", levelLabel: null };

/**
 * F-RCC6-BNBC's foundation as J-000 stores it (the `readback` skill's ground truth, and session 8's
 * db read of the FOUNDATION slot): 89 pile lines of 372.848929 m³ and 26 pile-cap lines of 128.781275
 * m³ of concrete, the caps' 254.132613 m² of formwork, 89 bored piles and 1,898.904 m of boring, the
 * blinding half measured and the excavation deferred — and on FDN, the neck's 26 column lines of
 * 3.059609 m³ (I-338) with their rebar contested.
 */
function bnbcFoundationLines(): RolledLine[] {
  return [
    ...linesSumming({ kind: RCC_CONCRETE, unit: "m3", count: 26, each: "0.117677", last: "0.117684", place: ON_FDN }),
    ...partialLines({ kind: "rcc.rebar", unit: "kg", count: 26, code: "NOTE_READING_CONTESTED", place: ON_FDN }),
    ...linesSumming({ kind: RCC_CONCRETE, unit: "m3", count: 89, each: "4.189314", last: "4.189297", place: IN_FOUNDATION }),
    ...linesSumming({ kind: RCC_CONCRETE, unit: "m3", count: 26, each: "4.953126", last: "4.953125", place: IN_FOUNDATION }),
    ...linesSumming({ kind: "rcc.formwork", unit: "m2", count: 26, each: "9.774331", last: "9.774338", place: IN_FOUNDATION }),
    ...linesSumming({ kind: "piling.bored", unit: "pcs", count: 89, each: "1", last: "1", place: IN_FOUNDATION }),
    ...linesSumming({ kind: "piling.boring", unit: "m", count: 89, each: "21.336", last: "21.336", place: IN_FOUNDATION }),
    ...linesSumming({ kind: "pcc.blinding", unit: "m3", count: 12, each: "0.391016", last: "0.391011", place: IN_FOUNDATION }),
    ...partialLines({ kind: "pcc.blinding", unit: "m3", count: 14, code: "BLINDING_PLAN_DEFERRED", place: IN_FOUNDATION }),
    ...partialLines({ kind: "earthwork.excavation", unit: "m3", count: 14, code: "EARTHWORK_PLAN_DEFERRED", place: IN_FOUNDATION }),
    ...partialLines({ kind: "earthwork.excavation", unit: "m3", count: 12, code: "GROUND_LEVEL_UNSTATED", place: IN_FOUNDATION }),
  ];
}

/** One roll-up the composition answered, by kind. */
function rollupOf(rollups: readonly RollupShape[], kind: string): RollupShape {
  const held = rollups.find((candidate) => candidate.kind === kind);
  expect(held, `a ${kind} roll-up stands on this row: ${JSON.stringify(rollups)}`).toBeDefined();
  return held as RollupShape;
}

describe("S-Levels rolls up the foundation that is there (I-433)", () => {
  test("I-433: the FOUNDATION slot's lines roll up on a row of their own, equal to the read-back", () => {
    const rows = rowsOfLines([FDN_ID, GF_ID], bnbcFoundationLines());
    const slots = rows.slots;
    expect(slots.map((slot) => slot.slot), "one row beneath the stack, and nothing on no level").toEqual(["FOUNDATION"]);
    const foundation = slots[0]?.rollups ?? [];

    const concrete = rollupOf(foundation, RCC_CONCRETE);
    expect(concrete.lines, "89 piles and 26 caps").toBe(115);
    expect(concrete.value, "372.848929 + 128.781275 m³, the read-back's piles and caps, summed exactly").toBe("501.630204");
    expect(concrete.coverage, "every one of them COMPLETE").toBe(COMPLETE);
    expect(rollupOf(foundation, "rcc.formwork").value, "the caps' formwork").toBe("254.132613");
    expect(rollupOf(foundation, "piling.bored").value, "89 bored piles").toBe("89");
    expect(rollupOf(foundation, "piling.boring").value, "and 1,898.904 m of boring").toBe("1898.904");
    const blinding = rollupOf(foundation, "pcc.blinding");
    expect([blinding.coverage, blinding.value, blinding.code], "blinding half measured states no figure, and why").toEqual([PARTIAL_DECLARED, null, "BLINDING_PLAN_DEFERRED"]);
    expect(rollupOf(foundation, "earthwork.excavation").coverage, "the excavation deferred is partial").toBe(PARTIAL_DECLARED);

    const neck = rows.byLevel.get(FDN_ID) ?? [];
    expect(neck.length, "FDN keeps only the lines of the objects standing on it — the neck's columns and their rebar").toBe(52);
    expect(rows.byLevel.has(GF_ID), "and a level no line stands on holds none").toBe(false);
  });

  test("I-433: every line lands on exactly one row — a line on no live level is on the unplaced row, never dropped", () => {
    const repudiated = "00000000-0000-4000-8000-0000000000de";
    const lines: RolledLine[] = [
      ...linesSumming({ kind: RCC_CONCRETE, unit: "m3", count: 3, each: "1", last: "1", place: { levelId: GF_ID, levelSlot: null, levelLabel: null } }),
      ...linesSumming({ kind: RCC_CONCRETE, unit: "m3", count: 2, each: "4", last: "4", place: IN_FOUNDATION }),
      ...partialLines({ kind: RCC_CONCRETE, unit: "m3", count: 2, code: "TYPICAL_RANGE_UNSTATED", place: { levelId: null, levelSlot: "UNRESOLVED", levelLabel: null } }),
      ...linesSumming({ kind: RCC_CONCRETE, unit: "m3", count: 1, each: "2", last: "2", place: { levelId: null, levelSlot: null, levelLabel: "MEZZ" } }),
      ...linesSumming({ kind: "rcc.formwork", unit: "m2", count: 1, each: "5", last: "5", place: { levelId: repudiated, levelSlot: null, levelLabel: null } }),
    ];
    const rows = rowsOfLines([GF_ID], lines);
    const onLevels = [...rows.byLevel.values()].reduce((total, held) => total + held.length, 0);
    const onSlots = rows.slots.reduce((total, slot) => total + slot.rollups.reduce((sum, held) => sum + held.lines, 0), 0);
    expect(onLevels + onSlots, "no line of the campaign is left off the grid").toBe(lines.length);
    expect(rows.slots.map((slot) => slot.slot), "the Foundation first, the unplaced last").toEqual(["FOUNDATION", "UNPLACED"]);
    const unplaced = rows.slots[1]?.rollups ?? [];
    expect(unplaced.map((held) => [held.kind, held.lines]), "the UNRESOLVED slot, a placeholder and a repudiated level's lines").toEqual([
      [RCC_CONCRETE, 3],
      ["rcc.formwork", 1],
    ]);
  });

  test("I-433: the Foundation row stands beneath the lowest level, names itself and holds no level's attributes", async () => {
    const copy = await levelsStrings();
    const rows = rowsOfLines([FDN_ID], bnbcFoundationLines());
    const fdn = await levelFixture({ levelId: FDN_ID, label: "FDN", ordinal: -1, readings: [{ value: "0.6096", unit: "m", sourceKey: "DXF_HANDLE:1D59" }] });
    const mounted = await mountLevels({
      view: viewFixture({
        stack: [{ ...fdn, rollups: rollupsOf(rows.byLevel.get(FDN_ID) ?? []) }],
        slots: rows.slots.map((slot) => ({ slot: slot.slot, rollups: [...slot.rollups] })),
      }),
    });
    const drawn = hooks(mounted.root, TESTID.row);
    expect(drawn.map((row) => row.getAttribute("data-slot") ?? row.getAttribute("data-level")), "the Foundation first, then the stack as it stands").toEqual(["FOUNDATION", FDN_ID]);
    const foundation = drawn[0] as HTMLElement;
    expect(foundation.hasAttribute("data-level"), "a slot row carries no surrogate a pointer could select").toBe(false);
    expect(foundation.hasAttribute("data-ordinal"), "and no ordinal a reader would count as a storey").toBe(false);
    expect(spokenText(foundation), "it names itself in words").toContain(copy["levels_slot_foundation"]);
    expect(foundation.querySelector(testIdSelector(TESTIDS.idChip.root)), "and shows no id chip").toBeNull();

    const concrete = foundation.querySelector<HTMLElement>(`[data-testid="${TESTID.rollup}"][data-kind="${RCC_CONCRETE}"]`) as HTMLElement;
    expect(concrete.getAttribute("data-lines"), "115 lines").toBe("115");
    expect(concrete.querySelector('[data-testid="quantity-text"]')?.getAttribute("data-value"), "the read-back's 501.630204 m³ exactly").toBe("501.630204");
    expect(concrete.querySelector(testIdSelector(TESTIDS.coverage.chip)), "whole, and says so").not.toBeNull();

    const neck = (drawn[1] as HTMLElement).querySelector<HTMLElement>(`[data-testid="${TESTID.rollup}"][data-kind="${RCC_CONCRETE}"]`) as HTMLElement;
    expect(neck.querySelector('[data-testid="quantity-text"]')?.getAttribute("data-value"), "FDN still states its own neck").toBe("3.059609");
    expect(neck.querySelector(testIdSelector(TESTIDS.coverage.chip)), "and keeps its chip: the foundation's lines are no floor's").not.toBeNull();

    const headers = [...mounted.root.querySelectorAll<HTMLElement>('[role="columnheader"]')].map((header) => textOf(header));
    expect(headers.slice(3), "the kinds the levels bear lead; the kinds only the Foundation bears follow").toEqual(["Concrete", "Rebar", "Excavation", "Blinding", "Bored", "Boring", "Formwork"]);
  });

  test("I-433: no 100% stands over a level's roll-up of a kind some of whose lines stand on no level", async () => {
    const level = await levelFixture({
      label: "1F",
      ordinal: 1,
      rollups: [rollup({ kind: RCC_CONCRETE, lines: 26, value: "15.22476" }), rollup({ kind: "rcc.formwork", unit: "m2", lines: 26, value: "120.5" })],
    });
    const unplaced = { slot: "UNPLACED", rollups: [rollup({ kind: RCC_CONCRETE, lines: 50, coverage: PARTIAL_DECLARED, code: "TYPICAL_RANGE_UNSTATED" })] };
    const mounted = await mountLevels({ view: viewFixture({ stack: [level], slots: [unplaced] }) });
    const [floor, onNoLevel] = hooks(mounted.root, TESTID.row) as [HTMLElement, HTMLElement];
    expect(onNoLevel.getAttribute("data-slot"), "the lines on no level stand last, on a row of their own").toBe("UNPLACED");

    const concrete = floor.querySelector<HTMLElement>(`[data-testid="${TESTID.rollup}"][data-kind="${RCC_CONCRETE}"]`) as HTMLElement;
    expect(concrete.querySelector('[data-testid="quantity-text"]')?.getAttribute("data-value"), "the floor still states the lines it holds").toBe("15.22476");
    expect(concrete.getAttribute("data-whole"), "but may be leaving some out").toBe("false");
    expect(concrete.querySelector(testIdSelector(TESTIDS.coverage.chip)), "so no 100% claims it whole").toBeNull();
    const formwork = floor.querySelector<HTMLElement>(`[data-testid="${TESTID.rollup}"][data-kind="rcc.formwork"]`) as HTMLElement;
    expect(formwork.querySelector(testIdSelector(TESTIDS.coverage.chip)), "a kind with no line on no level keeps its chip").not.toBeNull();
  });
});

describe("S-Levels' roll-up columns fit the grid they are measured in (I-434)", () => {
  test("I-434: three kinds share what the fixed columns leave at 1440 and at 1280, on the 4 px grid", () => {
    for (const grid of [GRID_AT_1440, GRID_AT_1280]) {
      const width = rollupWidthOf(grid, 3);
      expect(width % 4, `${width} px stays on the 4 px grid`).toBe(0);
      expect(144 + 64 + 152 + 3 * width + TRAILING, `three roll-ups at ${width} px fit a ${grid} px grid with its tools clear`).toBeLessThanOrEqual(grid);
    }
    expect(rollupWidthOf(GRID_AT_1440, 3), "at 1440 each keeps room for `26 lines 15.225 m³ 100%` (208 px) inside its padding").toBe(228);
    expect(rollupWidthOf(GRID_AT_1440, 1), "one kind never grows past 240").toBe(240);
    expect(rollupWidthOf(null, 3), "unmeasured, the width is the 1440 grid's, so the first paint is the measured one").toBe(rollupWidthOf(GRID_AT_1440, 3));
  });

  test("I-434: kinds that cannot stand in view at a width that says a figure each take 240, and the grid scrolls", () => {
    expect(rollupWidthOf(GRID_AT_1440, 7), "seven kinds in view would each be cut to `26 li…`, so none is").toBe(240);
    expect(rollupWidthOf(GRID_AT_1280 - 320, 3), "nor are three beside the open inspector at 1280").toBe(240);
  });

  test("I-434: the levels' own kinds stay in view at 1280 when the Foundation brings four more after them", async () => {
    const restore = gridMeasuredAt(GRID_AT_1280);
    try {
      const level = await levelFixture({
        label: "1F",
        ordinal: 1,
        rollups: [
          rollup({ kind: RCC_CONCRETE, lines: 49, coverage: PARTIAL_DECLARED, code: "SLAB_THICKNESS_UNSTATED" }),
          rollup({ kind: "rcc.formwork", unit: "m2", lines: 23, coverage: PARTIAL_DECLARED, code: "SLAB_THICKNESS_UNSTATED" }),
          rollup({ kind: "rcc.rebar", unit: "kg", lines: 26, coverage: PARTIAL_DECLARED, code: "NOTE_READING_CONTESTED" }),
        ],
      });
      const rows = rowsOfLines([], bnbcFoundationLines().filter((line) => line.place.levelSlot === "FOUNDATION"));
      const mounted = await mountLevels({ view: viewFixture({ stack: [level], slots: rows.slots.map((slot) => ({ slot: slot.slot, rollups: [...slot.rollups] })) }) });
      const headers = [...mounted.root.querySelectorAll<HTMLElement>('[role="columnheader"]')].map((header) => textOf(header));
      expect(headers.slice(3), "the frame's three lead, the Foundation's own four follow").toEqual(["Concrete", "Formwork", "Rebar", "Excavation", "Blinding", "Bored", "Boring"]);
      const widths = headerWidths(mounted.root);
      const inView = widths.slice(0, 6).reduce((total, width) => total + width, 0) + TRAILING;
      expect(inView, `Level, Ordinal, Storey height and the frame's three (${widths.slice(0, 6).join(" + ")}) stand inside ${GRID_AT_1280} px`).toBeLessThanOrEqual(GRID_AT_1280);
      expect(new Set(widths.slice(3)).size, "every roll-up column at the one width, the Foundation's a scroll away").toBe(1);
    } finally {
      restore();
    }
  });

  test("I-434: the index rail's heading is one line at the rail's 160 px floor, and never wraps", async () => {
    const copy = await levelsStrings();
    const level = await levelFixture({ label: "GF", ordinal: 0, rollups: [] });
    const mounted = await mountLevels({ view: viewFixture({ stack: [level] }) });
    const heading = hook(mounted.root, TESTID.ranges).querySelector<HTMLElement>("h2.cx-levels-panel-heading");
    expect(textOf(heading as HTMLElement), "the heading says what the list asks for, in the words the rail has room for").toBe(copy["levels_ranges_heading"]);
    // `Typical ranges to state` is 125 px at the heading's weight, measured on the served product; the
    // rail leaves 134 inside its padding at 1280. The length is the proxy jsdom can read.
    expect((copy["levels_ranges_heading"] ?? "").length, "no longer than the phrase measured to fit (the old one, 27 characters, wrapped)").toBeLessThanOrEqual(23);
    const sheet = readFileSync(join(REPO_ROOT, "src/app/(app)/t/[tenant]/p/[project]/takeoff/levels/levels.css"), "utf8");
    expect(declaredValue(sheet, ".cx-levels-panel-heading", "white-space"), "a face that outgrows it is cut on its one line (R-UI-083)").toBe("nowrap");
    expect(declaredValue(sheet, ".cx-levels-panel-heading", "text-overflow"), "with the ellipsis that says so").toBe("ellipsis");
  });

  test("I-433, I-434: a slot row's note is short enough to stand whole in the 152 px Storey height", async () => {
    const copy = await levelsStrings();
    // Measured in Spline Sans at 12 px: `Below the lowest level` 121 px, `Level not yet settled` 110,
    // against the 128 the column leaves inside comfortable's padding. The first wording, `No live
    // level carries these lines`, was 33 characters and 165 px.
    for (const key of ["levels_slot_foundation_note", "levels_slot_unplaced_note"]) {
      expect((copy[key] ?? "").length, `${key} is no longer than the phrase measured to fit`).toBeLessThanOrEqual(22);
    }
  });

  test("I-434: mounted over a 1280 grid, the stack's columns sum inside it — every roll-up in view", async () => {
    const restore = gridMeasuredAt(GRID_AT_1280);
    try {
      const level = await levelFixture({
        label: "1F",
        ordinal: 1,
        rollups: [
          rollup({ kind: RCC_CONCRETE, lines: 49, coverage: PARTIAL_DECLARED, code: "SLAB_THICKNESS_UNSTATED" }),
          rollup({ kind: "rcc.formwork", unit: "m2", lines: 23, coverage: PARTIAL_DECLARED, code: "SLAB_THICKNESS_UNSTATED" }),
          rollup({ kind: "rcc.rebar", unit: "kg", lines: 26, coverage: PARTIAL_DECLARED, code: "NOTE_READING_CONTESTED" }),
        ],
      });
      const mounted = await mountLevels({ view: viewFixture({ stack: [level] }) });
      const widths = headerWidths(mounted.root);
      expect(widths.length, "Level, Ordinal, Storey height and the three kinds").toBe(6);
      expect(widths.slice(0, 3), "the fixed columns: the storey height gives back what it held for a second phrase").toEqual([144, 64, 152]);
      expect(
        widths.reduce((total, width) => total + width, 0) + TRAILING,
        `${widths.join(" + ")} stands inside the 1280 grid's ${GRID_AT_1280} px with its tools clear — none cut off at the edge`,
      ).toBeLessThanOrEqual(GRID_AT_1280);
    } finally {
      restore();
    }
  });
});

describe("S-Levels' height form refuses an empty figure or source where it is typed (I-435)", () => {
  /** A stack of two levels, the first selected, with the reader holding every permission. */
  async function mountedWithGround(): Promise<{ root: HTMLElement; container: HTMLElement; bank: ReturnType<typeof doorBank>; ground: string; roof: string }> {
    const ground = await levelFixture({ label: "GF", ordinal: 0 });
    const roof = await levelFixture({ label: "ROOF", ordinal: 7 });
    const bank = doorBank({ actType: AUTHOR_STOREY_HEIGHT });
    const mounted = await mountLevels({ view: viewFixture({ stack: [ground, roof] }), doors: bank });
    fireEvent.click(hooks(mounted.root, TESTID.row).find((row) => row.getAttribute("data-level") === ground.levelId) as HTMLElement);
    return { root: mounted.root, container: mounted.container, bank, ground: ground.levelId, roof: roof.levelId };
  }

  test("I-435: a height with no source is refused on the Source key field, and no door is pressed", async () => {
    const copy = await levelsStrings();
    const it = await mountedWithGround();
    const inspector = hook(it.container, TESTID.inspector);
    fireEvent.change(hook(inspector, TESTID.heightValue), { target: { value: "3.2" } });
    fireEvent.click(hook(inspector, TESTID.authorHeight));

    expect(it.bank.callsTo("previewAuthorStoreyHeight"), "a height citing nothing is never sent to be previewed").toEqual([]);
    const said = inspector.querySelector<HTMLElement>('[role="alert"][data-field="source"]');
    expect(said, "the Source key field says why, under itself").not.toBeNull();
    expect(textOf(said as HTMLElement)).toBe(copy["levels_height_source_missing"]);
    expect(hook(inspector, TESTID.heightSource).getAttribute("aria-invalid"), "and is marked invalid for a reader who cannot see the red").toBe("true");
    expect(inspector.querySelector('[data-field="value"]'), "the figure was typed, so its field says nothing").toBeNull();

    fireEvent.change(hook(inspector, TESTID.heightSource), { target: { value: " DXF_HANDLE:1D90 " } });
    expect(inspector.querySelector('[data-field="source"]'), "typing the source clears its refusal").toBeNull();
    fireEvent.click(hook(inspector, TESTID.authorHeight));
    const sent = it.bank.callsTo("previewAuthorStoreyHeight");
    expect(sent.length, "with its evidence named, the door previews").toBe(1);
    const input = (sent[0]?.argument as { input?: Record<string, unknown> }).input ?? {};
    expect([input["levelId"], input["sourceKey"], input["valueAsWritten"]], "the selected level, the source as named, the figure as written").toEqual([it.ground, "DXF_HANDLE:1D90", "3.2"]);
  });

  test("I-435: an empty figure is refused on the Height field", async () => {
    const copy = await levelsStrings();
    const it = await mountedWithGround();
    const inspector = hook(it.container, TESTID.inspector);
    fireEvent.change(hook(inspector, TESTID.heightSource), { target: { value: "DXF_HANDLE:1D90" } });
    fireEvent.click(hook(inspector, TESTID.authorHeight));
    expect(it.bank.callsTo("previewAuthorStoreyHeight"), "nothing is sent").toEqual([]);
    const said = inspector.querySelector<HTMLElement>('[role="alert"][data-field="value"]');
    expect(textOf(said as HTMLElement), "the Height field says what it wants").toBe(copy["levels_height_value_missing"]);
    expect(hook(inspector, TESTID.heightValue).getAttribute("aria-invalid")).toBe("true");
  });

  test("I-435: the form belongs to the level it stands under — a figure typed on GF is not carried onto ROOF", async () => {
    const it = await mountedWithGround();
    fireEvent.change(hook(hook(it.container, TESTID.inspector), TESTID.heightValue), { target: { value: "3.2" } });
    fireEvent.click(hook(hook(it.container, TESTID.inspector), TESTID.authorHeight));
    fireEvent.click(hooks(it.root, TESTID.row).find((row) => row.getAttribute("data-level") === it.roof) as HTMLElement);
    const inspector = hook(it.container, TESTID.inspector);
    expect(inspector.getAttribute("data-level"), "ROOF fills the inspector").toBe(it.roof);
    expect((hook(inspector, TESTID.heightValue) as HTMLInputElement).value, "with an empty form of its own").toBe("");
    expect(inspector.querySelector('[role="alert"][data-field]'), "and none of GF's refusals").toBeNull();
  });
});
