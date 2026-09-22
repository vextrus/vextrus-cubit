// The BOQ line's item description, as Jev is asked it (L-BD-01, L-AI-03, L-AI-01): one choice over
// the closed catalogue's descriptions for this line's (class, kind), plus the no-match outcome — and
// one noul beside it, over the same state, asking whether the drawings state anything that tells
// those descriptions apart at all (the fan-out pattern: independent questions, one request).
//
// THE MODEL SELECTS; IT NEVER WRITES. L-BD-01 makes the item description the method of measurement,
// so the sentence a quantity is billed under is code-found — `candidateItemsFor` in
// `@/core/catalogue/item-descriptions` — and Jev only says which of them describes this line. A
// description Jev composed would be a method of measurement with no author (L-AI-03: "propose item
// mappings", and nothing more).
//
// The request this arm recognises is the one `@/modules/takeoff/boq` composes; it is recognised by
// the exact key set of its canonical content, never by its question name, because the name is not
// hashed into the request's identity.
import { NO_MATCH } from "../../catalogue/item-descriptions";
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the description request builder spells, sorted — what this arm is recognised by. */
const DESCRIPTION_KEYS = ["attributes", "candidates", "keys", "line"] as const;

/**
 * The answer for a line no candidate describes — and for a line whose drawings state nothing that
 * tells the candidates apart. It is the escape hatch the docs ask every closed list to carry, and
 * the caller takes it as an abstention: the draft keeps the plain description it already writes
 * (L-AI-02).
 *
 * Read from the catalogue that offers the options rather than spelled here: the question and the
 * caller's decoder must answer the same word, and a no-match outcome spelled twice would be two
 * words one day (B-17, ARCH-02).
 */
export const NONE_OF_THESE = NO_MATCH;

/** One candidate description, as the request spells one: the catalogue's id, and its own sentence. */
type DescriptionCandidate = { id: string; text: string };

/** One measured BOQ line, as recognised on a request. */
export type DescriptionTask = {
  kind: "description";
  /** Where the line stands: its class, kind, unit, storeys and bases — read, never re-measured. */
  line: JsonValue;
  /** What the drawings state about the members the line was measured on, as written. */
  attributes: JsonValue;
  /** The closed set this line may be billed under — code-found, and the only answers Jev may give. */
  candidates: readonly DescriptionCandidate[];
  /** The source keys the attributes were read from: the citations an answer rests on (L-AI-02). */
  keys: readonly string[];
};

/** What the no-match outcome means, in the words the bill would then keep. */
const NO_MATCH_CRITERION =
  "No option describes this line, or what the drawings state about it does not tell the options apart; the bill keeps its own plain description of the class and the trade.";

/** The choice's whole meaning, naming the state it reads by its own field paths (the docs' rule). */
const ITEM_INSTRUCTIONS = [
  "`line` states one measured line of an unpriced bill of quantities for a building in Bangladesh: `line.class` is the element class the line was measured on, `line.kind` the trade and material measured of it, `line.unit` the unit it is billed in, `line.levels` the storeys its members stand on, and `line.quantityBasis` / `line.selectionBasis` where its figures came from.",
  "`attributes` holds what the drawings state about those elements — each entry an attribute's name, the value exactly as the drawing wrote it, and the unit as written.",
  "Each option below is one work-item description from the closed catalogue this bill is written from; a description states the method of measurement the line is billed under.",
  "Which option's description describes this line, read against what `attributes` states?",
  `Choose ${NONE_OF_THESE} where no option describes the line, or where \`attributes\` states nothing that tells the options apart — a description that does not fit the line is worse than none, because the bill then keeps its own plain description.`,
].join(" ");

/** The noul's whole meaning: one yes-or-no, phrased so a high figure means the attributes separate. */
const SEPARATION_INSTRUCTIONS = [
  "`attributes` holds what the drawings state about the elements the line `line` was measured on — each entry an attribute's name, the value exactly as written and the unit as written.",
  "The options of the accompanying question are the closed catalogue's descriptions for `line.class` bearing `line.kind`, and they differ from one another by a nominal thickness, a grade, a mix, a face or a depth band.",
  "Do `attributes` state a value that tells those descriptions apart?",
].join(" ");

