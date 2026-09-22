// L-AI-01: the live transport — a fetch-based client of the model provider, and no SDK. Two
// providers are spoken to, chosen by which key the environment holds: TypeSafe Jev System One
// where `TYPESAFE_API_KEY` is set (`./typesafe`: closed questions, no generation), the Anthropic
// Messages API otherwise. Anything that keeps a call from being answered here is infrastructure,
// never a product decision (B-14): a missing key, a rejected fetch, a non-2xx status, a body without
// the answer's shape, a request the chosen provider has no question for. Each such failure crosses
// the fault seam exactly once and rejects with a plain error naming the fault (ARCH-03, B-21);
// nothing is parked and no ledger row is written for a call nobody answered.
import { reportFault } from "../faults/report";
import { tokenCount } from "../model-ledger.types";
import type { ModelEnv } from "./transport";
import { exchangeTypeSafe, type ProviderBody } from "./typesafe";
import type { JsonValue, ModelRequest, TransportAnswer, TransportPort } from "./types";

/** The Anthropic provider's endpoint and the API version this client speaks. */
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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
      let body: ProviderBody;
      try {
        body = await exchange(env, fetch, request);
      } catch (failure) {
        const { faultId } = reportFault({ requestId: ctx.requestId, actor: ctx.actor, route: ROUTE, cause: failure });
        throw new Error(`the model call ${hash} was not answered — recorded as fault ${faultId}`, { cause: failure });
      }
      // Whether the usage counts tokens is the money derivation's one judgement (B-17), and a
      // figure that is not a count fails exactly as the derivation fails for it — outside the
      // exchange, so the sentence the caller reads is the derivation's own and not a fault id.
      return { kind: "answered", payload: body.content, inputTokens: tokenCount(body.inputTokens), outputTokens: tokenCount(body.outputTokens), judgment: body.judgment, body: body.body };
    },
  };
}

/**
 * What the provider may generate for this request: the caller's `max_tokens` when it is a positive
 * integer, and the default otherwise — absent, `null` and any figure that is not a whole positive
 * number all fall to it, so no param can post a limit the provider would refuse.
 */
function maxTokensOf(params: Record<string, unknown>): number {
  const given = params["max_tokens"];
  return typeof given === "number" && Number.isSafeInteger(given) && given > 0 ? given : DEFAULT_MAX_TOKENS;
}

/** One request to the provider the environment names, answered or thrown. */
async function exchange(env: ModelEnv, fetch: typeof globalThis.fetch, request: ModelRequest): Promise<ProviderBody> {
  const typeSafeKey = keyOf(env.TYPESAFE_API_KEY) ?? keyOf(env.TYPESAFE_AI_API_KEY);
  if (typeSafeKey !== null) return exchangeTypeSafe(typeSafeKey, fetch, request, DEADLINE_MS);

  const anthropicKey = keyOf(env.ANTHROPIC_API_KEY);
  if (anthropicKey !== null) return exchangeAnthropic(anthropicKey, fetch, request);

  throw new Error("the environment holds neither TYPESAFE_API_KEY nor ANTHROPIC_API_KEY, so the live model transport cannot be reached");
}

/** A key as the environment states it, or null where it states none worth the name. */
function keyOf(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** The Anthropic Messages client. */
async function exchangeAnthropic(key: string, fetch: typeof globalThis.fetch, request: ModelRequest): Promise<ProviderBody> {
  const params = request.params ?? {};
  const body = {
    ...params,
    model: request.modelId,
    system: request.system,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    max_tokens: maxTokensOf(params),
  };
  const response = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
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

/** The provider's body with the answer's shape: content, and a usage whose figures are read as given. */
function answered(body: unknown): ProviderBody {
  if (body === null || typeof body !== "object" || !Object.hasOwn(body, "content")) {
    throw new Error("the model provider answered a body without content");
  }
  const usage = (body as { usage?: unknown }).usage;
  const counts = usage !== null && typeof usage === "object" ? (usage as { input_tokens?: unknown; output_tokens?: unknown }) : {};
  // A generative provider states nothing about its own answer: no choice, no probability, no
  // confidence — so the call carries no judgment, and the calibration line has nothing to read. Its
  // content IS the payload, so there is no second reading of it a kept body could replay.
  return { content: (body as { content: JsonValue }).content, inputTokens: counts.input_tokens, outputTokens: counts.output_tokens, judgment: null, body: null };
}
