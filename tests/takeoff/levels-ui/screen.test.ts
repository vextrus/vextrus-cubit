// @vitest-environment jsdom
/**
 * AC-1 — S-Levels as the grid-workspace template renders it: the tabs row with its third tab, the
 * shipped DataTable over the live stack, the roll-up cells, the shell's ONE inspector (absent until
 * a level is selected), the empty state and the seven-state matrix (R-TO-033, L-MEA-07, L-QTY-02,
 * R-UI-050, R-UI-080, docs/design/s-levels.md §1, §2, §7).
 *
 * Nothing here freezes a roster. The rows, the ordinals, the standings, the codes, the metres and
 * the roll-up cells are all derived from the `LevelsView` under test — a view bearing another level
 * or another kind grows the expectation with it — and every standing and figure in that view is
 * computed by the product's own core over the readings the fixture was written with (B-19, B-17).
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  AGREED,
  DEFAULTED,
  DERIVED,
  ENTERED,
  LEVELS_ROUTE,
  NONE,
  PARTIAL_DECLARED,
  RCC_CONCRETE,
  SCREEN_STATE_OF,
  SCREEN_STATES_MODULE,
  STOREY_HEIGHT_CONTESTED,
  SUSPENDED,
  TESTID,
  TESTIDS_MODULE,
  TRANSCRIBED,
  attr,
  cleanup,
  fireEvent,
  hook,
  hooks,
  levelFixture,
  levelsStrings,
  mountLevels,
  optionsOf,
  productModule,
  rollup,
  spokenText,
  textOf,
  viewFixture,
  type LevelShape,
  type LevelsViewShape,
} from "./support/levels-ui-view";

afterEach(() => {
  cleanup();
});

/**
 * A stack of three levels: one whose readings agree, one whose readings disagree, and one nobody has
 * read at all — so every standing the law admits stands in the grid at once, each with its own
 * roll-ups. The figures are the core's, never typed here.
 */
async function stackFixture(): Promise<LevelShape[]> {
  return [
    await levelFixture({
      label: "GF",
      ordinal: 0,
      readings: [
        { basis: TRANSCRIBED, sourceKey: "S-102:e:7", value: "3048", unit: "mm" },
        { basis: ENTERED, value: "3.048", unit: "m" },
      ],
      rollups: [rollup({ kind: RCC_CONCRETE, lines: 4, value: "2.43", coverage: "COMPLETE" })],
    }),
    await levelFixture({
      label: "MEZZ",
      ordinal: 1,
      readings: [
        { basis: TRANSCRIBED, sourceKey: "S-102:e:9", value: "3048", unit: "mm" },
        { basis: ENTERED, value: "3.2", unit: "m" },
      ],
      rollups: [rollup({ kind: RCC_CONCRETE, lines: 2, value: null, coverage: PARTIAL_DECLARED, code: STOREY_HEIGHT_CONTESTED })],
    }),
    await levelFixture({ label: "L1", ordinal: 2, rollups: [rollup({ kind: "rcc.formwork", unit: "m2", lines: 3, value: "12.5" })] }),
  ];
}

const viewOf = async (): Promise<LevelsViewShape> => viewFixture({ stack: await stackFixture() });

