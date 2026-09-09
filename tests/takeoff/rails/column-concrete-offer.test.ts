/**
 * AC-1 and AC-4's rail half — `columnConcreteRail` as a PURE function (R-TO-031, L-MEA-08, L-FRM-02).
 *
 * A rail "is a pure function returning `{ offers, observations }`" that "reaches no store and no
 * clock", so it is driven here with nothing but the register rows and the read-only setup the
 * interfaces spell: no database, no campaign, no fixture. What it answers is compared whole, because
 * L-MEA-08 has an offer carry "no field where a computed value could land" — an extra own key is as
 * much a defect as a wrong one.
 */
import { describe, expect, test } from "vitest";
import {
  BREADTH_VARIABLE,
  CALIBRATION_KEY,
  COLUMN_CLASS,
  COLUMN_CONCRETE_RULE_ID,
  COMPLETE,
  COUNT,
  DRAWING_ID,
  HEIGHT_SOURCE,
  HEIGHT_VARIABLE,
  INGEST_ID,
  LENGTH_VARIABLE,
  LEVEL_ID,
  MEASURED,
  MEMBER_FAMILY,
  PARTIAL_DECLARED,
  PIECES,
  PLACEMENT_KEY,
  PRISM_RECT,
  RCC_CONCRETE,
  SECTION_SOURCE,
  SET_REVISION,
  STOREY_HEIGHT_UNSTATED,
  TRANSCRIBED,
  VECTOR,
  VIEW_KEY,
  columnRailDoor,
  levelStanding,
  levelUnread,
  railInput,
  railsRoster,
  reading,
  registerRow,
  variant,
  type ColumnOfferShape,
  type MeasureShape,
  type RailInputDraft,
  type RailInputShape,
} from "./support/column-rail-stage";

/** The one register row the criterion describes: a column instance standing on level L1. */
const ROW = registerRow({ setRevisionId: SET_REVISION, placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, viewKey: VIEW_KEY, mark: MEMBER_FAMILY });

/** The key that row stands under — its own, never one this file mints beside it (L-REG-04). */
const OBJECT_KEY = String(ROW["objectKey"]);

/** The placement the row was sighted at, as the setup carries it. */
const PLACEMENT = {
  drawingId: DRAWING_ID,
  ingestId: INGEST_ID,
  viewKey: VIEW_KEY,
  memberFamily: MEMBER_FAMILY,
  engine: VECTOR,
  sourceEntity: PLACEMENT_KEY,
};

/** The section the schedule stated for that family: 300 × 450, in millimetres, read at one cell. */
const VARIANT = variant({ variantKey: MEMBER_FAMILY, width: 300, depth: 450, unit: "mm", sourceKeys: [SECTION_SOURCE] });

/** The input the criterion spells, with only what a case changes named beside it. */
function input(changed: Partial<RailInputDraft> = {}): RailInputShape {
  return railInput({
    objects: [ROW],
    placements: { [PLACEMENT_KEY]: PLACEMENT },
    memberTypes: { [INGEST_ID]: { [MEMBER_FAMILY]: [VARIANT] } },
    levels: [levelStanding({ levelId: LEVEL_ID, label: "L1", ordinal: 1, value: "3", unit: "M", sourceKey: HEIGHT_SOURCE })],
    calibrations: { [INGEST_ID]: { [VIEW_KEY]: CALIBRATION_KEY } },
    ...changed,
  });
}

/** The offer AC-1 spells, whole — every key it carries and no key it does not. */
const OFFER: ColumnOfferShape = {
  ruleId: COLUMN_CONCRETE_RULE_ID,
  kind: RCC_CONCRETE,
  class: COLUMN_CLASS,
  register: { setRevisionId: SET_REVISION, objectKey: OBJECT_KEY },
  drawing: { drawingId: DRAWING_ID, viewKey: VIEW_KEY },
  engine: VECTOR,
  geometry: { type: PRISM_RECT, basis: MEASURED, calibration: CALIBRATION_KEY },
  bindings: {
    [COUNT]: { value: "1", unit: PIECES, basis: MEASURED, source: PLACEMENT_KEY, calibration: CALIBRATION_KEY },
    [LENGTH_VARIABLE]: { value: "300", unit: "mm", basis: TRANSCRIBED, source: SECTION_SOURCE },
    [BREADTH_VARIABLE]: { value: "450", unit: "mm", basis: TRANSCRIBED, source: SECTION_SOURCE },
    [HEIGHT_VARIABLE]: { value: "3", unit: "M", basis: TRANSCRIBED, source: HEIGHT_SOURCE },
  },
  selectors: {},
  deductions: [],
  omitted: [],
  coverage: COMPLETE,
};

/** Every key spelled anywhere inside a value, however deeply nested. */
function keysWithin(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => keysWithin(item));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, held]) => [key, ...keysWithin(held)]);
}

