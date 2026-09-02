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

/** The route the fault seam records this seam's own failures under. */
const ROUTE = "model/callModel";

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
    callModel: (ctx, request) => answerThroughPort(port, options.ledger, ctx, request, asCarried).then(modelAnswer),
    propose: (ctx, request, contract) => answerThroughPort(port, options.ledger, ctx, request, asProposal(contract)).then(proposal),
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
async function answerThroughPort<T>(port: TransportPort, ledger: ModelLedger, ctx: ModelCallContext, request: ModelRequest, read: Reading<T>): Promise<Settled<T>> {
  const modelId = pinned(request.modelId);
  const hash = requestHash(request);
  const answer = await port.answer(ctx, request, hash);
  const attribution = { tenantId: ctx.tenantId, projectId: ctx.projectId, modelId, requestHash: hash, transport: port.transport } as const;

  if (answer.kind === "refused") {
    // Nothing was spent: the transport answered nothing.
    await recordRefused(ledger, ctx, { ...attribution, outcome: "refused", refusalCode: answer.code, inputTokens: 0, outputTokens: 0, attributedCost: modelCallCost(modelId, 0, 0) });
    throw answer.refusal;
  }

  const attributedCost = modelCallCost(modelId, answer.inputTokens, answer.outputTokens);
  const spent = { inputTokens: answer.inputTokens, outputTokens: answer.outputTokens, attributedCost } as const;
  const reading = read(answer.payload);
  if (!reading.ok) {
    // The model answered, so the tokens it spent stay attributed on the refused row (L-AI-02).
    const callId = await recordRefused(ledger, ctx, { ...attribution, ...spent, outcome: "refused", refusalCode: reading.code });
    throw refusal(reading.code, `the model's answer to request ${hash} was not accepted as a proposal against artifact ${reading.artifactDigest}: ${describe(reading.detail)}`, {
      ...reading.detail,
      callId,
      requestHash: hash,
      artifactDigest: reading.artifactDigest,
    });
  }

  const { callId } = await ledger.record({ ...attribution, ...spent, outcome: "proposed", refusalCode: null });
  return { callId, modelId, requestHash: hash, transport: port.transport, value: reading.value, ...spent };
}

/**
 * The refused row, written before the caller hears the refusal. The refusal happened whether or not
 * the ledger could take it: a failed write is a fault of its own (ARCH-03), recorded once, and the
 * caller still hears the refusal (B-21) — with no call id, since none was issued.
 */
async function recordRefused(ledger: ModelLedger, ctx: ModelCallContext, row: ModelLedgerRow): Promise<string | null> {
  try {
    return (await ledger.record(row)).callId;
  } catch (failure) {
    reportFault({ requestId: ctx.requestId, actor: ctx.actor, route: ROUTE, cause: failure });
    return null;
  }
}

/** The operator's detail of a failed reading, as `key=value` facts; an empty detail says nothing more. */
function describe(detail: Record<string, JsonValue>): string {
  const facts = Object.entries(detail).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  return facts.length === 0 ? "no source was cited" : facts.join(", ");
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
