// L-MEA-04's two independent total maps: kind → the discipline that is authoritative for it, and
// kind → the algebra its quantity is measured by. Independent because they answer different
// questions — which drawing set states the truth about a quantity, and how the quantity is computed
// — and total because a kind neither map answers for is a kind nothing can take off.
//
// Neither vocabulary is spelled twice: the disciplines are the sheet law's roster (`DISCIPLINES`),
// and the algebras are declared here as L-MEA-08 names them, beside the map that is their only
// reader until the rails land (B-17).
import { type Discipline } from "../sheets/law";
import { type Kind } from "./kinds";

/**
 * L-MEA-08's four algebras: `member` (section × run plus the bar rule — structure and brick walls),
 * `face` (a face of a space, gross less scheduled openings), `network` (runs by diameter) and
 * `topology` (a tee is a junction in the run graph). A rail is selected per quantity kind and never
 * per drawing, which is what the map below says.
 */
export const ALGEBRAS = ["member", "face", "network", "topology"] as const;

/** One algebra, drawn from the closed roster above. */
export type Algebra = (typeof ALGEBRAS)[number];

/**
 * The discipline whose drawings are authoritative for each kind. Concrete is stated by the
 * structural set: an architectural plan may show the same column, but it is not what it is measured
 * from (L-MEA-04).
 */
export const KIND_DISCIPLINE: Readonly<Record<Kind, Discipline>> = Object.freeze({
  "rcc.concrete": "STRUCTURAL",
  "rcc.formwork": "STRUCTURAL",
  // A pile, a pit and the blinding under a footing are all stated by the structural set: the
  // architectural set may draw the same ground, but it is not what any of them is measured from.
  "piling.bored": "STRUCTURAL",
  "piling.boring": "STRUCTURAL",
  "earthwork.excavation": "STRUCTURAL",
  "pcc.blinding": "STRUCTURAL",
});

/**
 * The algebra each kind's quantity is computed by. Concrete in a column is a member quantity —
 * section × run, with the bar rule — never a face and never a network (L-MEA-08).
 */
export const KIND_ALGEBRA: Readonly<Record<Kind, Algebra>> = Object.freeze({
  "rcc.concrete": "member",
  // Formwork is the contact face of a MEMBER, measured along the member's own run — a face of a
  // member, never a face of a space, so it takes the member algebra and not the face one (L-MEA-08).
  "rcc.formwork": "member",
  // Each of the four is measured off ONE member's own description — a pile's count and its bored
  // length, the pit around a footing's plan, the blinding under it. None is a face of a space and
  // none is a network of runs, so all four take the member algebra (L-MEA-08, L-FRM-04).
  "piling.bored": "member",
  "piling.boring": "member",
  "earthwork.excavation": "member",
  "pcc.blinding": "member",
});
