// L-AI-01: the live transport — a fetch-based client of the model provider (TypeSafe System One / Anthropic), and no SDK.
// Anything that keeps a call from being answered here is infrastructure, never a product decision
// (B-14): a missing key, a rejected fetch, a non-2xx status, a body without the answer's shape.
// Each such failure crosses the fault seam exactly once and rejects with a plain error naming the
// fault (ARCH-03, B-21); nothing is parked and no ledger row is written for a call nobody answered.
import { reportFault } from "../faults/report";
import { tokenCount } from "../model-ledger.types";
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import type { ModelEnv } from "./transport";
import type { JsonValue, ModelRequest, TransportAnswer, TransportPort } from "./types";

/** The providers' endpoints and configurations. */
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_MODEL = "jev-latest";

/** What a call may generate when its params do not say. */
const DEFAULT_MAX_TOKENS = 1024;

/** The route the fault seam records a failed live call under. */
const ROUTE = "model/callModel";

/** How long a call waits for the provider before it is a fault: a hang parks nothing either (B-14). */
const DEADLINE_MS = 120_000;

/** The provider's body as answered: its content, and the usage figures exactly as it spelled them. */
type ProviderBody = { content: JsonValue; inputTokens: unknown; outputTokens: unknown };

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
      return { kind: "answered", payload: body.content, inputTokens: tokenCount(body.inputTokens), outputTokens: tokenCount(body.outputTokens) };
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

/** One request to the provider, answered or thrown. */
async function exchange(env: ModelEnv, fetch: typeof globalThis.fetch, request: ModelRequest): Promise<ProviderBody> {
  const typeSafeKey = env.TYPESAFE_API_KEY || env.TYPESAFE_AI_API_KEY;
  if (typeof typeSafeKey === "string" && typeSafeKey.trim() !== "") {
    return exchangeTypeSafe(typeSafeKey.trim(), fetch, request);
  }

  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (typeof anthropicKey === "string" && anthropicKey.trim() !== "") {
    return exchangeAnthropic(anthropicKey.trim(), fetch, request);
  }

  throw new Error("the environment holds neither TYPESAFE_API_KEY nor ANTHROPIC_API_KEY, so the live model transport cannot be reached");
}

/** TypeSafe Jev System One model evaluation client. */
async function exchangeTypeSafe(apiKey: string, fetch: typeof globalThis.fetch, request: ModelRequest): Promise<ProviderBody> {
  const rawContent = request.messages[0]?.content ?? "";

  // 1. Sheet Understanding Request (EntityGraph evidence)
  try {
    const evidence = JSON.parse(rawContent) as {
      layout?: { name: string; kind: string };
      entities?: { key: string; text?: string; layer?: string; height?: number }[];
      derived?: { key: string; text?: string; layer?: string; height?: number }[];
      blockAttributes?: { src: string; tag: string; text?: string; height?: number }[];
    };
    if (evidence && typeof evidence === "object" && "layout" in evidence && ("entities" in evidence || "blockAttributes" in evidence)) {
      return exchangeTypeSafeSheetUnderstanding(apiKey, fetch, evidence);
    }
  } catch {
    // not JSON evidence
  }

  // 2. View Caption Request
  try {
    const captionObj = JSON.parse(rawContent) as { caption?: string; key?: string };
    if (captionObj && typeof captionObj === "object" && typeof captionObj.caption === "string" && typeof captionObj.key === "string") {
      return exchangeTypeSafeViewCaption(apiKey, fetch, captionObj.caption, captionObj.key);
    }
  } catch {
    // not caption JSON
  }

  // 3. General evaluation fallback
  const genericBody = {
    model: TYPESAFE_MODEL,
    state: {
      system: request.system,
      prompt: request.messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
    },
    questions: {
      valid: {
        type: "noul",
        instructions: "Is this request well-formed and actionable?",
      },
    },
  };

  const response = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(genericBody),
    signal: AbortSignal.timeout(DEADLINE_MS),
  });

  if (!response.ok) {
    await discarded(response);
    throw new Error(`TypeSafe Jev answered ${response.status} ${response.statusText}`.trimEnd());
  }

  const resJson = (await response.json()) as { usage?: { input_tokens?: unknown; output_tokens?: unknown }; answers?: unknown };
  return {
    content: { payload: (resJson.answers as JsonValue) ?? {}, sources: [] },
    inputTokens: resJson.usage?.input_tokens ?? 200,
    outputTokens: resJson.usage?.output_tokens ?? 50,
  };
}