describe("AC-1: one column instance, one PRISM_RECT offer", () => {
  test("AC-1: the rail answers exactly the offer the criterion spells, and observes nothing", async () => {
    const rail = await columnRailDoor();
    const batch = rail.columnConcreteRail(input());

    expect(
      [...batch.observations],
      "a row whose placement, section, height and calibration all stand leaves the rail nothing to report (L-MEA-08)",
    ).toEqual([]);
    expect(batch.offers.length, "one instance row on one level is one offer — the rail expands per (row, level) and never per drawing (L-FRM-02)").toBe(1);
    expect(batch.offers[0], "the offer carries the register reference, the view it was read in, its bindings and its calibration, and nothing else (AC-1)").toEqual(OFFER);
  });

  test("AC-1: the offer names no version anywhere and carries no computed field", async () => {
    const rail = await columnRailDoor();
    const offered = rail.columnConcreteRail(input()).offers[0] as ColumnOfferShape;

    expect(
      Object.keys(offered).sort(),
      "the offer's own keys are the contract's own keys — nothing beside them (L-MEA-08: no field where a computed value could land)",
    ).toStrictEqual(Object.keys(OFFER).sort());
    for (const forbidden of ["version", "ruleVersion", "volume", "total", "quantity"]) {
      expect(
        keysWithin(offered),
        `an offer names a rule and never a version, and computes nothing — it carries no \`${forbidden}\` at any depth (L-MEA-08, AC-1)`,
      ).not.toContain(forbidden);
    }

    // A reading is the one place `value` belongs: L-MEA-08 spells every binding and selector
    // `{ value, unit, basis, source, calibration? }`, so each carries those four and nothing
    // beside them — which is where a computed field would otherwise be smuggled in.
    for (const [name, held] of [...Object.entries(offered.bindings), ...Object.entries(offered.selectors)]) {
      const keys = Object.keys(held).sort();
      expect(
        keys.filter((key) => !["value", "unit", "basis", "source", "calibration"].includes(key)),
        `the reading bound to \`${name}\` is a raw reading with its unit, basis and source — no key beside them (L-MEA-08, L-QTY-03)`,
      ).toEqual([]);
      expect(
        ["value", "unit", "basis", "source"].filter((key) => !keys.includes(key)),
        `and it is whole: \`${name}\` states its value, unit, basis and source (L-MEA-08)`,
      ).toEqual([]);
    }
  });

  test("AC-1: the rail is pure — the same input twice answers deep-equal batches", async () => {
    const rail = await columnRailDoor();
    const first = rail.columnConcreteRail(input());
    const second = rail.columnConcreteRail(input());

    expect(second, "a rail is a pure function of what it was handed: it reaches no store and no clock (L-MEA-08)").toEqual(first);
  });

  test("AC-1: a grade the setup states is the offer's `grade` selector, and an unstated one leaves the selectors empty", async () => {
    const rail = await columnRailDoor();
    const grade: MeasureShape = reading("M25", "grade", { basis: TRANSCRIBED, source: "S-101:e:9" });

    const withGrade = rail.columnConcreteRail(input({ grades: { [DRAWING_ID]: grade } })).offers[0] as ColumnOfferShape;
    expect(withGrade.selectors, "the item-selecting attribute is carried onto the line beside the derivation (L-QTY-03)").toEqual({ grade });

    const without = rail.columnConcreteRail(input()).offers[0] as ColumnOfferShape;
    expect(without.selectors, "and where the drawing's general notes stated no grade, nothing is selected by (scope: `setup.grades` is a seam)").toEqual({});
  });

  test("AC-1: the roster answers this kind with this rail", async () => {
    const rail = await columnRailDoor();
    const rails = await railsRoster();

    expect(rails[RCC_CONCRETE], `\`RAILS\` gains the entry ${RCC_CONCRETE} — a rail is selected per quantity kind (L-MEA-08, interfaces)`).toBe(rail.columnConcreteRail);
  });
});

describe("AC-4: a level with no storey height is a row with no quantity", () => {
  test("AC-4: the offer is PARTIAL_DECLARED, binds count, L and B, and enumerates H as omitted", async () => {
    const rail = await columnRailDoor();
    const batch = rail.columnConcreteRail(input({ levels: [levelUnread({ levelId: LEVEL_ID, label: "L1", ordinal: 1 })] }));

    expect(batch.offers.length, "a level whose height nobody read is still a row — it is kept, with no quantity (L-QTY-02)").toBe(1);
    const offered = batch.offers[0] as ColumnOfferShape;
    expect(offered.coverage, "a row kept with no quantity is PARTIAL_DECLARED, never COMPLETE (L-QTY-02)").toBe(PARTIAL_DECLARED);
    expect(
      Object.keys(offered.bindings).sort(),
      "what was read is still bound — the count and the section the schedule stated — and the height is not invented (L-MEA-07)",
    ).toStrictEqual([BREADTH_VARIABLE, COUNT, LENGTH_VARIABLE].sort());
    expect([...offered.omitted], "and every omitted component is enumerated on the row, by name and by code (L-QTY-02)").toEqual([
      { variable: HEIGHT_VARIABLE, code: STOREY_HEIGHT_UNSTATED },
    ]);
  });
});
