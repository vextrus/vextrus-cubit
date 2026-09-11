// @vitest-environment jsdom
/**
 * AC-6 — the heat grid, the legend and the certificate preview, mounted over the residue fixture
 * (R-TO-052, X-3, R-UI-050, R-UI-060, L-QTY-07, docs/design/s-coverage.md §1).
 *
 * What is judged is what a reader meets: one cell per cell of the residue, each carrying its two
 * axes and the code it is read under, each marked by a glyph and NAMED IN WORDS — colour never
 * alone; a legend of every code the law admits; and the two boundary statements as they will print,
 * in their own order, with no count anywhere in them.
 *
 * Nothing here freezes a roster. The cells, the rows, the kinds and the codes are all derived from
 * the residue under test and from the law's own vocabulary, so a residue bearing another cell and a
 * law admitting another cause grow the expectation with them (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  COVERAGE_ROUTE,
  IN_BILL,
  KIND,
  NONE,
  QUANTITY_BEARING,
  SCREEN_STATE_OF,
  SCREEN_STATES_MODULE,
  TESTID,
  attr,
  cleanup,
  codeUnderAxis,
  compareCanonical,
  coverageViewFixture,
  hook,
  hooks,
  mountCoverage,
  productModule,
  refusalRegister,
  residueSeam,
  textOf,
  type CoverageViewShape,
  type RefusalEntryShape,
  type ResidueCellShape,
  type StatementRowShape,
} from "./support/coverage-stage";

/** The seam under `residue.ts` opens a pool at import time; the address is stated, never dialled. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

let view!: CoverageViewShape;
let registry!: Readonly<Record<string, RefusalEntryShape | undefined>>;
let canonical!: (a: string, b: string) => number;

/** Every code the law admits, in the order the hook registry declares the legend in. */
let codes!: string[];

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let loading: Promise<void> | undefined;
const ready = (): Promise<void> =>
  (loading ??= (async () => {
    view = await coverageViewFixture();
    registry = await refusalRegister();
    canonical = await compareCanonical();
    const residue = await residueSeam();
    codes = [QUANTITY_BEARING, ...residue.MEASUREMENT_CAUSES, ...residue.BILL_CAUSES];
  })());

afterEach(() => {
  cleanup();
});

/** How a cell's address is spelled on the element that renders it ("" for a null part). */
const addressOf = (cell: { kind: string; class: string | null; levelId: string | null }): string => `${cell.kind}|${cell.class ?? ""}|${cell.levelId ?? ""}`;

/** The registry's words for a code, where the registry holds it — the idle readings are no refusal. */
const wordsFor = (code: string): RefusalEntryShape | undefined => registry[code];

