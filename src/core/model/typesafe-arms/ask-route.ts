// S-Ask's routing question, as Jev is asked it (R-AI-003, docs/design/s-ask.md I-396, I-397,
// L-AI-01): a question the product's grammar could read every subject of but not the intent of is
// put to Jev as one choice over the intent roster, plus the no-match outcome, and — where the words
// name two subjects of one slot — one choice per such slot over the subjects named, plus the outcome
// for a slot the question does not ask about.
//
// THE MODEL CHOOSES; CODE ANSWERS. The roster, its meanings and the subjects are all code-found and
// carried IN the request (`@/modules/takeoff/ask/route-question` composes it), so this arm spells no
// intent of its own and core never reads the Ask module (ARCH-01). What Jev chooses is handed back
// to the grammar, which completes the reading against the project exactly as it completes its own;
// every figure of the answer is then a query result (I-395).
//
// The request carries the normalised question, the candidates (slot, label and the one defining key
// code read for it, or none) and the roster with its digest — no UUID, no project id, no figure — so
// its hash is stable from run to run and a roster change forces a re-record (I-397). It is
// recognised by the exact key set of its canonical content, which no other arm uses.
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the ask-route request builder spells, sorted — what this arm is recognised by. */
const ROUTE_KEYS = ["candidates", "question", "roster"] as const;

/** The intent answer for a question that asks for nothing the roster answers (a cost, a person, a date). */
export const ASK_ROUTE_NONE = "NONE_OF_THESE";

/** The slot answer for a subject the question names without asking about it ("like C3, how many C4…"). */
export const ASK_ROUTE_NOT_STATED = "NOT_STATED";

/** The prefix a slot's question id carries: `slot_mark`, `slot_level` … */
export const ASK_ROUTE_SLOT_PREFIX = "slot_";

/** One subject the question names, as the request spells it: its slot, its label, its defining key or none. */
export type RouteCandidate = { slot: string; label: string; key: string | null };

/** One intent of the roster and what it means, in a quantity surveyor's words. */
export type RouteIntent = { intent: string; means: string };

/** One question the grammar could not route, as recognised on a request. */
export type RouteTask = {
  kind: "route";
  question: string;
  candidates: readonly RouteCandidate[];
  digest: string;
  intents: readonly RouteIntent[];
};

/** What the no-match outcome means. */
const NONE_CRITERION =
  "None of the above: the question asks for a cost, a price, a rate, a duration, a judgement of safety or adequacy, a person or a date, or anything else these options do not answer.";

/** The intent choice's whole meaning, naming the state it reads by its own field paths (the docs' rule). */
const INTENT_INSTRUCTIONS = [
  "`question` is one question a quantity surveyor typed about the structural drawings of a building project, folded to lower case with punctuation removed.",
  "`subjects` lists what the question names that the project holds: `subjects[].slot` says what kind of subject it is (class = an element class such as column or pile cap, kind = a trade such as concrete or formwork, mark = a member mark such as C3, level = a storey label such as GF or 5F, noteKind = a kind of general note, discipline = a drawing discipline) and `subjects[].label` is the project's own label for it.",
  `Which option is the question asking for? Choose ${ASK_ROUTE_NONE} where it asks for none of them.`,
].join(" ");

/** A slot choice's meaning: which of the named subjects of that slot the question is about. */
function slotInstructions(slot: string): string {
  return [
    "`question` is one question a quantity surveyor typed about the structural drawings of a building project, and `subjects` lists what it names that the project holds.",
    `The question names more than one subject whose \`subjects[].slot\` is ${slot}. Which one of them is the question asking about?`,
    `Choose ${ASK_ROUTE_NOT_STATED} where it asks about all of them, or about none of them in particular.`,
  ].join(" ");
}

/** The slots the words name two or more subjects of, in the order they first stand among the candidates. */
export function doubledSlots(candidates: readonly RouteCandidate[]): string[] {
  const counted = new Map<string, number>();
  for (const candidate of candidates) counted.set(candidate.slot, (counted.get(candidate.slot) ?? 0) + 1);
  return [...counted.entries()].filter(([, count]) => count >= 2).map(([slot]) => slot);
}

