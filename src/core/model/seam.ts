// L-AI-01: `callModel`, the one path to a model. A call pins its model from the closed const (AS-05),
// is identified by its request hash, goes over the transport the environment selects (B-23), and is
// recorded in the ledger whether it was proposed or refused — the row is written before the caller
// hears the outcome. The seam is a factory over an env, a fetch and a ledger so acceptance can hand
// each one in (B-23); the production entry closes over the process and the tenant's database.
//
// L-AI-02: `propose` is the same path with one more judgement before the row: the transport's
// answer is read as a proposal — wire shape, cited sources resolved against the caller's artifact,
// payload decoded by the caller — and a reading that fails is a refused row that keeps the tokens
// the model spent, then the registered refusal. A second path to a model would break L-AI-01, so
// there is none: both calls settle through `answerThroughPort`.
import { forTenant } from "../db";
import { reportFault } from "../faults/report";
import { refusal } from "../faults/refusal-marker";
import { MODEL_IDS, modelCallCost, type ModelId } from "../model-ledger.types";
import { fixtureTransport } from "./fixture";
import { dbModelLedger } from "./ledger";
import { liveTransport } from "./live";
import { requestHash } from "./canonical";
import { PROPOSAL_KIND, resolveProposal, type Proposal, type ProposalContract, type Resolution, type ResolutionCode } from "./proposal";
import type { SourceKey } from "./sources";
import { selectTransport, type ModelEnv } from "./transport";
import type { JsonValue, ModelAnswer, ModelCallContext, ModelLedger, ModelLedgerRow, ModelRequest, ModelTransport, TransportPort } from "./types";

/** The routes the fault seam records this seam's own failures under — one per public entry (B-21). */
const ROUTES = { callModel: "model/callModel", propose: "model/propose" } as const;

/** What a seam is built over. */
export type ModelSeamOptions = { env: ModelEnv; fetch: typeof globalThis.fetch; ledger: ModelLedger };

/** A seam: the transport it selected, the call it answers, and the proposal it resolves. */
export type ModelSeam = {
  transport: ModelTransport;
  callModel(ctx: ModelCallContext, request: ModelRequest): Promise<ModelAnswer>;
  propose<T>(ctx: ModelCallContext, request: ModelRequest, contract: ProposalContract<T>): Promise<Proposal<T>>;
};

/** A seam over the given environment, fetch and ledger; the transport is selected once, here. */
export function createModelSeam(options: ModelSeamOptions): ModelSeam {
  const selected = selectTransport(options.env);
  const port: TransportPort = selected.transport === "fixture" ? fixtureTransport(selected.fixtureRoot) : liveTransport(options.env, options.fetch);
  return {
    transport: port.transport,
    callModel: (ctx, request) => answerThroughPort(port, options.ledger, ctx, request, asCarried, ROUTES.callModel).then(modelAnswer),
    propose: (ctx, request, contract) => answerThroughPort(port, options.ledger, ctx, request, asProposal(contract), ROUTES.propose).then(proposal),
  };
}

/** The production entry: the process environment, the global fetch, and the tenant's own ledger. */
export async function callModel(ctx: ModelCallContext, request: ModelRequest): Promise<ModelAnswer> {
  return productionSeam(ctx).callModel(ctx, request);
}

/** The production entry for a proposal, over exactly what `callModel` is over. */
export async function propose<T>(ctx: ModelCallContext, request: ModelRequest, contract: ProposalContract<T>): Promise<Proposal<T>> {
  return productionSeam(ctx).propose(ctx, request, contract);
}

function productionSeam(ctx: ModelCallContext): ModelSeam {
  return createModelSeam({ env: process.env, fetch: globalThis.fetch, ledger: dbModelLedger(forTenant({ tenantId: ctx.tenantId })) });
}

/**
 * How a call reads the transport's payload before its row is written: `callModel` takes it as the
 * transport carried it; `propose` resolves it under the caller's contract. A reading that fails
 * names the refusal the row records and the facts the thrown marker carries.
 */
type Reading<T> = (payload: JsonValue) => { ok: true; value: T } | { ok: false; code: ResolutionCode; detail: Record<string, JsonValue>; artifactDigest: string };

