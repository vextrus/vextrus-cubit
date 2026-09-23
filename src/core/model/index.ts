// L-AI-01: the model seam's barrel — the one lawful import from outside `src/core/model/`. Everything
// a caller may hold of the seam is named here; the interior behind it is the seam's own.
export { JEV_MODEL, MODEL_IDS } from "../model-ledger.types";
export { canonicalJson, requestHash } from "./canonical";
export { dbModelLedger } from "./ledger";
export { recordFixture } from "./mint";
export { MODEL_QUESTIONS, MODEL_QUESTION_NAMES, isModelQuestion } from "./questions";
// The id the corroboration arm asks its one Noul under, published because a caller reading that
// answer back off a ledger row must name it by the arm's own spelling and never by a second one.
export { OUTLINE_QUESTION_ID } from "./typesafe-arms/outline-corroboration";
export { callModel, createModelSeam, propose } from "./seam";
export { PROPOSAL_KIND, resolveProposal } from "./proposal";
export { SOURCE_SCHEMES, parseSourceKey, sourceKeyResolver } from "./sources";
export { selectTransport } from "./transport";
// Where Jev is reached (D-002), published for the session harness's live door (scripts/harness/mcp.mjs).
export { TYPESAFE_ENDPOINT } from "./typesafe-arms/arm";
export type { Recording } from "./mint";
export type { ModelQuestion } from "./questions";
export type { DecodeResult, Proposal, ProposalContract, ResolutionCode } from "./proposal";
export type { SourceKey, SourceKeyResolver, SourceScheme } from "./sources";
export type { AnswerJudgment, ModelAnswer, ModelCallContext, ModelFixture, ModelJudgment, ModelLedger, ModelLedgerRow, ModelRequest, ModelTransport } from "./types";
