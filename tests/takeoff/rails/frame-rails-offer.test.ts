/**
 * AC-4 — the beam rails are pure, bind only what the drawing said, and report rather than guess
 * (R-TO-032, L-MEA-08, L-MEA-09, L-QTY-01/02).
 *
 * A rail is a pure function of the register's rows and the read-only setup: it reads, it offers, and
 * where it cannot read it says so by name. Nothing here opens a database — these cases hand a rail
 * exactly what a loader would and grade what it answers.
 */
import { describe, expect, test } from "vitest";
import {
  BEAM_CLASS,
  BEAM_CONCRETE_RULE_ID,
  BEAM_FORMWORK_RULE_ID,
  CALIBRATION_KEY,
  COLUMN_CLASS,
  COMPLETE,
  ERRORS_MODULE,
  INGEST_ID,
  LINTEL_CLASS,
  LINTEL_SOURCE_ABSENT,
  MILLIMETRES,
  PARTIAL_DECLARED,
  PIECES,
  PRISM_RECT,
  RCC_CONCRETE,
  RCC_FORMWORK,
  RUN_UNREAD,
  SIDE_A_SOURCE,
  SIDE_B_SOURCE,
  SLAB_THICKNESS_UNSTATED,
  affirmedCalibration,
  frameRailDoor,
  frameRailInput,
  frameRoster,
  levelStanding,
  placementSetup,
  productModule,
  registerRow,
  run,
  variant,
  versionKeysIn,
  type FrameRailInputDraft,
  type FrameRailInputShape,
  type FrameRailShape,
  type OfferShape,
  type RunSetup,
} from "./support/frame-rail-stage";

/** The column rail this leaf composes with, untouched by it (interfaces). */
const COLUMN_RAIL_MODULE = "src/modules/takeoff/rails/columns/index.ts";

/** The one beam this criterion measures: a 250 × 450 B1 standing on 1F, its run read (AC-4). */
const BEAM_PLACEMENT = "PLACEMENT:S-102:B1:1000:2000";
const BEAM_FAMILY = "B1";
const BEAM_WIDTH = 250;
const BEAM_DEPTH = 450;
const CLEAR = "4200";
const THIN_SIDE = "0";
const THICK_SIDE = "150";

/** The column standing beside it, whose offer the composition answers first (AC-4). */
const COLUMN_PLACEMENT = "PLACEMENT:S-102:C1:3000:2000";
const COLUMN_FAMILY = "C1";

/** The lintel a scheduled opening would state, and this batch does not (AC-4). */
const LINTEL_PLACEMENT = "PLACEMENT:S-102:L1:5000:2000";
const LINTEL_FAMILY = "L1";

/** The beam's row, its placement, its section and its run — the whole of what a rail is handed. */
function beamDraft(options: { runs?: Record<string, RunSetup> } = {}): FrameRailInputDraft {
  return {
    objects: [registerRow({ placementKey: BEAM_PLACEMENT, elementType: BEAM_CLASS, mark: BEAM_FAMILY })],
    placements: { [BEAM_PLACEMENT]: placementSetup({ placementKey: BEAM_PLACEMENT, memberFamily: BEAM_FAMILY }) },
    memberTypes: { [INGEST_ID]: { [BEAM_FAMILY]: [variant({ variantKey: BEAM_FAMILY, width: BEAM_WIDTH, depth: BEAM_DEPTH })] } },
    levels: [levelStanding({ label: "1F" })],
    calibrations: affirmedCalibration(),
    runs: options.runs ?? { [BEAM_PLACEMENT]: run({ clear: CLEAR, sides: [THIN_SIDE, THICK_SIDE] }) },
  };
}

/** The same beam, asked of a formwork rail — the kind is the only thing that changes. */
function beamInput(kind: string, options: { runs?: Record<string, RunSetup> } = {}): FrameRailInputShape {
  return frameRailInput({ ...beamDraft(options), kind });
}

/** The one offer a rail answered, with what it answered instead named where there is none. */
function onlyOffer(answered: { offers: readonly OfferShape[]; observations: readonly unknown[] }, what: string): OfferShape {
  expect(answered.offers.length, `${what}: exactly one offer — one per (register row, kind) the rail could read (L-MEA-08). It observed ${JSON.stringify(answered.observations)}`).toBe(1);
  return answered.offers[0] as OfferShape;
}

