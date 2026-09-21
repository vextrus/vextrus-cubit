// L-AI-01's live transport, TypeSafe Jev System One half: a structured-question client, and no SDK.
//
// Jev does not generate text. It answers closed questions — a `choice` over criteria the caller
// spells — so the only requests it can be asked are the ones this seam already spells as closed
// questions: the silent-sheet reading (`@/modules/ai/sheet-understanding`: which candidate text is
// the title, which the number, which discipline) and the view-caption class (`@/core/view-captions`:
// which class of view a caption names). Each is recognised by the exact key set of the request's
// canonical JSON content, the same content the request hash is taken over, so what is asked of Jev
// is a function of the request and of nothing else (L-AI-01 replays deterministically).
//
// What comes back is spelled as the wire the seam resolves (`{payload, sources}`) and NOTHING is
// supplied where Jev supplied nothing (L-AI-02): a title Jev did not choose is null and the reading
// is refused as MALFORMED; a discipline outside the closed list is refused the same way; a source is
// only ever the key of a candidate Jev chose, so an answer citing nothing is UNSOURCED. Usage is
// carried as Jev states it, and a usage that is not a count fails as the ledger's own derivation
// fails for it (B-17). A request Jev has no question for is infrastructure's fault, never a
// product decision (B-14): it is thrown, and no question is posted.
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import { DISCIPLINES } from "../sheets";
import type { JsonValue, ModelRequest } from "./types";

/** Where Jev is reached, and the model asked for. */
export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const TYPESAFE_MODEL = "jev-latest";

/** How many of a sheet's texts are put to Jev as candidates, in the artifact's own order. */
export const CANDIDATE_CAP = 40;

/** How long a candidate text may be in the question; the whole text is what a chosen one answers with. */
const CRITERION_LENGTH = 100;

/** The answer a number question may give when the sheet states none. */
const NO_NUMBER = "NONE";

/** What a provider's body is read into: the wire the seam resolves, and the usage as stated. */
export type ProviderBody = { content: JsonValue; inputTokens: unknown; outputTokens: unknown };

/** One text a sheet reading may cite: the key it is cited by, and what it says. */
type Candidate = { key: string; text: string };

/** The two closed questions this adapter can put to Jev, as recognised on a request. */
export type StructuredTask = { kind: "sheet"; candidates: readonly Candidate[]; layout: string } | { kind: "caption"; caption: string; key: string };

/** The key sets the two request builders spell, sorted — what a request is recognised by. */
const CAPTION_KEYS = ["caption", "key"] as const;
const SHEET_KEYS = ["blockAttributes", "census", "derived", "entities", "layout"] as const;

/** What each discipline is, for the question; the list itself is the closed one R-TO-004 spells. */
const DISCIPLINE_CRITERIA: Readonly<Record<string, string>> = Object.freeze({
  STRUCTURAL: "Structural plans, framing, reinforcement, foundations, columns, beams, slabs",
  ARCHITECTURAL: "Architectural plans, elevations, finishes, partitions, openings",
  MEP: "Mechanical, electrical, plumbing, fire or HVAC services",
  CIVIL: "Civil, site, drainage or infrastructure works",
  OTHER: "General, cover, index or a discipline not listed",
});

/** The structured question a request is, or null where it is no question this adapter can ask. */
export function structuredTaskOf(request: ModelRequest): StructuredTask | null {
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
  if (sameKeys(keys, CAPTION_KEYS)) {
    const { caption, key } = record;
    return typeof caption === "string" && typeof key === "string" ? { kind: "caption", caption, key } : null;
  }
  if (sameKeys(keys, SHEET_KEYS)) {
    const layout = record["layout"];
    const name = layout !== null && typeof layout === "object" ? (layout as { name?: unknown }).name : undefined;
    return { kind: "sheet", layout: typeof name === "string" ? name : "", candidates: candidatesOf(record) };
  }
  return null;
}

function sameKeys(keys: readonly string[], expected: readonly string[]): boolean {
  return keys.length === expected.length && expected.every((key, index) => keys[index] === key);
}

/**
 * The texts a sheet reading may cite, in the request's own order: block attributes by the key of
 * the block they belong to, then entities and derived paint by their own keys. Nothing is deduped
 * here — a title block's attributes share one block key and are each a candidate — the citation
 * list is where a key is said once.
 */
