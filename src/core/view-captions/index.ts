// R-TO-030's silent-caption question: what a model may be asked about a view caption L-CAD-06's
// grammar read nothing in, and how its answer is read back.
//
// It lives in core for the reason `../sheets` does: the module that ASKS the question is the takeoff
// seam's stored partition and the module that PUBLISHES it is `src/modules/ai/view-captions`, and
// ARCH-01 lets neither of them name the other. One home, reachable by both (B-17, ARCH-02) — and by
// the act seam's own neighbourhood, which is core too.
//
// What comes back is a Proposal and stays one (L-AI-02): a classification held until a person
// confirms it. Nothing here writes a view, a type or a confirmation.
import { canonicalJson, propose } from "../model";
import type { DecodeResult, ModelCallContext, ModelRequest, Proposal, SourceKeyResolver } from "../model";
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import type { ModelId } from "../model-ledger.types";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model a silent caption is classified by. AS-05 pins `claude-sonnet-5` to cheap classification,
 * and reading one short caption into one class of a closed vocabulary is exactly that.
 */
export const VIEW_CAPTION_MODEL: ModelId = "claude-sonnet-5";

/** The field a classification answers with, and the only one. */
const PROPOSAL_FIELD = "type";

/**
 * What the model is told it is doing. It states the closed vocabulary and the answer's exact shape,
 * because L-AI-02 refuses an answer that is neither: a class outside the vocabulary is MALFORMED and
 * an uncited one is UNSOURCED, and a model that was not told so would spend tokens on answers nobody
 * can accept. The vocabulary is read from the one place it is written down (ARCH-02).
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
  };
}

/** What a model proposed one caption's view to be — a class of the caller's vocabulary, and no more. */
export type ViewTypeProposal = { readonly type: string };

/**
 * A model's payload as a classification, or the detail that says why it is not one (L-AI-02: a
 * decoder answers a result and never throws).
 *
 * The classifiable set is the caller's, because the vocabulary's law is a module's (L-CAD-06) and
 * core may not name it: what a caption may be classified AS is narrower than the vocabulary — the
 * classes that stand for "not read" say nothing a proposal could add — so the caller states the set
 * it will accept and an answer outside it is refused rather than stored.
 */
export function readViewTypeProposal(classifiable: readonly string[]): (payload: JsonValue) => DecodeResult<ViewTypeProposal> {
  return (payload) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, detail: `a view classification is an object naming ${PROPOSAL_FIELD}` };
    }
    const named = Object.keys(payload);
    if (named.length !== 1 || named[0] !== PROPOSAL_FIELD) {
      return { ok: false, detail: `a view classification names exactly ${PROPOSAL_FIELD}, and this one names ${named.join(", ") || "nothing"}` };
    }
    const type = payload[PROPOSAL_FIELD];
    if (typeof type !== "string" || !classifiable.includes(type)) {
      return { ok: false, detail: `${JSON.stringify(type)} is no class a caption can be read as — the classifiable set is ${classifiable.join(", ")}` };
    }
    return { ok: true, value: Object.freeze({ type }) };
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
export type ViewCaptionQuestion = {
  readonly caption: string;
  /** The source key of the caption's own entity: what the answer is asked about, and may cite. */
  readonly anchorKey: string;
  readonly classifiable: readonly string[];
  readonly artifact: SourceKeyResolver;
};

/**
 * What a model proposes this caption's view is (R-TO-030, L-AI-02). The seam's refusal is never
 * caught here: a refusal marker — a missing recorded answer, an uncited or unreadable answer —
 * reaches the caller intact, and the caller decides what a view nobody could read becomes, because
 * abstention is not the model's decision.
 */
export async function proposeViewType(ctx: ModelCallContext, question: ViewCaptionQuestion, port: ViewCaptionPort = PRODUCTION): Promise<Proposal<ViewTypeProposal>> {
  return port.propose(ctx, viewCaptionRequest(question.caption, question.anchorKey), {
    artifact: question.artifact,
    decode: readViewTypeProposal(question.classifiable),
  });
}
