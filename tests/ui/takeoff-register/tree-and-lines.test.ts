// @vitest-environment jsdom
/**
 * AC-2 — the tree, the inspector and the lines table of the register workspace
 * (R-TO-050, S-Takeoff, docs/design/s-takeoff.md §1).
 *
 * The workspace is mounted over `registerFixture()` with the SHIPPED chrome injected exactly as
 * `register-screen.tsx` injects it (Decision I-170), so what this suite reads is what the route
 * renders. Every expectation is derived from the fixture and from the product's own string table —
 * no column order, label or figure is transcribed twice (B-19).
 */
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import {
  DISCIPLINE,
  LEVEL_GF,
  CLASS_COLUMN,
  REGISTER_MARKS,
  all,
  cellsOf,
  copy,
  kinds,
  lineHeaders,
  lineRows,
  mountRegister,
  offerRosters,
  one,
  registerFixture,
  sightingStandings,
  takeoffStrings,
  text,
  treeItem,
  treeItems,
  type RegisterViewLike,
  type ViewLine,
} from "./support/fixtures";

afterEach(() => {
  cleanup();
});

/** The columns of the lines table, in the order the Decision fixes, by their copy keys. */
const COLUMN_KEYS: readonly string[] = [
  "takeoff_register_col_kind",
  "takeoff_register_col_value",
  "takeoff_register_col_unit",
  "takeoff_register_col_formula",
  "takeoff_register_col_variables",
  "takeoff_register_col_bases",
  "takeoff_register_col_coverage",
  "takeoff_register_col_calibration",
  "takeoff_register_col_engine",
  "takeoff_register_col_source",
];

/** The sentences a ready register states, each one a line of the screen's own table (Decision §3). */
const READY_COPY_KEYS: readonly string[] = [
  "takeoff_register_heading",
  "takeoff_register_caption",
  "takeoff_register_campaign_label",
  "takeoff_register_measure",
  "takeoff_register_measure_hint",
  "takeoff_register_tree_label",
  "takeoff_register_basis_label",
  "takeoff_register_role_label",
  "takeoff_register_corroboration_label",
  "takeoff_register_source_label",
  "takeoff_register_attributes_label",
];

/**
 * The screen's copy, loaded once and by the test that reads it: a suite-wide hook that failed would
 * SKIP the criteria beneath it, and a skipped criterion states nothing about the product.
 */
let loading: Promise<Record<string, string>> | undefined;
const strings = (): Promise<Record<string, string>> => (loading ??= takeoffStrings());

/**
 * The corpus every criterion below is judged over: the three columns of the fixture SPREAD over the
 * rosters the product itself declares — the bases, engines and coverages of `src/core/offers/law.ts`,
 * the sighting standings of `src/core/identity/law.ts`, the kinds of the catalogue — read off the
 * tree at the moment the suite runs rather than transcribed here (B-19). No row is another row's
 * copy, so what a cell states is a fact about the line it stands on and not a constant the screen
 * could hold; a roster that grows spreads the corpus further with no edit to this file.
 */
let staging: Promise<RegisterViewLike> | undefined;
const corpus = (): Promise<RegisterViewLike> =>
  (staging ??= (async (): Promise<RegisterViewLike> => {
    const [rosters, roles, kindRoster] = await Promise.all([offerRosters(), sightingStandings(), kinds()]);
    return registerFixture({ bases: rosters.bases, engines: rosters.engines, coverages: rosters.coverages, roles, kinds: kindRoster });
  })());

/**
 * How far a corpus of `held` rows can spread over a roster of `roster` members: all of them, up to
 * whichever of the two is smaller. Asked of each column a row renders, so a fixture that quietly went
 * uniform — and a criterion that stopped discriminating with it — fails here rather than passing.
 */
function spreadsOver(held: readonly string[], roster: readonly string[], column: string): void {
  for (const value of held) expect(roster, `every ${column} the corpus states is drawn from the roster the product declares it from`).toContain(value);
  expect(new Set(held).size, `the corpus states as many distinct ${column} values as the roster and the corpus can hold — a cell that spelled a constant would read alike for all of them`).toBe(
    Math.min(roster.length, held.length),
  );
}