/** What every call settles to once its row is written. */
type Settled<T> = {
  callId: string;
  modelId: ModelId;
  requestHash: string;
  transport: ModelTransport;
  value: T;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
};

/** What a resolved proposal settles to: the decoded payload and the sources it rests on. */
type ResolvedProposal<T> = { payload: T; sources: readonly [SourceKey, ...SourceKey[]] };

const asCarried: Reading<JsonValue> = (payload) => ({ ok: true, value: payload });

function asProposal<T>(contract: ProposalContract<T>): Reading<ResolvedProposal<T>> {
  return (payload) => {
    const resolution: Resolution<T> = resolveProposal(payload, contract);
    if (!resolution.ok) return { ok: false, code: resolution.code, detail: resolution.detail, artifactDigest: contract.artifact.artifactDigest };
    return { ok: true, value: { payload: resolution.payload, sources: resolution.sources } };
  };
}

function modelAnswer(settled: Settled<JsonValue>): ModelAnswer {
  const { value, ...call } = settled;
  return { ...call, outcome: "proposed", payload: value };
}

function proposal<T>(settled: Settled<ResolvedProposal<T>>): Proposal<T> {
  return { kind: PROPOSAL_KIND, payload: settled.value.payload, sources: settled.value.sources, model: settled.modelId, callId: settled.callId };
}

/** One call: pin the id, hash the request, ask the transport, read the answer, record the row, settle or refuse. */
async function answerThroughPort<T>(port: TransportPort, ledger: ModelLedger, ctx: ModelCallContext, request: ModelRequest, read: Reading<T>, route: string): Promise<Settled<T>> {
  const modelId = pinned(request.modelId);
  const hash = requestHash(request);
  const answer = await port.answer(ctx, request, hash);
  const attribution = { tenantId: ctx.tenantId, projectId: ctx.projectId, modelId, requestHash: hash, transport: port.transport } as const;

  if (answer.kind === "refused") {
    // Nothing was spent: the transport answered nothing.
    await recordedOrNone(ledger, ctx, route, { ...attribution, outcome: "refused", refusalCode: answer.code, inputTokens: 0, outputTokens: 0, attributedCost: modelCallCost(modelId, 0, 0) });
    throw answer.refusal;
  }

  const attributedCost = modelCallCost(modelId, answer.inputTokens, answer.outputTokens);
  const spent = { inputTokens: answer.inputTokens, outputTokens: answer.outputTokens, attributedCost } as const;
  const reading = await readOrFault(read, answer.payload, ledger, ctx, route, { ...attribution, ...spent });
  if (!reading.ok) {
    // The model answered, so the tokens it spent stay attributed on the refused row (L-AI-02).
    const callId = await recordedOrNone(ledger, ctx, route, { ...attribution, ...spent, outcome: "refused", refusalCode: reading.code });
    throw refusal(reading.code, `the model's answer to request ${hash} was not accepted as a proposal against artifact ${reading.artifactDigest}: ${describe(reading.code, reading.detail)}`, {
      ...reading.detail,
      callId,
      requestHash: hash,
      artifactDigest: reading.artifactDigest,
    });
  }

  const callId = await recordThroughSeam(ledger, ctx, route, { ...attribution, ...spent, outcome: "proposed", refusalCode: null });
  return { callId, modelId, requestHash: hash, transport: port.transport, value: reading.value, ...spent };
}

/**
 * The reading, taken so that a caller whose `decode` or `artifact.has` throws — a defect against
 * the contract, never a refusal (ARCH-03) — cannot swallow the call: the transport already answered
 * and charged, so the call is recorded as the model proposed it (L-AI-01 records every call), the
 * defect crosses the one fault seam under this entry's route (B-21), and the caller hears its own
 * throw unchanged. The row reads `proposed` because that is what happened at the model, and the
 * outcome column spells how the CALL ended: `refused` is the seam's own two judgements — the
 * transport's refusal and a failed reading. That the caller was handed nothing is the fault
 * record's to tell, which is why one is written under the same route and request id (B-21).
 */
