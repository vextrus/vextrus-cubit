// R-TO-030's silent-caption question: what a model may be asked about a view caption L-CAD-06's
// grammar read nothing in, and how its answer is read back.
//
// It lives in core for the reason `../sheets` does: the module that ASKS the question is the takeoff
// seam's stored partition and the module that PUBLISHES it is `src/modules/ai/view-captions`, and
// ARCH-01 lets neither of them name the other. One home, reachable by both (B-17, ARCH-02) — and by
// the act seam's own neighbourhood, which is core too.
//
// What comes back is a Proposal and stays one (L-AI-02): a classification held until a person
// confirms it — or, where the model answered the question's own "none of these", a proposal of NO
// class, which the caller decides what to do with (I-408). Nothing here writes a view, a type or
// a confirmation.
import { MODEL_QUESTIONS, canonicalJson, propose } from "../model";
import type { DecodeResult, ModelCallContext, ModelRequest, Proposal, SourceKeyResolver } from "../model";
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import { JEV_MODEL, type ModelId } from "../model-ledger.types";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model a silent caption is classified by: one class of a closed vocabulary is a closed question
 * only TypeSafe Jev answers, so it is pinned to Jev's id, unconditionally (Deviation D-002,
 * `docs/decisions/deviations.md`; AS-05 named `claude-sonnet-5` for cheap classification).
 */
export const VIEW_CAPTION_MODEL: ModelId = JEV_MODEL;

/** The field a classification answers with, and the only one. */
const PROPOSAL_FIELD = "type";

/**
 * What the model is told it is doing. It states the closed vocabulary and the answer's exact shape,
 * because L-AI-02 refuses an answer that is neither: a class outside the vocabulary is MALFORMED and
 * an uncited one is UNSOURCED, and a model that was not told so would spend tokens on answers nobody
 * can accept. The vocabulary is read from the one place it is written down (ARCH-02).
 *
 * This text is part of the request, so it is part of the hash every recorded answer is filed under
 * (L-AI-01): it is left verbatim, and the committed corpus keeps answering. Jev never reads it — the
 * view-caption arm composes its own instruction, which names the vocabulary's untyped member as the
 * no-match choice — so its last sentence speaks only to a model that reads a system prompt, and an
 * answer of that member from any model is read as the no-class proposal below (I-408).
 */
const SYSTEM = [
  "You read the caption of one view on a structural construction drawing and say which class of view it captions.",
  "The deterministic caption grammar read nothing in this caption, so what the view is must be read from the caption text itself and from nothing else.",
  'Answer with a JSON object of exactly {"payload": {"' + PROPOSAL_FIELD + '": "<CLASS>"}, "sources": ["<key>"]}.',
  `The classes are: ${VIEW_TYPE_SPELLINGS.join(", ")}. Spell the one you choose exactly as it is spelled here.`,
  "`sources` names the entity key you were given, which is the caption's own entity — it is the evidence the answer rests on.",
  "Propose a classification. Do not conclude and do not measure; a caption you cannot read is not one to guess at, and the classes that stand for 'not read' are not yours to answer with — refuse instead.",
].join("\n");

/**
 * The question one silent caption is asked, as a pure function of the caption and the entity it is
 * carried by: the same caption on the same entity makes the same request forever, so the hash a
 * recorded answer is filed under is a fact about the drawing rather than about the run (L-AI-01).
 */
export function viewCaptionRequest(caption: string, anchorKey: string): ModelRequest {
  return {
    modelId: VIEW_CAPTION_MODEL,
    system: SYSTEM,
    messages: [{ role: "user", content: canonicalJson({ caption, key: anchorKey }) }],
    question: MODEL_QUESTIONS.viewCaption,
  };
}

/**
 * What a model proposed one caption's view to be — a class of the caller's vocabulary, or NO class
 * at all. It is the caller's own class type: the set a question names is the set an answer can
 * carry, so a caller reading this proposal has a member of its vocabulary rather than a string to
 * re-judge.
 *
 * `type: null` is the question's own no-match outcome — "this caption names no class of view a
 * reader could tell" — carried up rather than refused (I-408). L-AI-02 names the ways an answer
 * fails to be a proposal (uncited, unresolved, unreadable) and says abstention is not the model's
 * decision: the CALLER decides queue item or exclusion. An answer the question itself offered, cited
 * to the caption it was asked about, is none of the three, and refusing it MALFORMED would tell the
 * audit the model spoke nonsense where it spoke plainly — and tell a reader to "request the answer
 * again" when the same caption asks the same question and hears the same answer. The note-clause
 * question reads its no-match the same way (`../notes/model.ts`, I-296).
 */
