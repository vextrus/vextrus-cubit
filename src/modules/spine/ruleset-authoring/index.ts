// The rule-set authoring module (R-SPINE-012, L-MEA-01): the surface the authoring SCREEN reads —
// what authoring moves, and what the fork would hold.
//
// `diffParameters`, `authoredContent` and `sameDecimal` are the edition store's own (they are read
// by the ACT, and core imports nothing above it — ARCH-01), and they are re-exported rather than
// re-implemented: one home for "what changed", so a row a reader saw marked and a subject the seam
// digested cannot come from two different computations (B-17).
export { authoredContent, diffParameters, sameDecimal, type ParameterDiffRow } from "@/core/rulesets/editions";
