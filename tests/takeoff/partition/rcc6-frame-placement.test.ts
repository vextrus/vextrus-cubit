/**
 * AC-3 — F-RCC6's beams and tie beams, placed off their drawn edge lines, with their runs stored
 * (R-TO-032, L-MEA-09, L-REG-02/04, L-CAD-07).
 *
 * F-RCC6 draws no beam as a closed outline: a beam is a pair of parallel S-BEAM edge lines with its
 * mark beside the axis between them. So this grades three things at once — that the mark grammar
 * knows a B from a TB, that the placement anchors to the pair rather than to an outline, and that the
 * RUN stored for each placement is the clear axis L-MEA-09 measures, not the grid-to-grid span.
 *
 * Every figure compared against is the fixture's own authored statement of its geometry
 * (fixtures/rcc6/inputs.json, `measured.clear_m` and `measured.faces`), read as data. Nothing here
 * types a quantity, and nothing here reads the product's source.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  BEAM_CLASS,
  MILLIMETRES,
  TIE_BEAM_CLASS,
  canon,
  inputsBeamLevels,
  inputsClearByMarkAndLevel,
  inputsFacesByMarkAndLevel,
  inputsSpanByMark,
  inputsTieBeamMarks,
  productModule,
  type Decimal,
} from "../rails/support/frame-rail-stage";
import {
  closeStage,
  field,
  registerRowsOf,
  runsOfStage,
  stageRcc6,
  type Rcc6Stage,
  type SideReading,
  type StagedRun,
  type StoredPlacement,
} from "../rails/support/rcc6-stage";

/** The partition's placement law, whose mark grammar this leaf widens (interfaces). */
const PLACEMENT_LAW_MODULE = "src/modules/takeoff/partition/placement/law.ts";

/** The basis a run measured off the drawing carries (L-QTY-01). */
const MEASURED_BASIS = "MEASURED";

/** The standing a register row on a level nothing was drawn at carries (L-REG-03). */
const DERIVED_STANDING = "DERIVED";

/** The level the fixture calls its roof — the one level drawn by a plan of its own. */
const ROOF_LABEL = "ROOF";

let measured: Rcc6Stage;
let beams: StoredPlacement[];
let ties: StoredPlacement[];

beforeAll(async () => {
  measured = await stageRcc6("rcc6-frame");
  beams = measured.partition.placementRows.filter((row) => row.elementType === BEAM_CLASS);
  ties = measured.partition.placementRows.filter((row) => row.elementType === TIE_BEAM_CLASS);
}, 1_800_000);

/**
 * The runs the partition stored, read once. Asked for inside the cases that read them rather than in
 * the hook, so a tree with no run door fails each of those cases by name instead of taking the whole
 * suite down with one hook.
 */
let reading: Promise<StagedRun[]> | undefined;
const storedRuns = (): Promise<StagedRun[]> => (reading ??= runsOfStage(measured));

afterAll(async () => {
  await closeStage();
});

/** A reading in millimetres, carried to metres in the canon (B-07). */
async function metres(reading: SideReading): Promise<Decimal> {
  const { exact } = await canon();
  expect(reading.unit, "a run is stored in the unit the drawing was read in").toBe(MILLIMETRES);
  return exact(reading.value).mul(exact("0.001"));
}

/** The register rows of the pinned revision, by the placement each stands for. */
function rowsByPlacement(): Map<string, Record<string, unknown>[]> {
  const held = new Map<string, Record<string, unknown>[]>();
  for (const row of registerRowsOf(measured)) {
    const key = String(field(row, "placementKey", "placement_key"));
    held.set(key, [...(held.get(key) ?? []), row as unknown as Record<string, unknown>]);
  }
  return held;
}

/** The level label a register row stands at — the stack's own label, or FDN where it stands on none. */
function labelOf(row: Record<string, unknown>): string {
  const levelId = field(row as never, "levelId", "level_id");
  if (levelId === null || levelId === undefined) return "FDN";
  return measured.levels.find((level) => level.levelId === String(levelId))?.label ?? "";
}