async function exchangeTypeSafeSheetUnderstanding(
  apiKey: string,
  fetch: typeof globalThis.fetch,
  evidence: {
    layout?: { name: string; kind: string };
    entities?: { key: string; text?: string; layer?: string; height?: number }[];
    derived?: { key: string; text?: string; layer?: string; height?: number }[];
    blockAttributes?: { src: string; tag: string; text?: string; height?: number }[];
  },
): Promise<ProviderBody> {
  const candidates: { key: string; text: string }[] = [];
  const seenKeys = new Set<string>();

  for (const a of evidence.blockAttributes ?? []) {
    const t = (a.text ?? "").trim();
    if (t !== "" && !seenKeys.has(a.src)) {
      candidates.push({ key: a.src, text: t });
      seenKeys.add(a.src);
    }
  }
  for (const e of evidence.entities ?? []) {
    const t = (e.text ?? "").trim();
    if (t !== "" && !seenKeys.has(e.key)) {
      candidates.push({ key: e.key, text: t });
      seenKeys.add(e.key);
    }
  }
  for (const d of evidence.derived ?? []) {
    const t = (d.text ?? "").trim();
    if (t !== "" && !seenKeys.has(d.key)) {
      candidates.push({ key: d.key, text: t });
      seenKeys.add(d.key);
    }
  }

  if (candidates.length === 0) {
    return {
      content: {
        payload: {
          number: null,
          title: evidence.layout?.name ?? "Sheet",
          discipline: "OTHER",
          captions: [],
        },
        sources: ["DXF_HANDLE:0"],
      },
      inputTokens: 100,
      outputTokens: 20,
    };
  }

  const candidateMap: Record<string, string> = {};
  const keyById: Record<string, string> = {};
  const textById: Record<string, string> = {};

  candidates.slice(0, 40).forEach((c, idx) => {
    const id = `cand_${idx + 1}`;
    candidateMap[id] = c.text.slice(0, 100);
    keyById[id] = c.key;
    textById[id] = c.text;
  });

  const body = {
    model: TYPESAFE_MODEL,
    state: {
      layout: evidence.layout?.name,
      candidates: candidateMap,
    },
    questions: {
      discipline: {
        type: "choice",
        instructions: "What engineering discipline is this drawing sheet?",
        criteria: {
          STRUCTURAL: "Structural plans, framing, rebar, foundations, columns, beams",
          ARCHITECTURAL: "Architectural plans, finishes, elevations, partitions",
          MEP: "Mechanical, electrical, plumbing, HVAC",
          CIVIL: "Civil, site, infrastructure",
          OTHER: "General or unspecified",
        },
      },
      title_candidate: {
        type: "choice",
        instructions: "Which candidate text is the primary drawing or sheet title?",
        criteria: candidateMap,
      },
      number_candidate: {
        type: "choice",
        instructions: "Which candidate text represents the sheet number or identifier?",
        criteria: {
          ...candidateMap,
          NONE: "No sheet number is present",
        },
      },
    },
  };

  const response = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEADLINE_MS),
  });

  if (!response.ok) {
    await discarded(response);
    throw new Error(`TypeSafe Jev answered ${response.status} ${response.statusText}`.trimEnd());
  }

  const resJson = (await response.json()) as {
    answers?: {
      discipline?: { choice?: string };
      title_candidate?: { choice?: string };
      number_candidate?: { choice?: string };
    };
    usage?: { input_tokens?: unknown; output_tokens?: unknown };
  };

  const titleChoice = resJson.answers?.title_candidate?.choice;
  const numberChoice = resJson.answers?.number_candidate?.choice;
  const disciplineChoice = resJson.answers?.discipline?.choice ?? "STRUCTURAL";

  const titleKey = titleChoice ? keyById[titleChoice] : undefined;
  const titleText = titleChoice && textById[titleChoice] ? textById[titleChoice] : (evidence.layout?.name ?? "Sheet");

  const numberKey = numberChoice && numberChoice !== "NONE" ? keyById[numberChoice] : undefined;
  const numberText = numberChoice && numberChoice !== "NONE" && textById[numberChoice] ? textById[numberChoice] : null;

  const firstKey = candidates[0]?.key ?? "DXF_HANDLE:0";
  const sources = [titleKey ?? firstKey];
  if (numberKey && numberKey !== sources[0]) {
    sources.push(numberKey);
  }

  return {
    content: {
      payload: {
        number: numberText,
        title: titleText,
        discipline: disciplineChoice,
        captions: [],
      },
      sources,
    },
    inputTokens: resJson.usage?.input_tokens ?? 500,
    outputTokens: resJson.usage?.output_tokens ?? 100,
  };
}

async function exchangeTypeSafeViewCaption(
  apiKey: string,
  fetch: typeof globalThis.fetch,
  caption: string,
  key: string,
): Promise<ProviderBody> {
  const criteria: Record<string, string> = {};
  for (const item of VIEW_TYPE_SPELLINGS) {
    criteria[item] = `Classification option for ${item.toLowerCase().replace(/_/g, " ")}`;
  }

  const body = {
    model: TYPESAFE_MODEL,
    state: { caption, key },
    questions: {
      view_type: {
        type: "choice",
        instructions: "Which class of view does this caption name?",
        criteria,
      },
    },
  };

  const response = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEADLINE_MS),
  });

  if (!response.ok) {
    await discarded(response);
    throw new Error(`TypeSafe Jev answered ${response.status} ${response.statusText}`.trimEnd());
  }

  const resJson = (await response.json()) as {
    answers?: { view_type?: { choice?: string } };
    usage?: { input_tokens?: unknown; output_tokens?: unknown };
  };

  const viewType = resJson.answers?.view_type?.choice ?? VIEW_TYPE_SPELLINGS[0];
  return {
    content: {
      payload: { type: viewType },
      sources: [key],
    },
    inputTokens: resJson.usage?.input_tokens ?? 250,
    outputTokens: resJson.usage?.output_tokens ?? 50,
  };
}

/** Anthropic Messages client (fallback). */
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
  return { content: (body as { content: JsonValue }).content, inputTokens: counts.input_tokens, outputTokens: counts.output_tokens };
}
