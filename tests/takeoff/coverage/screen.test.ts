// @vitest-environment jsdom
/**
 * AC-5 — the heat grid, its glyphs and its legend (X-3, R-TO-052, R-UI-050, R-UI-060,
 * docs/design/s-coverage.md §1–§3).
 *
 * The workspace is mounted over `coverageView()` with the SHIPPED chrome injected exactly as the
 * route injects it (Decision I-170), so what this suite reads is what the route renders. Every
 * expectation is derived from the cells the product's own `resolveResidue` answered and from the
 * registry the causes are declared in — no cause, remedy or cell list is transcribed twice (B-19).
 *
 * The rule under R-UI-060 is asserted as a rule: two causes may share a tint deliberately (I-188),
 * so what must never repeat is the MARK. The glyphs are compared to each other rather than to a
 * table of shapes, which is what makes "no meaning carried by colour alone" checkable rather than
 * aspirational.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  CAUSES,
  COVERAGE_ROUTE_KEY,
  COVERAGE_STATES_MODULE,
  QUANTITY_BEARING,
  SCREEN_STATES_MODULE,
  all,
  cellFor,
  cellHooks,
  cleanup,
  coverageView,
  levelIdOf,
  mountCoverage,
  one,
  productModule,
  refusalRegister,
  registered,
  text,
  type Cell,
  type CoverageViewLike,
} from "./support/coverage-stage";

afterEach(() => {
  cleanup();
});

/** One mount, shared by the criteria that only read it — the fixture is the same for all of them. */
let staging: Promise<CoverageViewLike> | undefined;
const view = (): Promise<CoverageViewLike> => (staging ??= coverageView());

/** The reading a cell wears on the axis a cause stands on. */
function wears(at: { measurement: string | null; bill: string | null }, cause: string): boolean {
  return at.measurement === cause || at.bill === cause;
}

/** The level a cell stands on, by the label a reader reads on the grid's header row. */
function labelOf(view_: CoverageViewLike, row: Cell): string | null {
  const levelId = levelIdOf(row);
  return view_.input.levels.find((level) => level.levelId === levelId)?.label ?? null;
}

describe("AC-5 — the six causes are registered, each with a message and a remedy", () => {
  test.each(CAUSES)("AC-5: %s is a registered cause with words a reader can act on", async (cause) => {
    const entry = await registered(cause);

    expect(entry.code, "the entry answers under its own code").toBe(cause);
    expect(entry.message.length, `${cause} states what is true of the cell, in words (I-191)`).toBeGreaterThan(0);
    expect(entry.remedy.length, `${cause} states what to do about it — every cause a remedy (X-3)`).toBeGreaterThan(0);
    expect(entry.message, "and the two are not the same sentence").not.toBe(entry.remedy);
  });
});

describe("AC-5 — the screen declares its states in one enumerable place (R-UI-050, B-19)", () => {
  test("AC-5: COVERAGE_STATES is declared beside the route and the matrix holds the route's key", async () => {
    const states = (await productModule<Record<string, unknown>>(COVERAGE_STATES_MODULE))["COVERAGE_STATES"];
    expect(Array.isArray(states), `${COVERAGE_STATES_MODULE} publishes \`COVERAGE_STATES\` — the one enumerable place this screen's states are declared`).toBe(true);
    expect((states as readonly string[]).length, "and it declares them").toBeGreaterThan(0);

    const matrix = (await productModule<Record<string, unknown>>(SCREEN_STATES_MODULE))["screenStates"] as Record<string, unknown>;
    expect(Object.keys(matrix), `the matrix the suite reflects over holds ${COVERAGE_ROUTE_KEY} — a screen outside it is a screen no state matrix grades`).toContain(COVERAGE_ROUTE_KEY);
  });

  test("AC-5: the mounted screen wears one of its own declared states", async () => {
    const states = (await productModule<Record<string, unknown>>(COVERAGE_STATES_MODULE))["COVERAGE_STATES"] as readonly string[];
    const root = await mountCoverage(await view());

    expect([...states], `coverage-screen[data-state] is one of the states the route declares — it reads ${String(root.getAttribute("data-state"))}`).toContain(root.getAttribute("data-state"));
  });
});

