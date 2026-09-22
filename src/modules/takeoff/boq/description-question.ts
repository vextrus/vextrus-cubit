// R-TO-053's item-description question: what a model may be asked about one (class · kind) group of
// an unpriced draft, and how its answer is read back (L-BD-01, L-AI-02, L-AI-03).
//
// It lives in this module rather than in core because only this module asks it: the draft is the
// one reader of a bill item's description, and `@/core/catalogue/item-descriptions` — which core and
// this module both read — is where the closed list itself lives (ARCH-01, ARCH-02).
//
// THE DESCRIPTION IS CHOSEN, NEVER WRITTEN. L-BD-01 makes the item description the method of
// measurement, so the candidates are code-found and the model says which one describes the line, or
// that none does. What comes back is a Proposal and stays one (L-AI-02): a classification held until
// the draft is issued. Nothing here writes a line, a rate, a register row or an act (L-AI-03).
import { NO_MATCH, type ItemDescriptionRow } from "@/core/catalogue/item-descriptions";
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import { MODEL_QUESTIONS, canonicalJson, propose } from "@/core/model";
import type { DecodeResult, ModelCallContext, ModelRequest, Proposal, SourceKeyResolver } from "@/core/model";
import { JEV_MODEL, type ModelId } from "@/core/model-ledger.types";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model a group's description is chosen by: mapping one measured line onto one sentence of a
 * closed list is a closed question only TypeSafe Jev answers, so it is pinned to Jev's id,
 * unconditionally, and the ledger bills Jev's published rate (Deviation D-002,
 * `docs/decisions/deviations.md`).
 */
export const BOQ_DESCRIPTION_MODEL: ModelId = JEV_MODEL;

/** The field a chosen description answers with, and the only one. */
const PROPOSAL_FIELD = "item";

/** Where one group of the draft stands, as the question states it — read, never re-measured. */
export type BoqLineState = {
  readonly class: ElementType;
  readonly kind: Kind;
  readonly unit: string;
  /** The storeys the group's lines stand on, by LABEL: a level id would say nothing to a reader. */
  readonly levels: readonly string[];
  /** The bill the taxonomy placed the group in, and the row that decided it (AM-14, AM-16). */
  readonly bill: string;
  readonly decidedBy: string;
  readonly quantityBasis: string;
  readonly selectionBasis: string;
};

/** One thing the drawings state about the group's members, exactly as the drawing wrote it (L-MEA-06). */
export type BoqAttributeState = { readonly name: string; readonly valueAsWritten: string; readonly unitAsWritten: string };

/** Everything one description question is asked over: the line, what is stated of it, and the closed list. */
export type BoqDescriptionState = {
  readonly line: BoqLineState;
  readonly attributes: readonly BoqAttributeState[];
  readonly candidates: readonly ItemDescriptionRow[];
  /** The source keys the attributes were read from — the citations the answer rests on (L-AI-02). */
  readonly keys: readonly string[];
};

/**
 * What the model is told it is doing. It states the answer's exact shape because L-AI-02 refuses an
 * answer that is neither a payload nor a citation: an id outside the list is MALFORMED and an
 * uncited answer is UNSOURCED, and a model that was not told so would spend tokens on answers
 * nobody can accept.
 */
const SYSTEM = [
  "You read one measured group of an unpriced bill of quantities and say which work-item description from a closed catalogue describes it.",
  "The description is the method of measurement the line is billed under, so it is CHOSEN from the list you are given and never written, reworded or composed.",
  `Answer with a JSON object of exactly {"payload": {"${PROPOSAL_FIELD}": "<id>"}, "sources": ["<key>"]}.`,
  `The ids are the ones the question offers. Answer ${NO_MATCH} where no description fits the line, or where what the drawings state does not tell the descriptions apart.`,
  "`sources` names the source keys you were given, which are the entities the stated attributes were read from — they are the evidence the answer rests on.",
  "Propose a selection. Do not measure, do not price, and do not invent a description: a line you cannot place keeps the plain description the bill already has.",
].join("\n");

/**
 * The question one group is asked, as a pure function of the state: the same group of the same
 * pinned revision makes the same request forever, so the hash a recorded answer is filed under is a
 * fact about the register rather than about the run (L-AI-01).
 *
 * The content's keys are exactly `attributes`, `candidates`, `keys`, `line` — the key set the
 * adapter's arm recognises this question by, and the content the request hash is taken over.
 */
