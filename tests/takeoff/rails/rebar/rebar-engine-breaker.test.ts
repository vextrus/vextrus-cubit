/**
 * What the reinforcement rail does with the three things a real drawing hands it that the acceptance
 * never hands it: a bar diameter the kg/m table holds no rate for, a general note two readers
 * transcribed differently, and a grade written in a unit the ℓd table is not stated in.
 *
 * Every case is driven through the SAME door the measure job drives (`RAILS["rcc.rebar"]` /
 * `rebarRail`), over the hand-built setup the acceptance's own contract publishes, so nothing here
 * asserts against a private surface. Each case is a disclosure question: L-QTY-02 keeps the row and
 * names what is missing, and the one thing a rail may never do is answer neither a figure nor a code.
 */
import { describe, expect, test } from "vitest";
import {
  DETAILING_ROW_NOT_IN_EDITION,
  NOTE_READING_CONTESTED,
  detailingUnread,
  levelStanding,
  placement,
  railInput,
  reading,
  rebarRailDoor,
  refusalRegister,
  registerRow,
  variant,
  zone,
  type DetailingSetupShape,
  type OfferShape,
  type RailBatchShape,
  type RailShape,
  type RebarZoneSetupShape,
} from "./support/rebar-contract";
import { parseRebarGroups } from "../../../../src/modules/takeoff/partition/notation";

/** The member every case is about: one column of one family, on one level, at one placement. */
const PLACEMENT_KEY = "PLAN:S-102:t:4|C1|12000.0|8000.0";
const FAMILY = "C1";
const LEVEL_ID = "55555555-5555-4555-8555-555555555555";
const OBJECT_KEY = `${PLACEMENT_KEY}@${LEVEL_ID}`;

/** One column, with the main-bar group and the detailing the case is about and nothing else. */
function columnCase(options: { bars: RebarZoneSetupShape["bars"]; detailing?: DetailingSetupShape; runMm?: string }) {
  return railInput({
    objects: [registerRow({ placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, levelLabel: "1F", mark: FAMILY })],
    placements: { [PLACEMENT_KEY]: placement({ placementKey: PLACEMENT_KEY, memberFamily: FAMILY }) },
    memberTypes: {
      [FAMILY]: [variant({ variantKey: `${FAMILY}:ALL`, width: 450, depth: 450, rebar: [zone({ zone: "main", bars: options.bars })] })],
    },
    levels: [levelStanding({ levelId: LEVEL_ID, label: "1F", ordinal: 1, value: options.runMm ?? "3000" })],
    detailing: options.detailing ?? detailingUnread(),
  });
}

/** The member's own line out of a batch — every case states exactly one member. */
function lineOf(batch: RailBatchShape): OfferShape {
  const offer = batch.offers.find((one) => one.register.objectKey === OBJECT_KEY);
  expect(offer, `the rail keeps a line for ${OBJECT_KEY} — "a row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02)`).toBeDefined();
  return offer as OfferShape;
}

/** Every registered code the batch discloses about the member: on its line, or beside it. */
function disclosedCodes(batch: RailBatchShape): readonly string[] {
  const onLine = batch.offers.filter((one) => one.register.objectKey === OBJECT_KEY).flatMap((one) => one.omitted.map((component) => component.code));
  const beside = batch.observations.filter((one) => one.objectKey === undefined || one.objectKey === OBJECT_KEY).map((one) => one.code);
  return [...onLine, ...beside];
}

