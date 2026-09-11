// L-FRM-06's unit canon refusals: the two tiers are not interchangeable, a packaging unit without its
// property has no factor to take, and a reading in an unmapped unit is never guessed at.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type UnitsRefusalCode =
  | "DIMENSION_MISMATCH"
  | "PRODUCT_FACTOR_MISSING"
  | "UNIT_UNMAPPED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const UNITS_REFUSALS: RefusalGroup<UnitsRefusalCode> = Object.freeze({
  // L-FRM-06: the two tiers of the unit canon are not interchangeable — a volume is not an area, and
  // there is no factor between them to take.
  DIMENSION_MISMATCH: Object.freeze({
    code: "DIMENSION_MISMATCH",
    message: "These two units measure different kinds of quantity, so there is no factor between them and no conversion exists.",
    remedy: "Choose a unit that measures the same thing as the quantity, such as its own dimension's canonical unit.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-06: a packaging unit holds whatever the product it packages holds, so converting one
  // without that property would be inventing a factor — "never a silent 1.0".
  PRODUCT_FACTOR_MISSING: Object.freeze({
    code: "PRODUCT_FACTOR_MISSING",
    message: "A bag, drum or coil holds what its product says it holds, and this product states no such property, so the quantity was not converted.",
    remedy: "State the product's packaged quantity — how much one bag, drum or coil holds — and convert again.",
    severity: "error",
    surface: "inline",
  }),
  // L-FRM-06 / L-MEA-08: a reading in a unit the canon carries no factor for cannot be normalised,
  // and a figure the machine guessed a factor for would be priced as though somebody had read it.
  UNIT_UNMAPPED: Object.freeze({
    code: "UNIT_UNMAPPED",
    message: "This reading is stated in a unit the canon carries no conversion factor for.",
    remedy: "State the reading in a unit the canon holds, or add the factor to the unit canon before measuring again.",
    severity: "error",
    surface: "inline",
  }),
});
