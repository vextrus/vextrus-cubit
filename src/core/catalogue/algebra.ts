// L-MEA-04: kind → algebra. The second of the two total maps over `Kind`, and independent of the
// first — this file reads the kinds and nothing else. The two answer different questions and are
// wrong to derive from each other: a discipline says whose drawing rules, an algebra says what
// arithmetic turns geometry into a quantity, and two kinds owned by the same discipline routinely
// need different arithmetic (a column's concrete is a prism, its formwork is the contact surface of
// the same prism).
import { type Kind } from "./kinds";

/**
 * How a quantity is derived from geometry:
 *
 * - `prism-net` — plan figure × depth, less what is deducted from it.
 * - `displaced-prism` — a prism less the volume other work already occupies, as backfill is.
 * - `footprint` — the plan area a member covers.
 * - `contact-surface` — the area of the faces something is worked against, as shuttering is.
 * - `surface-net` — finished face area, less openings and unfinished breaks.
 * - `surface-gross` — face area taken whole, as a continuous membrane must be.
 * - `run` — length along a path.
 * - `perimeter-run` — length around a figure's edge.
 * - `tally` — a count of instances.
 * - `schedule-mass` — mass summed from a bar or section schedule, never from bulk geometry.
 */
export type Algebra =
  | "prism-net"
  | "displaced-prism"
  | "footprint"
  | "contact-surface"
  | "surface-net"
  | "surface-gross"
  | "run"
  | "perimeter-run"
  | "tally"
  | "schedule-mass";

/** The algebra of every kind. Total over `Kind`: a missing key is a `tsc` failure. */
export const KIND_ALGEBRA: Readonly<Record<Kind, Algebra>> = Object.freeze({
  excavation: "prism-net",
  backfilling: "displaced-prism",
  "sand-filling": "prism-net",
  "brick-soling": "footprint",
  "lean-concrete": "prism-net",
  "concrete-casting": "prism-net",
  reinforcement: "schedule-mass",
  formwork: "contact-surface",
  brickwork: "prism-net",
  plastering: "surface-net",
  tiling: "surface-net",
  painting: "surface-net",
  waterproofing: "surface-gross",
  "false-ceiling": "footprint",
  skirting: "perimeter-run",
  railing: "run",
  pipework: "run",
  "sanitary-ware": "tally",
  "electrical-point": "tally",
  "structural-steel": "schedule-mass",
} satisfies Record<Kind, Algebra>);
