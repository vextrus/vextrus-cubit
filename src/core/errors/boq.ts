// The BOQ area's own refusals (L-BD-08, R-TO-053, AM-11): what stops a draft being read, and what
// stops one being exported.
//
// M3's bill-of-quantities area registers its codes HERE. The barrel `src/core/errors.ts` already
// enumerates this file, so a code added to the group below is a code the closed taxonomy holds — with
// no shared list to edit and no other area's file to touch.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type BoqRefusalCode = "BOQ_NO_CAMPAIGN" | "BOQ_NO_PUBLISHED_LINE" | "BOQ_TAXONOMY_VERSION_MOVED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const BOQ_REFUSALS: RefusalGroup<BoqRefusalCode> = Object.freeze({
  // A draft is read off a campaign's published lines (R-TO-053), so a project with none pinned has
  // nothing to draft rather than an empty draft: an absence is stated, never rendered as a document
  // that would look like an answer.
  BOQ_NO_CAMPAIGN: Object.freeze({
    code: "BOQ_NO_CAMPAIGN",
    message: "No campaign is open on this project, so there is no register to draft a BOQ from.",
    remedy: "Pin a drawing set revision and measure the campaign, then export the draft.",
    severity: "info",
    surface: "inline",
  }),
  // A campaign that measured nothing yet is the same absence one step later — and the remedy names
  // the surface the lines come from, because a draft states what was published and assumes nothing.
  BOQ_NO_PUBLISHED_LINE: Object.freeze({
    code: "BOQ_NO_PUBLISHED_LINE",
    message: "This campaign has published no line to draft.",
    remedy: "Measure and publish from the takeoff register — a draft states what was published and assumes nothing.",
    severity: "info",
    surface: "inline",
  }),
  // An issued document states the taxonomy it was drafted under and never follows a later one
  // (L-BD-08's swappable data, AM-14 §1): a draft issued under an older taxonomy stays true to it,
  // and a reader who wants the new sections asks for a new draft.
  BOQ_TAXONOMY_VERSION_MOVED: Object.freeze({
    code: "BOQ_TAXONOMY_VERSION_MOVED",
    message: "The taxonomy has changed since this draft was issued.",
    remedy: "Export the draft again — an issued document states the taxonomy it was drafted under and never follows a later one.",
    severity: "warning",
    surface: "inline",
  }),
});
