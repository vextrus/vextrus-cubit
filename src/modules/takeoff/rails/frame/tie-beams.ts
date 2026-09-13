// L-MEA-09's tie/grade beam, as a pair of rails: the concrete it holds and the formwork it is cast
// against, both over the RUN the partition read clear between the faces of the footings or pile caps
// carrying its ends — those own the junction, by the precedence pile › pile cap › column / shear
// wall › beam › slab.
//
// A tie beam adjoins no slab, so no side is read and nothing is taken off its depth: it stands in
// the FOUNDATION slot under the building rather than on a storey of it, and its register row says so
// by carrying no level (L-REG-02).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import type { Measure, Offer, Rail, RailInput, RailObservation, RailSetup, ReadingSetup, RunSetup } from "@/core/offers/contract";
import { CANONICAL_UNIT } from "@/core/units/canon";
import { measureOf, observe, ONE, PRISM_RECT, readMember, rowsOfClass, selectorsOf, type MemberRead } from "./member";

/** The one class these rails measure (L-MEA-08). */
const TIE_BEAM: ElementType = "tie_beam";
const RCC_CONCRETE: Kind = "rcc.concrete";
const RCC_FORMWORK: Kind = "rcc.formwork";

/** The rules they offer under. An offer names a rule and never a version (L-MEA-08). */
export const TIE_BEAM_CONCRETE_RULE_ID = "rcc.tie_beam.concrete";
export const TIE_BEAM_FORMWORK_RULE_ID = "rcc.tie_beam.formwork";

/** The variables the two methods declare, by the names their templates spell them under. */
const COUNT = "count";
const WIDTH = "b";
const DEPTH = "D";
const CLEAR = "clear";

/** What one tie-beam row is offered from, once its run has been found beside its member reading. */
type TieBeamRead = { readonly member: MemberRead; readonly run: RunSetup };

/** The offer one read row stands to be measured by — the same four readings under either rule. */
function offerOf(read: TieBeamRead, setup: RailSetup, ruleId: string, kind: Kind): Offer {
  const { row, placement, calibration, section } = read.member;
  const bindings: Record<string, Measure> = {
    [COUNT]: { value: ONE, unit: CANONICAL_UNIT.COUNT, basis: row.standing, source: placement.sourceEntity, calibration },
    [WIDTH]: section.width,
    [DEPTH]: section.depth,
    [CLEAR]: measureOf(read.run.clear as ReadingSetup, calibration),
  };
  return {
    ruleId,
    kind,
    class: TIE_BEAM,
    register: { setRevisionId: row.setRevisionId, objectKey: row.objectKey },
    drawing: { drawingId: placement.drawingId, viewKey: placement.viewKey },
    engine: placement.engine,
    geometry: { type: PRISM_RECT, basis: row.standing, calibration },
    bindings,
    selectors: selectorsOf(placement, setup),
    deductions: [],
    // Nothing of a tie beam's description goes unmeasured once its run is read: it declares no side.
    omitted: [],
    coverage: "COMPLETE",
  };
}

/** Every tie-beam row of the batch, read against the setup — or reported by name (L-MEA-08). */
function readTieBeams(input: RailInput, kind: Kind): { readonly reads: readonly TieBeamRead[]; readonly observations: readonly RailObservation[] } {
  const reads: TieBeamRead[] = [];
  const observations: RailObservation[] = [];
  for (const row of rowsOfClass(input.objects, TIE_BEAM)) {
    const member = readMember(row, input.setup);
    if (!member.ok) {
      observations.push(observe(TIE_BEAM, kind, member.code, row, member.sourceEntity));
      continue;
    }
    const run = input.setup.runs[row.placementKey];
    if (run === undefined || run.clear === null) {
      observations.push(observe(TIE_BEAM, kind, "RUN_UNREAD", row, member.read.placement.sourceEntity));
      continue;
    }
    reads.push({ member: member.read, run });
  }
  return { reads, observations };
}

/** `rcc.tie_beam.concrete`: `count × b × D × clear` — no slab adjoins, so no depth is given up. */
export const tieBeamConcreteRail: Rail = (input: RailInput) => {
  const { reads, observations } = readTieBeams(input, RCC_CONCRETE);
  return { offers: reads.map((read) => offerOf(read, input.setup, TIE_BEAM_CONCRETE_RULE_ID, RCC_CONCRETE)), observations };
};

/** `rcc.tie_beam.formwork`: `count × (2·D + b) × clear` — two full sides and a soffit, no top. */
export const tieBeamFormworkRail: Rail = (input: RailInput) => {
  const { reads, observations } = readTieBeams(input, RCC_FORMWORK);
  return { offers: reads.map((read) => offerOf(read, input.setup, TIE_BEAM_FORMWORK_RULE_ID, RCC_FORMWORK)), observations };
};
