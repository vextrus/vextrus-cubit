// L-AI-01's live transport, TypeSafe Jev System One half: a structured-question client, and no SDK.
//
// Jev does not generate text. It answers closed questions — a `choice` over criteria the caller
// spells — so the only requests it can be asked are the ones this seam already spells as closed
// questions. Each is an ARM of its own (`./typesafe/`), enumerated by `./typesafe/registry`: the
// silent-sheet reading (`@/modules/ai/sheet-understanding`: which candidate text is the title, which
// the number, which discipline) and the view-caption class (`@/core/view-captions`: which class of
// view a caption names). This file is the WIRE — it recognises which arm a request belongs to, posts
// what that arm composed and reads what came back; what is asked, and how an answer is read, is the
// arm's own and lives nowhere else (AM-11).
//
// An arm recognises a request by the exact key set of the request's canonical JSON content, the same
// content the request hash is taken over, so what is asked of Jev is a function of the request and
// of nothing else (L-AI-01 replays deterministically).
//
// What comes back is spelled as the wire the seam resolves (`{payload, sources}`) and NOTHING is
// supplied where Jev supplied nothing (L-AI-02): a title Jev did not choose is null and the reading
// is refused as MALFORMED; a discipline outside the closed list is refused the same way; a source is
// only ever the key of a candidate Jev chose, so an answer citing nothing is UNSOURCED. Usage is
// carried as Jev states it, and a usage that is not a count fails as the ledger's own derivation
// fails for it (B-17). A request Jev has no question for is infrastructure's fault, never a
// product decision (B-14): it is thrown, and no question is posted.
//
// The contract spoken is the HTTP API as its documentation states it (docs.typesafe.ai/api, read
// 2026-09-21): `POST /v1/systemone` with a bearer key; a body of `model`, `state` and `questions`,
// each question `{type, instructions, criteria}`; an answer of `{type, choice, probabilities,
// confidence}` per question; `usage.input_tokens` and `usage.output_tokens`; and `model` reporting
// the versioned id the alias resolved to. The guidance the docs give is followed to the letter by
// every arm: instructions reference the state by its backticked field paths, a question carries its
// whole meaning in itself (its id is never sent), and a no-match outcome is offered where nothing
// may fit. What Jev says about its answer — the choice's confidence and probabilities — is carried
// beside the wire as the call's judgment, for the ledger to record and the calibration line to read;
// the seam never routes on it here, because a threshold is the caller's policy, evaluated on that
// corpus.
import { TYPESAFE_ENDPOINT, TYPESAFE_MODEL, type TypeSafeArm } from "./typesafe-arms/arm";
import { TYPESAFE_ARMS, type TypeSafeTask } from "./typesafe-arms/registry";
import type { AnswerJudgment, JsonValue, ModelJudgment, ModelRequest } from "./types";

// Where Jev is reached, the model asked for, and how many of a sheet's texts are put to it: each is
// declared where it is spoken — the wire's two by the arms' own leaf, the cap by the arm that caps —
// and published from here, which is the seam's face for this provider.
export { TYPESAFE_ENDPOINT, TYPESAFE_MODEL };
export { CANDIDATE_CAP } from "./typesafe-arms/sheet-reading";

/** What a provider's body is read into: the wire the seam resolves, the usage as stated, and what the model said of its answer. */
export type ProviderBody = { content: JsonValue; inputTokens: unknown; outputTokens: unknown; judgment: ModelJudgment | null };

/** The closed questions this adapter can put to Jev, as recognised on a request. */
export type StructuredTask = TypeSafeTask;

/** An arm and the task it recognised — always one arm's, never two (`TypeSafeArm`). */
type Recognised = { arm: TypeSafeArm; task: StructuredTask };

/** The structured question a request is, or null where it is no question this adapter can ask. */
export function structuredTaskOf(request: ModelRequest): StructuredTask | null {
  return recognisedIn(request)?.task ?? null;
}

