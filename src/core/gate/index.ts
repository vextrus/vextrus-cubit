// SEAM-GATE's one door: the gate is the sole writer of quantity lines and rail observations
// (L-MEA-08), and this is where it is reached.
//
// Who may reach it is the point of the module. `src/modules/**` and `src/app/**` cannot import this
// file at all — the ban is total, type-only imports included, and it is enforced by the committed
// scan beside this directory (`__tests__/gate-import-scan.ts`). The one lawful caller is the worker's
// measure handler, which is the composition root the layered matrix already lets hold both halves
// (ARCH-01, ARCH-02).
//
// The rail↔gate vocabulary is `src/core/offers/contract`'s, and re-exported here for the caller that
// may name this module — so the worker's handler types a verdict from the door it calls, while a
// module that only has to type a rail imports the contract and never this (riskNotes (2)).
export { partitionDeductions } from "./deductions";
export type { DeductionPartition } from "./deductions";
export { evaluateOffers } from "./evaluate";
export { QUEUE_ITEM_CAUSES } from "./law";
export type { QueueItemCause } from "./law";
export { renderFormula } from "./template";
export { normaliseMeasure } from "./units";
export type { NormalisedMeasure } from "./units";

export type {
  DeductionCandidate,
  DeductionChannel,
  GateRefusal,
  GateScope,
  GateVerdict,
  Measure,
  Offer,
  QuantityBasis,
  RailBatch,
  RailObservation,
} from "../offers/contract";
