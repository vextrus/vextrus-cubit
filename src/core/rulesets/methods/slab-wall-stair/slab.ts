// L-MEA-09 (AM-02) and L-FRM-02/03, as formulas: what a slab plate, a tapering plate, a soffit, an
// edge band and a sunken drop are measured by.
//
// "Slabs run through: outline to the edge-beam outer face, less column and wall plan areas, less
// openings above `openingDeductionMinM2`" — so the plate's net area is the reading less the members
// it runs past less the openings the EDITION's threshold took off, and the thickness carries it into
// a volume. A slab forms its soffit net of the beam soffits below it, because the beam owns that
// face (L-MEA-09's precedence), plus its free edges through the thickness; a slab on grade forms
// those edges and nothing else, because the ground bears its soffit.
//
// A method converts nothing: every binding arrives in the canonical unit of its own dimension,
// carried there by the gate's one canon (B-17, L-FRM-06). The arithmetic is the canon's exact
// decimal, so a figure is exact from the drawing to the page (B-07).
//
// `openings` is DECLARED here and bound by nobody who offers: it is the deducted sum, which only the
// gate knows — the rail hands candidates in the `opening` channel and the gate binds the sum it
// partitioned into this variable (L-MEA-02, `CHANNEL_VARIABLE`).
import type { MethodPair } from "../../editions/content";
import { formulaFrom, K, minus, plus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The count of members one offer is for, as a declared variable rather than a folded multiplier. */
const COUNT: MethodVariable = Object.freeze({ name: "count", dimension: "COUNT" as const });

/** The plate as the reader read it, and the two junctions L-MEA-09 gives to somebody else. */
const AREA: MethodVariable = Object.freeze({ name: "A", dimension: "AREA" as const });
const MEMBERS: MethodVariable = Object.freeze({ name: "A_members", dimension: "AREA" as const });
const BEAMS: MethodVariable = Object.freeze({ name: "A_beams", dimension: "AREA" as const });

/** The deducted sum of the `opening` channel — the gate's own binding (L-MEA-02). */
const OPENINGS: MethodVariable = Object.freeze({ name: "openings", dimension: "AREA" as const });

/** The free run of edge a plate forms against, and the thicknesses it is cast at. */
const EDGE: MethodVariable = Object.freeze({ name: "L_edge", dimension: "LENGTH" as const });
const THICKNESS: MethodVariable = Object.freeze({ name: "t", dimension: "LENGTH" as const });
const THICKNESS_ONE: MethodVariable = Object.freeze({ name: "t1", dimension: "LENGTH" as const });
const THICKNESS_TWO: MethodVariable = Object.freeze({ name: "t2", dimension: "LENGTH" as const });

/** The three sides of a sunken panel's drop wall. */
const LENGTH: MethodVariable = Object.freeze({ name: "L", dimension: "LENGTH" as const });
const BREADTH: MethodVariable = Object.freeze({ name: "B", dimension: "LENGTH" as const });
const HEIGHT: MethodVariable = Object.freeze({ name: "H", dimension: "LENGTH" as const });

/** The one channel a slab partitions: its scheduled openings (L-MEA-02). */
const OPENING_CHANNEL = Object.freeze(["opening" as const]);

/** The plate's net plan area — the reading less the verticals it runs past less what was deducted. */
const NET_AREA = minus(minus(V(AREA.name), V(MEMBERS.name)), V(OPENINGS.name));

/* ------------------------------------------------------------------ the plate, as concrete */

export const SLAB_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.slab.concrete", version: "1" });

const SLAB_CONCRETE_TREE: Statement = Object.freeze({ result: "V", expr: times(V(COUNT.name), NET_AREA, V(THICKNESS.name)) });

const SLAB_CONCRETE = formulaFrom(SLAB_CONCRETE_TREE, SLAB_CONCRETE_METHOD.ruleId);

/** `rcc.slab.concrete@1`: the plate through one thickness (L-MEA-09, L-FRM-02's AREA_THICK). */
export const SLAB_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: SLAB_CONCRETE_METHOD.ruleId,
  version: SLAB_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, AREA, MEMBERS, OPENINGS, THICKNESS]),
  deductionChannels: OPENING_CHANNEL,
  tree: SLAB_CONCRETE_TREE,
  template: SLAB_CONCRETE.template,
  evaluate: SLAB_CONCRETE.evaluate,
  attempt: SLAB_CONCRETE.attempt,
});

/* ------------------------------------------------------------------ the plate, tapering */

export const SLAB_TAPER_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.slab.taper.concrete", version: "1" });

// L-FRM-02's taper: a plate read at two thicknesses is cast through their mean, which is the
// prismoidal rule's own answer where the plan area does not change between the two faces. The mean
// is written as a HALF of the sum rather than a sum divided by two: a quotient printed as a factor
// re-reads as a quotient of the whole product, which is the same figure but a different tree, and
// the template has to read back as the tree it was printed from (L-QTY-03, `expr.parse`).
const SLAB_TAPER_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(V(COUNT.name), NET_AREA, plus(V(THICKNESS_ONE.name), V(THICKNESS_TWO.name)), K("0.5")),
});

const SLAB_TAPER = formulaFrom(SLAB_TAPER_TREE, SLAB_TAPER_CONCRETE_METHOD.ruleId);

/** `rcc.slab.taper.concrete@1`: the plate through the mean of the two thicknesses it was read at. */
export const SLAB_TAPER_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: SLAB_TAPER_CONCRETE_METHOD.ruleId,
  version: SLAB_TAPER_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, AREA, MEMBERS, OPENINGS, THICKNESS_ONE, THICKNESS_TWO]),
  deductionChannels: OPENING_CHANNEL,
  tree: SLAB_TAPER_TREE,
  template: SLAB_TAPER.template,
  evaluate: SLAB_TAPER.evaluate,
  attempt: SLAB_TAPER.attempt,
});

