// SEAM-MODEL's refusals (L-AI-01, L-AI-02): what the model seam answers when the fixture transport
// holds no recorded answer, and the three ways a model's answer fails to become a proposal.

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type AiRefusalCode =
  | "FIXTURE_MISSING"
  | "UNSOURCED"
  | "SOURCE_UNRESOLVED"
  | "MALFORMED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const AI_REFUSALS: RefusalGroup<AiRefusalCode> = Object.freeze({
  // L-AI-01: under the fixture transport a request nobody recorded an answer for is refused, never
  // sent to a provider — verify is network-free, and the refusal is a ledger row like any other.
  FIXTURE_MISSING: Object.freeze({
    code: "FIXTURE_MISSING",
    message: "No recorded model answer exists for this request, so it was not carried out.",
    remedy: "Record the model's answer for this request, then try it again.",
    severity: "error",
    surface: "inline",
  }),
  // L-AI-02: a model's answer is a proposal only once every source it cites is resolved against the
  // artifact; the three ways it fails that are refusals, each recorded in the ledger as a refused
  // call that still keeps the tokens the transport spent.
  UNSOURCED: Object.freeze({
    code: "UNSOURCED",
    message: "The model's answer names no source entity in the drawing, so it was not accepted as a proposal.",
    remedy: "Request the answer again with the entities it rests on cited — nothing uncited is carried forward.",
    severity: "error",
    surface: "inline",
  }),
  SOURCE_UNRESOLVED: Object.freeze({
    code: "SOURCE_UNRESOLVED",
    message: "The model's answer cites a source entity the drawing does not contain, so it was not accepted as a proposal.",
    remedy: "Request the answer again against the drawing as ingested — a citation must name an entity that exists in it.",
    severity: "error",
    surface: "inline",
  }),
  // This code is the MODEL transport's and stays it: one code, one meaning (R-SPINE-062). L-AI-01
  // fixes its copy at the shape a PROPOSAL takes, so it is never the answer to a caller whose form
  // field was unreadable — the transports answer `REQUEST_MALFORMED` (./server.ts) for that.
  MALFORMED: Object.freeze({
    code: "MALFORMED",
    message: "The model's answer is not in the shape a proposal takes, so it was not accepted.",
    remedy: "Request the answer again — an answer that cannot be read as a proposal is never guessed at.",
    severity: "error",
    surface: "inline",
  }),
});
