// R-TO-034's silent-clause question: what a model may be asked about a general-note clause the
// deterministic grammar read nothing in, and how its answer is read back (L-AI-03's order — the
// grammar answers first, and the model only where it read nothing).
//
// It lives in core for the reason `../view-captions/index.ts` does: the module that ASKS is the
// takeoff seam's partition and the module that PUBLISHES is `src/modules/ai`, and ARCH-01 lets
// neither of them name the other. One home, reachable by both (B-17, ARCH-02) — and by the act
// seam's own neighbourhood, which is core too.
//
// TWO ANSWERS, ONE STATE. Which of R-TO-034's five detailing figures the clause STATES, as one
// closed choice with a no-match outcome; and whether the lap it states governs over a
// development-length table printed on the same sheet (AM-03(e), T-NOTE-OVERRIDE). The second is a
// proposition put for disposition and never a standing: it moves no figure and enters no applied
// value.
//
// THE MODEL NEVER MOVES A DIGIT (L-AI-03). What comes back is a CLASS. The figure of a clause a
// model classified is read by the grammar's own reader (`readFigure`), off the same words, so a
// model that answered LAP on a clause stating no multiple of d offers nothing at all.
//
// What comes back is a Proposal and stays one (L-AI-02): a classification held until a person
// confirms it. Nothing here writes a reading, a standing or an act.
import { MODEL_QUESTIONS, canonicalJson, propose } from "../model";
import type { DecodeResult, ModelCallContext, ModelRequest, Proposal, SourceKeyResolver } from "../model";
import type { ModelId } from "../model-ledger.types";
import { NOTE_KINDS } from "./law";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model a silent clause is classified by. AS-05 pins `claude-sonnet-5` to cheap classification,
 * and reading one clause into one class of a closed roster of five is exactly that. Jev answers the
 * same question through the same seam and is billed under this pinned id until the owner's
 * amendment lands (docs/decisions/as-05-jev-amendment.md): nothing here invents a rate.
 */
export const NOTE_CLAUSE_MODEL: ModelId = "claude-sonnet-5";

/** The two fields an answer carries, and the only ones. */
const CLASS_FIELD = "kind";
const GOVERNS_FIELD = "governs";

/** The answer a classification gives when the clause states none of the five figures. */
export const NO_NOTE_KIND = "NONE_OF_THESE" as const;

/**
 * What the model is told it is doing. It states the closed roster and the answer's exact shape,
 * because L-AI-02 refuses an answer that is neither: a class outside the roster is MALFORMED and an
 * uncited one is UNSOURCED, and a model that was not told so would spend tokens on answers nobody
 * can accept. The roster is read from the one place it is written down (ARCH-02, B-17).
 */
const SYSTEM = [
  "You read one clause of the general notes printed on a structural construction drawing sheet and say which detailing figure it states.",
  "The deterministic note grammar read no figure in this clause, so what it states must be read from the clause's own words and from nothing else.",
  `Answer with a JSON object of exactly {"payload": {"${CLASS_FIELD}": "<CLASS>", "${GOVERNS_FIELD}": <0..1 or null>}, "sources": ["<key>"]}.`,
  `The classes are: ${NOTE_KINDS.join(", ")}, ${NO_NOTE_KIND}. Spell the one you choose exactly as it is spelled here.`,
  `Answer ${NO_NOTE_KIND} where the clause states none of them. A clause that mentions laps, hooks or concrete without stating their figure states none of them; a clause stating a cover, a load, a wind speed, a bar diameter, a stirrup spacing, a curtailment fraction, a code reference or a drawing convention states none of them.`,
  `${GOVERNS_FIELD} is the probability, between 0 and 1, that this clause states the tension lap that governs OVER a development-length or lap table printed on the same sheet — null where you state none.`,
  "`sources` names the entity key you were given, which is the clause's own entity — it is the evidence the answer rests on.",
  "Classify. Do not measure and do not read a number out: the figure of a clause you classify is read by the product's own grammar, off these same words.",
].join("\n");

/** One clause as the question is asked about it: what it says, where it stands, and its context. */
export type NoteClauseQuestionState = {
  /** The clause verbatim, codes resolved (`./clauses.ts`). */
  readonly clause: string;
  /** The source key of the clause's own entity: what the answer is asked about, and may cite. */
  readonly key: string;
  /** The sheet the clause stands on — the layout name the notes panel is keyed by. */
  readonly layout: string;
  /** Every figure a deterministic parser found in the clause, as the drawing writes them. */
  readonly figures: readonly string[];
  /** The headings of a lap or development-length table on the same sheet; empty where none stands. */
  readonly lapTable: readonly string[];
};

