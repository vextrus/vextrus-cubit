// The rail↔gate contract's closed vocabularies, as law: the rosters a store's CHECK is written from
// and the contract beside it publishes. They stand apart from `contract.ts` because the schema reads
// them too — a table that spelled its own copy of "MEASURED · DERIVED · INTERPRETED" would be a
// second home for a closed roster (B-17, ARCH-02) — and this file reaches nothing but the law.

/**
 * L-QTY-01's basis: how the figure on a line came to be known, in the clause's own order — by
 * RECOURSE, strongest first. The order is the roster's order and carries meaning: "weakest-wins"
 * roll-ups read it as a rank, so a basis added anywhere but in its lawful place would silently
 * re-rank every line the tree publishes.
 */
export const QUANTITY_BASES = ["MEASURED", "TRANSCRIBED", "DERIVED", "IMPORTED", "ENTERED", "INTERPRETED", "DEFAULTED"] as const;

/** One basis, drawn from the closed roster above. */
export type QuantityBasis = (typeof QUANTITY_BASES)[number];

/**
 * The weakest of a set of bases — L-QTY-01's roll-up: "a line derives two roll-ups weakest-wins".
 * An empty set answers the honest weakest, DEFAULTED: nobody looked and nobody decided, which is
 * exactly what the clause says that basis means (riskNotes (5)).
 */
export function weakestBasis(bases: readonly QuantityBasis[]): QuantityBasis {
  let weakest = 0;
  for (const basis of bases) weakest = Math.max(weakest, QUANTITY_BASES.indexOf(basis));
  return bases.length === 0 ? "DEFAULTED" : (QUANTITY_BASES[weakest] as QuantityBasis);
}

/**
 * The deduction channels a candidate can stand in. L-MEA-01 states a threshold per channel; this
 * leaf carries the one whose threshold is in a unit the canon holds (`openingDeductionMinM2`), and
 * the member-end and embedded-duct channels join it with the units they are stated in.
 */
export const DEDUCTION_CHANNELS = ["opening"] as const;

/** One deduction channel, drawn from the closed roster above. */
export type DeductionChannel = (typeof DEDUCTION_CHANNELS)[number];

/**
 * L-FRM-01's typed member geometry, by name: the five a machine reads off a drawing and the three a
 * manual tool draws. An offer carries the discriminant, its basis and its calibration; what each
 * shape IS — and the shoelace check over a polygon — is the geometry leaf's.
 */
export const GEOMETRY_TYPES = ["PRISM_RECT", "PRISM_POLY", "FRUSTUM_RECT", "TAPER_LINEAR", "AREA_THICK", "POLYLINE", "POLYGON", "POINT_SET"] as const;

/** One geometry type of the union above. */
export type GeometryType = (typeof GEOMETRY_TYPES)[number];

/** L-QTY-03's engine: what read the drawing, orthogonal to the basis it was read on. */
export const ENGINES = ["VECTOR", "RASTER"] as const;

/** One engine, drawn from the closed roster above. */
export type Engine = (typeof ENGINES)[number];

/**
 * How complete a line's coverage is (L-QTY-02): COMPLETE, or PARTIAL_DECLARED with every omitted
 * component enumerated on the row. PARTIAL_UNDECLARED is not here and never will be — the clause
 * makes it unrepresentable, which in a closed roster means it is simply not a value.
 */
export const COVERAGES = ["COMPLETE", "PARTIAL_DECLARED"] as const;

/** One coverage, drawn from the closed roster above. */
export type Coverage = (typeof COVERAGES)[number];

/**
 * The plan members a reader states a reading of, by name (R-TO-032, AM-06 §3/§4). A closed roster:
 * a reading is one of these five or it is not a reading this product measures from.
 *
 * It stands here with the other closed vocabularies rather than beside the reading shapes in
 * `contract.ts`, for the reason this file exists: Q-07's register scan declares refusal-shaped
 * spellings by reading the roster itself, and a file of `src/core/errors/**` cannot reach a module
 * that reaches the store (ARCH-01, B-19). `contract.ts` publishes it again, so a rail still reads
 * the whole contract at one door.
 */
export const PLAN_MEMBERS = ["SLAB_PANEL", "SLAB_DROP", "STAIR_FLIGHT", "STAIR_LANDING", "WALL_RUN"] as const;

/** One plan member, drawn from the closed roster above. */
export type PlanMember = (typeof PLAN_MEMBERS)[number];
