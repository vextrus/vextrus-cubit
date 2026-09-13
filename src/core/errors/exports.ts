// The EXPORTS area's own refusals (AM-11, R-SPINE-062): what the download door can answer when the
// link itself is the problem.
//
// Three codes, and no more: a link this installation did not sign, a link whose hour has passed, and
// an address this workspace has nothing stored at. Everything else the door answers — no session, no
// membership, an unreadable statement — is already registered by the areas that own those questions,
// and a fourth spelling of them here would be a second taxonomy (B-17).
//
// The copy follows docs/design/refusal-state.md § 3: one present-tense sentence saying what was
// refused, one remedy beginning with the verb that resolves it. An expired link is a `warning` rather
// than an `error` because nothing went wrong — a signed URL expiring is Q-12 working.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type ExportsRefusalCode = "EXPORT_URL_INVALID" | "EXPORT_URL_EXPIRED" | "EXPORT_NOT_FOUND";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const EXPORTS_REFUSALS: RefusalGroup<ExportsRefusalCode> = Object.freeze({
  EXPORT_URL_INVALID: Object.freeze({
    code: "EXPORT_URL_INVALID",
    message: "This download link is not one this workspace issued.",
    remedy: "Open the export again to get a fresh link.",
    severity: "error",
    surface: "inline",
  }),
  EXPORT_URL_EXPIRED: Object.freeze({
    code: "EXPORT_URL_EXPIRED",
    message: "This download link has expired.",
    remedy: "Open the export again to get a fresh link.",
    severity: "warning",
    surface: "inline",
  }),
  EXPORT_NOT_FOUND: Object.freeze({
    code: "EXPORT_NOT_FOUND",
    message: "No export is stored at this address in this workspace.",
    remedy: "Build the export again before downloading it.",
    severity: "error",
    surface: "inline",
  }),
});
