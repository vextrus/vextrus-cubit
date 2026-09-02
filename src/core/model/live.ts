// L-AI-01: the live transport — a fetch-based client of the provider's Messages endpoint, and no SDK.
// Anything that keeps a call from being answered here is infrastructure, never a product decision
// (B-14): a missing key, a rejected fetch, a non-2xx status, a body without the answer's shape.
// Each such failure crosses the fault seam exactly once and rejects with a plain error naming the
// fault (ARCH-03, B-21); nothing is parked and no ledger row is written for a call nobody answered.
import { reportFault } from "../faults/report";
import type { ModelEnv } from "./transport";
import type { JsonValue, ModelRequest, TransportAnswer, TransportPort } from "./types";

/** The provider's single text-message exchange, and the API version this client speaks. */
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

/** What a call may generate when its params do not say. */
const DEFAULT_MAX_TOKENS = 1024;

/** The route the fault seam records a failed live call under. */
const ROUTE = "model/callModel";

/** How long a call waits for the provider before it is a fault: a hang parks nothing either (B-14). */
const DEADLINE_MS = 120_000;

/** A transport over the provider, reached through the fetch and the environment the seam was handed. */
export function liveTransport(env: ModelEnv, fetch: typeof globalThis.fetch): TransportPort {
  return {
    transport: "live",
    async answer(ctx, request, hash): Promise<TransportAnswer> {
      try {
        return await exchange(env, fetch, request);
      } catch (failure) {
        const { faultId } = reportFault({ requestId: ctx.requestId, actor: ctx.actor, route: ROUTE, cause: failure });
        throw new Error(`the model call ${hash} was not answered — recorded as fault ${faultId}`, { cause: failure });
      }
    },
  };
}

/** One request to the provider, answered or thrown. */
async function exchange(env: ModelEnv, fetch: typeof globalThis.fetch, request: ModelRequest): Promise<TransportAnswer> {
  const key = env.ANTHROPIC_API_KEY;
  if (typeof key !== "string" || key === "") throw new Error("the environment holds no ANTHROPIC_API_KEY, so the live model transport cannot be reached");
  const params = request.params ?? {};
  // The pinned id, the prompt and the exchange are spelled after the params, so no param can
  // stand in for them: what the provider is asked is what the ledger row attributes (AS-05).
  const body = {
    ...params,
    model: request.modelId,
    system: request.system,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    max_tokens: params["max_tokens"] ?? DEFAULT_MAX_TOKENS,
  };
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": VERSION, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEADLINE_MS),
  });
  if (!response.ok) {
    await discarded(response);
    throw new Error(`the model provider answered ${response.status} ${response.statusText}`.trimEnd());
  }
  return answered((await response.json()) as unknown);
}

/** A body nobody will read, released so the connection is not held until collection. */
async function discarded(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The status line is the fault; a body that would not close adds nothing to it.
  }
}

/** The provider's body as the seam's answer: its content, and the tokens its usage counts. */
function answered(body: unknown): TransportAnswer {
  if (body === null || typeof body !== "object" || !Object.hasOwn(body, "content")) {
    throw new Error("the model provider answered a body without content");
  }
  const usage = (body as { usage?: unknown }).usage;
  const inputTokens = (usage as { input_tokens?: unknown } | undefined)?.input_tokens;
  const outputTokens = (usage as { output_tokens?: unknown } | undefined)?.output_tokens;
  if (!isTokenCount(inputTokens) || !isTokenCount(outputTokens)) {
    throw new Error("the model provider answered a body whose usage does not count tokens as whole, non-negative numbers");
  }
  return { kind: "answered", payload: (body as { content: JsonValue }).content, inputTokens, outputTokens };
}

const isTokenCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