export type ViewTypeProposal<T extends string = string> = { readonly type: T | null };

/**
 * A model's payload as a classification, or the detail that says why it is not one (L-AI-02: a
 * decoder answers a result and never throws).
 *
 * The classifiable set is the caller's, because the vocabulary's law is a module's (L-CAD-06) and
 * core may not name it: what a caption may be classified AS is narrower than the vocabulary — the
 * classes that stand for "not read" say nothing a proposal could add — so the caller states the set
 * it will accept and an answer outside it is refused rather than stored.
 *
 * `noClass` is the caller's spelling of the member the question offers as its "none of these" (the
 * view-caption arm tells Jev to choose the vocabulary's untyped member where the caption names no
 * class), and it stands outside the classifiable set. An answer of exactly that member is a proposal
 * of no class (`type: null`); any other answer outside the set — a class the caller does not offer,
 * or no string at all — is still no reading of a caption, and is refused.
 */
export function readViewTypeProposal<T extends string>(classifiable: readonly T[], noClass: string): (payload: JsonValue) => DecodeResult<ViewTypeProposal<T>> {
  return (payload) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, detail: `a view classification is an object naming ${PROPOSAL_FIELD}` };
    }
    const named = Object.keys(payload);
    if (named.length !== 1 || named[0] !== PROPOSAL_FIELD) {
      return { ok: false, detail: `a view classification names exactly ${PROPOSAL_FIELD}, and this one names ${named.join(", ") || "nothing"}` };
    }
    const type = payload[PROPOSAL_FIELD];
    // The answer is read back OUT of the caller's set rather than merely tested against it: what
    // comes back is then one of the classes the question offered, by construction, and the caller
    // has nothing left to re-judge about an answer this already accepted.
    const answered = typeof type === "string" ? classifiable.find((candidate) => candidate === type) : undefined;
    if (answered !== undefined) return { ok: true, value: Object.freeze({ type: answered }) };
    // The question's own "none of these": a plain answer that the caption names no class, held as
    // a proposal of no class for the caller to decide on (L-AI-02) — never a refusal of the model.
    if (type === noClass) return { ok: true, value: Object.freeze({ type: null }) };
    return { ok: false, detail: `${JSON.stringify(type)} is no class a caption can be read as — the classifiable set is ${classifiable.join(", ")}, and ${noClass} answers none of these` };
  };
}

/**
 * The way to a model, as a seam a caller may hand in (B-23). The default is the shipped `propose` —
 * live in production, replayed from the recorded corpus inside verify (L-AI-01) — and a caller that
 * hands its own hands a `propose`, never a second path to a provider.
 */
export type ViewCaptionPort = { propose: typeof propose };

/** The port every call uses unless the caller names another: the model seam's own production entry. */
const PRODUCTION: ViewCaptionPort = { propose };

/** One silent caption, with the classes it may be read as and the artifact a citation resolves against. */
export type ViewCaptionQuestion<T extends string = string> = {
  readonly caption: string;
  /** The source key of the caption's own entity: what the answer is asked about, and may cite. */
  readonly anchorKey: string;
  readonly classifiable: readonly T[];
  /** The member the question offers as its "none of these" — outside the classifiable set (I-408). */
  readonly noClass: string;
  readonly artifact: SourceKeyResolver;
};

/**
 * What a model proposes this caption's view is (R-TO-030, L-AI-02). The seam's refusal is never
 * caught here: a refusal marker — a missing recorded answer, an uncited or unreadable answer —
 * reaches the caller intact. Neither is a "none of these" turned into anything here: it comes back
 * as a proposal of no class, and the caller decides what a view nobody could read becomes, because
 * abstention is not the model's decision.
 */
export async function proposeViewType<T extends string>(ctx: ModelCallContext, question: ViewCaptionQuestion<T>, port: ViewCaptionPort = PRODUCTION): Promise<Proposal<ViewTypeProposal<T>>> {
  return port.propose(ctx, viewCaptionRequest(question.caption, question.anchorKey), {
    artifact: question.artifact,
    decode: readViewTypeProposal(question.classifiable, question.noClass),
  });
}