describe("AC-4: the beam rails bind what the drawing said, and report what it did not", () => {
  test("AC-4: the concrete rail offers one beam under its rule, binding the thicker adjoining slab as t", async () => {
    const door = await frameRailDoor();
    const offer = onlyOffer(door.beamConcreteRail(beamInput(RCC_CONCRETE)), "the beam whose run and both sides were read");

    expect({ ruleId: offer.ruleId, kind: offer.kind, class: offer.class }, "the offer states the rule it was derived by, the kind it measures and the class it measures (L-QTY-03)").toEqual({
      ruleId: BEAM_CONCRETE_RULE_ID,
      kind: RCC_CONCRETE,
      class: BEAM_CLASS,
    });
    expect(offer.geometry.type, "a beam is a rectangular prism along its run (L-FRM-02)").toBe(PRISM_RECT);
    expect(Object.keys(offer.bindings).sort(), "and binds exactly the readings its method declares").toEqual(["D", "b", "clear", "count", "t"]);
    expect({ value: offer.bindings["count"]?.value, unit: offer.bindings["count"]?.unit }, "one instance, counted in pieces").toEqual({ value: "1", unit: PIECES });
    expect({ value: offer.bindings["b"]?.value, unit: offer.bindings["b"]?.unit }, "the section width the schedule stated, in the unit it stated it in (L-REG-01)").toEqual({
      value: String(BEAM_WIDTH),
      unit: MILLIMETRES,
    });
    expect({ value: offer.bindings["D"]?.value, unit: offer.bindings["D"]?.unit }, "and its depth").toEqual({ value: String(BEAM_DEPTH), unit: MILLIMETRES });
    expect(offer.bindings["t"]?.value, "the THICKER adjoining slab governs t — a selection between two stated readings, never arithmetic (L-MEA-09)").toBe(THICK_SIDE);
    expect(offer.bindings["t"]?.source, "and t carries the source of the side it was selected from, not of the other one").toBe(SIDE_B_SOURCE);
    expect(offer.bindings["clear"]?.value, "the run is the clear axis between the faces of the members supporting its ends (L-MEA-09)").toBe(CLEAR);
    expect(offer.bindings["clear"]?.calibration, "read off the drawing, so it stands on the view's affirmed calibration (L-MEA-05)").toBe(CALIBRATION_KEY);
    expect([...offer.deductions], "a beam nets nothing: the junction it does not own is the other member's (L-MEA-09)").toEqual([]);
    expect([...offer.omitted], "and nothing of its description was left unmeasured").toEqual([]);
    expect(offer.coverage, "so the row is COMPLETE (L-QTY-02)").toBe(COMPLETE);
    expect(versionKeysIn(offer), "an offer states the rule it was derived by and never a version — the edition decides which version is in force (L-MEA-01)").toEqual([]);

    // The law selects the THICKER reading, not a side of the axis: the same two readings drawn in
    // the other order are the same beam, so `t` is the same thickness and carries the source of the
    // side it was selected from — which is now the first one. A rail that took the second side and
    // called it the thicker would answer this drawing and misprice every beam drawn the other way
    // round, and no F-RCC6 row could tell the two apart (L-MEA-09, B-19).
    const mirrored = onlyOffer(
      door.beamConcreteRail(beamInput(RCC_CONCRETE, { runs: { [BEAM_PLACEMENT]: run({ clear: CLEAR, sides: [THICK_SIDE, THIN_SIDE] }) } })),
      "the same beam with its two sides read in the other order",
    );
    expect(mirrored.bindings["t"]?.value, "the thicker adjoining slab still governs t when it is the side read first (L-MEA-09)").toBe(THICK_SIDE);
    expect(mirrored.bindings["t"]?.source, "and t carries that side's own source — the first one's here, the second one's above").toBe(SIDE_A_SOURCE);
    expect(mirrored.coverage, "with both sides stated, the mirrored row is COMPLETE too (L-QTY-02)").toBe(COMPLETE);
  });

  test("AC-4: the formwork rail offers the same beam under its own rule, binding each side separately", async () => {
    const door = await frameRailDoor();
    const offer = onlyOffer(door.beamFormworkRail(beamInput(RCC_FORMWORK)), "the beam's contact area");

    expect({ ruleId: offer.ruleId, kind: offer.kind, class: offer.class }, "formwork is its own kind, measured by its own rule over the same member (L-MEA-08)").toEqual({
      ruleId: BEAM_FORMWORK_RULE_ID,
      kind: RCC_FORMWORK,
      class: BEAM_CLASS,
    });
    expect(Object.keys(offer.bindings).sort(), "binding both sides beside the four readings the concrete shares").toEqual(["D", "b", "clear", "count", "t_left", "t_right"]);
    expect(
      { t_left: offer.bindings["t_left"]?.value, t_right: offer.bindings["t_right"]?.value },
      "each side is bound as the side it is — an edge beam's open side is the 0 the drawing implies, not a repetition of the other (L-MEA-09)",
    ).toEqual({ t_left: THIN_SIDE, t_right: THICK_SIDE });
    expect({ left: offer.bindings["t_left"]?.source, right: offer.bindings["t_right"]?.source }, "each carrying its own reading's source").toEqual({
      left: SIDE_A_SOURCE,
      right: SIDE_B_SOURCE,
    });
    expect(offer.coverage, "and the row is COMPLETE (L-QTY-02)").toBe(COMPLETE);
    expect(versionKeysIn(offer), "with no version anywhere on it").toEqual([]);
  });

  test("AC-4: a rail is a pure function — the same input twice answers the same batch", async () => {
    const door = await frameRailDoor();
    for (const [name, rail, kind] of [
      ["beamConcreteRail", door.beamConcreteRail, RCC_CONCRETE],
      ["beamFormworkRail", door.beamFormworkRail, RCC_FORMWORK],
    ] as readonly [string, FrameRailShape, string][]) {
      expect(rail(beamInput(kind)), `${name} is a pure function of what it was handed: nothing it answers depends on when it was asked (L-MEA-08)`).toEqual(rail(beamInput(kind)));
    }
  });

  test("AC-4: an unstated slab thickness is kept with no quantity and enumerated, never guessed", async () => {
    const door = await frameRailDoor();

    // Either side of the axis may be the one the drawing left unstated, and the side nobody read
    // may be the THICKER of the two — so the concrete row's `t` is omitted whichever side is
    // missing. A rail that selected `t` by position would bind the stated side here and publish a
    // figure the drawing never supported (L-MEA-09, L-QTY-01).
    for (const [sides, unread, stated, statedValue] of [
      [[THIN_SIDE, null], "t_right", "t_left", THIN_SIDE],
      [[null, THICK_SIDE], "t_left", "t_right", THICK_SIDE],
    ] as readonly [readonly [string | null, string | null], string, string, string][]) {
      const unstated = { [BEAM_PLACEMENT]: run({ clear: CLEAR, sides }) };
      const which = `sides ${JSON.stringify(sides)}`;

      const concrete = onlyOffer(door.beamConcreteRail(beamInput(RCC_CONCRETE, { runs: unstated })), `the beam with one side unread (${which}), measured for concrete`);
      expect(concrete.coverage, `a row whose description has a component nobody could measure is PARTIAL_DECLARED, never COMPLETE (L-QTY-02, ${which})`).toBe(PARTIAL_DECLARED);
      expect([...concrete.omitted], `and enumerates the omission on the row, by name (${which})`).toEqual([{ variable: "t", code: SLAB_THICKNESS_UNSTATED }]);
      expect(
        Object.keys(concrete.bindings),
        `the variable nobody read is not bound at all — an unread side may be the thicker one, and an unread thickness is never a zero nor the other side's reading (L-QTY-01, ${which})`,
      ).not.toContain("t");

      const formwork = onlyOffer(door.beamFormworkRail(beamInput(RCC_FORMWORK, { runs: unstated })), `the same beam (${which}), measured for formwork`);
      expect(formwork.coverage, `the same statement on the formwork row (${which})`).toBe(PARTIAL_DECLARED);
      expect([...formwork.omitted], `naming the side that was not stated, not the side that was (${which})`).toEqual([{ variable: unread, code: SLAB_THICKNESS_UNSTATED }]);
      expect(Object.keys(formwork.bindings), `which is therefore unbound (${which})`).not.toContain(unread);
      expect(formwork.bindings[stated]?.value, `while the side the drawing did state is bound as stated, as the side it is (${which})`).toBe(statedValue);
    }
  });

  test("AC-4: a beam with no run is not offered at all, and is reported by name", async () => {
    const door = await frameRailDoor();
    const objectKey = String(registerRow({ placementKey: BEAM_PLACEMENT, elementType: BEAM_CLASS, mark: BEAM_FAMILY })["objectKey"]);

    for (const [rail, kind] of [
      [door.beamConcreteRail, RCC_CONCRETE],
      [door.beamFormworkRail, RCC_FORMWORK],
    ] as readonly [FrameRailShape, string][]) {
      const answered = rail(beamInput(kind, { runs: {} }));
      expect([...answered.offers], `a beam whose run was never read is not measured at all — a figure is never guessed from a grid (L-MEA-09, ${kind})`).toEqual([]);
      expect([...answered.observations], `and the rail says exactly what it could not read, on the row it could not read it for (${kind})`).toEqual([
        { class: BEAM_CLASS, kind, code: RUN_UNREAD, objectKey, sourceEntity: BEAM_PLACEMENT },
      ]);
    }
  });

  test("AC-4: the three codes are the area's own, and every one of them is a registered refusal", async () => {
    const door = await frameRailDoor();
    const errors = await productModule<{ REFUSALS: Record<string, { code: string; message: string; remedy: string; severity: string; surface: string } | undefined> }>(ERRORS_MODULE);

    for (const code of [RUN_UNREAD, SLAB_THICKNESS_UNSTATED, LINTEL_SOURCE_ABSENT]) {
      expect([...door.FRAME_RAIL_CODES], `${code} stands in the area's closed code roster (interfaces)`).toContain(code);
      const entry = errors.REFUSALS[code];
      expect(entry, `${code} is registered in the one refusal register, with the sentence a reader is shown (L-AI-01)`).toBeTruthy();
      expect(typeof entry?.remedy, `and the remedy that tells them what to do about it (${code})`).toBe("string");
    }
  });

  test("AC-4: the area's rails compose per kind, the column's offer first", async () => {
    const door = await frameRailDoor();
    const columns = await productModule<{ columnConcreteRail: FrameRailShape }>(COLUMN_RAIL_MODULE);
    const roster = await frameRoster();

    const draft = beamDraft();
    const composed: FrameRailInputDraft = {
      ...draft,
      objects: [registerRow({ placementKey: COLUMN_PLACEMENT, elementType: COLUMN_CLASS, mark: COLUMN_FAMILY }), ...draft.objects],
      placements: { ...draft.placements, [COLUMN_PLACEMENT]: placementSetup({ placementKey: COLUMN_PLACEMENT, memberFamily: COLUMN_FAMILY }) },
      memberTypes: { [INGEST_ID]: { ...(draft.memberTypes?.[INGEST_ID] ?? {}), [COLUMN_FAMILY]: [variant({ variantKey: COLUMN_FAMILY, width: 300, depth: 450 })] } },
    };
    const input = frameRailInput(composed);

    const answered = door.frameConcreteRail(input);
    expect(answered.offers.length, `the composition offers the column and the beam — one member of the rail per class (interfaces). It observed ${JSON.stringify(answered.observations)}`).toBe(2);
    expect(answered.offers[0], "the column's offer, from the column rail, unchanged and first — the M2 rows do not move (AC-5)").toEqual(columns.columnConcreteRail(input).offers[0]);
    expect(answered.offers[1]?.ruleId, "and the beam's after it").toBe(BEAM_CONCRETE_RULE_ID);

    expect(roster[RCC_CONCRETE], "the area's roster answers the concrete composition for the concrete kind (AM-11)").toBe(door.frameConcreteRail);
    expect(roster[RCC_FORMWORK], "and the formwork composition for the formwork kind").toBe(door.frameFormworkRail);
  });

  test("AC-4: a lintel is offered from a scheduled opening and from nowhere else", async () => {
    const door = await frameRailDoor();
    const draft = beamDraft();
    const withLintel = frameRailInput({
      ...draft,
      objects: [registerRow({ placementKey: LINTEL_PLACEMENT, elementType: LINTEL_CLASS, mark: LINTEL_FAMILY })],
      placements: { [LINTEL_PLACEMENT]: placementSetup({ placementKey: LINTEL_PLACEMENT, memberFamily: LINTEL_FAMILY }) },
      runs: {},
    });

    for (const [rail, kind] of [
      [door.lintelConcreteRail, RCC_CONCRETE],
      [door.lintelFormworkRail, RCC_FORMWORK],
    ] as readonly [FrameRailShape, string][]) {
      expect(
        [...rail(withLintel).offers],
        `a lintel with no scheduled opening behind it is not measured: a lintel is never inferred from the wall it spans (${kind})`,
      ).toEqual([]);
    }
  });
});
