// The DOCS area's own refusals (R-SPINE-040, SEAM-DOC, Q-12): what `renderDocument` answers when it
// will not reach the renderer, what the renderer's own failure becomes, and what a download link is
// answered with when it is not one this workspace issued.
//
// The barrel `src/core/errors.ts` already enumerates this file, so a code added to the group below is
// a code the closed taxonomy holds — with no shared list to edit and no other area's file to touch.
//
// None of these is a fault. A kind nobody registered and a payload that will not parse are the
// caller's statement, and a renderer that fell over is recorded ONCE at the fault seam and then
// answered here by name (ARCH-03, B-21) — a stack never reaches the person who asked for a document.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type DocsRefusalCode =
  | "DOCUMENT_KIND_UNKNOWN"
  | "DOCUMENT_PAYLOAD_MALFORMED"
  | "DOCUMENT_NOT_RENDERED"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_URL_INVALID"
  | "DOCUMENT_URL_EXPIRED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const DOCS_REFUSALS: RefusalGroup<DocsRefusalCode> = Object.freeze({
  // SEAM-DOC: the kinds barrel is the closed set of documents this product issues. A kind it does
  // not hold names no schema and no template, so there is nothing to render and nothing to guess at.
  DOCUMENT_KIND_UNKNOWN: Object.freeze({
    code: "DOCUMENT_KIND_UNKNOWN",
    message: "This product issues no document of that kind.",
    remedy: "Ask for one of the document kinds this project publishes.",
    severity: "error",
    surface: "inline",
  }),
  // L-FMT-03: a document is rendered from a STRUCTURED payload, parsed by the kind's own Zod schema
  // before anything is staged. The issues travel in the refusal's detail for an operator; what a
  // person reads is this one sentence (R-SPINE-062).
  DOCUMENT_PAYLOAD_MALFORMED: Object.freeze({
    code: "DOCUMENT_PAYLOAD_MALFORMED",
    message: "This document's contents are not in the shape its kind requires.",
    remedy: "Correct the fields the document kind states and ask for it again.",
    severity: "error",
    surface: "inline",
  }),
  // ARCH-03: the renderer falling over is OUR outage, recorded once at the fault seam. What crosses
  // back is this code and the id of that record — never a stack, and never a subprocess's stderr.
  DOCUMENT_NOT_RENDERED: Object.freeze({
    code: "DOCUMENT_NOT_RENDERED",
    message: "This document could not be produced.",
    remedy: "Ask for the document again; if it still fails, quote the fault id to support.",
    severity: "error",
    surface: "banner",
  }),
  // R-SPINE-021 addresses a stored document by the sha256 of its own bytes under its workspace's
  // prefix, so an id this workspace holds no row for names a document it never issued — an absence.
  DOCUMENT_NOT_FOUND: Object.freeze({
    code: "DOCUMENT_NOT_FOUND",
    message: "No document is stored under that id in this workspace.",
    remedy: "Open the document list again and follow the link from there.",
    severity: "error",
    surface: "inline",
  }),
  // Q-12: the signature is SEAM-STORAGE's own, over the workspace, the address and the expiry. A
  // link whose signature does not check out was not minted here, and it is told nothing about what
  // stands at the address it names.
  DOCUMENT_URL_INVALID: Object.freeze({
    code: "DOCUMENT_URL_INVALID",
    message: "This document link is not one this workspace issued.",
    remedy: "Open the document again to get a fresh link.",
    severity: "error",
    surface: "inline",
  }),
  // Q-12: a signed URL expires. A link that WAS good and has aged out is a different fact from one
  // that was never good, so it is a warning with its own code — the person did nothing wrong.
  DOCUMENT_URL_EXPIRED: Object.freeze({
    code: "DOCUMENT_URL_EXPIRED",
    message: "This document link has expired.",
    remedy: "Open the document again to get a fresh link.",
    severity: "warning",
    surface: "inline",
  }),
});
