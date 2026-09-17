// L-MEA-03's finishes, as two rails: the plaster and the paint of one surface, each `gross − openings`
// over the same face.
//
// The two read the SAME surface and say the same thing about what is deducted from it — a plaster and
// a paint of one face are two work items of one geometry (R-TO-032) — so the reader is written once
// and the two rails differ only in the kind they measure, the rule they offer under and the facts
// that SELECT their item: a plaster is selected by its thickness, its mix, the face and the floor; a
// paint has no thickness and no mix, and is selected by the face and the floor alone (L-MEA-06).
//
// A surface that is not a closed outline defers by name and is never bounding-boxed, and a face with
// no schedule behind it is not measured at all: gross area would over-measure (L-MEA-02, L-MEA-03).
// A selecting fact nobody read leaves its key ABSENT and is reported beside the offer — the quantity
// still stands, and it is the ITEM that cannot be priced (L-QTY-03: the right number at the wrong
// rate is not a wrong number).
import type { Kind } from "@/core/catalogue/kinds";
import type { Measure, Offer, OmittedComponent, Rail, RailInput, RailObservation, RailSetup, RegisterObjectRow, SurfaceSetup } from "@/core/offers/contract";
import {
  FACE,
  FINISH_GROSS_UNSTATED,
  FLOOR,
  MIX,
  OPENING_SCHEDULE_ABSENT,
  POLYGON,
  SURFACE,
  SURFACE_NOT_CLOSED,
  THICKNESS,
  carried,
  observe,
  observeSelector,
  scheduleOf,
  sightingOf,
  surfaceOf,
  thresholdOf,
} from "./read";

/** The rules these rails offer under. An offer names a rule and never a version (L-MEA-08). */
export const PLASTER_RULE_ID = "finish.surface.plaster";
export const PAINT_RULE_ID = "finish.surface.paint";

/** The two kinds a surface bears (L-MEA-04's `bears`). */
const FINISH_PLASTER: Kind = "finish.plaster";
const FINISH_PAINT: Kind = "finish.paint";

/** The channel a finished face's openings are deducted through, and its own threshold (L-MEA-01). */
const FINISH_OPENING_CHANNEL = "finish_opening" as const;
const FINISH_OPENING_THRESHOLD_PARAMETER = "finishOpeningDeductionMinM2";

/** The variable the methods declare the face's gross area under (L-MEA-03). */
const GROSS = "gross";

/** What one finish is: the kind it measures, the rule it is measured by, and what selects its item. */
type Finish = {
  readonly kind: Kind;
  readonly ruleId: string;
  /** Whether the thickness and the mix select this item — a paint has neither (L-MEA-06). */
  readonly coated: boolean;
};

/**
 * The facts that select one finish's item, each carried as the reader wrote it — `12 mm`, never
 * `band: 2` (L-MEA-06: "store `clear height 6.2 m`, never `band: 3`").
 *
 * A fact nobody read leaves its key absent and is REPORTED: "defaults are barred from
 * quantity-determining attributes", and a selecting attribute nobody stated is the one thing a
 * default would hide (L-MEA-06, L-QTY-01).
 */
function selectorsOf(
  finish: Finish,
  stated: SurfaceSetup,
  row: RegisterObjectRow,
  sourceEntity: string,
): { readonly selectors: Record<string, Measure>; readonly reported: RailObservation[] } {
  const selectors: Record<string, Measure> = {};
  const reported: RailObservation[] = [];
  if (finish.coated) {
    for (const [name, reading] of [
      [THICKNESS, stated.thickness],
      [MIX, stated.mix],
    ] as const) {
      if (reading === null) reported.push(observeSelector(SURFACE, finish.kind, row, sourceEntity, name));
      else selectors[name] = carried(reading);
    }
  }
  selectors[FACE] = carried(stated.face);
  selectors[FLOOR] = carried(stated.floor);
  return { selectors, reported };
}

/**
 * A finish rail for one kind: every surface of the batch whose opening schedule was read and whose
 * outline closed, offered as the face net of what its schedule deducts.
 *
 * The order of the offers is the order of the rows it was handed — a rail sorts nothing.
 */
function finishRail(finish: Finish): Rail {
  return (input: RailInput) => {
    const setup: RailSetup = input.setup;
    const offers: Offer[] = [];
    const observations: RailObservation[] = [];

    for (const row of input.objects.filter((one) => one.elementType === SURFACE)) {
      const sighting = sightingOf(row, setup);
      if (!sighting.ok) {
        observations.push(observe(SURFACE, finish.kind, sighting.code, row, sighting.sourceEntity));
        continue;
      }
      const { placement, calibration } = sighting;

      // L-MEA-02: "a face with no schedule is not measured (gross area would over-measure)".
      const stated = surfaceOf(row.placementKey, setup);
      if (stated === undefined || stated.openings === null) {
        observations.push(observe(SURFACE, finish.kind, OPENING_SCHEDULE_ABSENT, row, placement.sourceEntity));
        continue;
      }

      // L-MEA-03: "a surface that is not a closed outline defers with a reason — never
      // bounding-boxed". So it is answered before the gross area is read at all: an outline that did
      // not close has no area to offer, whatever figure stands beside it.
      if (!stated.closed) {
        observations.push(observe(SURFACE, finish.kind, SURFACE_NOT_CLOSED, row, placement.sourceEntity));
        continue;
      }

      const schedule = scheduleOf(row, stated.openings, setup, FINISH_OPENING_CHANNEL);
      if (!schedule.ok) {
        for (const said of schedule.reported) observations.push(observe(SURFACE, finish.kind, said.code, row, said.sourceEntity));
        continue;
      }

      const bindings: Record<string, Measure> = {};
      const omitted: OmittedComponent[] = [];
      if (stated.gross === null) omitted.push({ variable: GROSS, code: FINISH_GROSS_UNSTATED });
      else bindings[GROSS] = carried(stated.gross);

      const selected = selectorsOf(finish, stated, row, placement.sourceEntity);
      observations.push(...selected.reported);

      offers.push({
        ruleId: finish.ruleId,
        kind: finish.kind,
        class: SURFACE,
        register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
        drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
        engine: placement.engine,
        // A closed outline is L-FRM-01's POLYGON, standing on the affirmed calibration of the view it
        // was read in (L-QTY-03).
        geometry: { type: POLYGON, basis: row.standing, calibration },
        // `openings` is bound by nobody here: the gate binds the sum of what its threshold deducted
        // (L-MEA-08, riskNotes (2)).
        bindings: { ...bindings, ...thresholdOf(setup, FINISH_OPENING_THRESHOLD_PARAMETER) },
        selectors: selected.selectors,
        deductions: schedule.candidates,
        omitted,
        coverage: omitted.length === 0 ? "COMPLETE" : "PARTIAL_DECLARED",
      });
    }

    return { offers, observations };
  };
}

/** The plaster of a surface: the face it covers, by the thickness and the mix it is laid in. */
export const plasterRail: Rail = finishRail({ kind: FINISH_PLASTER, ruleId: PLASTER_RULE_ID, coated: true });

/** The paint of a surface: the face it covers, selected by the face and the floor alone. */
export const paintRail: Rail = finishRail({ kind: FINISH_PAINT, ruleId: PAINT_RULE_ID, coated: false });
