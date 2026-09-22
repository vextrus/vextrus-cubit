// L-QTY-04's uncorroborated-outline question: what a model may be asked about one interpreted
// outline the gate deferred, and how its answer is read back.
//
// L-QTY-04 defers an interpreted outline nobody corroborated and never publishes a line from it. The
// machine may say, before a person looks, whether the outline it interpreted is the member its mark
// names at the size the drawing states — L-AI-03's "flag anomalies against benchmarks" — and the
// benchmarks are the drawing's OWN: the section its schedules state for that mark, the median
// footprint of the plan's other members, and the near-anchor reach and footprint band the project's
// pinned edition states. Nothing here measures: every figure the question reasons over is found by
// code before the call (`@/modules/takeoff/partition/placement/evidence`), and what comes back is a
// probability about that state and nothing else — no unit, no quantity, no register row (L-AI-03).
//
// It lives in core for the reason `../view-captions` does: the evidence is a takeoff module's, the
// judging acts are core's (`../acts/corroborate`, `../acts/repudiate`), and ARCH-01 lets neither of
// them name the other. One home, reachable by both (B-17, ARCH-02).
//
// What comes back is a Proposal and stays one (L-AI-02): a classification held until a person acts.
// Nothing here corroborates, repudiates, publishes or strikes.
import { MODEL_QUESTIONS, canonicalJson, propose } from "../model";
import type { DecodeResult, ModelCallContext, ModelRequest, Proposal, SourceKeyResolver } from "../model";
import type { ModelId } from "../model-ledger.types";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model one outline's corroboration is read by. AS-05 pins `claude-sonnet-5` to cheap
 * classification, and comparing a handful of numbers against benchmarks found beside them is exactly
 * that. Jev is billed under this pinned id until the owner's amendment lands
 * (docs/decisions/as-05-jev-amendment.md): nothing here adds a Jev id or a rate.
 */
export const OUTLINE_CORROBORATION_MODEL: ModelId = "claude-sonnet-5";

/** The field the answer carries, and the only one. */
const PROPOSAL_FIELD = "corroborates";

/** How many places every figure in the state is rounded to before the request is hashed. */
const PLACES = 3;

/**
 * Everything one outline's corroboration is asked over: what code found about the outline, about the
 * mark that anchors it, about the plan it stands on, and about the bands the pinned edition states.
 *
 * Declared in core, and read there by the acts that judge the proposal, because the stage that finds
 * it is a module's (ARCH-01). Every length is in the DRAWING's own units — the two stated sides
 * carried to those units at the scale the drawing's own plans and schedules agree on, and null
 * together where the schedules state no section for the mark or no scale could be read: a drawing
 * that was silent reads as silence, never as a number nobody read (L-QTY-04, L-MEA-07).
 */
export type OutlineEvidence = {
  /** The member mark the outline is anchored by, normalised (`C4`). */
  readonly mark: string;
  /** The element class that mark names (`column`, `footing`, …). */
  readonly class: string;
  /** The source key of the closed outline — what the answer is about, and what it cites. */
  readonly outlineKey: string;
  /** The source key of the mark's own text entity — the second thing the answer is about. */
  readonly markKey: string;
  readonly outlineLongest: number;
  readonly outlineShorter: number;
  /** The bounding box's area — the size figure a reader recognises a footprint by, never a measured quantity. */
  readonly outlineArea: number;
  /** The median longest side of every mark-anchored outline on this same plan. */
  readonly planMedianLongest: number;
  readonly statedLongest: number | null;
  readonly statedShorter: number | null;
  /** How far the naming mark stands from the outline's centre. */
  readonly nearAnchorDistance: number;
  /** The furthest a mark may stand from an outline and still be taken to name it. */
  readonly nearAnchorReach: number;
  /** The plan's minimum grid spacing — what both distances and both band shares are scaled from. */
  readonly gridSpacing: number;
  readonly footprintMin: number;
  readonly footprintMax: number;
};

/**
 * What the model is told it is doing. It states the answer's exact shape because L-AI-02 refuses an
 * answer that is not one: a payload that is not a probability is MALFORMED and an uncited one is
 * UNSOURCED, and a model that was not told so would spend tokens on answers nobody can accept.
 *
 * The closed-question adapter (`../model/typesafe-arms/outline-corroboration`) puts the same state as
 * one Noul and never reads this text; it is the system prompt of the generative transport, which is
 * what a recording made under the pinned Claude id answers through.
 */
const SYSTEM = [
  "You are shown one closed outline drawn on a layout plan of a structural construction drawing, the member mark standing nearest it, and the sizes the same drawing states elsewhere for that mark.",
  "Say whether this outline is the member that mark names, at the size this drawing states for it.",
  'Answer with a JSON object of exactly {"payload": {"' + PROPOSAL_FIELD + '": <number between 0 and 1>}, "sources": ["<outline key>", "<mark key>"]}.',
  `\`${PROPOSAL_FIELD}\` is your probability that it is: 1 where the outline's size agrees with the stated section and with the plan's own other members inside the band and the mark stands well within the near-anchor reach, 0 where the outline is better explained as something else the plan drew near that mark — a stair or lift opening, a room or parapet ring, a hatch fragment, or a different member the mark merely stands close to.`,
  "`sources` names the two entity keys you were given, which are the outline and the mark themselves — the evidence the answer rests on.",
  "Propose a reading. Do not conclude and do not measure: you corroborate nothing, you publish nothing, and no quantity follows from your answer.",
].join("\n");

