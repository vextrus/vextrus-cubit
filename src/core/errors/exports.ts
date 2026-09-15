// The EXPORTS area's own refusals (R-SPINE-041, R-SPINE-021, Q-12): what a download link is answered
// with when it is not one this workspace issued, when the hour it was minted for has passed, and when
// nothing is stored at the address it names.
//
// All three are answers a well-formed request earned, never faults: a link a person was handed is a
// thing they can act on, so each carries the remedy that gets them a fresh one (AM-11, R-SPINE-062).

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type ExportsRefusalCode = "EXPORT_URL_INVALID" | "EXPORT_URL_EXPIRED" | "EXPORT_NOT_FOUND";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const EXPORTS_REFUSALS: RefusalGroup<ExportsRefusalCode> = Object.freeze({
  // Q-12: the signature is the storage seam's own, over the address and the expiry. A link whose
  // signature does not check out was not minted here, and it is told nothing about what stands at
  // the address it names — a stranger with a forged link learns no more than that it is forged.
  EXPORT_URL_INVALID: Object.freeze({
    code: "EXPORT_URL_INVALID",
    message: "This download link is not one this workspace issued.",
    remedy: "Open the export again to get a fresh link.",
    severity: "error",
    surface: "inline",
  }),
  // Q-12: a signed URL expires. A link that WAS good and has aged out is a different fact from one
  // that was never good, so it is a warning with its own code — the person did nothing wrong, and
  // the same door will mint them another.
  EXPORT_URL_EXPIRED: Object.freeze({
    code: "EXPORT_URL_EXPIRED",
    message: "This download link has expired.",
    remedy: "Open the export again to get a fresh link.",
    severity: "warning",
    surface: "inline",
  }),
  // R-SPINE-021 addresses an artefact by the sha256 of its own bytes, so an address nothing is
  // stored at names an artefact this workspace never built — an absence, and an absence is an answer.
  EXPORT_NOT_FOUND: Object.freeze({
    code: "EXPORT_NOT_FOUND",
    message: "No export is stored at this address in this workspace.",
    remedy: "Build the export again before downloading it.",
    severity: "error",
    surface: "inline",
  }),
});