/** The routing question's arm: one choice over the intents, and one per doubled slot. */
export const askRouteArm: TypeSafeArm<RouteTask> = {
  question: MODEL_QUESTIONS.askRoute,
  keys: ROUTE_KEYS,

  recognise(record): RouteTask | null {
    const question = record["question"];
    const candidates = candidatesOf(record["candidates"]);
    const roster = record["roster"];
    if (typeof question !== "string" || candidates === null || roster === null || typeof roster !== "object" || Array.isArray(roster)) return null;
    const { digest, intents } = roster as Record<string, unknown>;
    const read = intentsOf(intents);
    if (typeof digest !== "string" || read === null) return null;
    return { kind: "route", question, candidates, digest, intents: read };
  },

  guard(task): void {
    // I-397: a question whose candidates carry no key is never put to the model — an answer could
    // cite nothing, so it would be UNSOURCED by construction. And a roster with no intent is no choice.
    if (task.intents.length === 0) throw new Error(`the question ${JSON.stringify(task.question)} carries an empty intent roster, so Jev has nothing to choose from; no question was posted`);
    if (!task.candidates.some((candidate) => candidate.key !== null)) {
      throw new Error(`the question ${JSON.stringify(task.question)} names no subject with a source key an answer could cite; no question was posted`);
    }
  },

  compose(task): TypeSafeQuestion {
    const criteria: Record<string, string> = {};
    for (const { intent, means } of task.intents) criteria[intent] = means;
    criteria[ASK_ROUTE_NONE] = NONE_CRITERION;
    const questions: Record<string, JsonValue> = { intent: { type: "choice", instructions: INTENT_INSTRUCTIONS, criteria } };
    for (const slot of doubledSlots(task.candidates)) {
      const options: Record<string, string> = {};
      for (const candidate of task.candidates) if (candidate.slot === slot) options[candidate.label] = `The question asks about the ${slot} ${candidate.label}.`;
      options[ASK_ROUTE_NOT_STATED] = `The question asks about every ${slot} it names, or about none of them in particular.`;
      questions[`${ASK_ROUTE_SLOT_PREFIX}${slot}`] = { type: "choice", instructions: slotInstructions(slot), criteria: options };
    }
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      // The keys are not state: they are what an answer RESTS on (the caption precedent), and the
      // roster's meanings are the criteria, never state Jev reads twice.
      state: {
        question: task.question,
        subjects: task.candidates.map((candidate) => ({ slot: candidate.slot, label: candidate.label })),
      },
      questions,
    };
    return {
      body,
      read(answers) {
        const slots: Record<string, JsonValue> = {};
        for (const slot of doubledSlots(task.candidates)) slots[slot] = choiceOf(answers[`${ASK_ROUTE_SLOT_PREFIX}${slot}`]) ?? null;
        // Every keyed candidate offered is what the reading rests on (the BOQ description arm's
        // `keys`, the precedent): a NONE_OF_THESE answer still resolves, and abstaining stays the caller's.
        const sources = [...new Set(task.candidates.flatMap((candidate) => (candidate.key === null ? [] : [candidate.key])))];
        return { payload: { intent: choiceOf(answers["intent"]) ?? null, slots }, sources };
      },
    };
  },
};

/** The candidates as the request spells them, or null where the member is not that shape. */
function candidatesOf(value: unknown): RouteCandidate[] | null {
  if (!Array.isArray(value)) return null;
  const read: RouteCandidate[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const { slot, label, key } = item as Record<string, unknown>;
    if (typeof slot !== "string" || slot === "" || typeof label !== "string" || label === "" || !(key === null || (typeof key === "string" && key !== ""))) return null;
    read.push({ slot, label, key });
  }
  return read;
}

/** The roster's intents as the request spells them, or null. */
function intentsOf(value: unknown): RouteIntent[] | null {
  if (!Array.isArray(value)) return null;
  const read: RouteIntent[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const { intent, means } = item as Record<string, unknown>;
    if (typeof intent !== "string" || intent === "" || typeof means !== "string" || means === "") return null;
    read.push({ intent, means });
  }
  return read;
}