/**
 * The question one silent clause is asked, as a pure function of the clause and the sheet it stands
 * on: the same clause on the same entity of the same sheet makes the same request forever, so the
 * hash a recorded answer is filed under is a fact about the drawing rather than about the run
 * (L-AI-01). The key set of this content is what the Jev adapter's own arm recognises the request
 * by (`../model/typesafe-arms/note-clause.ts`).
 */
export function noteClauseRequest(state: NoteClauseQuestionState): ModelRequest {
  return {
    modelId: NOTE_CLAUSE_MODEL,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: canonicalJson({
          clause: state.clause,
          figures: [...state.figures],
          key: state.key,
          lapTable: [...state.lapTable],
          layout: state.layout,
        }),
      },
    ],
    question: MODEL_QUESTIONS.noteClause,
  };
}

/**
 * What a model proposed one clause to be: a class of the caller's roster, or NO class at all, and
 * what it made of the lap's standing over the sheet's table.
 *
 * `kind: null` is the no-match outcome carried up rather than refused. L-AI-02 says abstention is
 * the CALLER's decision, and here abstention is both the commonest and the most valuable answer —
 * every cover clause on F-RCC6-BNBC's S-01 has no class to be read into, because the law's roster
 * carries none — so refusing it would throw away the calibration evidence and put a refusal where
 * the law puts a decision. The caller offers nothing for a null class; it is not a failure.
 */
export type NoteClauseProposal<K extends string = string> = {
  readonly kind: K | null;
  /** The probability the clause's lap governs over the sheet's table, or null where none was stated. */
  readonly governs: number | null;
};

/** A probability as the wire may carry one: a finite number the contract's own range admits. */
function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * A model's payload as a classification, or the detail that says why it is not one (L-AI-02: a
 * decoder answers a result and never throws).
 *
 * The classifiable set is the caller's, for the reason the caption's is: what a clause may be
 * classified AS is the caller's law, and an answer outside it is refused rather than stored. The
 * answer is read back OUT of that set, so what a caller holds is a member of its own roster rather
 * than a string to re-judge.
 */
export function readNoteClauseProposal<K extends string>(classifiable: readonly K[]): (payload: JsonValue) => DecodeResult<NoteClauseProposal<K>> {
  return (payload) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, detail: `a clause classification is an object naming ${CLASS_FIELD} and ${GOVERNS_FIELD}` };
    }
    const named = Object.keys(payload).sort();
    if (named.length !== 2 || named[0] !== GOVERNS_FIELD || named[1] !== CLASS_FIELD) {
      return { ok: false, detail: `a clause classification names exactly ${CLASS_FIELD} and ${GOVERNS_FIELD}, and this one names ${named.join(", ") || "nothing"}` };
    }
    const kind = payload[CLASS_FIELD];
    const governs = payload[GOVERNS_FIELD];
    const answered = typeof kind === "string" ? classifiable.find((candidate) => candidate === kind) : undefined;
    if (kind !== null && answered === undefined) {
      return { ok: false, detail: `${JSON.stringify(kind)} is no class a note clause can be read as — the classifiable set is ${classifiable.join(", ")}` };
    }
    if (governs !== null && !isProbability(governs)) {
      return { ok: false, detail: `${JSON.stringify(governs)} is no probability that this clause's lap governs — a figure between 0 and 1, or null where none was stated` };
    }
    return { ok: true, value: Object.freeze({ kind: answered ?? null, governs: governs === null ? null : governs }) };
  };
}

/**
 * The way to a model, as a seam a caller may hand in (B-23). The default is the shipped `propose` —
 * live in production, replayed from the recorded corpus inside verify (L-AI-01) — and a caller that
 * hands its own hands a `propose`, never a second path to a provider.
 */
export type NoteClausePort = { propose: typeof propose };

/** The port every call uses unless the caller names another: the model seam's own production entry. */
const PRODUCTION: NoteClausePort = { propose };

/** One silent clause, with the classes it may be read as and the artifact a citation resolves against. */
export type NoteClauseQuestion<K extends string = string> = NoteClauseQuestionState & {
  readonly classifiable: readonly K[];
  readonly artifact: SourceKeyResolver;
};

/**
 * What a model proposes this clause states (R-TO-034, L-AI-02). The seam's refusal is never caught
 * here: a refusal marker — a missing recorded answer (FIXTURE_MISSING), an uncited or unreadable
 * answer — reaches the caller intact, and the caller decides what a clause nobody could read
 * becomes, because abstention is not the model's decision.
 */
export async function proposeNoteClause<K extends string>(ctx: ModelCallContext, question: NoteClauseQuestion<K>, port: NoteClausePort = PRODUCTION): Promise<Proposal<NoteClauseProposal<K>>> {
  return port.propose(ctx, noteClauseRequest(question), {
    artifact: question.artifact,
    decode: readNoteClauseProposal(question.classifiable),
  });
}