/**
 * The item description's arm.
 *
 * A criterion is the candidate's OWN sentence, whole and unclipped: the criterion IS the method of
 * measurement, and a method truncated to fit a budget would be a different method from the one the
 * line is billed under (L-BD-01). The roster is authored and short, so there is nothing to cap.
 */
export const boqLineDescriptionArm: TypeSafeArm<DescriptionTask> = {
  question: MODEL_QUESTIONS.boqLineDescription,
  keys: DESCRIPTION_KEYS,

  recognise(record): DescriptionTask | null {
    const line = record["line"];
    const attributes = record["attributes"];
    const candidates = candidatesOf(record["candidates"]);
    const keys = stringsOf(record["keys"]);
    if (!isObject(line) || attributes === undefined || candidates === null || keys === null) return null;
    return { kind: "description", line: line as JsonValue, attributes: attributes as JsonValue, candidates, keys };
  },

  guard(task): void {
    // A question with nothing to choose from is not a question, and an answer that could cite
    // nothing is UNSOURCED by construction: both are infrastructure's fault and neither is posted
    // (B-14). The caller asks only where two or more candidates stand — this is the wire's own
    // refusal to spend a token on a selection with nothing to select.
    if (task.candidates.length === 0) {
      throw new Error(`the line ${JSON.stringify(task.line)} carries no candidate description, so Jev has nothing to choose from; no question was posted`);
    }
    if (task.keys.length === 0) {
      throw new Error(`the line ${JSON.stringify(task.line)} carries no source key an answer could cite, so nothing it answered could be sourced; no question was posted`);
    }
  },

  compose(task): TypeSafeQuestion {
    const criteria: Record<string, string> = {};
    for (const candidate of task.candidates) criteria[candidate.id] = candidate.text;
    criteria[NONE_OF_THESE] = NO_MATCH_CRITERION;
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      // The citable keys are not state: they are what an answer RESTS on, and code chooses them —
      // a key in the state would be one more thing for Jev to read rather than the evidence itself
      // (the caption and coverage-cause precedent).
      state: {
        line: task.line,
        attributes: task.attributes,
        candidates: task.candidates.map((candidate) => ({ id: candidate.id, text: candidate.text })),
      },
      questions: {
        item_description: { type: "choice", instructions: ITEM_INSTRUCTIONS, criteria },
        // No criteria: the yes-or-no boundary is stated in the instructions themselves, and the
        // docs ask for criteria only where that boundary is subtle (docs.typesafe.ai/primitives/noul).
        attributes_separate: { type: "noul", instructions: SEPARATION_INSTRUCTIONS },
      },
    };
    return {
      body,
      read(answers) {
        // The noul travels in the call's judgment, which the ledger records and the calibration line
        // reads; it answers nothing into the payload, because what a bill is billed under is the
        // choice and never a probability (L-AI-03).
        return { payload: { item: choiceOf(answers["item_description"]) ?? null }, sources: [...task.keys] };
      },
    };
  },
};

/**
 * The candidates as the request spells them, or null.
 *
 * A LIST, and not a map of id to text: the canonical spelling a request is hashed over sorts an
 * object's keys at every depth, so a map would put the catalogue's order at the mercy of how an id
 * happens to sort — and the order the options are offered in is the catalogue's to decide (B-17).
 */
function candidatesOf(value: unknown): DescriptionCandidate[] | null {
  if (!Array.isArray(value)) return null;
  const candidates: DescriptionCandidate[] = [];
  for (const item of value) {
    if (!isObject(item)) return null;
    const { id, text } = item;
    if (typeof id !== "string" || id === "" || typeof text !== "string" || text === "") return null;
    candidates.push({ id, text });
  }
  return candidates;
}

/** The strings of an array, or null where the member is not an array of non-empty strings. */
function stringsOf(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item === "") return null;
    strings.push(item);
  }
  return strings;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
