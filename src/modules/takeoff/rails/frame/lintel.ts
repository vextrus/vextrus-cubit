// L-MEA-09's lintel, as a rail: the concrete over one scheduled opening, and the formwork it is cast
// against.
//
// A lintel is read from the sighting and then from the OPENING SCHEDULE, and from nowhere else: its
// five readings — the count, the section, the opening's width and the bearing at each end — are all
// the schedule's, so a placement no schedule stands behind is reported `LINTEL_SOURCE_ABSENT` rather
// than measured from the wall it spans (R-TO-032, settled reading). It does not read the member
// types at all, which is why a lintel whose mark no member-type schedule names is never reported
// MEMBER_TYPE_UNKNOWN — that would be a code about the wrong silence.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { LintelSetup, Measure, Offer, Rail, RailInput, RailObservation, ReadingSetup } from "@/core/offers/contract";
import { COUNT, DEPTH, PRISM_RECT, WIDTH, observe, sightingOf } from "./read";

/** The class these rails measure (L-MEA-04's roster). */
const LINTEL: ElementType = "lintel";

/** The two readings of the opening a lintel spans, by the names its methods' templates spell them. */
const OPENING = "w";
const BEARING = "bearing";

/** One cell of the schedule as an offer carries it: transcribed, on the view's own calibration. */
function carried(reading: ReadingSetup, calibration: string): Measure {
  return { value: reading.value, unit: reading.unit, basis: reading.basis, source: reading.source, calibration };
}

/** Every reading a lintel is measured from, bound by the name its method declares it under. */
function bindingsOf(stated: LintelSetup, calibration: string): Record<string, Measure> {
  return {
    [COUNT]: carried(stated.count, calibration),
    [WIDTH]: carried(stated.b, calibration),
    [DEPTH]: carried(stated.D, calibration),
    [OPENING]: carried(stated.w, calibration),
    [BEARING]: carried(stated.bearing, calibration),
  };
}

/**
 * A lintel rail for one kind: every lintel instance of the batch whose opening a schedule states,
 * offered as a rectangular prism over the opening plus its bearings.
 *
 * The order of the offers is the order of the rows it was handed — a rail sorts nothing.
 */
export function lintelRail(declared: { readonly ruleId: string; readonly kind: Kind }): Rail {
  return (input: RailInput) => {
    const setup = input.setup;
    const offers: Offer[] = [];
    const observations: RailObservation[] = [];

    for (const row of input.objects.filter((one) => one.elementType === LINTEL)) {
      const sighting = sightingOf(row, setup);
      if (!sighting.ok) {
        observations.push(observe(LINTEL, declared.kind, sighting.code, row, sighting.sourceEntity));
        continue;
      }
      const { placement, calibration } = sighting;

      const stated = setup.lintels[row.placementKey];
      if (stated === undefined) {
        observations.push(observe(LINTEL, declared.kind, "LINTEL_SOURCE_ABSENT", row, placement.sourceEntity));
        continue;
      }

      offers.push({
        ruleId: declared.ruleId,
        kind: declared.kind,
        class: LINTEL,
        register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
        drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
        engine: placement.engine,
        geometry: { type: PRISM_RECT, basis: row.standing, calibration },
        bindings: bindingsOf(stated, calibration),
        selectors: {},
        deductions: [],
        // Every reading a lintel is measured from comes from the one schedule that states it, so an
        // entry the setup holds states all five or the schedule was never read at all (L-QTY-02).
        omitted: [],
        coverage: "COMPLETE",
      });
    }

    return { offers, observations };
  };
}
