// L-AI-01: the shapes the model seam speaks in — what a caller hands `callModel`, what it gets back,
// what the ledger records about every call, and the format a recorded answer is replayed from. The
// closed model ids and their money live in `../model-ledger.types` (AS-05, B-17); this file names
// only the seam's own contract around them.
import type { ModelId } from "../model-ledger.types";

/** Any JSON value: what a request's params hold and what a model's answer is carried as. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** The two ways a call reaches an answer — the same two spellings `model_calls.transport` admits. */
export type ModelTransport = "fixture" | "live";

/** How a recorded call ended — the same two spellings `model_calls.outcome` admits. */
export type ModelOutcome = "proposed" | "refused";

/** Who is calling, for which project, and under which request — what the ledger and the fault seam attribute to. */
export type ModelCallContext = { tenantId: string; projectId: string; actor: string; requestId: string };

/** One turn of a single text exchange. */
export type ModelMessage = { role: "user" | "assistant"; content: string };

/** What a caller asks of a model: a pinned id, a system prompt, the exchange so far and provider params. */
export type ModelRequest = {
  modelId: ModelId;
  system: string;
  messages: readonly ModelMessage[];
  params?: Readonly<Record<string, JsonValue>>;
};

/** A proposed answer: the payload as the transport carried it, what it spent, and the ledger row that records it. */
export type ModelAnswer = {
  callId: string;
  modelId: ModelId;
  requestHash: string;
  transport: ModelTransport;
  outcome: "proposed";
  payload: JsonValue;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
};

/** One row of the model-call ledger: every answered or refused call, attributed to a tenant and a project. */
export type ModelLedgerRow = {
  tenantId: string;
  projectId: string;
  modelId: ModelId;
  requestHash: string;
  transport: ModelTransport;
  outcome: ModelOutcome;
  refusalCode: string | null;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
};

/** Where ledger rows go. The shipped adapter writes `model_calls`; acceptance hands in a memory one. */
export interface ModelLedger {
  record(row: ModelLedgerRow): Promise<{ callId: string }>;
}

/** A recorded model answer, keyed by the request hash it answers — the file format under a fixture root. */
export type ModelFixture = {
  requestHash: string;
  modelId: ModelId;
  payload: JsonValue;
  inputTokens: number;
  outputTokens: number;
};

/**
 * What a transport answers the seam with: a proposal to record, or a refusal to record and then
 * throw. A transport that could do neither has already reported its fault and thrown (ARCH-03).
 */
export type TransportAnswer =
  | { kind: "answered"; payload: JsonValue; inputTokens: number; outputTokens: number }
  | { kind: "refused"; code: string; refusal: Error };

/** One transport, chosen at seam construction (B-23): where an answer comes from. */
export interface TransportPort {
  readonly transport: ModelTransport;
  answer(ctx: ModelCallContext, request: ModelRequest, hash: string): Promise<TransportAnswer>;
}
