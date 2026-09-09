// The rail↔gate contract's closed vocabularies, as law: the rosters a store's CHECK is written from
// and the contract beside it publishes. They stand apart from `contract.ts` because the schema reads
// them too — a table that spelled its own copy of "MEASURED · DERIVED · INTERPRETED" would be a
// second home for a closed roster (B-17, ARCH-02) — and this file reaches nothing but the law.

/** L-QTY-03's quantity basis: how the figure on a line came to be known. */
export const QUANTITY_BASES = ["MEASURED", "DERIVED", "INTERPRETED"] as const;

/** One basis, drawn from the closed roster above. */
export type QuantityBasis = (typeof QUANTITY_BASES)[number];

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
 * How complete a line's coverage is. Only a whole one is representable at this leaf: an algebra that
 * can measure part of a scope is a later one, and a coverage nothing can produce is not a value a
 * store should admit (L-QTY-03).
 */
export const COVERAGES = ["COMPLETE"] as const;

/** One coverage, drawn from the closed roster above. */
export type Coverage = (typeof COVERAGES)[number];
