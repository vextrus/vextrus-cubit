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
  COLUMN_CIRCULAR_CONCRETE_RULE_ID,
  COLUMN_CLASS,
  COLUMN_CONCRETE_RULE_ID,
  COMPLETE,
  COUNT,
  DIAMETER_VARIABLE,
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
  PRISM_POLY,
  PRISM_RECT,
  RCC_CONCRETE,
  ROUND,
  SECTION_SOURCE,
  SET_REVISION,
  STOREY_HEIGHT_UNSTATED,
  TRANSCRIBED,
  VECTOR,
  VIEW_KEY,
  columnRailDoor,
  levelStanding,
  levelUnread,
  placement,
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

/** The placement the row was sighted at, as the setup carries it — one no plan note named. */
const PLACEMENT = placement({});

/** The section the schedule stated for that family: 300 × 450, in millimetres, read at one cell. */
const VARIANT = variant({ variantKey: MEMBER_FAMILY, width: 300, depth: 450, unit: "mm", sourceKeys: [SECTION_SOURCE] });

/** The same placement, with a plan note over it calling the section ROUND (I-303, I-304). */
const NOTED_ROUND = placement({ noteShape: ROUND });

/** And the section such a schedule states: one cell, two EQUAL sides — b = d = 450 (I-304). */
const SQUARE_CELL = variant({ variantKey: MEMBER_FAMILY, width: 450, depth: 450, unit: "mm", sourceKeys: [SECTION_SOURCE] });

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

describe("AC-1: one column instance, one offer in the shape the plan says it is", () => {
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

  test("AC-1: the roster answers this kind with a rail that answers the column exactly as this one does", async () => {
    const rail = await columnRailDoor();
    const rails = await railsRoster();
    const roster = rails[RCC_CONCRETE];

    expect(roster, `\`RAILS\` carries the entry ${RCC_CONCRETE} — a rail is selected per quantity kind, never per drawing (L-MEA-08, interfaces)`).toBeTypeOf("function");

    // The kind's entry is no longer this rail itself: the FRAME area composes the per-class rails of
    // `rcc.concrete` into one, and this rail is its first member. What the roster answers ABOUT THE
    // COLUMN is therefore graded by what it answers — the offers whole, and the silence beside them —
    // rather than by which function object it is. A composition that dropped, reordered or altered
    // the column's answer is caught here. What the composition says about a class of its OWN is that
    // class's leaf to state, and is not a change to this one (L-MEA-08, L-QTY-02).
    const answered = roster?.(input());
    const alone = rail.columnConcreteRail(input());
    expect(answered?.offers, `and for a column row it answers the column rail's own offers, unchanged by the composition (L-MEA-08)`).toEqual(alone.offers);
    expect(
      answered?.observations.filter((one) => one.class === COLUMN_CLASS),
      `and says about the column exactly what the column rail said about it, and nothing beside it`,
    ).toEqual(alone.observations);
  });
});

/**
 * The offer the same instance stands to be measured by once a plan note has called it round: the
 * circular rule, PRISM_POLY, and a DIAMETER where the rectangle bound two sides — and every other
 * field of it what it was, because the shape is the only thing that moved (I-304, I-305).
 */
const ROUND_OFFER: ColumnOfferShape = {
  ...OFFER,
  ruleId: COLUMN_CIRCULAR_CONCRETE_RULE_ID,
  geometry: { type: PRISM_POLY, basis: MEASURED, calibration: CALIBRATION_KEY },
  bindings: {
    [COUNT]: { value: "1", unit: PIECES, basis: MEASURED, source: PLACEMENT_KEY, calibration: CALIBRATION_KEY },
    // The FIGURE and its unit are the schedule cell's, because the note carries neither — a unitless
    // section is what `SECTION_UNIT_UNSTATED` already refuses (L-REG-01). What the note contributes
    // is that this 450 is a diameter rather than a side (I-304).
    [DIAMETER_VARIABLE]: { value: "450", unit: "mm", basis: TRANSCRIBED, source: SECTION_SOURCE },
    [HEIGHT_VARIABLE]: { value: "3", unit: "M", basis: TRANSCRIBED, source: HEIGHT_SOURCE },
  },
};

describe("I-304/I-305: a column the plan calls round is a PRISM_POLY billed by its own rule", () => {
  test("the rail answers exactly the circular offer, and observes nothing", async () => {
    const rail = await columnRailDoor();
    const batch = rail.columnConcreteRail(
      input({ placements: { [PLACEMENT_KEY]: NOTED_ROUND }, memberTypes: { [INGEST_ID]: { [MEMBER_FAMILY]: [SQUARE_CELL] } } }),
    );

    expect(
      [...batch.observations],
      "the plan states the SHAPE and the schedule states the SIZE, and b = d = 450 either way — there is no disagreement here to report (I-304, L-REG-03)",
    ).toEqual([]);
    expect(batch.offers.length, "one instance row on one level is still one offer — the shape changes what is measured, never how many (L-FRM-02)").toBe(1);
    expect(
      batch.offers[0],
      "a circle is a prism over a plan that is no rectangle, offered under the rule whose template prints the quarter of π d² a reader audits (I-305, L-FRM-01)",
    ).toEqual(ROUND_OFFER);
  });

  test("it binds a diameter and no sides, and is COMPLETE", async () => {
    const rail = await columnRailDoor();
    const offered = rail.columnConcreteRail(
      input({ placements: { [PLACEMENT_KEY]: NOTED_ROUND }, memberTypes: { [INGEST_ID]: { [MEMBER_FAMILY]: [SQUARE_CELL] } } }),
    ).offers[0] as ColumnOfferShape;

    expect(
      Object.keys(offered.bindings).sort(),
      "a circle declares `count`, `d` and `H` — an `L` or a `B` beside them would be a variable its method does not name (I-305, L-MEA-08)",
    ).toStrictEqual([COUNT, DIAMETER_VARIABLE, HEIGHT_VARIABLE].sort());
    expect([...offered.omitted], "nothing is left out: the schedule stated the section and the stack stated the storey (L-QTY-02)").toEqual([]);
    expect(offered.coverage, "so the row publishes whole").toBe(COMPLETE);
  });

  test("a placement no note named is untouched — the rectangular offer does not move a byte", async () => {
    const rail = await columnRailDoor();
    const offered = rail.columnConcreteRail(input()).offers[0] as ColumnOfferShape;

    expect(
      offered,
      "the shape is stated by a note and by nothing else, so a member no note named is measured exactly as it was before this reading landed (I-304, AM-01)",
    ).toEqual(OFFER);
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