/** The arm whose key set this request's canonical content is, with the task it read out of it. */
function recognisedIn(request: ModelRequest): Recognised | null {
  const content = request.messages.find((message) => message.role === "user")?.content;
  if (content === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const keys = Object.keys(parsed).sort();
  const record = parsed as Record<string, unknown>;
  for (const candidate of TYPESAFE_ARMS) {
    if (!sameKeys(keys, candidate.keys)) continue;
    const task = candidate.recognise(record);
    // Held as the contract rather than as this one arm: what a caller may do with an arm is ask it
    // to recognise and hand the task it recognised back — and both have happened by here.
    const arm: TypeSafeArm = candidate;
    return task === null ? null : { arm, task };
  }
  return null;
}

function sameKeys(keys: readonly string[], expected: readonly string[]): boolean {
  return keys.length === expected.length && expected.every((key, index) => keys[index] === key);
}

/** One request put to Jev, answered as the wire the seam resolves — or thrown. */
export async function exchangeTypeSafe(apiKey: string, fetch: typeof globalThis.fetch, request: ModelRequest, deadlineMs: number): Promise<ProviderBody> {
  const recognised = recognisedIn(request);
  if (recognised === null) {
    // The questions are named off the registry rather than spelled here: an arm added beside the
    // others must not be able to leave this sentence quietly out of date (B-19).
    throw new Error(
      `TypeSafe Jev System One answers only the closed questions this seam spells — ${TYPESAFE_ARMS.map((arm) => arm.question).join(", ")} — and this request is neither; no question was posted`,
    );
  }
  // The guard is the arm's own refusal to ask at all, and it throws before anything is posted.
  const { arm, task } = recognised;
  arm.guard?.(task);
  const question = arm.compose(task);
  const response = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(question.body),
    signal: AbortSignal.timeout(deadlineMs),
  });
  if (!response.ok) {
    await discarded(response);
    throw new Error(`TypeSafe Jev System One answered ${response.status} ${response.statusText}`.trimEnd());
  }
  const answered = (await response.json()) as unknown;
  const answers = answersOf(answered);
  const usage = usageOf(answered);
  return { content: question.read(answers), inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, judgment: judgmentOf(answered, answers) };
}

function answersOf(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object") throw new Error("TypeSafe Jev System One answered a body that is not an object");
  const answers = (body as { answers?: unknown }).answers;
  if (answers === null || typeof answers !== "object") throw new Error("TypeSafe Jev System One answered a body without answers");
  return answers as Record<string, unknown>;
}

function usageOf(body: unknown): { input_tokens?: unknown; output_tokens?: unknown } {
  const usage = (body as { usage?: unknown }).usage;
  return usage !== null && typeof usage === "object" ? (usage as { input_tokens?: unknown; output_tokens?: unknown }) : {};
}

/**
 * What Jev said about its answers, read as the API states it and never supplied where it stated
 * nothing: a `confidence` or `probabilities` that is not what the contract spells is null, not a
 * figure. The call's own confidence is the weakest answer's — one uncertain question makes an
 * uncertain call — and null where no answer carried one.
 */
function judgmentOf(body: unknown, answers: Record<string, unknown>): ModelJudgment {
  const provider = (body as { model?: unknown }).model;
  const read: Record<string, AnswerJudgment> = {};
  const confidences: number[] = [];
  for (const [id, answer] of Object.entries(answers)) {
    const judged = answerJudgmentOf(answer);
    if (judged === null) continue;
    read[id] = judged;
    if (judged.confidence !== null) confidences.push(judged.confidence);
  }
  return { provider: typeof provider === "string" ? provider : null, confidence: confidences.length === 0 ? null : Math.min(...confidences), answers: read };
}

/** One answer's judgment as the API spells it, or null for an answer that is not an object. */
function answerJudgmentOf(answer: unknown): AnswerJudgment | null {
  if (answer === null || typeof answer !== "object") return null;
  const { type, choice, noul, score, confidence, probabilities } = answer as Record<string, unknown>;
  const primitive = type === "noul" ? "noul" : type === "score" ? "score" : "choice";
  const value = primitive === "choice" ? (typeof choice === "string" ? choice : null) : primitive === "noul" ? probability(noul) : probability(score);
  // A Noul's probability is its whole judgment; the contract states no separate confidence for it.
  const stated = primitive === "noul" ? value : probability(confidence);
  return { type: primitive, value, confidence: typeof stated === "number" ? stated : null, probabilities: probabilitiesOf(probabilities) };
}

/** A figure as a probability the contract could have stated: a finite number, or null. */
function probability(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The distribution over criteria as stated, every entry a finite number, or null where it is not one. */
function probabilitiesOf(value: unknown): Record<string, number> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const read: Record<string, number> = {};
  for (const [criterion, figure] of Object.entries(value as Record<string, unknown>)) {
    const held = probability(figure);
    if (held === null) return null;
    read[criterion] = held;
  }
  return read;
}

/** A body nobody will read, released so the connection is not held until collection. */
async function discarded(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The status line is the fault; a body that would not close adds nothing to it.
  }
}
