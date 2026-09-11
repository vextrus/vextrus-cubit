// The partition's view-reading refusals (L-CAD-06, L-CAD-08): a caption the deterministic grammar
// reads nothing in, and a drawing whose own geometry does not say which layer carries a role.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type TakeoffViewsRefusalCode =
  | "CAPTION_UNCLASSIFIABLE"
  | "CONVENTION_ROLE_UNRESOLVED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const TAKEOFF_VIEWS_REFUSALS: RefusalGroup<TakeoffViewsRefusalCode> = Object.freeze({
  // L-CAD-06's answer for a view caption the deterministic grammar reads nothing in: the view stands
  // untyped and says why, because a grammar that guessed would put a class in front of a person as
  // though it had been read off the drawing.
  CAPTION_UNCLASSIFIABLE: Object.freeze({
    code: "CAPTION_UNCLASSIFIABLE",
    message: "This view's caption says nothing the classification grammar reads, so the view is untyped.",
    remedy: "Confirm what the view is yourself, or re-caption it in the drawing and ingest it again.",
    severity: "info",
    surface: "inline",
  }),
  // L-CAD-08's answer where a drawing's own geometry does not say which layer carries a role: the
  // profile defers the role rather than defaulting one, because a defaulted convention would be a
  // reading nobody made (L-QTY-04).
  CONVENTION_ROLE_UNRESOLVED: Object.freeze({
    code: "CONVENTION_ROLE_UNRESOLVED",
    message: "No layer of this drawing carries this role plainly enough to resolve it, so the convention profile leaves it unresolved.",
    remedy: "Say which layer carries it yourself, or draw the role on a layer of its own and ingest the drawing again.",
    severity: "info",
    surface: "inline",
  }),
});
