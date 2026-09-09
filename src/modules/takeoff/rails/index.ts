// L-MEA-08's rails, as a roster: "rail is selected per quantity KIND, never per drawing".
//
// So the roster is keyed by kind, and a kind with no rail is a kind nothing measures rather than a
// kind measured by a default: the map is partial on purpose, and the measure job runs whatever
// stands here — a rail landed tomorrow is run with no edit to the job (B-19).
//
// A kind is named here once, beside the rail that measures it: a roster naming a rail the tree does
// not hold would be a claim that a kind is measured when nothing measures it (B-19).
import type { Kind } from "@/core/catalogue/kinds";
import type { Rail } from "@/core/offers/contract";
import { columnConcreteRail } from "./columns";

/** Every kind this product measures, and the pure function that measures it (L-MEA-08). */
export const RAILS: Readonly<Partial<Record<Kind, Rail>>> = Object.freeze({
  "rcc.concrete": columnConcreteRail,
});
