/**
 * I-334 — the plan a foundation is measured over: THE PLAN STATES THE SHAPE, THE SCHEDULE THE SIZE
 * (I-304 for foundations; L-FRM-02, L-QTY-04).
 *
 * Where the placement stage read the member's ring, the ring governs: a polygon is measured over its
 * own shoelace and never over the schedule's rectangle, and a rectangle over the schedule's own
 * sides only where they are the sides the ring was drawn with — otherwise over the ring's. Where no
 * ring was read, the schedule's section is the plan, as it always was.
 *
 * PURE, in the unit lane: hand-built rail inputs through the shipped rail door, one reading varied at
 * a time. What the drawing does is graded in tests/takeoff/partition/placement/bnbc-pile-caps.test.ts.
 */
import { describe, expect, test } from "vitest";
import {
  CALIBRATION_KEY,
  INGEST_ID,
  MEASURED,
  MILLIMETRE,
  MILLIMETRE_SQUARED,
  PILE_CAP,
  PRISM_POLY,
  PRISM_RECT,
  RCC_CONCRETE,
  SECTION_SOURCE,
  TRANSCRIBED,
  foundationsRailDoor,
  outline,
  placement,
  railInput,
  reading,
  registerRow,
  variant,
  type OutlineSetup,
  type RailInputShape,
} from "./support/foundations-contract";

const PLACEMENT = "PLACEMENT:S-06:PC2:4572:-199775";
const RING = "S-06:e:5AF";

/** One pile cap, its ring read as the case states, its schedule stating the section it states. */
function capOver(ring: OutlineSetup | null, section: { width: number; depth: number; unit?: string } | null): RailInputShape {
  return railInput({
    kind: RCC_CONCRETE,
    objects: [registerRow({ placementKey: PLACEMENT, elementType: PILE_CAP, mark: "PC2" })],
    placements: { [PLACEMENT]: placement({ memberFamily: "PC2", sourceEntity: PLACEMENT, outline: ring }) },
    memberTypes: {
      [INGEST_ID]: {
        PC2: [variant({ variantKey: "SIZE", width: section?.width ?? null, depth: section?.depth ?? null, unit: section === null ? null : (section.unit ?? MILLIMETRE), dimensions: { depth: reading("1295", MILLIMETRE, { basis: TRANSCRIBED, source: "S-06:e:642" }) } })],
      },
    },
  });
}

const polygon = (): OutlineSetup => outline({ type: PRISM_POLY, area: reading("3262500.0", MILLIMETRE_SQUARED, { source: RING }) });
const rectangle = (long: string, short: string, unit = MILLIMETRE): OutlineSetup =>
  outline({ type: PRISM_RECT, area: reading("2000000.0", MILLIMETRE_SQUARED, { source: RING }), length: reading(long, unit, { source: RING }), breadth: reading(short, unit, { source: RING }) });

/** The one concrete offer a case makes. */
async function offerOf(input: RailInputShape) {
  const door = await foundationsRailDoor();
  const batch = door.foundationConcreteRail(input);
  expect(batch.offers.length, `one offer (observations: ${JSON.stringify(batch.observations)})`).toBe(1);
  return batch.offers[0] as { ruleId: string; geometry: { type: string }; bindings: Record<string, { value: string; unit: string; basis: string; source: string; calibration?: string }> };
}

describe("I-334: a read ring governs the plan; the schedule's section corroborates it", () => {
  test("a polygon ring is measured over its own shoelace, never over the schedule's 2100 × 1750", async () => {
    const offer = await offerOf(capOver(polygon(), { width: 2100, depth: 1750 }));
    expect([offer.ruleId, offer.geometry.type], "the polygon prism").toEqual(["rcc.foundation.prism_poly", PRISM_POLY]);
    expect(offer.bindings["A"], "A is the ring's, measured, on the view's affirmed calibration").toEqual({ value: "3262500.0", unit: MILLIMETRE_SQUARED, basis: MEASURED, source: RING, calibration: CALIBRATION_KEY });
    expect(offer.bindings["L"], "no rectangle stands beside it").toBeUndefined();
  });

  test("a rectangle the schedule's section corroborates binds the schedule's own print — the turned PC1, by its own sides", async () => {
    const offer = await offerOf(capOver(rectangle("2000.0", "1000.0"), { width: 2000, depth: 1000 }));
    expect([offer.bindings["L"]?.value, offer.bindings["B"]?.value, offer.bindings["L"]?.basis, offer.bindings["L"]?.source], "the SIZE cell, transcribed — the figure the ring was drawn to").toEqual(["2000", "1000", TRANSCRIBED, SECTION_SOURCE]);
  });

  test("corroboration is either way round and within the half-unit the schedule printed to", async () => {
    const turned = await offerOf(capOver(rectangle("1000.0", "2000.0"), { width: 2000, depth: 1000 }));
    expect(turned.bindings["L"]?.basis, "a ring whose long side is its second is the same rectangle").toBe(TRANSCRIBED);
    const nudged = await offerOf(capOver(rectangle("2000.4", "999.6"), { width: 2000, depth: 1000 }));
    expect(nudged.bindings["L"]?.basis, "a side drawn inside `2000`'s half-unit IS the side it states").toBe(TRANSCRIBED);
  });

  test("a rectangle the schedule does not corroborate — or states in another unit — is measured over the ring's own sides", async () => {
    const disagreeing = await offerOf(capOver(rectangle("2000.0", "2000.0"), { width: 2000, depth: 1000 }));
    expect([disagreeing.bindings["L"]?.value, disagreeing.bindings["B"]?.value, disagreeing.bindings["B"]?.basis, disagreeing.bindings["B"]?.calibration], "the drawn 2000 × 2000, measured").toEqual(["2000.0", "2000.0", MEASURED, CALIBRATION_KEY]);
    const inches = await offerOf(capOver(rectangle("2000.0", "1000.0"), { width: 78.74, depth: 39.37, unit: "in" }));
    expect(inches.bindings["L"]?.basis, "a comparison across units would be a conversion, and a rail converts nothing").toBe(MEASURED);
  });

  test("a ring and no section is measured by the ring; a section and no ring is the section, as it always was", async () => {
    const ringOnly = await offerOf(capOver(rectangle("2000.0", "1000.0"), null));
    expect([ringOnly.bindings["L"]?.value, ringOnly.bindings["L"]?.basis], "the ring's own side").toEqual(["2000.0", MEASURED]);
    const sectionOnly = await offerOf(capOver(null, { width: 2000, depth: 1000 }));
    expect([sectionOnly.ruleId, sectionOnly.bindings["L"]?.value, sectionOnly.bindings["L"]?.basis], "the schedule's rectangle").toEqual(["rcc.foundation.prism_rect", "2000", TRANSCRIBED]);
  });
});