function candidatesOf(evidence: Record<string, unknown>): Candidate[] {
  const out: Candidate[] = [];
  const said = (key: unknown, text: unknown): void => {
    if (typeof key === "string" && typeof text === "string" && text.trim() !== "") out.push({ key, text: text.trim() });
  };
  for (const attribute of listOf(evidence["blockAttributes"])) said(attribute["src"], attribute["text"]);
  for (const entity of listOf(evidence["entities"])) said(entity["key"], entity["text"]);
  for (const derived of listOf(evidence["derived"])) said(derived["key"], derived["text"]);
  return out;
}

function listOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object") : [];
}

/** One request put to Jev, answered as the wire the seam resolves — or thrown. */
export async function exchangeTypeSafe(apiKey: string, fetch: typeof globalThis.fetch, request: ModelRequest, deadlineMs: number): Promise<ProviderBody> {
  const task = structuredTaskOf(request);
  if (task === null) {
    throw new Error(
      "TypeSafe Jev System One answers only the closed questions this seam spells — a silent sheet's reading and a view caption's class — and this request is neither; no question was posted",
    );
  }
  if (task.kind === "sheet" && task.candidates.length === 0) {
    throw new Error(`the sheet ${JSON.stringify(task.layout)} carries no text a reading could cite, so Jev has nothing to choose from; no question was posted`);
  }
  const question = task.kind === "sheet" ? sheetQuestion(task) : captionQuestion(task);
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
  return { content: question.read(answers), inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
}

/** A question as posted, and the reading of its answers into the wire. */
type Question = { body: JsonValue; read: (answers: Record<string, unknown>) => JsonValue };

/** The silent-sheet reading as three choices: the discipline, the title candidate, the number candidate. */
function sheetQuestion(task: Extract<StructuredTask, { kind: "sheet" }>): Question {
  const candidates = task.candidates.slice(0, CANDIDATE_CAP);
  const byId = new Map<string, Candidate>();
  const criteria: Record<string, string> = {};
  candidates.forEach((candidate, index) => {
    const id = `cand_${index + 1}`;
    byId.set(id, candidate);
    criteria[id] = candidate.text.slice(0, CRITERION_LENGTH);
  });
  const disciplineCriteria: Record<string, string> = {};
  for (const discipline of DISCIPLINES) disciplineCriteria[discipline] = DISCIPLINE_CRITERIA[discipline] ?? discipline;
  const body: JsonValue = {
    model: TYPESAFE_MODEL,
    state: { layout: task.layout, candidates: criteria },
    questions: {
      discipline: { type: "choice", instructions: "Which engineering discipline is this drawing sheet?", criteria: disciplineCriteria },
      title_candidate: { type: "choice", instructions: "Which candidate text is the sheet's title?", criteria },
      number_candidate: {
        type: "choice",
        instructions: "Which candidate text is the sheet's number or identifier?",
        criteria: { ...criteria, [NO_NUMBER]: "The sheet states no number" },
      },
    },
  };
  return {
    body,
    read(answers) {
      const title = byId.get(choiceOf(answers["title_candidate"]) ?? "");
      const numberChoice = choiceOf(answers["number_candidate"]);
      const number = numberChoice === NO_NUMBER ? undefined : byId.get(numberChoice ?? "");
      const discipline = choiceOf(answers["discipline"]);
      const sources = [...new Set([title?.key, number?.key].filter((key): key is string => key !== undefined))];
      return {
        payload: { number: number?.text ?? null, title: title?.text ?? null, discipline: discipline ?? null, captions: [] },
        sources,
      };
    },
  };
}

/** The view-caption class as one choice over the closed view vocabulary. */
function captionQuestion(task: Extract<StructuredTask, { kind: "caption" }>): Question {
  const criteria: Record<string, string> = {};
  for (const spelling of VIEW_TYPE_SPELLINGS) criteria[spelling] = spelling.toLowerCase().replace(/_/g, " ");
  const body: JsonValue = {
    model: TYPESAFE_MODEL,
    state: { caption: task.caption },
    questions: { view_type: { type: "choice", instructions: "Which class of view does this caption name?", criteria } },
  };
  return {
    body,
    read(answers) {
      return { payload: { type: choiceOf(answers["view_type"]) ?? null }, sources: [task.key] };
    },
  };
}

/** The `choice` of one answer, as Jev spelled it, or null where it gave none. */
function choiceOf(answer: unknown): string | null {
  if (answer === null || typeof answer !== "object") return null;
  const choice = (answer as { choice?: unknown }).choice;
  return typeof choice === "string" ? choice : null;
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

/** A body nobody will read, released so the connection is not held until collection. */
async function discarded(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The status line is the fault; a body that would not close adds nothing to it.
  }
}
