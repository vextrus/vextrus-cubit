// L-MEA-08's rails, as a roster: "rail is selected per quantity KIND, never per drawing".
//
// So the roster is keyed by kind, and a kind with no rail is a kind nothing measures rather than a
// kind measured by a default: the map is partial on purpose, and the measure job runs whatever
// stands here — a rail landed tomorrow is run with no edit to the job (B-19).
//
// Empty at this leaf. The column rail and its member geometry are their own increment; what this
// increment proves is the seam the roster is run through, and a roster that pretended to hold a rail
// would prove it against a fiction.
import type { Kind } from "@/core/catalogue/kinds";
import type { Rail } from "@/core/offers/contract";

/** Every kind this product measures, and the pure function that measures it (L-MEA-08). */
export const RAILS: Readonly<Partial<Record<Kind, Rail>>> = Object.freeze({});