describe("AC-6: the grid states every cell of the residue, twice over — a mark and words", () => {
  test("AC-6: one gridcell per ResidueCell, carrying both axes and the code it is read under", async () => {
    await ready();
    const mounted = await mountCoverage({ view });
    const grid = hook(mounted.root, TESTID.grid);
    expect(attr(grid, "role"), "the grid is a grid to a reader who cannot see it (R-UI-032)").toBe("grid");

    const rendered = hooks(mounted.root, TESTID.cell);
    expect(rendered.length, `one cell is drawn per cell the residue holds: ${view.cells.length}`).toBe(view.cells.length);

    const byAddress = new Map<string, HTMLElement[]>();
    for (const element of rendered) {
      const key = `${attr(element, "data-kind")}|${attr(element, "data-class")}|${attr(element, "data-level")}`;
      byAddress.set(key, [...(byAddress.get(key) ?? []), element]);
    }

    for (const cell of view.cells) {
      const found = byAddress.get(addressOf(cell)) ?? [];
      expect(found.length, `the grid draws exactly one cell for ${addressOf(cell)} — a KIND-grain row states its class and level as ""`).toBe(1);
      const element = found[0] as HTMLElement;
      const code = codeUnderAxis(cell);
      expect(
        {
          role: attr(element, "role"),
          grain: attr(element, "data-grain"),
          measurement: attr(element, "data-measurement"),
          bill: attr(element, "data-bill"),
          contradicted: attr(element, "data-contradicted"),
          code: attr(element, "data-code"),
        },
        `the cell at ${addressOf(cell)} states both axes and the code the axis rule reads it under`,
      ).toEqual({
        role: "gridcell",
        grain: cell.grain,
        measurement: cell.measurement,
        bill: cell.bill,
        contradicted: String(cell.contradicted),
        code,
      });

      const glyph = hook(element, TESTID.glyph);
      expect(attr(glyph, "data-code"), `and the cell's mark is the mark of that code — the cause is the glyph (I-188/I-189)`).toBe(code);

      const label = attr(element, "aria-label");
      expect(label.length, `every cell is named in words: colour and shape alone say nothing to a reader who cannot see them (R-UI-060)`).toBeGreaterThan(0);
      expect(label, `and a code is machine-readable only — the name says the cause in words, never the code: "${label}"`).not.toContain(code);
      const words = wordsFor(code);
      if (words !== undefined) {
        expect(label, `taking the registry's own message for ${code}, never a paraphrase (R-SPINE-062): "${label}"`).toContain(words.message);
      }
    }
  }, 120_000);

  test("AC-6: one row per kind, the kind-grain rows first, then the borne kinds in canonical order", async () => {
    await ready();
    const mounted = await mountCoverage({ view });
    const kindsOf = (cells: readonly ResidueCellShape[]): string[] => [...new Set(cells.map((cell) => cell.kind))].sort(canonical);
    const expected = [...kindsOf(view.cells.filter((cell) => cell.grain === KIND)), ...kindsOf(view.cells.filter((cell) => cell.grain !== KIND))];
    expect(
      hooks(mounted.root, TESTID.kindRow).map((row) => attr(row, "data-kind")),
      "a kind that bears no cell stands at the head of the grid, shown and never hidden (R-UI-050, I-196); the rest follow in canonical order",
    ).toEqual(expected);
  }, 120_000);

  test("AC-6: the legend names every code the law admits, with its mark and the registry's words", async () => {
    await ready();
    const mounted = await mountCoverage({ view });
    const legend = hook(mounted.root, TESTID.legend);
    const entries = hooks(legend, TESTID.legendEntry);
    expect(
      entries.map((entry) => attr(entry, "data-code")),
      "the legend is the whole vocabulary — one measured reading and every cause, in the law's own order",
    ).toEqual(codes);

    for (const entry of entries) {
      const code = attr(entry, "data-code");
      expect(attr(hook(entry, TESTID.glyph), "data-code"), `the legend entry for ${code} carries the very mark the grid draws for it`).toBe(code);
      const words = wordsFor(code);
      if (words !== undefined) {
        expect(textOf(entry), `and states the registry's message for ${code} verbatim (I-195)`).toContain(words.message);
      }
    }
  }, 120_000);
});

describe("AC-6: the certificate preview prints the two statements, and never a count", () => {
  test("AC-6: measurement first, then bill, each an enumeration of its own rows", async () => {
    await ready();
    const mounted = await mountCoverage({ view });
    const preview = hook(mounted.root, TESTID.certificate);
    const statements = hooks(preview, TESTID.statement);
    expect(
      statements.map((statement) => attr(statement, "data-axis")),
      "two separately titled statements, measurement boundary first and in full, then bill — never a shared cause column (L-QTY-07)",
    ).toEqual(["MEASUREMENT", "BILL"]);

    const owed: Readonly<Record<string, StatementRowShape[]>> = { MEASUREMENT: view.measurement, BILL: view.bill };
    for (const statement of statements) {
      const axis = attr(statement, "data-axis");
      const rows = owed[axis] ?? [];
      const rendered = hooks(statement, TESTID.statementRow);
      expect(rendered.length, `the ${axis} statement prints one row per row the core computed`).toBe(rows.length);

      if (rows.length === 0) {
        const none = hook(statement, TESTID.statementNone);
        expect(attr(none, "data-code"), `an empty statement says so in its own sentence, under ${NONE}`).toBe(NONE);
      } else {
        expect(hooks(statement, TESTID.statementNone), `a statement with rows prints no ${NONE}`).toEqual([]);
      }

      for (const [at, row] of rows.entries()) {
        const element = rendered[at] as HTMLElement;
        expect(
          {
            kind: attr(element, "data-kind"),
            class: attr(element, "data-class"),
            level: attr(element, "data-level"),
            levels: attr(element, "data-levels"),
            code: attr(element, "data-code"),
          },
          `row ${at} of the ${axis} statement is the row the core computed, in the order it computed it`,
        ).toEqual({
          kind: row.kind,
          class: row.class ?? "",
          level: row.levelId ?? "",
          levels: row.levels,
          code: row.cause,
        });
        const words = wordsFor(row.cause);
        if (words !== undefined) {
          expect(textOf(element), `and prints the registry's message as prose — a certificate states the reason in words: ${row.cause}`).toContain(words.message);
        }
      }
    }
  }, 120_000);

  test("AC-6: no count, fraction or percentage stands anywhere in the preview", async () => {
    await ready();
    const mounted = await mountCoverage({ view });
    const preview = hook(mounted.root, TESTID.certificate);
    const printed = textOf(preview);
    expect(printed, "a certificate enumerates; it never scores (L-QTY-07)").not.toContain("%");

    const model = new Set<string>();
    for (const row of [...view.measurement, ...view.bill]) {
      model.add(row.kind);
      if (row.class !== null) model.add(row.class);
      model.add(row.levelLabel);
      model.add(row.levels);
    }
    const numeric = printed.split(/\s+/u).filter((token) => /\d/u.test(token));
    for (const token of numeric) {
      expect(
        [...model].some((value) => value !== "" && (value.includes(token) || token.includes(value))),
        `"${token}" is printed in the preview and is part of no model value the statements carry — a figure on this screen is a count, and this section prints none`,
      ).toBe(true);
    }
  }, 120_000);
});

