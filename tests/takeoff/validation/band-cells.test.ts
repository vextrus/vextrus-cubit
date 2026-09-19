// @vitest-environment node
/**
 * AC-1, AC-2 — the cells the band lane grades, read off the two fixtures' own goldens (R-TO-035,
 * L-QTY-06, AM-01).
 *
 * What a band suite may grade is decided before any database is opened: the (class, kind) cells the
 * fixture's golden bears, each level's figure being the EXACT sum of the components (NET, LAP, EDGE)
 * the golden records for it — "ground truth is row sums, never printed grand totals" (L-QTY-06). This
 * suite drives `goldenCellsOf` over both fixtures and grades it against the very rows it is derived
 * from, spelled through the ONE map the tree already holds (`GOLDEN_CLASS`/`GOLDEN_KIND`): nothing is
 * frozen here, so a fixture that grows a class, a kind or a storey grows this expectation with it.
 *
 * The live band runs themselves — staging, measuring, grading and recording — are the band suites
 * AC-1 and AC-2 name (`tests/golden/band/*.band.test.ts`), which run in V-GOLDEN; what stands here is
 * the reading they are all driven off, and the engine every observation of this increment is keyed to.
 *
 * It sits beside the validation module's own acceptance rather than under `tests/golden/`: the golden
 * lane's config is the home of the suites V-GOLDEN's 180 s ceiling is spent on (AM-10 §1), and this
 * reading needs no fixture drawing, no database and no place in that budget — the unit lane collects it.
 */
import { describe, expect, test } from "vitest";
import { goldenRows, type GoldenRow } from "../../golden/support/golden-fixture";
import { BNBC, RCC6, VECTOR, bandStage, canon, cellKey, goldenSpellings, productModule, sumExact, type CellLevel, type Canon, type GoldenSpellings } from "./support/band-acceptance";

/** The cell AC-2 fixes F-RCC6's band on, and the two figures its golden prints for it. */
const COLUMN_CONCRETE = cellKey("column", "rcc.concrete");
const STOREY_CONCRETE = "16.740";
const ROOF_CONCRETE = "2.304";
const ROOF = "ROOF";

/**
 * The cells a fixture's golden bears, derived here from its rows: grouped by (class, kind, level),
 * components summed exactly per level, and spelled into the product's own words through the map the
 * band lane is required to read them through. A golden word the map does not carry is a row no cell
 * can be graded from, so it is not a cell (`WALL` is no element class of this product's roster).
 */
function cellsFromGolden(rows: readonly GoldenRow[], spellings: GoldenSpellings, exact: Canon["exact"]): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    const elementClass = spellings.GOLDEN_CLASS[row.class];
    const kind = spellings.GOLDEN_KIND[row.kind];
    if (elementClass === undefined || kind === undefined) continue;
    const key = cellKey(elementClass, kind);
    const levels = found.get(key) ?? new Map<string, string[]>();
    levels.set(row.level, [...(levels.get(row.level) ?? []), row.quantity]);
    found.set(key, levels);
  }
  const summed = new Map<string, Map<string, string>>();
  for (const [key, levels] of found) {
    const perLevel = new Map<string, string>();
    for (const [level, quantities] of levels) perLevel.set(level, sumExact(quantities, exact));
    summed.set(key, perLevel);
  }
  return summed;
}

/** What `goldenCellsOf` answered, as a map of the same shape — so the two are compared like for like. */
function asLevelMap(levels: readonly CellLevel[]): Map<string, string> {
  const held = new Map<string, string>();
  for (const level of levels) held.set(level.level, level.golden);
  return held;
}

/** Both readings of one fixture: what the band lane answers, and what its golden's rows say. */
async function bothReadings(fixtureId: string): Promise<{ answered: Map<string, readonly CellLevel[]>; expected: Map<string, Map<string, string>>; exact: Canon["exact"] }> {
  const [stage, spellings, { exact }] = await Promise.all([bandStage(), goldenSpellings(), canon()]);
  const answered = stage.goldenCellsOf(fixtureId);
  expect(answered instanceof Map, `goldenCellsOf(${JSON.stringify(fixtureId)}) answers a Map keyed 'class|kind' (interfaces)`).toBe(true);
  return { answered, expected: cellsFromGolden(goldenRows(fixtureId), spellings, exact), exact };
}

