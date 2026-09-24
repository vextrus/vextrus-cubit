// S-Ask's routing question: what the machine may be asked about a question the grammar could not
// route, and how its answer is read back (docs/design/s-ask.md I-396, I-397; L-AI-01, L-AI-02).
//
// THE MODEL CHOOSES AN INTENT; CODE READS THE QUESTION. The grammar reads every subject the words
// name against this project (`openIntentOf`); what it could not choose is WHICH of the closed intents
// the words ask. Jev chooses that — and, where the words name two subjects of one slot, which of them
// is asked about — out of lists code built, and the grammar then completes the reading exactly as it
// completes its own (`readWithIntent`): a compound, a level counted two ways, a subject the reading
// cannot use are still a clarify or a refusal by name. Every figure of the answer is a query result
// (I-395); nothing here reads a figure, writes a line or moves an act (L-AI-03).
//
// Everything but `proposeRoute` is PURE, so the corpus recorder (`scripts/model-corpus/ask-route.ts`)
// composes the very request the door composes, and opens no database.
import { createHash } from "node:crypto";
import { ASK_ROUTE_NONE, ASK_ROUTE_NOT_STATED, MODEL_QUESTIONS, canonicalJson, propose } from "@/core/model";
import type { DecodeResult, ModelCallContext, ModelJudgment, ModelRequest, Proposal, SourceKeyResolver } from "@/core/model";
import { JEV_MODEL, type ModelId } from "@/core/model-ledger.types";
import { ASK_SLOTS, readWithIntent, wordsOf, type AskSlot, type AskSlotChoice, type AskSubject } from "./grammar";
import { ASK_REFUSAL_CODES, ASK_ROUTED_INTENTS, isAskRoutedIntent, type AskAnswer, type AskOffered, type AskReading, type AskRefused, type AskRoutedIntent } from "./law";
import type { AskVocabulary } from "./vocabulary";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model a question is routed by: a choice over a closed roster is a question only TypeSafe Jev
 * answers, so it is pinned to Jev's id, unconditionally (D-002; the owner's Q4 ruling, I-395).
 */
export const ASK_ROUTE_MODEL: ModelId = JEV_MODEL;

/**
 * The confidence a routing must carry before its reading is answered. Below it the machine's two
 * best readings are offered to the person ("Did you mean …") and nothing is answered on its word.
 *
 * Measured on this arm's own composed requests (I-624): over the 60 recorded paraphrases of
 * `tests/ai/ask/paraphrases.json`, Jev chose the reading written for 56; the four it missed stood at
 * 0.21–0.46, and all 44 routings at or above 0.70 were right, so 0.70 answers nearly three in four on
 * the machine's word and puts every miss back to the person. `tests/ai/ask/route-corpus.test.ts` re-reads
 * that line off the recordings, so a re-record that moves it fails there, by name.
 */
export const ASK_ROUTE_CONFIDENCE_FLOOR = 0.7;

/**
 * What each intent means, in the words a quantity surveyor asks it in — the criteria Jev chooses
 * among. Keyed by the routed roster (`ASK_ROUTED_INTENTS`, I-677), so an intent added to it with no meaning does not compile,
 * and carried in the request, so a meaning reworded is a new request and forces a re-record.
 */
const INTENT_MEANINGS: Readonly<Record<AskRoutedIntent, string>> = Object.freeze({
  COUNT: "How many members of a class or of one mark there are, optionally on one level: a count of columns, piles or pile caps.",
  MARKS: "Which marks (member types) a class carries and how many members bear each: a breakdown by mark.",
  QUANTITY: "A measured quantity of one trade — concrete, formwork, rebar, excavation, blinding, brickwork — for one class, mark or level: a volume, an area, a length or a weight.",
  MEASURED_SO_FAR: "The total of a trade, or of everything, across the whole building and all its classes, as measured so far.",
  WHY_NOT_MEASURED: "Why something has no quantity: why it was left out, stands blank or missing, or was not measured.",
  MEMBER_TYPE: "What the members of one mark are, as their schedule states: the size, section or dimensions, the main bars, the ties.",
  NOTE: "What the general notes specify: the concrete strength, the steel grade, the lap length, the hook, the cover.",
  LEVEL_HEIGHT: "The floor-to-floor or storey height of a level.",
  SHEET_LIST: "Which sheets or drawings the set holds.",
});

/** The roster as the request carries it: each intent with its meaning, in roster order. */
function rosterIntents(): { intent: AskRoutedIntent; means: string }[] {
  return ASK_ROUTED_INTENTS.map((intent) => ({ intent, means: INTENT_MEANINGS[intent] }));
}

/** The roster's digest: sixteen hex characters over its canonical spelling, stated beside it on the request. */
export function askRouteRosterDigest(): string {
  return createHash("sha256").update(canonicalJson(rosterIntents())).digest("hex").slice(0, 16);
}

