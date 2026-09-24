// R-TO-032's foundations, at their door: the six class readers this area writes, the rules they
// offer under, and the closed roster of codes they answer with.
//
// The rails themselves stand in the files their clause stands in — the prisms with L-FRM-02, their
// side formwork with L-FRM-03, the pit and the blinding with L-FRM-04, the piles with AM-06 §2 — and
// this file is where the area publishes them. The area's ROSTER, which keys a rail by the kind it
// measures, is `../foundations.ts`: a rail is selected per kind (L-MEA-08), so `rcc.concrete` is
// measured by one function composed of this area's concrete reader and the columns', and
// `rcc.formwork` by one composed of its formwork reader and the frame's (riskNotes (1), I-337).
//
// A pile cap is offered under the sentences that net what the piles it stands on own of it — their
// heads, and their sections through the blinding — and the recess cast into it, or keeps its row with
// the reading it lacks named, its piles unread included (L-MEA-09, I-544..d); the readers are the
// same three, choosing the rule by what they read.

export { blindingRail, excavationRail, BLINDING_OVER_PILES_RULE_ID, BLINDING_RULE_ID, EXCAVATION_RULE_ID } from "./earthwork";
export {
  foundationConcreteRail,
  FOUNDATION_PRISM_POLY_RULE_ID,
  FOUNDATION_PRISM_RECT_RULE_ID,
  PILE_CAP_PRISM_POLY_RECESS_RULE_ID,
  PILE_CAP_PRISM_POLY_RULE_ID,
  PILE_CAP_PRISM_RECT_RECESS_RULE_ID,
  PILE_CAP_PRISM_RECT_RULE_ID,
  PILE_CONCRETE_RULE_ID,
} from "./concrete";
export {
  foundationFormworkRail,
  FOUNDATION_FORMWORK_POLY_RULE_ID,
  FOUNDATION_FORMWORK_RECT_RULE_ID,
  PILE_CAP_FORMWORK_POLY_RECESS_RULE_ID,
  PILE_CAP_FORMWORK_RECT_RECESS_RULE_ID,
} from "./formwork";
export { pileCountRail, pileLengthRail, PILE_COUNT_RULE_ID, PILE_LENGTH_RULE_ID } from "./piling";
export { FOUNDATIONS_RAIL_CODES } from "./read";
export type { FoundationsRailCode } from "./read";