/** Every cell of a fixture, graded level by level against the rows it was summed from. */
function gradeReading(answered: Map<string, readonly CellLevel[]>, expected: Map<string, Map<string, string>>, exact: Canon["exact"], fixtureId: string): void {
  expect([...answered.keys()].sort(), `the cells of ${fixtureId} are exactly the (class, kind) pairs its golden bears in words the product's rosters carry — no cell invented, none dropped (L-QTY-06)`).toEqual(
    [...expected.keys()].sort(),
  );
  for (const [key, levels] of expected) {
    const held = asLevelMap(answered.get(key) ?? []);
    expect([...held.keys()].sort(), `${fixtureId} ${key} is read at every level its golden prints a figure for, and no other`).toEqual([...levels.keys()].sort());
    for (const [level, figure] of levels) {
      const answer = held.get(level) ?? "";
      expect(
        exact(answer).eq(figure),
        `${fixtureId} ${key} at ${level} is the EXACT sum of the golden's own component rows (${figure}); the lane read ${JSON.stringify(answer)} — ground truth is row sums, never a printed total (L-QTY-06)`,
      ).toBe(true);
    }
  }
}

describe("AC-1: the cells of F-RCC6-BNBC, as the band lane reads its golden", () => {
  test("AC-1: every (class, kind) cell of the BNBC golden is read, with each level the exact sum of its components", async () => {
    const { answered, expected, exact } = await bothReadings(BNBC);
    expect(expected.size, `${BNBC}'s golden bears cells the product's rosters can be graded against (AM-01)`).toBeGreaterThan(0);
    gradeReading(answered, expected, exact, BNBC);
  }, 120_000);

  test("AC-1: the band's engine is the VECTOR engine of the offers law, and no other", async () => {
    const [stage, law] = await Promise.all([bandStage(), productModule<{ ENGINES?: readonly string[] }>("src/core/offers/law.ts")]);
    expect(stage.BAND_ENGINE, "`BAND_ENGINE` is VECTOR — this increment validates what read the drawing as a vector, and the RASTER engine's validation is M4's (scope)").toBe(VECTOR);
    expect([...(law.ENGINES ?? [])], "and it is drawn from the closed roster of engines, never a second spelling (L-QTY-03, B-19)").toContain(stage.BAND_ENGINE);
  }, 120_000);
});

describe("AC-2: the cells of F-RCC6, frozen at v1.1, as the band lane reads its golden", () => {
  test("AC-2: every (class, kind) cell of F-RCC6's golden is read, with each level the exact sum of its components", async () => {
    const { answered, expected, exact } = await bothReadings(RCC6);
    expect(expected.size, "F-RCC6's golden bears the cells AC-2 grades — the regression fixture is byte-frozen at v1.1 (AM-01)").toBeGreaterThan(0);
    gradeReading(answered, expected, exact, RCC6);
  }, 120_000);

  test("AC-2: COLUMN × rcc.concrete carries the figures AC-2 fixes the band on, at every storey the fixture stacks", async () => {
    const { answered, exact } = await bothReadings(RCC6);
    const levels = asLevelMap(answered.get(COLUMN_CONCRETE) ?? []);
    expect(levels.size, `F-RCC6's ${COLUMN_CONCRETE} cell is read at the levels its golden prints (AC-2)`).toBeGreaterThan(0);
    const storeys = [...levels.keys()].filter((level) => level !== ROOF).sort();
    expect(storeys.length, "the fixture stacks the storeys the column band is graded at, ROOF apart (AM-01)").toBeGreaterThan(0);
    for (const level of storeys) {
      expect(
        exact(levels.get(level) ?? "").eq(STOREY_CONCRETE),
        `F-RCC6 prints ${STOREY_CONCRETE} m³ of column concrete at ${level} — the figure AC-2's band is fixed on (it read ${JSON.stringify(levels.get(level))})`,
      ).toBe(true);
    }
    expect(
      exact(levels.get(ROOF) ?? "").eq(ROOF_CONCRETE),
      `and ${ROOF_CONCRETE} m³ at ${ROOF} — the short columns of the roof storey (AC-2); it read ${JSON.stringify(levels.get(ROOF))}`,
    ).toBe(true);
  }, 120_000);
});