/** One subject the question names, as the request carries it: its slot, its label and its one defining key. */
export type AskRouteCandidate = { readonly slot: AskSlot; readonly label: string; readonly key: string | null };

/** Everything one routing question is asked over. No UUID, no project id and no figure enters it. */
export type AskRouteState = {
  /** The question as whole words (`wordsOf`), joined by one space. */
  readonly question: string;
  readonly candidates: readonly AskRouteCandidate[];
};

/**
 * The state one question is routed over: its words, and each subject the grammar read with the
 * defining key the caller found for it (I-397) — a mark's entity on its first registered member, a
 * level's first stated storey-height reading, none for a class, a kind, a note kind or a discipline.
 */
export function askRouteStateOf(question: string, subjects: readonly AskSubject[], keyOf: (subject: AskSubject) => string | null): AskRouteState {
  return {
    question: wordsOf(question).join(" "),
    candidates: subjects.map((subject) => ({ slot: subject.slot, label: subject.label, key: keyOf(subject) })),
  };
}

/** Whether a state may be put to the model at all: a question whose candidates carry no key never is (I-397). */
export function isRoutable(state: AskRouteState): boolean {
  return state.candidates.some((candidate) => candidate.key !== null);
}

/** The keys an answer may cite: every keyed candidate offered, once, in the order offered. */
export function askRouteKeys(state: AskRouteState): string[] {
  return [...new Set(state.candidates.flatMap((candidate) => (candidate.key === null ? [] : [candidate.key])))];
}

/** What the model is told it is doing, and the answer's exact shape (L-AI-02). */
const SYSTEM = [
  "You read one question a quantity surveyor asked about a building project's drawings, and say which of a closed list of intents it asks.",
  "The subjects it names are read by code and listed beside it; you choose the intent, and where it names two subjects of one kind, which one it asks about.",
  `Answer with a JSON object of exactly {"payload": {"intent": "<INTENT>", "slots": {"<slot>": "<label>"}}, "sources": ["<key>"]}.`,
  `Answer ${ASK_ROUTE_NONE} where the question asks for none of the intents, and ${ASK_ROUTE_NOT_STATED} for a slot it does not ask about one subject of.`,
  "`sources` names the source keys of the subjects you were given — they are the evidence the reading rests on.",
  "Propose a routing. Do not answer the question, do not measure and do not invent a subject.",
].join("\n");

/**
 * The question one routing is, as a pure function of its state: the same words about the same
 * subjects make the same request forever, so a recorded answer replays in every lane (L-AI-01). The
 * content's keys are exactly `candidates`, `question`, `roster` — the key set the adapter's arm
 * recognises this question by, and no other arm's.
 */
export function askRouteRequest(state: AskRouteState): ModelRequest {
  const content: JsonValue = {
    // A LIST in reading order: the canonical spelling sorts an object's keys, never a list.
    candidates: state.candidates.map((candidate) => ({ key: candidate.key, label: candidate.label, slot: candidate.slot })),
    question: state.question,
    roster: { digest: askRouteRosterDigest(), intents: rosterIntents() },
  };
  return { modelId: ASK_ROUTE_MODEL, system: SYSTEM, messages: [{ role: "user", content: canonicalJson(content) }], question: MODEL_QUESTIONS.askRoute };
}

/** What the model proposed: the intent (null for none of these) and, per doubled slot, the subject asked about. */
export type AskRouteProposal = { readonly intent: AskRoutedIntent | null; readonly slots: AskSlotChoice };

/** The slots the state names two or more subjects of. */
function doubled(state: AskRouteState): AskSlot[] {
  return ASK_SLOTS.filter((slot) => state.candidates.filter((candidate) => candidate.slot === slot).length >= 2);
}

/**
 * A model's payload as a routing, or the detail that says why it is not one (a decoder answers and
 * never throws). The intent is read back OUT of the roster and each slot OUT of the subjects offered,
 * so what comes back is one of the options the question offered, by construction.
 */
