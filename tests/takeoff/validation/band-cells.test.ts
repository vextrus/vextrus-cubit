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
 * Beside the reading stands the LANE: "`pnpm test:golden` collects tests/golden/band/<fixture>.band.test.ts
 * and exits 0" is a claim about what the golden lane collects, and a lane that collects three older
 * suites and no band suite exits 0 too. So that question is put to the runner itself — `vitest list`
 * against the golden lane's own config, the way tests/toolchain/test-lane-split.test.ts asks it — and the
 * fixtures it is owed a suite for are derived from the tree: every fixture carrying a `takeoff.golden.json`
 * is a fixture the band lane grades. The live runs themselves are graded in band-arms.live.test.ts.
 *
 * It sits beside the validation module's own acceptance rather than under `tests/golden/`: the golden
 * lane's config is the home of the suites V-GOLDEN's 180 s ceiling is spent on (AM-10 §1), and this
 * reading needs no fixture drawing, no database and no place in that budget — the unit lane collects it.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import * as ts from "typescript";
import { describe, expect, test } from "vitest";
import { goldenRows, type GoldenRow } from "../../golden/support/golden-fixture";
import { BNBC, RCC6, VECTOR, bandStage, canon, cellKey, goldenSpellings, productModule, sumExact, type CellLevel, type Canon, type GoldenSpellings } from "./support/band-acceptance";

/** The cell AC-2 fixes F-RCC6's band on, and the two figures its golden prints for it. */
const COLUMN_CONCRETE = cellKey("column", "rcc.concrete");
const STOREY_CONCRETE = "16.740";
const ROOF_CONCRETE = "2.304";
const ROOF = "ROOF";

/** tests/takeoff/validation/ → the checkout. */
const ROOT = resolve(join(import.meta.dirname, "..", "..", ".."));

/** The lane whose collection AC-1 and AC-2 name, and the directory its band suites stand in. */
const GOLDEN_CONFIG = "tests/golden/vitest.config.ts";
const BAND_DIR = "tests/golden/band";

/** The calls a band suite must reach: the stage for its fixture, the measure, and the ledger's door. */
const STAGE_CALL: Readonly<Record<string, string>> = Object.freeze({ "rcc6-bnbc": "stageBnbcBand", rcc6: "stageRcc6Band" });
const MEASURE_CALL = "measureBand";
const LEDGER_CALLS = ["recordObservation", "observationsOf"];

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

/* ------------------------------------------------------------------ the lane that runs the arms */

/** Every fixture that carries a hand takeoff — the fixtures the band lane is owed a suite for (AM-01). */
function fixturesWithGoldens(): string[] {
  const dir = join(ROOT, "fixtures");
  expect(existsSync(dir), "the checkout carries its fixtures (AM-01: two of them, never a replacement)").toBe(true);
  // white-box: AC-1 — the roster of fixtures the band lane owes a suite for cannot be asked of the
  // product: what is graded here is that a suite EXISTS and is collected per fixture, so the question
  // has to be put to the tree. It walks `fixtures/` — committed yardstick evidence, no product source —
  // and reads no text out of it: a directory carrying `takeoff.golden.json` is a fixture with a hand
  // takeoff, which is the derivation AM-01 states and the reason nothing here is a frozen list (B-19).
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "takeoff.golden.json")))
    .map((entry) => entry.name)
    .sort();
}

/** What the golden lane's own runner collects, asked of it with the database pointed at a dead port. */
function collectedByGoldenLane(): string[] {
  const listed = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "list", "--filesOnly", "--config", GOLDEN_CONFIG], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300_000,
    env: { ...process.env, DATABASE_URL: "postgresql://x@127.0.0.1:1/x" },
  });
  expect(listed.status, `vitest could not list ${GOLDEN_CONFIG}:\n${`${listed.stdout ?? ""}${listed.stderr ?? ""}`.slice(-1600)}`).toBe(0);
  return (listed.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /\.test\.tsx?$/.test(line))
    .map((line) => relative(ROOT, resolve(ROOT, line)).replace(/\\/g, "/"))
    .sort();
}

// white-box: AC-1 — "the suite hands its batch to the gate and records the cell" is a property of what
// the suite's own source imports: no run of the lane can tell a suite that grades and records from one
// that grades and returns, because both exit 0. The named bindings are read off the PARSED import
// declarations, never matched as text, which is the whole reason this read is here.
/** The named bindings a module imports, and the local modules it imports them from. */
function importsOf(file: string): { names: Set<string>; local: string[] } {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const names = new Set<string>();
  const local: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : "";
    if (specifier.startsWith(".")) {
      const base = resolve(dirname(file), specifier);
      const found = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
      if (found !== undefined) local.push(found);
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings !== undefined && ts.isNamedImports(bindings)) for (const element of bindings.elements) names.add(element.name.text);
  }
  return { names, local };
}

/** Every name a suite imports, directly or through the support modules it imports beside it (one hop). */
function reachedNames(file: string): string[] {
  const direct = importsOf(file);
  const reached = new Set(direct.names);
  for (const module of direct.local) for (const name of importsOf(module).names) reached.add(name);
  return [...reached];
}

describe("AC-1, AC-2: V-GOLDEN collects a band suite per fixture, and each one drives the band", () => {
  test("AC-1: the golden lane collects one band suite for every fixture that carries a hand takeoff", () => {
    const fixtures = fixturesWithGoldens();
    expect(fixtures.length, "the tree carries fixtures with hand takeoffs — two of them, never a replacement (AM-01)").toBeGreaterThan(0);
    const collected = collectedByGoldenLane();
    for (const fixtureId of fixtures) {
      expect(
        collected,
        `\`pnpm test:golden\` collects ${BAND_DIR}/${fixtureId}.band.test.ts — the band arm for ${fixtureId} (AC-1, AC-2). The lane collects: ${JSON.stringify(collected)}`,
      ).toContain(`${BAND_DIR}/${fixtureId}.band.test.ts`);
    }
  }, 300_000);

  test("AC-2: each band suite stages its own fixture, measures it, and records what it graded", () => {
    for (const fixtureId of fixturesWithGoldens()) {
      const suite = join(ROOT, BAND_DIR, `${fixtureId}.band.test.ts`);
      expect(existsSync(suite), `${BAND_DIR}/${fixtureId}.band.test.ts stands in the tree (AC-1, AC-2)`).toBe(true);
      const reached = reachedNames(suite);
      const staging = STAGE_CALL[fixtureId];
      if (staging !== undefined) {
        expect(reached, `${fixtureId}'s band suite reaches \`${staging}\` — the stage AC-1 and AC-2 name for that fixture (interfaces)`).toContain(staging);
      }
      expect(reached, `and \`${MEASURE_CALL}\`, which is what hands the batch to the gate and reads the register back (interfaces)`).toContain(MEASURE_CALL);
      for (const call of LEDGER_CALLS) {
        expect(
          reached,
          `and \`${call}\` — a band suite that grades and does not record leaves V-GOLDEN's "records validation observations" to nobody, and exits 0 while doing it (R-TO-035, AC-1)`,
        ).toContain(call);
      }
    }
  }, 300_000);
});