describe("AC-5 — the grid holds one cell per residue row, and every cell states its own reading", () => {
  test("AC-5: one `coverage-cell` per ResidueCell, each carrying the row's kind, class, level and both readings", async () => {
    const held = await view();
    const root = await mountCoverage(held);
    const grid = one(root, "coverage-grid");

    expect(all(grid, "coverage-cell").length, "one cell for every row the residue answered, and none invented").toBe(held.cells.length);

    for (const row of held.cells) {
      const at = cellHooks(cellFor(grid, row));
      const said = `${String(row["kind"])} on ${String(row["class"] ?? "every class")}`;
      expect(at.measurement, `${said}: the cell states the measurement axis — QUANTITY_BEARING or the cause`).toBe(row["measurement"]);
      expect(at.bill, `${said}: and the bill axis, which is orthogonal to it (L-QTY-05)`).toBe(row["bill"]);
      expect(at.contradicted, `${said}: and whether a declaration over it is contradicted, as a word and not only as a stroke (I-192)`).toBe(String(row["contradicted"]));
    }
  });

  test("AC-5: every cell carries a glyph for its cause, and no two causes share a mark", async () => {
    const held = await view();
    const root = await mountCoverage(held);
    const grid = one(root, "coverage-grid");
    const marks = new Map<string, string>();

    for (const row of held.cells) {
      const cell = cellFor(grid, row);
      const at = cellHooks(cell);
      const glyphs = all(cell, "coverage-cell-glyph");
      expect(glyphs.length, `${String(row["kind"])} on ${String(row["class"] ?? "every class")} carries a mark for its reading — meaning is never carried by colour alone (R-UI-060, I-189)`).toBeGreaterThan(0);

      for (const glyph of glyphs) {
        const cause = glyph.getAttribute("data-cause") ?? "";
        expect([...CAUSES, QUANTITY_BEARING], `a glyph names the reading it draws, and it is one of the closed set — it names ${cause}`).toContain(cause);
        const drawn = glyph.innerHTML.replace(/\s+/gu, " ").trim();
        expect(drawn.length, `${cause}: the mark is drawn geometry, not an empty group`).toBeGreaterThan(0);
        const before = marks.get(cause);
        if (before === undefined) marks.set(cause, drawn);
        else expect(drawn, `${cause} is drawn the same way wherever it stands — one mark per cause (Decision §1)`).toBe(before);
      }

      const measurement = glyphs.map((glyph) => glyph.getAttribute("data-cause"));
      expect(measurement, `and the cell's own measurement reading is among the marks it carries (${String(at.measurement)})`).toContain(at.measurement);
    }

    expect(new Set(marks.values()).size, "and no two readings are drawn alike: a shared tint is deliberate (I-188), a shared mark would hide a cause behind another").toBe(marks.size);
    expect(marks.size, "with more than one reading standing on this grid").toBeGreaterThan(1);
  });

  test("AC-5: a cell's accessible name says the kind, the class, the level and the cause in words, and never a code", async () => {
    const held = await view();
    const root = await mountCoverage(held);
    const grid = one(root, "coverage-grid");
    const register = await refusalRegister();

    for (const row of held.cells) {
      const cell = cellFor(grid, row);
      const at = cellHooks(cell);
      const label = cell.getAttribute("aria-label") ?? "";
      const said = `${String(row["kind"])} on ${String(row["class"] ?? "every class")}`;

      expect(label.length, `${said}: the cell has an accessible name`).toBeGreaterThan(0);
      expect(label, `${said}: which names the kind`).toContain(String(row["kind"]));
      if ((row["class"] ?? null) !== null) {
        expect(label, `${said}: and the class`).toContain(String(row["class"]));
        const level = labelOf(held, row);
        if (level !== null) expect(label, `${said}: and the level, by the label the reader reads`).toContain(level);
      }

      const cause = at.bill === "NOT_IN_THIS_BILL" ? at.bill : (at.measurement as string);
      if (CAUSES.includes(cause)) {
        expect(label, `${said}: and states the cause in the registry's own words (Decision §3, I-195)`).toContain(register[cause]?.message ?? cause);
      }
      for (const code of [...CAUSES, QUANTITY_BEARING]) {
        expect(label.includes(code), `${said}: and never spells a code — codes are machine-readable only (refusal-state §7, I-195)`).toBe(false);
      }
    }
  });
});

describe("AC-5 — the legend names every cause, with the remedy the registry holds", () => {
  test("AC-5: one entry per cause of the closed set, each carrying its code and its registered remedy", async () => {
    const root = await mountCoverage(await view());
    const legend = one(root, "coverage-legend");
    const entries = all(legend, "coverage-legend-entry");
    const register = await refusalRegister();

    expect(entries.map((entry) => entry.getAttribute("data-cause")).sort(), "the legend enumerates exactly the closed cause set — no more, and none left out").toEqual([...CAUSES].sort());

    for (const entry of entries) {
      const cause = entry.getAttribute("data-cause") as string;
      expect(text(entry), `${cause}: the legend states its remedy, taken from REFUSALS and never paraphrased — which is what makes a colour readable in words (X-3, R-UI-060)`).toContain(register[cause]?.remedy ?? cause);
      expect(all(entry, "coverage-cell-glyph").length + entry.querySelectorAll("svg,path,circle,g").length, `${cause}: and shows the mark it stands for, so the legend reads the grid`).toBeGreaterThan(0);
    }
  });

  test.each(CAUSES)("AC-5: %s stands somewhere a reader can meet it — on the grid, or in the legend that explains it", async (cause) => {
    const held = await view();
    const root = await mountCoverage(held);
    const entry = all(one(root, "coverage-legend"), "coverage-legend-entry").filter((node) => node.getAttribute("data-cause") === cause);

    expect(entry.length, `${cause} is one of the six the legend names`).toBe(1);

    const wearing = all(one(root, "coverage-grid"), "coverage-cell").filter((cell) => wears(cellHooks(cell), cause));
    const standing = held.cells.filter((row) => row["measurement"] === cause || row["bill"] === cause);
    expect(wearing.length, `and every residue row reading ${cause} is a cell on the grid reading ${cause}`).toBe(standing.length);
  });
});