/** The cell of one row under a named column — the position the header order gives it. */
function cellUnder(row: HTMLElement, key: string): string {
  const at = COLUMN_KEYS.indexOf(key);
  const cells = cellsOf(row);
  expect(cells.length, `a line's row carries one cell per declared column: ${JSON.stringify(cells)}`).toBe(COLUMN_KEYS.length);
  return cells[at] as string;
}

/** The row of one line, found by the line's own id through the table's row id (`getRowId`). */
function rowOf(root: HTMLElement, line: ViewLine): HTMLElement {
  const rows = lineRows(root);
  const found = rows.filter((row) => text(row).includes(line.formula) && text(row).includes(line.sourceKey));
  expect(found.length, `exactly one row states the line ${line.lineId} (its formula and its source key)`).toBe(1);
  return found[0] as HTMLElement;
}

describe("AC-2 — discipline → level → class → object, and the lines beneath", () => {
  test("AC-2: the tree nests discipline → level → class → object, labelled verbatim", async () => {
    const view: RegisterViewLike = await corpus();
    const root = await mountRegister(view);

    const tree = one(root, "register-tree");
    expect(tree.querySelector('[role="tree"]'), "`register-tree` names the shipped Tree's own root, one element deeper (I-171)").not.toBeNull();

    const discipline = treeItem(root, DISCIPLINE);
    const level = treeItem(root, LEVEL_GF);
    const cls = treeItem(root, CLASS_COLUMN);
    expect(discipline.contains(level), `the level \`${LEVEL_GF}\` is nested under the discipline \`${DISCIPLINE}\``).toBe(true);
    expect(level.contains(cls), `the class \`${CLASS_COLUMN}\` is nested under the level \`${LEVEL_GF}\``).toBe(true);

    for (const mark of REGISTER_MARKS) {
      const object = treeItem(root, mark);
      expect(cls.contains(object), `the object \`${mark}\` is nested under its class`).toBe(true);
    }
    expect(treeItems(root).length, "the tree holds one item per discipline, level, class and object of the view").toBe(1 + 1 + 1 + view.objects.length);
  });

  test("AC-2: selecting an object fills the inspector with its basis, role, corroboration and source", async () => {
    const view = await corpus();
    const rosters = await offerRosters();
    const root = await mountRegister(view);
    const user = userEvent.setup();

    // Every object of the corpus, not the first alone: the three stand at different bases and
    // different roles, so an inspector that spelled one object's standing states another's wrongly.
    spreadsOver(
      view.objects.map((object) => object.basis),
      rosters.bases,
      "object basis",
    );
    spreadsOver(
      view.objects.map((object) => object.role),
      await sightingStandings(),
      "object role",
    );

    for (const object of view.objects) {
      await user.click(treeItem(root, object.mark));

      const inspector = one(root, "register-inspector");
      expect(text(one(root, "register-object-key")), "the inspector states the object key whole (I-26)").toBe(object.objectKey);
      expect(one(root, "register-object-basis").getAttribute("data-basis"), `the basis of ${object.mark} is the weakest basis over its lines`).toBe(object.basis);
      expect(one(root, "register-object-role").getAttribute("data-role"), `the role of ${object.mark} is its sighting standing`).toBe(object.role);
      expect(one(root, "register-object-corroboration").getAttribute("data-standing"), "the object's corroboration state stands beside it").toBe(object.corroboration);
      expect(text(one(root, "register-source-key")), "the cited source key renders as text — the Trace is inc-215's").toBe(object.sourceKey);
      expect(inspector.contains(one(root, "register-object-key")), "and all of it stands in the inspector").toBe(true);
    }
  });

  test("AC-2: the lines table states every column the Decision fixes, in its order", async () => {
    const view = await corpus();
    const root = await mountRegister(view);

    const lines = one(root, "register-lines");
    expect(lines.querySelector('[role="grid"]'), "`register-lines` names the shipped DataTable's own root, one element deeper (I-171); v2 is an aria GRID, because its cells take a cursor (§5 rule 6)").not.toBeNull();
    expect(lineHeaders(root), "the columns are the Decision's, in its order, named by the screen's own table").toEqual(await Promise.all(COLUMN_KEYS.map(async (key) => copy(await strings(), key))));
    expect(lineRows(root).length, "one row per line the view answers").toBe(view.lines.length);
  });

  test("AC-2: a line's cells state its SI value, formula, variables, bases, coverage, calibration and engine", async () => {
    const view = await corpus();
    const rosters = await offerRosters();
    const root = await mountRegister(view);

    // The corpus each cell below is read against varies in every column it renders, so a cell that
    // held a constant states the wrong words for at least one row rather than passing on a corpus
    // that happens to be uniform (B-19).
    spreadsOver(
      view.lines.map((line) => line.quantityBasis),
      rosters.bases,
      "quantity basis",
    );
    spreadsOver(
      view.lines.map((line) => line.selectionBasis),
      rosters.bases,
      "selection basis",
    );
    spreadsOver(
      view.lines.map((line) => line.coverage),
      rosters.coverages,
      "coverage",
    );
    spreadsOver(
      view.lines.map((line) => line.engine),
      rosters.engines,
      "engine",
    );
    spreadsOver(
      view.lines.map((line) => line.kind),
      await kinds(),
      "kind",
    );
    expect(
      new Set(view.lines.map((line) => Object.entries(line.variables).map(([name, binding]) => `${name}=${binding.value} ${binding.unit}`).join(" "))).size,
      "and each of the three columns was read at its own dimensions, one of them in millimetres — so no two variables cells read alike",
    ).toBe(view.lines.length);

    for (const line of view.lines) {
      const row = rowOf(root, line);
      expect(cellUnder(row, "takeoff_register_col_kind"), `the line's kind stands verbatim`).toContain(line.kind);
      expect(
        cellUnder(row, "takeoff_register_col_value"),
        `the SI value stands verbatim, never re-rounded (I-25); a line kept with no quantity states none — never a zero, never the word null (L-QTY-02)`,
      ).toBe(line.value ?? "");
      expect(cellUnder(row, "takeoff_register_col_unit"), `the unit stands beside it`).toContain(line.unit);
      expect(cellUnder(row, "takeoff_register_col_formula"), `the formula stands verbatim`).toBe(line.formula);

      const variables = cellUnder(row, "takeoff_register_col_variables");
      for (const [name, binding] of Object.entries(line.variables)) {
        expect(variables, `the variable \`${name}\` reads as \`name=value unit\` from the line's bindings`).toContain(`${name}=${binding.value} ${binding.unit}`);
      }

      expect(cellUnder(row, "takeoff_register_col_bases"), "the two bases read `quantityBasis/selectionBasis`").toContain(`${line.quantityBasis}/${line.selectionBasis}`);
      expect(cellUnder(row, "takeoff_register_col_coverage"), "the coverage states its own word").toContain(line.coverage);
      for (const key of line.calibrationKeys) expect(cellUnder(row, "takeoff_register_col_calibration"), "every calibration key is stated, whole").toContain(key);
      expect(cellUnder(row, "takeoff_register_col_engine"), "the engine states its own word").toContain(line.engine);
      expect(cellUnder(row, "takeoff_register_col_source"), "the cited source key renders as text").toContain(line.sourceKey);
    }
  });

  test("AC-2: every sentence a ready register states is a line of the screen's own string table", async () => {
    const view = await corpus();
    const root = await mountRegister(view);
    const said = text(root);

    for (const key of READY_COPY_KEYS) {
      expect(said, `the screen states \`${key}\` from src/ui/strings/takeoff.ts rather than a sentence written beside it (B-17)`).toContain(copy(await strings(), key));
    }
    expect(all(root, "register-lines-count").length, "and the count line is mounted from first paint (Decision §1)").toBe(1);
  });
});