async function readOrFault<T>(
  read: Reading<T>,
  payload: JsonValue,
  ledger: ModelLedger,
  ctx: ModelCallContext,
  route: string,
  attributed: Omit<ModelLedgerRow, "outcome" | "refusalCode">,
): Promise<ReturnType<Reading<T>>> {
  try {
    return read(payload);
  } catch (failure) {
    await recordedOrNone(ledger, ctx, route, { ...attributed, outcome: "proposed", refusalCode: null });
    reportFault({ requestId: ctx.requestId, actor: ctx.actor, route, cause: failure });
    throw failure;
  }
}

/**
 * The row, written before the caller hears the outcome. A failed write is a fault of its own
 * (ARCH-03), recorded once under the entry the caller used — every path's write crosses here, the
 * proposed row included. A call that could not be recorded is no answer: L-AI-01 records every
 * call, and the id a Proposal and a ModelAnswer carry is the ledger's own, so the caller hears the
 * write's failure rather than an answer that names no call.
 */
async function recordThroughSeam(ledger: ModelLedger, ctx: ModelCallContext, route: string, row: ModelLedgerRow): Promise<string> {
  try {
    return (await ledger.record(row)).callId;
  } catch (failure) {
    reportFault({ requestId: ctx.requestId, actor: ctx.actor, route, cause: failure });
    throw failure;
  }
}

/**
 * The same write on a path that already holds the caller's answer — a refusal to throw, or the
 * caller's own defect (B-21). The fault is recorded by the write above; here it ends, and the
 * answer the caller is owed reaches it with no call id, since none was issued.
 */
async function recordedOrNone(ledger: ModelLedger, ctx: ModelCallContext, route: string, row: ModelLedgerRow): Promise<string | null> {
  return recordThroughSeam(ledger, ctx, route, row).then(
    (callId) => callId,
    () => null,
  );
}

/** How much of one model-supplied fact the operator's message carries before it is clipped. */
const FACT_LIMIT = 200;

/**
 * What a refusal says when its detail holds no fact at all — one sentence per resolution code, total
 * over the closed set (L-AI-02, R-SPINE-062). A detail is empty only when the judgement had nothing
 * model-supplied to state, and the sentence is then the whole of what the operator is told: it
 * belongs to the code, exported and total, rather than to a branch inside `describe` that could
 * answer one code's words for another's failure (B-17, ARCH-02).
 */
export const EMPTY_DETAIL_SENTENCES: Readonly<Record<ResolutionCode, string>> = Object.freeze({
  UNSOURCED: "no source was cited",
  SOURCE_UNRESOLVED: "no cited source resolved against the artifact",
  MALFORMED: "the answer was not shaped as a proposal",
});

/**
 * The operator's detail of a failed reading, as `key=value` facts; a detail holding none says the
 * sentence of its own code. Every value is model-supplied — a rejected source string, a decoder's
 * detail, the list of unresolved keys — so each fact is clipped to a readable length: the whole of it
 * lives on the refusal's detail, and the message never amplifies what a model answered.
 */
function describe(code: ResolutionCode, detail: Record<string, JsonValue>): string {
  const facts = Object.entries(detail).map(([key, value]) => `${key}=${clip(JSON.stringify(value) ?? "null")}`);
  return facts.length === 0 ? EMPTY_DETAIL_SENTENCES[code] : facts.join(", ");
}

function clip(text: string): string {
  return text.length <= FACT_LIMIT ? text : `${text.slice(0, FACT_LIMIT)}… (${text.length - FACT_LIMIT} more characters)`;
}

/**
 * The id as one of the closed const's, checked at runtime too: a caller that reaches past the type
 * with an unpinned id has a programming defect, answered plainly — no fetch, no row (AS-05, B-21).
 */
function pinned(modelId: string): ModelId {
  if (!(MODEL_IDS as readonly string[]).includes(modelId)) {
    throw new Error(`${JSON.stringify(modelId)} is not a pinned model id — a call names one of ${MODEL_IDS.join(", ")} (AS-05)`);
  }
  return modelId as ModelId;
}