describe("the reinforcement rail, attacked where the acceptance does not reach", () => {
  test("a main-bar diameter the kg/m table holds no rate for is disclosed, never thrown", async () => {
    // The cell is one a schedule really yields: the notation reads `8-18Ø` as eight 18 mm bars, and
    // 18 mm is not one of the eleven rows L-FRM-05's verified unit-weight lookup holds.
    expect(parseRebarGroups("8-18Ø"), "a schedule cell stating `8-18Ø` reads as eight 18 mm bars (R-TO-031's notation)").toEqual([{ n: 8, diameterMm: 18 }]);

    const rail = (await rebarRailDoor())["rebarRail"] as RailShape;
    const input = columnCase({ bars: [{ n: 8, diameterMm: 18 }] });

    // A rail is asked by the measure job with no guard around it (`measure/job.ts`), so a throw here
    // is the whole campaign's measurement lost — every other kind's lines with it — instead of one
    // member's schedule cell reported for a reader to go and read (L-QTY-02, L-MEA-08).
    let batch: RailBatchShape | undefined;
    expect(() => {
      batch = rail(input);
    }, "the rail answers a diameter it cannot price rather than throwing out of the measure job").not.toThrow();

    const register = await refusalRegister();
    const codes = disclosedCodes(batch as RailBatchShape);
    expect(codes.length, "and the member is disclosed by a code rather than billed at a rate nobody published (L-QTY-01)").toBeGreaterThan(0);
    for (const code of codes) expect(Object.hasOwn(register, code), `and ${code} is a code the one register holds (Q-07)`).toBe(true);
  });

  test("a general note two readers read differently is omitted by name, never replaced by the edition's default", async () => {
    const rail = (await rebarRailDoor())["rebarRail"] as RailShape;
    const notes = ["LAP", "FY"] as const;

    for (const kind of notes) {
      // What the notes door answers when one kind's readings DISAGREE: no figure, and the kind named
      // in `suspended`. The setup's own words for it: "a note nobody has settled states nothing at
      // all, and the component it governs is omitted by name" (`DetailingSetup`, AM-03(h)).
      const contested: DetailingSetupShape = { ...detailingUnread(), suspended: [kind], sourceKeys: ["fixtures/rcc6-bnbc/model.json#notes"] };
      const line = lineOf(rail(columnCase({ bars: [{ n: 8, diameterMm: 20 }], detailing: contested })));
      const codes = line.omitted.filter((component) => component.variable === "lap").map((component) => component.code);

      expect(
        line.bindings["lap"],
        `with the ${kind} note contested the lap is bound by nothing: a figure taken off the edition's own clause and published DERIVED would state the lap a reader is still arguing about (L-QTY-01, L-QTY-02)`,
      ).toBeUndefined();
      expect(codes, `and the omission is named by the code a contested reading stands under (src/core/notes/law.ts: SUSPENDED → ${NOTE_READING_CONTESTED})`).toContain(NOTE_READING_CONTESTED);
    }
  });

  test("a grade written in a unit the ℓd table is not stated in is not detailed as if it were MPa", async () => {
    const rail = (await rebarRailDoor())["rebarRail"] as RailShape;
    const bars = [{ n: 8, diameterMm: 20 }];

    // The notes grammar admits a grade in `kg/cm²` (`STRENGTH_UNITS`), and 500 kg/cm² is about 49
    // MPa — a seventh of the grade the fy 500 rows are stated for. The mix is carried to psi before
    // anything clamps (`fcPsiOf`); the grade is read with `Number(value)` and its unit dropped, so
    // the two halves of one note are read to two different standards.
    const metric: DetailingSetupShape = { ...detailingUnread(), fy: reading("500", "MPa"), sourceKeys: ["fixtures/rcc6-bnbc/model.json#notes"] };
    const gravimetric: DetailingSetupShape = { ...detailingUnread(), fy: reading("500", "kg/cm2"), sourceKeys: ["fixtures/rcc6-bnbc/model.json#notes"] };

    const asMPa = lineOf(rail(columnCase({ bars, detailing: metric })));
    const asKgCm2 = lineOf(rail(columnCase({ bars, detailing: gravimetric })));

    expect(
      asKgCm2.bindings["lap"]?.value,
      "a grade stated in kg/cm² does not bill the lap the fy 500 MPa row would: the same digits in another unit are another grade (L-QTY-01)",
    ).not.toBe(asMPa.bindings["lap"]?.value);
    expect(
      asKgCm2.omitted.filter((component) => component.variable === "lap").map((component) => component.code),
      `and the edition holds no ℓd row for it, which is what ${DETAILING_ROW_NOT_IN_EDITION} says (AM-03(f))`,
    ).toContain(DETAILING_ROW_NOT_IN_EDITION);
  });
});
