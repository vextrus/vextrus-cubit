/**
 * The column-concrete rail's residue: every reason it reports a row instead of offering one
 * (R-TO-031, L-MEA-08).
 *
 * L-MEA-08 reserves the refused arm for contract violations and sends a non-offer to the residue as
 * evidence, so a row the rail could not read reaches the observations rather than the refusals — and
 * a rail that dropped it in silence would lose the evidence altogether. The roster is closed
 * (interfaces), and each code here is spelled by the case that earns it.
 */
import { describe, expect, test } from "vitest";
import {
  CALIBRATION_KEY,
  COLUMN_CLASS,
  INGEST_ID,
  LEVEL_ID,
  MEMBER_FAMILY,
  PLACEMENT_KEY,
  RCC_CONCRETE,
  ROUND,
  SECTION_SOURCE,
  VIEW_KEY,
  columnRailDoor,
  levelStanding,
  placement,
  railInput,
  registerRow,
  variant,
  type LevelSetup,
  type RailInputDraft,
  type RailInputShape,
  type VariantSetup,
} from "./support/column-rail-stage";

/** The codes this rail reports under, by name — the roster the interfaces close it at. */
const VIEW_SCALE_UNAFFIRMED = "VIEW_SCALE_UNAFFIRMED";
const MEMBER_TYPE_UNKNOWN = "MEMBER_TYPE_UNKNOWN";
const SECTION_BAND_UNCOVERED = "SECTION_BAND_UNCOVERED";
const SECTION_UNIT_UNSTATED = "SECTION_UNIT_UNSTATED";
/** The fifth: a row whose PLACEMENT the setup does not hold, re-homed off MEMBER_TYPE_UNKNOWN. */
const PLACEMENT_UNHELD = "PLACEMENT_UNHELD";
/** The sixth: a plan note calling a section round over a schedule cell whose two sides DIFFER. */
const SECTION_NOT_CIRCULAR = "SECTION_NOT_CIRCULAR";

/** The level the row of every case below stands on, and one below it a band can name. */
const GROUND: LevelSetup = levelStanding({ levelId: "44444444-4444-4444-8444-444444444401", label: "GF", ordinal: 0, value: "3", unit: "M", sourceKey: "S-105:e:2" });
const STANDS_ON: LevelSetup = levelStanding({ levelId: LEVEL_ID, label: "L1", ordinal: 1, value: "3", unit: "M", sourceKey: "S-105:e:3" });

/** The row every case reads: one column instance, sighted at one placement, standing on L1. */
const ROW = registerRow({ setRevisionId: "11111111-1111-4111-8111-111111111111", placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, viewKey: VIEW_KEY, mark: MEMBER_FAMILY });

/** The placement the setup holds for it — one no plan note named. */
const PLACEMENT = placement({});

/** A setup that stands whole, with only what a case takes away from it named. */
function input(changed: Partial<RailInputDraft> = {}): RailInputShape {
  return railInput({
    objects: [ROW],
    placements: { [PLACEMENT_KEY]: PLACEMENT },
    memberTypes: { [INGEST_ID]: { [MEMBER_FAMILY]: [variant({ variantKey: MEMBER_FAMILY, width: 300, depth: 450, sourceKeys: [SECTION_SOURCE] })] } },
    levels: [GROUND, STANDS_ON],
    calibrations: { [INGEST_ID]: { [VIEW_KEY]: CALIBRATION_KEY } },
    ...changed,
  });
}

/**
 * The one observation a case's batch reports, having offered nothing — asserted whole, because an
 * observation is "a rail-local closed code keyed (class × kind) with optional object and source
 * entity" (L-MEA-08) and a key beside those is a field a reader was never told to read.
 */
async function reportedBy(draft: Partial<RailInputDraft>, sourceEntity: string): Promise<string> {
  const rail = await columnRailDoor();
  const batch = rail.columnConcreteRail(input(draft));
  expect(batch.offers, "a row the rail could not read is not offered — an offer it could not stand behind is worse than none (L-MEA-08)").toEqual([]);
  expect(batch.observations.length, "and it is reported exactly once, on the row that earned it").toBe(1);
  const observation = batch.observations[0] as { class: string; kind: string; code: string; objectKey?: string; sourceEntity?: string };
  expect([observation.class, observation.kind], "an observation is keyed by the (class × kind) the rail measures (L-MEA-08)").toStrictEqual([COLUMN_CLASS, RCC_CONCRETE]);
  expect(observation.objectKey, "and it names the register row it is evidence about, so the residue can be traced back (L-QTY-03)").toBe(ROW["objectKey"]);
  expect(observation, "and the entity it names is the one a reader has to go and look at — with nothing carried beside it (L-MEA-08)").toStrictEqual({
    class: COLUMN_CLASS,
    kind: RCC_CONCRETE,
    code: observation.code,
    objectKey: ROW["objectKey"],
    sourceEntity,
  });
  return observation.code;
}

