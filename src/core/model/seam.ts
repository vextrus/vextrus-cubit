// L-AI-01: `callModel`, the one path to a model. A call pins its model from the closed const (AS-05),
// is identified by its request hash, goes over the transport the environment selects (B-23), and is
// recorded in the ledger whether it was proposed or refused — the row is written before the caller
// hears the outcome. The seam is a factory over an env, a fetch and a ledger so acceptance can hand
// each one in (B-23); the production entry closes over the process and the tenant's database.
import { forTenant } from "../db";
import { MODEL_IDS, modelCallCost, type ModelId } from "../model-ledger.types";
import { fixtureTransport } from "./fixture";
import { dbModelLedger } from "./ledger";
import { liveTransport } from "./live";
import { requestHash } from "./canonical";
import { selectTransport, type ModelEnv } from "./transport";
import type { ModelAnswer, ModelCallContext, ModelLedger, ModelRequest, ModelTransport, TransportPort } from "./types";

/** What a seam is built over. */
export type ModelSeamOptions = { env: ModelEnv; fetch: typeof globalThis.fetch; ledger: ModelLedger };

/** A seam: the transport it selected, and the call it answers. */
export type ModelSeam = { transport: ModelTransport; callModel(ctx: ModelCallContext, request: ModelRequest): Promise<ModelAnswer> };

/** A seam over the given environment, fetch and ledger; the transport is selected once, here. */
export function createModelSeam(options: ModelSeamOptions): ModelSeam {
  const selected = selectTransport(options.env);
  const port: TransportPort = selected.transport === "fixture" ? fixtureTransport(selected.fixtureRoot) : liveTransport(options.env, options.fetch);
  return {
    transport: port.transport,
    callModel: (ctx, request) => answerThroughPort(port, options.ledger, ctx, request),
  };
}

/** The production entry: the process environment, the global fetch, and the tenant's own ledger. */
export async function callModel(ctx: ModelCallContext, request: ModelRequest): Promise<ModelAnswer> {
  const seam = createModelSeam({ env: process.env, fetch: globalThis.fetch, ledger: dbModelLedger(forTenant({ tenantId: ctx.tenantId })) });
  return seam.callModel(ctx, request);
}

/** One call: pin the id, hash the request, ask the transport, record the row, answer or refuse. */
async function answerThroughPort(port: TransportPort, ledger: ModelLedger, ctx: ModelCallContext, request: ModelRequest): Promise<ModelAnswer> {
  const modelId = pinned(request.modelId);
  const hash = requestHash(request);
  const answer = await port.answer(ctx, request, hash);
  const attribution = { tenantId: ctx.tenantId, projectId: ctx.projectId, modelId, requestHash: hash, transport: port.transport } as const;

  if (answer.kind === "refused") {
    await ledger.record({ ...attribution, outcome: "refused", refusalCode: answer.code, inputTokens: 0, outputTokens: 0, attributedCost: modelCallCost(modelId, 0, 0) });
    throw answer.refusal;
  }

  const attributedCost = modelCallCost(modelId, answer.inputTokens, answer.outputTokens);
  const { callId } = await ledger.record({
    ...attribution,
    outcome: "proposed",
    refusalCode: null,
    inputTokens: answer.inputTokens,
    outputTokens: answer.outputTokens,
    attributedCost,
  });
  return {
    callId,
    modelId,
    requestHash: hash,
    transport: port.transport,
    outcome: "proposed",
    payload: answer.payload,
    inputTokens: answer.inputTokens,
    outputTokens: answer.outputTokens,
    attributedCost,
  };
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
