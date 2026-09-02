// L-AI-01: the model seam's barrel — the one lawful import from outside `src/core/model/`. Everything
// a caller may hold of the seam is named here; the interior behind it is the seam's own.
export { MODEL_IDS } from "../model-ledger.types";
export { canonicalJson, requestHash } from "./canonical";
export { dbModelLedger } from "./ledger";
export { callModel, createModelSeam, propose } from "./seam";
export { PROPOSAL_KIND, resolveProposal } from "./proposal";
export { SOURCE_SCHEMES, parseSourceKey, sourceKeyResolver } from "./sources";
export { selectTransport } from "./transport";
export type { DecodeResult, Proposal, ProposalContract, ResolutionCode } from "./proposal";
export type { SourceKey, SourceKeyResolver, SourceScheme } from "./sources";
export type { ModelAnswer, ModelCallContext, ModelFixture, ModelLedger, ModelLedgerRow, ModelRequest, ModelTransport } from "./types";