/**
 * The state one outline is judged over, as the request carries it: every figure rounded to three
 * places HERE, so a float's last bit cannot re-key a recorded answer, and nulls left null.
 *
 * The keys are the exact set the closed-question adapter recognises this request by, so a field
 * added or renamed here is a new question with a new key set and a new hash — which is what makes a
 * recorded answer a fact about the drawing rather than about the run (L-AI-01).
 */
function stateOf(evidence: OutlineEvidence): Record<string, JsonValue> {
  return {
    class: evidence.class,
    footprintMax: placed(evidence.footprintMax),
    footprintMin: placed(evidence.footprintMin),
    gridSpacing: placed(evidence.gridSpacing),
    mark: evidence.mark,
    markKey: evidence.markKey,
    nearAnchorDistance: placed(evidence.nearAnchorDistance),
    nearAnchorReach: placed(evidence.nearAnchorReach),
    outlineArea: placed(evidence.outlineArea),
    outlineKey: evidence.outlineKey,
    outlineLongest: placed(evidence.outlineLongest),
    outlineShorter: placed(evidence.outlineShorter),
    planMedianLongest: placed(evidence.planMedianLongest),
    statedLongest: evidence.statedLongest === null ? null : placed(evidence.statedLongest),
    statedShorter: evidence.statedShorter === null ? null : placed(evidence.statedShorter),
  };
}

/** One figure as the request states it: three places, and never a negative zero. */
function placed(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`the outline evidence states ${JSON.stringify(value)}, which is no figure a question can be asked over (L-AI-01)`);
  const rounded = Number(value.toFixed(PLACES));
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * The question one deferred outline is asked, as a pure function of the evidence: the same drawing,
 * schedules and pinned shares make the same request — and so the same hash — forever (L-AI-01).
 */
export function outlineCorroborationRequest(evidence: OutlineEvidence): ModelRequest {
  return {
    modelId: OUTLINE_CORROBORATION_MODEL,
    system: SYSTEM,
    messages: [{ role: "user", content: canonicalJson(stateOf(evidence)) }],
    question: MODEL_QUESTIONS.outlineCorroboration,
  };
}

/** What a model proposed about one outline: how probable it is the member its mark names, and no more. */
export type CorroborationProposal = { readonly corroborates: number };

/**
 * A model's payload as a corroboration, or the detail that says why it is not one (L-AI-02: a
 * decoder answers a result and never throws).
 *
 * A probability outside 0…1 is refused rather than clamped: a figure the contract does not admit is
 * an answer nobody can read, and clamping it would be this decoder deciding what the model meant.
 */
export function readCorroborationProposal(payload: JsonValue): DecodeResult<CorroborationProposal> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, detail: `a corroboration is an object naming ${PROPOSAL_FIELD}` };
  }
  const named = Object.keys(payload);
  if (named.length !== 1 || named[0] !== PROPOSAL_FIELD) {
    return { ok: false, detail: `a corroboration names exactly ${PROPOSAL_FIELD}, and this one names ${named.join(", ") || "nothing"}` };
  }
  const stated = payload[PROPOSAL_FIELD];
  if (typeof stated !== "number" || !Number.isFinite(stated) || stated < 0 || stated > 1) {
    return { ok: false, detail: `${JSON.stringify(stated)} is no probability that this outline is the member its mark names` };
  }
  return { ok: true, value: Object.freeze({ corroborates: stated }) };
}

/**
 * The way to a model, as a seam a caller may hand in (B-23). The default is the shipped `propose` —
 * live in production, replayed from the recorded corpus inside verify (L-AI-01) — and a caller that
 * hands its own hands a `propose`, never a second path to a provider.
 */
export type OutlineCorroborationPort = { propose: typeof propose };

/** The port every call uses unless the caller names another: the model seam's own production entry. */
const PRODUCTION: OutlineCorroborationPort = { propose };

/** One deferred outline, and the artifact its two citations resolve against. */
export type OutlineCorroborationQuestion = {
  readonly evidence: OutlineEvidence;
  readonly artifact: SourceKeyResolver;
};

/**
 * What a model proposes about this outline (L-QTY-04, L-AI-02). The seam's refusal is never caught
 * here: FIXTURE_MISSING, an uncited answer, a payload that is no probability — each reaches the
 * caller intact, and the caller decides what an outline nobody could read becomes, because
 * abstention is not the model's decision. The queue item stands either way.
 */
export async function proposeOutlineCorroboration(
  ctx: ModelCallContext,
  question: OutlineCorroborationQuestion,
  port: OutlineCorroborationPort = PRODUCTION,
): Promise<Proposal<CorroborationProposal>> {
  return port.propose(ctx, outlineCorroborationRequest(question.evidence), { artifact: question.artifact, decode: readCorroborationProposal });
}

export { CORROBORATION_NO, CORROBORATION_YES, corroborationOutcomeOf, corroborationReadingOf } from "./law";
export type { CorroborationAct, CorroborationReading } from "./law";