describe("AC-1: the stack renders as the grid-workspace template", () => {
  test("AC-1: the screen stands ready under the takeoff tabs row, with Levels the current tab", async () => {
    const view = await viewOf();
    const copy = await levelsStrings();
    const mounted = await mountLevels({ view });

    expect(attr(mounted.root, "data-state"), "a reading that answered stands ready (§2's order, first holding wins)").toBe("ready");

    // The tabs row is the LANE's, drawn as chrome above whichever surface a reader stands on and
    // never inside the screen (`takeoff/nav.tsx`: "the lane draws ONE row and no screen draws a
    // second one above the grid"), so it is read from the page the screen stands in.
    const levels = hook(mounted.container, TESTID.navLevels);
    expect(attr(levels, "aria-current"), "the lane's third tab is the current page at this address").toBe("page");
    expect(textOf(levels), "and is named by the lane's own registry key, never a second spelling").toBe(copy["takeoff_nav_levels"]);

    for (const beside of [TESTID.navRegister, TESTID.navCoverage]) {
      const tab = hook(mounted.container, beside);
      expect(attr(tab, "aria-current"), `${beside} stands beside it and is not the current page`).not.toBe("page");
    }
  });

  test("AC-1: one row per live level in ordinal order, each stating its standing, code and metres", async () => {
    const view = await viewOf();
    const mounted = await mountLevels({ view });
    const grid = hook(mounted.root, TESTID.grid);

    const ordered = [...view.stack].sort((left, right) => left.ordinal - right.ordinal);
    expect(attr(grid, "data-rows-rendered"), "the grid publishes what it in fact drew, for a retrying read to wait on").toBe(String(ordered.length));

    const rows = hooks(grid, TESTID.row);
    expect(
      rows.map((row) => attr(row, "data-level")),
      "one row per LIVE level, in the order the stack physically stands in (L-MEA-07)",
    ).toEqual(ordered.map((level) => level.levelId));

    for (const [at, level] of ordered.entries()) {
      const row = rows[at] as HTMLElement;
      expect(
        {
          ordinal: attr(row, "data-ordinal"),
          standing: attr(row, "data-standing"),
          code: attr(row, "data-code"),
          metres: attr(row, "data-metres"),
        },
        `the row for ${level.label} states what the reading says about it — and no figure beside a standing that is not ${AGREED} (I-242)`,
      ).toEqual({
        ordinal: String(level.ordinal),
        standing: level.standing,
        code: level.code ?? "",
        metres: level.standing === AGREED ? (level.canonicalMetres ?? "") : "",
      });
      expect([AGREED, SUSPENDED, NONE], `and its standing is one of the three the law admits: ${level.standing}`).toContain(attr(row, "data-standing"));
    }
  });

  test("AC-1: each row holds one roll-up cell per kind its lines bear, read and never re-derived", async () => {
    const view = await viewOf();
    const mounted = await mountLevels({ view });
    const rows = hooks(hook(mounted.root, TESTID.grid), TESTID.row);

    for (const level of view.stack) {
      const row = rows.find((candidate) => attr(candidate, "data-level") === level.levelId);
      expect(row, `the grid draws ${level.label}`).toBeTruthy();
      const cells = hooks(row as HTMLElement, TESTID.rollup);
      expect(
        cells.map((cell) => attr(cell, "data-kind")),
        `${level.label} holds one roll-up cell per kind its stored lines bear`,
      ).toEqual(level.rollups.map((held) => held.kind));

      for (const [at, held] of level.rollups.entries()) {
        const cell = cells[at] as HTMLElement;
        expect(
          { lines: attr(cell, "data-lines"), coverage: attr(cell, "data-coverage"), code: attr(cell, "data-code") },
          `${level.label}'s ${held.kind} cell states the stored lines exactly as the reading answered them (I-241)`,
        ).toEqual({ lines: String(held.lines), coverage: held.coverage, code: held.code ?? "" });
        if (held.coverage === PARTIAL_DECLARED) {
          expect(textOf(cell), "a partial roll-up prints no value at all — L-QTY-02's rule, applied to the cell").not.toContain(".");
        }
      }
    }
  });

  test("AC-1: ids render through IdChip and standings through EnumLabel", async () => {
    const view = await viewOf();
    const mounted = await mountLevels({ view });
    const rows = hooks(hook(mounted.root, TESTID.grid), TESTID.row);
    const registry = await productModule<{ ALL_TESTIDS: readonly string[] }>(TESTIDS_MODULE);
    const primitives = ["id-chip", "enum-label"].filter((id) => registry.ALL_TESTIDS.includes(id));
    expect(primitives, "the shipped primitives this screen renders ids and enums through are the registry's own").toContain("id-chip");

    for (const [at, level] of [...view.stack].sort((left, right) => left.ordinal - right.ordinal).entries()) {
      const row = rows[at] as HTMLElement;
      const chips = hooks(row, "id-chip").map((chip) => textOf(chip));
      expect(
        chips.some((chip) => chip.length > 0 && level.levelId.includes(chip.replace(/[^0-9a-f-]/giu, ""))),
        `${level.label}'s surrogate renders through IdChip, never woven into a sentence (R-UI-082): ${JSON.stringify(chips)}`,
      ).toBe(true);
      const said = [...row.querySelectorAll<HTMLElement>("[data-value]")].find(
        (element) => attr(element, "data-value") === level.standing,
      );
      expect(
        said,
        `${level.label}'s standing goes through the shipped EnumLabel, which publishes the model value it is saying (data-value="${level.standing}")`,
      ).toBeTruthy();
      expect(
        spokenText(said as HTMLElement),
        `and what it says OUT LOUD is a word, not the enum — the raw value stays machine-readable inside the technical disclosure (§3's voice)`,
      ).not.toContain(level.standing);
      expect(
        spokenText(said as HTMLElement).length,
        `${level.label}'s standing is spoken, never left as an empty cell`,
      ).toBeGreaterThan(0);
    }
  });

  test("AC-1: no inspector stands while nothing is selected, and selecting a row mounts exactly one", async () => {
    const view = await viewOf();
    const mounted = await mountLevels({ view });
    expect(hooks(mounted.container, TESTID.inspector), "the frame's one right column is ABSENT at rest, never an empty panel (R-UI-080)").toEqual([]);

    const level = [...view.stack].sort((left, right) => left.ordinal - right.ordinal)[0] as LevelShape;
    const row = hooks(hook(mounted.root, TESTID.grid), TESTID.row).find((candidate) => attr(candidate, "data-level") === level.levelId) as HTMLElement;
    fireEvent.click(row);

    const inspector = hook(mounted.container, TESTID.inspector);
    expect(attr(inspector, "data-level"), "the one inspector names the level the reader selected").toBe(level.levelId);

    const readings = hooks(inspector, TESTID.reading);
    expect(readings.length, `it lists one reading per reading made of ${level.label}, superseded ones included`).toBe(level.readings.length);
    for (const [at, reading] of level.readings.entries()) {
      const element = readings[at] as HTMLElement;
      expect(
        {
          basis: attr(element, "data-basis"),
          source: attr(element, "data-source"),
          metres: attr(element, "data-metres"),
          superseded: attr(element, "data-superseded"),
        },
        `reading ${at} of ${level.label} states what it was read on, off what, at what, and whether a later reading under its key superseded it`,
      ).toEqual({
        basis: reading.basis,
        source: reading.sourceKey ?? "",
        metres: reading.canonicalMetres,
        superseded: String(reading.superseded),
      });
      expect(textOf(element), "and prints the value as it was written, verbatim").toContain(reading.valueAsWritten);
    }
  });

  test("AC-1: the inspector carries the height form, whose basis roster is exactly the three read bases", async () => {
    const view = await viewOf();
    const mounted = await mountLevels({ view });
    const level = view.stack[0] as LevelShape;
    fireEvent.click(hooks(mounted.root, TESTID.row).find((row) => attr(row, "data-level") === level.levelId) as HTMLElement);
    const inspector = hook(mounted.container, TESTID.inspector);

    for (const id of [TESTID.heightValue, TESTID.heightUnit, TESTID.heightBasis, TESTID.heightSource, TESTID.authorHeight, TESTID.repudiate]) {
      expect(hooks(inspector, id).length, `${id} stands in the inspector — the form is in place and only the door previews (I-243)`).toBe(1);
    }

    const basis = hook(inspector, TESTID.heightBasis);
    expect(basis.tagName.toLowerCase(), "the roster is the shipped Select, never a native select (R-UI-083)").not.toBe("select");
    const offered = optionsOf(basis, mounted.container).map((option) => option.value);
    expect(offered, `exactly the three bases a height may be READ on: ${offered.join(", ")}`).toEqual([TRANSCRIBED, DERIVED, ENTERED]);
    expect(offered, `and never ${DEFAULTED}, which the act and the store both refuse (I-244)`).not.toContain(DEFAULTED);
  });

  test("AC-1: a stack with no live level teaches the insert, and the one primary stands exactly once", async () => {
    const full = await mountLevels({ view: await viewOf() });
    expect(hooks(full.container, TESTID.insert).length, "one INSERT_LEVEL door in the DOM at any time — the tabs-row aside holds it (I-246)").toBe(1);
    expect(hooks(full.container, TESTID.empty), "a stack with levels renders no empty state").toEqual([]);
    full.unmount();

    const copy = await levelsStrings();
    const empty = await mountLevels({ view: viewFixture({ stack: [] }) });
    expect(attr(empty.root, "data-state"), "no LIVE level is the empty state, not a bare grid").toBe("empty");
    const state = hook(empty.container, TESTID.empty);
    expect(textOf(state), "which teaches the next action in the screen's own words").toContain(copy["levels_empty_heading"]);
    expect(hooks(state, TESTID.insert).length, "and carries the ONE insert door as its one action (I-246)").toBe(1);
    expect(hooks(empty.container, TESTID.insert).length, "still exactly one in the DOM: the aside is empty while the stack is").toBe(1);
  });

  test("AC-1: the route declares all seven states, and the screen stands in each spelling", async () => {
    const states = await productModule<{
      STATE_NAMES: readonly string[];
      screenStates: Record<string, Record<string, unknown> | undefined>;
      missingStates: (routes: readonly string[]) => string[];
    }>(SCREEN_STATES_MODULE);
    expect(states.missingStates([LEVELS_ROUTE]), `${LEVELS_ROUTE} owes no state — a missing one is a failing test, never a review note (R-UI-050, B-19)`).toEqual([]);

    const view = await viewOf();
    for (const name of states.STATE_NAMES) {
      const spelling = SCREEN_STATE_OF[name];
      expect(spelling, `the screen spells the matrix state ${name} on data-state`).toBeTruthy();
      const mounted = await mountLevels({ view, state: spelling });
      expect(attr(mounted.root, "data-state"), `the screen stands in ${spelling}, the state its matrix entry declares as ${name}`).toBe(spelling);
      mounted.unmount();
    }
  });

  test("AC-1: every test id this screen carries is spelled in the one registry", async () => {
    const registry = await productModule<{ ALL_TESTIDS: readonly string[] }>(TESTIDS_MODULE);
    const owed = Object.values(TESTID);
    for (const id of owed) {
      expect(registry.ALL_TESTIDS, `${id} is spelled in ${TESTIDS_MODULE}, the only home of a test id (AM-09 §1)`).toContain(id);
    }
  });
});