describe("AC-3: the partition places F-RCC6's beams and tie beams, and stores their runs", () => {
  test("AC-3: a mark's prefix decides its class — B is a beam, TB a tie beam, and a slab mark neither", async () => {
    const law = await productModule<{ classOfMark: (mark: string) => string | null; isFoundationClass: (type: string) => boolean }>(PLACEMENT_LAW_MODULE);

    expect(law.classOfMark("B5"), "a B mark is a beam (interfaces: CLASS_OF_PREFIX)").toBe(BEAM_CLASS);
    expect(law.classOfMark("TB1"), "and a TB mark a tie beam — the longer prefix wins over the shorter one").toBe(TIE_BEAM_CLASS);
    expect(law.classOfMark("S1"), "a slab mark is still no member this leaf places (out of scope)").toBeNull();
    expect(law.isFoundationClass(TIE_BEAM_CLASS), "a tie beam stands in the FOUNDATION slot, not on a level of the stack (L-REG-02)").toBe(true);
  });

  test("AC-3: every beam and tie beam the fixture states is placed, on the plans that draw it", () => {
    const stated = inputsBeamLevels();
    expect([...new Set(beams.map((row) => row.mark))].sort(), `every beam mark the fixture states is placed (the run stored ${beams.length} beam placements)`).toEqual([...stated.keys()].sort());
    expect([...new Set(ties.map((row) => row.mark))].sort(), "and every tie-beam mark").toEqual([...inputsTieBeamMarks()].sort());

    // A mark drawn on two layout plans is exactly a mark the fixture states at the roof as well as
    // the typical levels: the roster is the fixture's, never a list of view names typed here (B-19).
    const viewsOfMark = new Map<string, Set<string>>();
    for (const row of beams) viewsOfMark.set(row.mark, new Set([...(viewsOfMark.get(row.mark) ?? []), row.viewKey]));
    for (const [mark, levels] of stated) {
      // The plans that draw a mark, derived from the levels the fixture states it at: the roof is
      // its own plan, and every other level is the typical floor plan's range.
      const owed = (levels.includes(ROOF_LABEL) ? 1 : 0) + (levels.some((level) => level !== ROOF_LABEL) ? 1 : 0);
      expect((viewsOfMark.get(mark) ?? new Set()).size, `${mark} is placed on the ${String(owed)} layout plan(s) the fixture draws it on`).toBe(owed);
    }
    for (const row of ties) expect((row.viewKey ?? "").length, `the tie beam ${row.mark} was sighted in the plan that draws it`).toBeGreaterThan(0);
  });

  test("AC-3: each placement carries the schedule family its section is read from", () => {
    expect(beams.length + ties.length, `the partition placed the beams and tie beams F-RCC6 draws (it stored ${measured.partition.placements} placements in all)`).toBeGreaterThan(0);
    for (const row of [...beams, ...ties]) {
      expect(row.memberFamily, `${row.mark} names the BEAM SCHEDULE family its section comes from — a member with no family has no section (L-MEA-06)`).toBeTruthy();
    }
  });

  test("AC-3: one run is stored per beam and tie-beam placement, measured off the drawing", async () => {
    const runs = await storedRuns();
    const keys = new Set([...beams, ...ties].map((row) => row.placementKey));
    const stored = runs.filter((one) => keys.has(one.placementKey));

    expect(stored.length, `the partition stored one run per beam and tie-beam placement (${keys.size} of them; it stored ${runs.length} runs in all)`).toBe(keys.size);
    expect(new Set(stored.map((one) => one.placementKey)).size, "each keyed to its own placement, once").toBe(stored.length);
    for (const one of stored) {
      expect(one.clear, `${String(one.placement?.mark)} has a clear run — a run nobody could read is stored as unread, and F-RCC6 draws every one of them`).toBeTruthy();
      expect(one.clear?.unit, "stored in the unit the drawing was read in").toBe(MILLIMETRES);
      expect(one.clear?.basis, "and MEASURED: it was read off the geometry, not transcribed from a schedule (L-QTY-01)").toBe(MEASURED_BASIS);
      expect((one.clear?.sourceKeys ?? []).length, "naming the entities it was read from, so a reader can go back to them (L-QTY-03)").toBeGreaterThan(0);
    }
  });

  test("AC-3: each (beam mark, level)'s runs sum to the clear the fixture states, not to its grid span", async () => {
    const { exact } = await canon();
    const owed = inputsClearByMarkAndLevel();
    const rows = rowsByPlacement();
    const runOf = new Map((await storedRuns()).map((one) => [one.placementKey, one]));

    for (const [mark, byLevel] of owed) {
      for (const [level, clearMetres] of byLevel) {
        // The placements standing at this (mark, level) are the ones the register registered there:
        // the level a run is measured for is the level its instance stands on (L-REG-04).
        const keys = new Set(
          [...rows.entries()]
            .filter(([, held]) => held.some((row) => String(field(row as never, "mark", "mark")) === mark && labelOf(row) === level))
            .map(([key]) => key),
        );
        expect(keys.size, `${mark} stands at ${level} — the fixture states a clear run for it there`).toBeGreaterThan(0);

        let summed = exact("0");
        for (const key of keys) {
          const held = runOf.get(key);
          expect(held?.clear, `the placement ${key} of ${mark} has a stored run`).toBeTruthy();
          summed = summed.add(await metres(held?.clear as SideReading));
        }
        expect(
          summed.eq(exact(clearMetres)),
          `${mark} at ${level}: the runs sum to ${clearMetres} m — the drawn axis clear between support faces, less every stretch inside a slab opening (L-MEA-09). They summed to ${summed.toString()}`,
        ).toBe(true);
        expect(
          summed.lt(exact(String(inputsSpanByMark().get(mark))).mul(exact(String(keys.size)))),
          `and less than ${mark}'s grid-to-grid span over the same placements: a clear run is never the span (L-MEA-09)`,
        ).toBe(true);
      }
    }
  });

  test("AC-3: each run states the slab thickness adjoining each of its sides, as the view states it", async () => {
    const { exact } = await canon();
    const owed = inputsFacesByMarkAndLevel();
    const rows = rowsByPlacement();
    const runOf = new Map((await storedRuns()).map((one) => [one.placementKey, one]));
    const pairOf = (sides: readonly (SideReading | null)[]): string =>
      sides
        .map((side) => (side === null ? "unstated" : exact(side.value).toString()))
        .sort()
        .join("/");

    for (const [mark, byLevel] of owed) {
      for (const [level, faces] of byLevel) {
        const keys = [...rows.entries()]
          .filter(([, held]) => held.some((row) => String(field(row as never, "mark", "mark")) === mark && labelOf(row) === level))
          .map(([key]) => key);

        // What the drawing said, grouped exactly as the fixture groups it: one entry per distinct
        // pair of adjoining slabs, with the clear run measured under that pair.
        const measuredByPair = new Map<string, Decimal>();
        for (const key of keys) {
          const held = runOf.get(key) as StagedRun;
          const pair = pairOf(held.sides);
          measuredByPair.set(pair, (measuredByPair.get(pair) ?? exact("0")).add(await metres(held.clear as SideReading)));
        }
        const statedByPair = new Map(faces.map((face) => [[...face.slabThicknessMm].map((value) => exact(value).toString()).sort().join("/"), exact(face.clearMetres)]));

        expect(
          [...measuredByPair.keys()].sort(),
          `${mark} at ${level} adjoins the slabs the fixture states — an edge beam is open on one side and an interior beam is not (L-MEA-09)`,
        ).toEqual([...statedByPair.keys()].sort());
        for (const [pair, owedClear] of statedByPair) {
          expect(
            (measuredByPair.get(pair) as Decimal).eq(owedClear),
            `${mark} at ${level}, sides ${pair}: ${owedClear.toString()} m of run adjoins that pair (it measured ${String(measuredByPair.get(pair)?.toString())})`,
          ).toBe(true);
        }
      }
    }
  });

  test("AC-3: a tie beam's run is clear between the footing or cap faces it ends in", async () => {
    const { exact } = await canon();
    const spans = inputsSpanByMark();
    const runOf = new Map((await storedRuns()).map((one) => [one.placementKey, one]));
    expect(ties.length, "the partition placed the tie beams the FOUNDATION PLAN draws").toBeGreaterThan(0);

    for (const placement of ties) {
      const held = runOf.get(placement.placementKey) as StagedRun;
      const clear = await metres(held.clear as SideReading);
      const span = spans.get(placement.mark);
      expect(span, `the fixture states a grid-to-grid span for ${placement.mark}`).toBeTruthy();
      expect(
        clear.lt(exact(String(span))),
        `${placement.mark}: ${clear.toString()} m is clear between the faces of the members supporting its ends, so it is less than the ${String(span)} m grid-to-grid span (L-MEA-09)`,
      ).toBe(true);
    }
  });

  test("AC-3: a beam expands over its view's levels and a tie beam stands in the FOUNDATION slot", () => {
    const rows = rowsByPlacement();
    const stated = inputsBeamLevels();

    for (const placement of beams) {
      const held = rows.get(placement.placementKey) ?? [];
      expect(held.length, `${placement.mark}'s placement is registered on every level its view stands over — a beam expands per level exactly as a vertical does (interfaces)`).toBeGreaterThan(0);
      expect(new Set(held.map((row) => labelOf(row))).size, "once per level, never twice").toBe(held.length);
      expect(
        held.filter((row) => String(field(row as never, "standing", "standing")) !== DERIVED_STANDING).length,
        `and only the level ${placement.mark} was DRAWN at is not DERIVED (L-REG-03)`,
      ).toBeLessThanOrEqual(1);
    }

    // Every level the fixture states a mark at is a level that mark now stands on, and no other.
    for (const [mark, levels] of stated) {
      const standing = new Set(
        beams
          .filter((placement) => placement.mark === mark)
          .flatMap((placement) => (rows.get(placement.placementKey) ?? []).map((row) => labelOf(row))),
      );
      expect([...standing].sort(), `${mark} stands on exactly the levels the fixture states it at`).toEqual([...levels].sort());
    }

    for (const placement of ties) {
      const held = rows.get(placement.placementKey) ?? [];
      expect(held.length, `${placement.mark} is registered exactly once — the FOUNDATION slot is one place, not a level range (L-REG-02)`).toBe(1);
      expect(field(held[0] as never, "levelId", "level_id"), "and stands on no level of the stack").toBeNull();
    }
  });
});