describe("AC-6: the screen renders every state its matrix entry declares", () => {
  test("AC-6: coverage-screen[data-state] carries each declared state", async () => {
    await ready();
    const states = await productModule<{ STATE_NAMES: readonly string[]; screenStates: Record<string, Record<string, unknown> | undefined> }>(SCREEN_STATES_MODULE);
    const declaration = states.screenStates[COVERAGE_ROUTE];
    expect(declaration, `${COVERAGE_ROUTE} declares its states in the one enumerable place the suite reflects over (R-UI-050, B-19)`).toBeTruthy();

    const declared = states.STATE_NAMES.filter((name) => (declaration ?? {})[name] !== undefined);
    expect(declared, "and it declares all seven — a missing state is a failing test, never a review note").toEqual([...states.STATE_NAMES]);

    for (const name of declared) {
      const spelling = SCREEN_STATE_OF[name];
      expect(spelling, `the hook registry spells ${name} on data-state`).toBeTruthy();
      const mounted = await mountCoverage({ view, state: spelling });
      expect(attr(mounted.root, "data-state"), `the screen stands in ${spelling}, the state its matrix entry declares as ${name}`).toBe(spelling);
      mounted.unmount();
    }
  }, 120_000);
});

describe("AC-6: the axis rule is what a cell is read under", () => {
  test("AC-6: a cell held out of this bill reads its bill cause, and one in the bill reads its measurement", async () => {
    await ready();
    const mounted = await mountCoverage({ view });
    const held = view.cells.filter((cell) => cell.bill !== IN_BILL);
    const inBill = view.cells.filter((cell) => cell.bill === IN_BILL);
    expect(held.length, "the fixture holds a cell out of this bill, so the bill arm of the axis rule is exercised").toBeGreaterThan(0);
    expect(inBill.length, "and holds cells in it, so the measurement arm is exercised too").toBeGreaterThan(0);

    const codeAt = (cell: ResidueCellShape): string => {
      const element = hooks(mounted.root, TESTID.cell).find(
        (candidate) => `${attr(candidate, "data-kind")}|${attr(candidate, "data-class")}|${attr(candidate, "data-level")}` === addressOf(cell),
      );
      expect(element, `the grid draws ${addressOf(cell)}`).toBeTruthy();
      return attr(element as HTMLElement, "data-code");
    };

    for (const cell of held) expect(codeAt(cell), `a cell whose bill axis has moved is read under the bill: ${addressOf(cell)}`).toBe(cell.bill);
    for (const cell of inBill) expect(codeAt(cell), `and a cell in the bill is read under its measurement: ${addressOf(cell)}`).toBe(cell.measurement);
  }, 120_000);
});