export function readRouteProposal(state: AskRouteState): (payload: JsonValue) => DecodeResult<AskRouteProposal> {
  return (payload) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, detail: "a routing is an object naming intent and slots" };
    const named = Object.keys(payload).sort();
    if (named.join(",") !== "intent,slots") return { ok: false, detail: `a routing names exactly intent and slots, and this one names ${named.join(", ") || "nothing"}` };
    const intent = payload["intent"];
    if (!(intent === ASK_ROUTE_NONE || isAskRoutedIntent(intent))) return { ok: false, detail: `${JSON.stringify(intent)} is no intent of the roster — the roster is ${ASK_ROUTED_INTENTS.join(", ")} and ${ASK_ROUTE_NONE}` };
    const slots = payload["slots"];
    if (slots === null || typeof slots !== "object" || Array.isArray(slots)) return { ok: false, detail: "a routing's slots are an object" };
    const asked = doubled(state);
    const chosen: Partial<Record<AskSlot, string>> = {};
    for (const [slot, label] of Object.entries(slots)) {
      if (!(asked as readonly string[]).includes(slot)) return { ok: false, detail: `${JSON.stringify(slot)} is no slot the question named two subjects of` };
      if (label === null || label === ASK_ROUTE_NOT_STATED) continue;
      const offered = state.candidates.some((candidate) => candidate.slot === slot && candidate.label === label);
      if (!offered || typeof label !== "string") return { ok: false, detail: `${JSON.stringify(label)} is no ${slot} the question named` };
      chosen[slot as AskSlot] = label;
    }
    return { ok: true, value: Object.freeze({ intent: intent === ASK_ROUTE_NONE ? null : (intent as AskRoutedIntent), slots: Object.freeze(chosen) }) };
  };
}

/** A routing read back: the reading the grammar completed under it, a question back, or a refusal by name. */
export type AskRouteSettled =
  | { readonly outcome: "READ"; readonly reading: AskReading; readonly callId: string }
  | Extract<AskAnswer, { outcome: "CLARIFY" }>
  | AskRefused;

/** The intents of the roster in the order the model ranked them: its own probabilities, ties to the roster's order. */
function ranked(judgment: ModelJudgment | null, chosen: AskRoutedIntent | null): AskRoutedIntent[] {
  const probabilities = judgment?.answers["intent"]?.probabilities ?? null;
  if (probabilities === null) return chosen === null ? [] : [chosen];
  return ASK_ROUTED_INTENTS.filter((intent) => (probabilities[intent] ?? 0) > 0 || intent === chosen).sort(
    (left, right) => (probabilities[right] ?? 0) - (probabilities[left] ?? 0) || ASK_ROUTED_INTENTS.indexOf(left) - ASK_ROUTED_INTENTS.indexOf(right),
  );
}

/** Whether a routing carrying this confidence is taken on the model's word. No stated confidence is below the floor. */
export function routeStandsAboveFloor(confidence: number | null): boolean {
  return confidence !== null && confidence >= ASK_ROUTE_CONFIDENCE_FLOOR;
}

/**
 * What a routing becomes (I-396, I-624). At or above the floor: none of these is the grammar's own
 * refusal, `ASK_NOT_UNDERSTOOD`, and an intent is the reading the grammar completes under it, routed
 * MODEL. Below the floor — whatever the model chose, none of these included — the person is offered
 * the two readings the model ranked highest that the grammar completes ("Did you mean …"), and nothing
 * is answered on the model's word; where no intent it ranked completes, the refusal stands.
 */
export function settleRoute(question: string, vocabulary: AskVocabulary, proposal: { readonly payload: AskRouteProposal; readonly callId: string }, judgment: ModelJudgment | null): AskRouteSettled {
  const notUnderstood: AskRefused = { outcome: "REFUSED", code: ASK_REFUSAL_CODES.notUnderstood, reading: null, held: null };
  const intent = proposal.payload.intent;
  if (routeStandsAboveFloor(judgment?.confidence ?? null)) {
    if (intent === null) return notUnderstood;
    const read = readWithIntent(question, vocabulary, intent, proposal.payload.slots);
    return read.outcome === "READ" ? { outcome: "READ", reading: read.reading, callId: proposal.callId } : read;
  }
  const offered: AskOffered[] = [];
  for (const candidate of ranked(judgment, intent)) {
    const read = readWithIntent(question, vocabulary, candidate, proposal.payload.slots);
    if (read.outcome !== "READ" || offered.some((held) => JSON.stringify(held.reading) === JSON.stringify(read.reading))) continue;
    offered.push({ reading: read.reading, gloss: null });
    if (offered.length === 2) break;
  }
  return offered.length === 0 ? notUnderstood : { outcome: "CLARIFY", lead: "MACHINE", offered };
}

/**
 * The way to a model and to what it judged, as a seam a caller may hand in (B-23). The judgment is a
 * LEDGER fact read back by the call id (L-AI-02 closes a Proposal's list), never a second source of it.
 */
export type AskRoutePort = {
  readonly propose: typeof propose;
  readonly judgmentOf: (callId: string) => Promise<ModelJudgment | null>;
};

/**
 * What the model proposes a question asks (L-AI-02). The seam's refusal is never caught here: a
 * missing recording, an uncited or unreadable answer reaches the door intact and renders as
 * registered (§1.1 refused).
 */
export async function proposeRoute(ctx: ModelCallContext, state: AskRouteState, artifact: SourceKeyResolver, port: Pick<AskRoutePort, "propose">): Promise<Proposal<AskRouteProposal>> {
  return port.propose(ctx, askRouteRequest(state), { artifact, decode: readRouteProposal(state) });
}