export function boqDescriptionRequest(state: BoqDescriptionState): ModelRequest {
  const content: JsonValue = {
    attributes: state.attributes.map((attribute) => ({ name: attribute.name, unitAsWritten: attribute.unitAsWritten, valueAsWritten: attribute.valueAsWritten })),
    // A LIST, in the catalogue's own order: the canonical spelling sorts an object's keys, and the
    // order the options stand in is the catalogue's to decide rather than the alphabet's.
    candidates: state.candidates.map((candidate) => ({ id: candidate.id, text: candidate.text })),
    keys: [...state.keys],
    line: {
      bill: state.line.bill,
      class: state.line.class,
      decidedBy: state.line.decidedBy,
      kind: state.line.kind,
      levels: [...state.line.levels],
      quantityBasis: state.line.quantityBasis,
      selectionBasis: state.line.selectionBasis,
      unit: state.line.unit,
    },
  };
  return {
    modelId: BOQ_DESCRIPTION_MODEL,
    system: SYSTEM,
    messages: [{ role: "user", content: canonicalJson(content) }],
    question: MODEL_QUESTIONS.boqLineDescription,
  };
}

/**
 * What a model proposed this group's description to be: one row of the caller's own candidate set,
 * or `null` — the no-match answer, which is a first-class reading and not a failure. The caller
 * decides what an abstention becomes, because abstention is the caller's (L-AI-02).
 */
export type ItemDescriptionProposal = { readonly item: ItemDescriptionRow | null };

/**
 * A model's payload as a chosen description, or the detail that says why it is not one (L-AI-02: a
 * decoder answers a result and never throws).
 *
 * The answer is read back OUT of the caller's candidate set rather than merely tested against it:
 * what comes back is then one of the descriptions the question offered, by construction, and the
 * caller has nothing left to re-judge about an answer this already accepted.
 */
export function readItemDescriptionProposal(candidates: readonly ItemDescriptionRow[]): (payload: JsonValue) => DecodeResult<ItemDescriptionProposal> {
  return (payload) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, detail: `an item selection is an object naming ${PROPOSAL_FIELD}` };
    }
    const named = Object.keys(payload);
    if (named.length !== 1 || named[0] !== PROPOSAL_FIELD) {
      return { ok: false, detail: `an item selection names exactly ${PROPOSAL_FIELD}, and this one names ${named.join(", ") || "nothing"}` };
    }
    const item = payload[PROPOSAL_FIELD];
    if (item === NO_MATCH) return { ok: true, value: Object.freeze({ item: null }) };
    const chosen = typeof item === "string" ? candidates.find((candidate) => candidate.id === item) : undefined;
    if (chosen === undefined) {
      return { ok: false, detail: `${JSON.stringify(item)} is no description this line may be billed under — the candidates are ${candidates.map((candidate) => candidate.id).join(", ")}` };
    }
    return { ok: true, value: Object.freeze({ item: chosen }) };
  };
}

/**
 * The way to a model, as a seam a caller may hand in (B-23). The default is the shipped `propose` —
 * live in production, replayed from the recorded corpus inside verify (L-AI-01) — and a caller that
 * hands its own hands a `propose`, never a second path to a provider.
 */
export type BoqDescriptionPort = { propose: typeof propose };

/** The port every call uses unless the caller names another: the model seam's own production entry. */
const PRODUCTION: BoqDescriptionPort = { propose };

/** One group's question: the state it is asked over, and the artifact a citation resolves against. */
export type BoqDescriptionQuestion = {
  readonly state: BoqDescriptionState;
  readonly artifact: SourceKeyResolver;
};

/**
 * What a model proposes this group is billed under (L-AI-02). The seam's refusal is never caught
 * here: a refusal marker — a missing recorded answer, an uncited or unreadable answer — reaches the
 * caller intact, and the caller decides what a group nobody could place is described as, because
 * abstention is not the model's decision.
 */
export async function proposeLineDescription(
  ctx: ModelCallContext,
  question: BoqDescriptionQuestion,
  port: BoqDescriptionPort = PRODUCTION,
): Promise<Proposal<ItemDescriptionProposal>> {
  return port.propose(ctx, boqDescriptionRequest(question.state), {
    artifact: question.artifact,
    decode: readItemDescriptionProposal(question.state.candidates),
  });
}