describe("the column rail's closed code roster", () => {
  test("the roster is exactly the codes the rail reports under", async () => {
    const rail = await columnRailDoor();
    // TEST_AMENDED (inc-sweep-src-modules-2, AC-3(a)): the roster gains PLACEMENT_UNHELD, the code a
    // row whose placement the setup does not hold is now reported under. The roster is still closed —
    // a code beside these is one no reader was told to expect — and the ORDER of a roster is nobody's
    // contract, so membership is what is asserted (interfaces, AM-11).
    //
    // TEST_AMENDED (I-304, I-305): and SECTION_NOT_CIRCULAR, the code a plan note calling a section
    // round is reported under where the schedule states two sides that differ. The rail now reads a
    // SHAPE as well as a size, so it has a new way of being unable to read one — and L-REG-03 has
    // that disagreement declared by name rather than settled by picking a side.
    expect(
      new Set([...rail.COLUMN_RAIL_CODES]),
      "a rail-local roster is closed: a seventh reason would be a code no reader was told to expect (interfaces)",
    ).toStrictEqual(new Set([VIEW_SCALE_UNAFFIRMED, MEMBER_TYPE_UNKNOWN, SECTION_BAND_UNCOVERED, SECTION_UNIT_UNSTATED, PLACEMENT_UNHELD, SECTION_NOT_CIRCULAR]));
  });

  test("a view no affirmed calibration stands for is reported, never offered", async () => {
    // riskNotes (3): the rail cannot mint a calibration reference it does not hold, and L-QTY-03
    // requires a non-empty set of affirmed references on every measured attribute — so the row goes
    // to the residue as evidence rather than to the refused arm.
    expect(await reportedBy({ calibrations: {} }, VIEW_KEY)).toBe(VIEW_SCALE_UNAFFIRMED);
  });

  test("a reference the setup spells as nothing is no affirmed calibration either", async () => {
    // The same silence, written down: offering under it would publish nothing and be refused for
    // the contract, which names the machine's disagreement rather than the view a reader has to go
    // and affirm (L-QTY-03's non-empty set, riskNotes (3)).
    expect(await reportedBy({ calibrations: { [INGEST_ID]: { [VIEW_KEY]: "" } } }, VIEW_KEY)).toBe(VIEW_SCALE_UNAFFIRMED);
  });

  test("a family the member-type registry holds no variant for is reported", async () => {
    expect(await reportedBy({ memberTypes: { [INGEST_ID]: {} } }, PLACEMENT_KEY)).toBe(MEMBER_TYPE_UNKNOWN);
  });

  test("a row whose placement the setup does not hold is reported rather than dropped", async () => {
    // There is no drawing, view or engine to offer such a row under, and silence would lose it.
    // TEST_AMENDED (inc-sweep-src-modules-2, AC-3(a)): under its OWN code. MEMBER_TYPE_UNKNOWN's
    // registered message and remedy send the reader to a member-type registry that answered nothing
    // wrong; the recourse here is to rebuild the drawing's partition (Q-07, debt-src-modules-bfezdu).
    expect(await reportedBy({ placements: {} }, PLACEMENT_KEY)).toBe(PLACEMENT_UNHELD);
  });

  test("a level no section band covers defers, by name", async () => {
    // "A level no band covers defers" (L-FRM-02): a banded schedule row prices the levels its own
    // endpoints name, and the level above them is priced by nothing.
    const banded: VariantSetup = variant({ variantKey: MEMBER_FAMILY, width: 300, depth: 450, sourceKeys: [SECTION_SOURCE], bandFrom: "GF", bandTo: "GF" });
    expect(await reportedBy({ memberTypes: { [INGEST_ID]: { [MEMBER_FAMILY]: [banded] } } }, PLACEMENT_KEY)).toBe(SECTION_BAND_UNCOVERED);
  });

  test("a section read without the unit it was written in is reported, never guessed", async () => {
    // A figure with no unit cannot be carried into metres by anybody, and a rail converts nothing:
    // the canon is the one home of that carrying, and it is given a unit or it is given nothing
    // (L-FRM-06, B-17).
    const unitless: VariantSetup = variant({ variantKey: MEMBER_FAMILY, width: 300, depth: 450, unit: null, sourceKeys: [SECTION_SOURCE] });
    expect(await reportedBy({ memberTypes: { [INGEST_ID]: { [MEMBER_FAMILY]: [unitless] } } }, SECTION_SOURCE)).toBe(SECTION_UNIT_UNSTATED);
  });

  test("a plan note calling the section round over a cell whose two sides differ is reported, and no side is picked", async () => {
    // SYNTHETIC BY NECESSITY, and it is worth saying which fixture it is not. F-RCC6-BNBC's S-10
    // writes `C7 %%C450 PORCH COLUMN` and its S-11 COLUMN SCHEDULE states `450x450` for C7 under all
    // four band headers, so the two AGREE — b = d = 450 — and the guard this case earns never fires
    // on that fixture. It has to be staged by hand or it cannot be staged at all.
    //
    // What it grades is the other half of I-304. The plan states the SHAPE and the schedule states
    // the SIZE, which is not a disagreement while a square cell is what a circle's diameter reads
    // off. Where the cell states two DIFFERENT sides there is no diameter anywhere in the set: it is
    // a real disagreement, and L-REG-03 has one DECLARED and never resolved silently. So the member
    // is reported and nothing publishes — a rail that took the width, the depth, the larger or the
    // mean would be billing a column nobody drew (L-QTY-01, L-QTY-04).
    const rectangular: VariantSetup = variant({ variantKey: MEMBER_FAMILY, width: 300, depth: 450, sourceKeys: [SECTION_SOURCE] });
    expect(
      await reportedBy(
        { placements: { [PLACEMENT_KEY]: placement({ noteShape: ROUND }) }, memberTypes: { [INGEST_ID]: { [MEMBER_FAMILY]: [rectangular] } } },
        // The SCHEDULE CELL, because that is where the remedy sends a reader: the note said one
        // thing about a shape and said nothing about a size, and the cell is the surface a diameter
        // could be stated on (L-QTY-03).
        SECTION_SOURCE,
      ),
    ).toBe(SECTION_NOT_CIRCULAR);
  });
});
