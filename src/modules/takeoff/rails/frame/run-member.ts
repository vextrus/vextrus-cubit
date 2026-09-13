// L-MEA-09's horizontal members, as rails: a beam and a tie/grade beam, each measured along the RUN
// the partition read for it — "clear between support faces and below the slab soffit".
//
// The four rails this file builds differ in three facts and in nothing else: the class they measure,
// the rule and kind they offer under, and what they do with the slab each side adjoins. So the
// reading is written once and the facts are handed in (B-17): a beam's concrete takes the THICKER
// adjoining slab off its depth, a beam's formwork takes each side off its own face, and a tie beam
// adjoins no slab at all, so nothing comes off it.
//
// The rail is pure: everything it reads arrives in its argument, it reaches no store and no clock,
// and the same input twice answers deep-equal batches (L-MEA-08). It computes nothing — the figure
// is the method's, over bindings the gate carries into canonical units.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { Measure, Offer, OmittedComponent, Rail, RailInput, RailObservation, ReadingSetup, RegisterObjectRow } from "@/core/offers/contract";
import { CANONICAL_UNIT } from "@/core/units/canon";
import { CLEAR, COUNT, DEPTH, LEFT, ONE, PRISM_RECT, RIGHT, THICKNESS, WIDTH, observe, runOf, sectionOf, sightingOf } from "./read";

/** The item-selecting attribute a concrete line is priced by, where a reader stated one (L-QTY-03). */
const GRADE = "grade";

/**
 * What a rail does with the two slabs a member's sides adjoin (L-MEA-09):
 *   · `thicker` — the concrete of a beam: one `t`, the thicker of the two, so the beam owns exactly
 *     the depth below the soffit the slab does not. Neither side read is no `t` at all.
 *   · `each` — the formwork of a beam: each side's face is its own, because an edge beam is open on
 *     one side and buried under a slab on the other.
 *   · `none` — a tie beam, which adjoins no slab: nothing comes off its depth.
 */
export type SidePolicy = "thicker" | "each" | "none";

/** What one of these rails is: the class it measures, the rule and kind it offers under, and the sides. */
export type RunMemberRail = {
  readonly class: ElementType;
  readonly ruleId: string;
  readonly kind: Kind;
  readonly sides: SidePolicy;
};

/** One side's reading as an offer carries one: the view's own calibration stands behind it. */
function carried(reading: ReadingSetup, calibration: string): Measure {
  return { value: reading.value, unit: reading.unit, basis: reading.basis, source: reading.source, calibration };
}

/** The thicker of the two adjoining slabs, as a reading — a SELECTION between what two sides stated. */
function thickerOf(sides: readonly [ReadingSetup | null, ReadingSetup | null]): ReadingSetup | null {
  const [left, right] = sides;
  // Neither side read is no thickness at all: the thicker of one stated reading and one silence is
  // not the stated one, because nobody knows what the silent side holds (L-QTY-01).
  if (left === null || right === null) return null;
  return Number(right.value) > Number(left.value) ? right : left;
}

/**
 * A rail for one (class × kind) measured along a run: every instance of its class in the batch,
 * offered as a rectangular prism over the clear run the partition read for its placement.
 *
 * The order of the offers is the order of the rows it was handed — a rail sorts nothing, so what it
 * answers is a function of what it was given and of nothing else.
 */
export function runMemberRail(declared: RunMemberRail): Rail {
  return (input: RailInput) => {
    const setup = input.setup;
    const offers: Offer[] = [];
    const observations: RailObservation[] = [];
    const report = (code: Parameters<typeof observe>[2], row: RegisterObjectRow, sourceEntity: string): void => {
      observations.push(observe(declared.class, declared.kind, code, row, sourceEntity));
    };

    for (const row of input.objects.filter((one) => one.elementType === declared.class)) {
      const sighting = sightingOf(row, setup);
      if (!sighting.ok) {
        report(sighting.code, row, sighting.sourceEntity);
        continue;
      }
      const { placement, calibration } = sighting;

      const section = sectionOf(row, placement, setup);
      if (!section.ok) {
        report(section.code, row, section.sourceEntity ?? placement.sourceEntity);
        continue;
      }

      // A run nobody read is a member this rail will not measure: the grid-to-grid span is not the
      // clear run, and a figure is never guessed from a grid (L-MEA-09).
      const run = runOf(row.placementKey, setup);
      if (run === undefined) {
        report("RUN_UNREAD", row, placement.sourceEntity);
        continue;
      }

      // An expanded object's geometry on a level not drawn carries DERIVED, and one read off the
      // drawing carries MEASURED: the register row's own standing IS that distinction, and the rail
      // carries it rather than re-deciding it (L-QTY-01, L-REG-03).
      const basis = row.standing;
      const bindings: Record<string, Measure> = {
        [COUNT]: { value: ONE, unit: CANONICAL_UNIT.COUNT, basis, source: placement.sourceEntity, calibration },
        [WIDTH]: section.width,
        [DEPTH]: section.depth,
        [CLEAR]: carried(run.clear as ReadingSetup, calibration),
      };
      const omitted: OmittedComponent[] = [];

      if (declared.sides === "thicker") {
        const thicker = thickerOf(run.sides);
        // "A row kept with no quantity is PARTIAL_DECLARED, never COMPLETE" (L-QTY-02): an unread
        // thickness is never a zero, so the variable is not bound and the omission is enumerated.
        if (thicker === null) omitted.push({ variable: THICKNESS, code: "SLAB_THICKNESS_UNSTATED" });
        else bindings[THICKNESS] = carried(thicker, calibration);
      }
      if (declared.sides === "each") {
        for (const [at, variable] of [[0, LEFT] as const, [1, RIGHT] as const]) {
          const side = run.sides[at];
          if (side === null) omitted.push({ variable, code: "SLAB_THICKNESS_UNSTATED" });
          else bindings[variable] = carried(side, calibration);
        }
      }

      const grade = setup.grades[placement.drawingId];
      offers.push({
        ruleId: declared.ruleId,
        kind: declared.kind,
        class: declared.class,
        register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
        drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
        engine: placement.engine,
        geometry: { type: PRISM_RECT, basis, calibration },
        bindings,
        // A grade selects the concrete item a line is priced under; formwork is not priced by the
        // grade of what is cast against it, so it carries none (L-QTY-03).
        selectors: grade === undefined || declared.kind !== "rcc.concrete" ? {} : { [GRADE]: grade },
        // A beam nets nothing: the junction it does not own is the other member's, and the run it
        // was handed is already clear of it (L-MEA-09).
        deductions: [],
        omitted,
        coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
      });
    }

    return { offers, observations };
  };
}
