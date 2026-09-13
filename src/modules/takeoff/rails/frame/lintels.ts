// R-TO-032's lintel, as a pair of rails: the concrete one lintel holds and the formwork it is cast
// against, both over the opening it spans plus its bearing at each end — `w + 2·bearing`.
//
// "A lintel is never inferred from the wall it spans": every reading a lintel is measured from is an
// opening schedule's own statement, so a placement the setup states no lintel for is REPORTED under
// `LINTEL_SOURCE_ABSENT` and measured by nobody (L-QTY-01). That is also why these rails ask no
// member-type schedule: a lintel's section stands in the schedule that states the opening, not in
// the member types a beam's family is read from.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { LintelSetup, Measure, Offer, Rail, RailInput, RailObservation, RailSetup } from "@/core/offers/contract";
import { measureOf, observe, PRISM_RECT, readSighting, rowsOfClass, selectorsOf, type Sighting } from "./member";

/** The one class these rails measure (L-MEA-08). */
const LINTEL: ElementType = "lintel";
const RCC_CONCRETE: Kind = "rcc.concrete";
const RCC_FORMWORK: Kind = "rcc.formwork";

/** The rules they offer under. An offer names a rule and never a version (L-MEA-08). */
export const LINTEL_CONCRETE_RULE_ID = "rcc.lintel.concrete";
export const LINTEL_FORMWORK_RULE_ID = "rcc.lintel.formwork";

/** The variables the two methods declare, by the names their templates spell them under. */
const COUNT = "count";
const WIDTH = "b";
const DEPTH = "D";
const OPENING = "w";
const BEARING = "bearing";

/** What one lintel row is offered from: where it was sighted, and the opening its schedule states. */
type LintelRead = { readonly row: RailInput["objects"][number]; readonly sighting: Sighting; readonly lintel: LintelSetup };

/** The five readings both lintel rules share, each carried in the unit its schedule cell stated. */
function bindingsOf(read: LintelRead): Record<string, Measure> {
  const { lintel } = read;
  return {
    // Unlike a drawn member, a lintel is counted by the schedule: it states how many openings of
    // this type the building holds, and the rail carries that count rather than minting one.
    [COUNT]: measureOf(lintel.count),
    [WIDTH]: measureOf(lintel.b),
    [DEPTH]: measureOf(lintel.D),
    [OPENING]: measureOf(lintel.w),
    [BEARING]: measureOf(lintel.bearing),
  };
}

/** The offer one read row stands to be measured by — the same five readings under either rule. */
function offerOf(read: LintelRead, setup: RailSetup, ruleId: string, kind: Kind): Offer {
  const { row, sighting } = read;
  const { placement, calibration } = sighting;
  return {
    ruleId,
    kind,
    class: LINTEL,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    geometry: { type: PRISM_RECT, basis: row.standing, calibration },
    bindings: bindingsOf(read),
    selectors: selectorsOf(placement, setup),
    // A lintel owns the length it bears into the wall; nothing is netted off it (L-MEA-09).
    deductions: [],
    // Every reading a lintel's description names is the schedule's, and a row reaches here only once
    // the schedule stated all five of them.
    omitted: [],
    coverage: "COMPLETE",
  };
}

/** Every lintel row of the batch, read against the setup — or reported by name (L-MEA-08). */
function readLintels(input: RailInput, kind: Kind): { readonly reads: readonly LintelRead[]; readonly observations: readonly RailObservation[] } {
  const reads: LintelRead[] = [];
  const observations: RailObservation[] = [];
  for (const row of rowsOfClass(input.objects, LINTEL)) {
    const sighted = readSighting(row, input.setup);
    if (!sighted.ok) {
      observations.push(observe(LINTEL, kind, sighted.code, row, sighted.sourceEntity));
      continue;
    }
    const lintel = input.setup.lintels[row.placementKey];
    if (lintel === undefined) {
      observations.push(observe(LINTEL, kind, "LINTEL_SOURCE_ABSENT", row, sighted.sighting.placement.sourceEntity));
      continue;
    }
    reads.push({ row, sighting: sighted.sighting, lintel });
  }
  return { reads, observations };
}

/** `rcc.lintel.concrete`: `count × b × D × (w + 2·bearing)` — the opening, plus a bearing each end. */
export const lintelConcreteRail: Rail = (input: RailInput) => {
  const { reads, observations } = readLintels(input, RCC_CONCRETE);
  return { offers: reads.map((read) => offerOf(read, input.setup, LINTEL_CONCRETE_RULE_ID, RCC_CONCRETE)), observations };
};

/** `rcc.lintel.formwork`: `count × (2·D + b) × (w + 2·bearing)` — two sides and a soffit, no top. */
export const lintelFormworkRail: Rail = (input: RailInput) => {
  const { reads, observations } = readLintels(input, RCC_FORMWORK);
  return { offers: reads.map((read) => offerOf(read, input.setup, LINTEL_FORMWORK_RULE_ID, RCC_FORMWORK)), observations };
};
