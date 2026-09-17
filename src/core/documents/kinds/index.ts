// SEAM-DOC's kind registry: every document this product issues, enumerated (AM-11, R-SPINE-040).
//
// "Here" is this DIRECTORY, not this file. Each kind is one file — `<kind>.ts` with its `.typ`
// beside it — declaring its own key, its own Zod payload schema and its own presenter; this file is
// the roster, and it ENUMERATES those files and never re-declares what they say. A kind joins the
// product by adding its file and ONE line to the list below, and no other file in the tree moves
// (B-19). A key declared twice throws at import rather than one kind silently winning (`enumerateKinds`).
//
// The unpriced draft BOQ joined the roster exactly that way: one file, one line below, nothing else
// in the tree moved (R-TO-053, A-BOQ-PDF). `bbs` is its own increment's file and line
// (inc-310-bbs-view), which is what "the seam is built, the kinds extend it" means in practice.
import { BBS_KIND } from "./bbs";
import { BOQ_DRAFT_KIND } from "./boq-draft";
import { enumerateKinds, type DocumentKind } from "./law";
import { PROOF_KIND } from "./proof";

export type { DocumentKind } from "./law";

/**
 * Every document kind this product issues, keyed by the key each kind states for itself. The map is
 * frozen and total: `renderDocument` refuses a key it does not hold rather than inventing a template
 * for it (DOCUMENT_KIND_UNKNOWN).
 */
export const DOCUMENT_KINDS: Readonly<Record<string, DocumentKind>> = enumerateKinds([PROOF_KIND, BOQ_DRAFT_KIND, BBS_KIND]);
