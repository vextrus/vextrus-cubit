/**
 * The column-concrete rail's residue: the four reasons it reports a row instead of offering one
 * (R-TO-031, L-MEA-08).
 *
 * L-MEA-08 reserves the refused arm for contract violations and sends a non-offer to the residue as
 * evidence, so a row the rail could not read reaches the observations rather than the refusals — and
 * a rail that dropped it in silence would lose the evidence altogether. The roster is closed at four
 * (interfaces), and each code here is spelled by the case that earns it.
 */
import { describe, expect, test } from "vitest";
import {
  CALIBRATION_KEY,
  COLUMN_CLASS,
  DRAWING_ID,
  INGEST_ID,
  LEVEL_ID,
  MEMBER_FAMILY,
  PLACEMENT_KEY,
  RCC_CONCRETE,
  SECTION_SOURCE,
  VECTOR,
  VIEW_KEY,
  columnRailDoor,
  levelStanding,
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

/** The level the row of every case below stands on, and one below it a band can name. */
const GROUND: LevelSetup = levelStanding({ levelId: "44444444-4444-4444-8444-444444444401", label: "GF", ordinal: 0, value: "3", unit: "M", sourceKey: "S-105:e:2" });
const STANDS_ON: LevelSetup = levelStanding({ levelId: LEVEL_ID, label: "L1", ordinal: 1, value: "3", unit: "M", sourceKey: "S-105:e:3" });

/** The row every case reads: one column instance, sighted at one placement, standing on L1. */
const ROW = registerRow({ setRevisionId: "11111111-1111-4111-8111-111111111111", placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, viewKey: VIEW_KEY, mark: MEMBER_FAMILY });

/** The placement the setup holds for it. */
const PLACEMENT = { drawingId: DRAWING_ID, ingestId: INGEST_ID, viewKey: VIEW_KEY, memberFamily: MEMBER_FAMILY, engine: VECTOR, sourceEntity: PLACEMENT_KEY };

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
  test("the roster is exactly the four codes the rail reports under", async () => {
    const rail = await columnRailDoor();
    expect([...rail.COLUMN_RAIL_CODES], "a rail-local roster is closed: a fifth reason would be a code no reader was told to expect (interfaces)").toStrictEqual([
      VIEW_SCALE_UNAFFIRMED,
      MEMBER_TYPE_UNKNOWN,
      SECTION_BAND_UNCOVERED,
      SECTION_UNIT_UNSTATED,
    ]);
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
    expect(await reportedBy({ placements: {} }, PLACEMENT_KEY)).toBe(MEMBER_TYPE_UNKNOWN);
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
});