/* ------------------------------------------------------------------ the soffit and its edges */

export const SLAB_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.slab.formwork", version: "1" });

// L-FRM-03: the soffit net of the members and the beam soffits it stands over, plus the free edges
// through the thickness — `L_edge × t` is the edge term, named so a reader can see it on the line.
const SLAB_FORMWORK_TREE: Statement = Object.freeze({
  result: "F",
  expr: times(V(COUNT.name), plus(minus(NET_AREA, V(BEAMS.name)), times(V(EDGE.name), V(THICKNESS.name)))),
});

const SLAB_FORMWORK = formulaFrom(SLAB_FORMWORK_TREE, SLAB_FORMWORK_METHOD.ruleId);

/** `rcc.slab.formwork@1`: a framed panel's soffit, net of what other members own, plus its edges. */
export const SLAB_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: SLAB_FORMWORK_METHOD.ruleId,
  version: SLAB_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, AREA, MEMBERS, BEAMS, OPENINGS, EDGE, THICKNESS]),
  deductionChannels: OPENING_CHANNEL,
  tree: SLAB_FORMWORK_TREE,
  template: SLAB_FORMWORK.template,
  evaluate: SLAB_FORMWORK.evaluate,
  attempt: SLAB_FORMWORK.attempt,
});

export const SLAB_EDGE_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.slab.edge-formwork", version: "1" });

const SLAB_EDGE_TREE: Statement = Object.freeze({ result: "F", expr: times(V(COUNT.name), V(EDGE.name), V(THICKNESS.name)) });

const SLAB_EDGE = formulaFrom(SLAB_EDGE_TREE, SLAB_EDGE_FORMWORK_METHOD.ruleId);

/**
 * `rcc.slab.edge-formwork@1`: a slab on grade forms its edges and nothing else (L-FRM-03).
 *
 * No soffit area is declared, because the ground bears the soffit and nothing is formed there — a
 * variable declared and bound at zero would put a figure on the line for a face nobody shuttered.
 */
export const SLAB_EDGE_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: SLAB_EDGE_FORMWORK_METHOD.ruleId,
  version: SLAB_EDGE_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, EDGE, THICKNESS]),
  // An edge run has no opening to partition: the reveals of an opening are their own term, and a
  // channel nothing can offer through is a channel declared for nothing (L-MEA-08).
  deductionChannels: Object.freeze([]),
  tree: SLAB_EDGE_TREE,
  template: SLAB_EDGE.template,
  evaluate: SLAB_EDGE.evaluate,
  attempt: SLAB_EDGE.attempt,
});

/* ------------------------------------------------------------------ the sunken panel's drop */

export const SLAB_DROP_CONCRETE_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.slab.drop.concrete", version: "1" });

const SLAB_DROP_CONCRETE_TREE: Statement = Object.freeze({
  result: "V",
  expr: times(V(COUNT.name), V(LENGTH.name), V(BREADTH.name), V(HEIGHT.name)),
});

const SLAB_DROP_CONCRETE = formulaFrom(SLAB_DROP_CONCRETE_TREE, SLAB_DROP_CONCRETE_METHOD.ruleId);

/** `rcc.slab.drop.concrete@1`: the wall that carries a sunken panel down, run × breadth × drop. */
export const SLAB_DROP_CONCRETE_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: SLAB_DROP_CONCRETE_METHOD.ruleId,
  version: SLAB_DROP_CONCRETE_METHOD.version,
  kind: "rcc.concrete",
  dimension: "VOLUME",
  variables: Object.freeze([COUNT, LENGTH, BREADTH, HEIGHT]),
  deductionChannels: Object.freeze([]),
  tree: SLAB_DROP_CONCRETE_TREE,
  template: SLAB_DROP_CONCRETE.template,
  evaluate: SLAB_DROP_CONCRETE.evaluate,
  attempt: SLAB_DROP_CONCRETE.attempt,
});

export const SLAB_DROP_FORMWORK_METHOD: MethodPair = Object.freeze({ ruleId: "rcc.slab.drop.formwork", version: "1" });

// Both faces of the drop are shuttered: the inner one against the sunken pocket and the outer one
// against the plate it steps down from.
const SLAB_DROP_FORMWORK_TREE: Statement = Object.freeze({
  result: "F",
  expr: times(V(COUNT.name), K("2"), V(LENGTH.name), V(HEIGHT.name)),
});

const SLAB_DROP_FORMWORK = formulaFrom(SLAB_DROP_FORMWORK_TREE, SLAB_DROP_FORMWORK_METHOD.ruleId);

/** `rcc.slab.drop.formwork@1`: the two faces of the drop wall. */
export const SLAB_DROP_FORMWORK_FORMULA: FormulaMethod = Object.freeze({
  role: "formula",
  ruleId: SLAB_DROP_FORMWORK_METHOD.ruleId,
  version: SLAB_DROP_FORMWORK_METHOD.version,
  kind: "rcc.formwork",
  dimension: "AREA",
  variables: Object.freeze([COUNT, LENGTH, HEIGHT]),
  deductionChannels: Object.freeze([]),
  tree: SLAB_DROP_FORMWORK_TREE,
  template: SLAB_DROP_FORMWORK.template,
  evaluate: SLAB_DROP_FORMWORK.evaluate,
  attempt: SLAB_DROP_FORMWORK.attempt,
});
