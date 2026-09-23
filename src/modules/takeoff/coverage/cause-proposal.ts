// R-TO-052's cause question: what a model may be asked about one unmeasured cell of the residue,
// and how its answer is read back (L-AI-01, L-AI-02, L-AI-03).
//
// It lives in the module that ASKS it (the `@/modules/ai/sheet-understanding/request.ts` shape):
// only S-Coverage puts this question, and what the two boundary acts need is the answer, never the
// question. Nothing here writes a declaration, a quantity or an act — what comes back is a Proposal
// and stays one, a classification held until a person carries the boundary themselves (L-AI-02).
//
// Everything below is PURE: the state is a reading of one `ResidueCell`, the request is a function
// of that state and of nothing else, and the decoder answers a result. The residue query, the
// campaign and the ledger are the door's (`./server`), so this file opens no database and is safe
// for the corpus recorder, which opens none either.
import { MODEL_QUESTIONS, canonicalJson, parseSourceKey, propose } from "@/core/model";
import type { DecodeResult, ModelCallContext, ModelRequest, Proposal, SourceKey, SourceKeyResolver } from "@/core/model";
import { JEV_MODEL, type ModelId } from "@/core/model-ledger.types";
import { SCOPE_DECLARATION_CAUSES, type ScopeDeclarationCause } from "@/core/errors";
import { compareCanonical, viewRefOf } from "@/core/identity";
// The law module, never the residue's roster: the roster carries the query, which reaches the
// database, and this file is read by a script that opens none (ARCH-01, the workspace's precedent).
import { IN_BILL, type MeasurementCause, type ResidueCell } from "@/core/residue/law";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model an unmeasured cell's cause is proposed by: one choice over a three-entry vocabulary is a
 * closed question only TypeSafe Jev answers, so it is pinned to Jev's id, unconditionally, and billed
 * at Jev's published rate (Deviation D-002, `docs/decisions/deviations.md`).
 */
export const COVERAGE_CAUSE_MODEL: ModelId = JEV_MODEL;

/** The field a proposed cause answers with, and the only one. */
const PROPOSAL_FIELD = "cause";

/**
 * The measurement axis' fall-through: the one reading a cause may be proposed over. Every other
 * reading of that axis is already explained — by published lines, by a person's declaration, or by a
 * sheet read only in part — and a question about it would be a question nobody could act on
 * (L-QTY-05's arm order). Spelled here as this file's own reading of the closed roster, because the
 * residue's boundary module reaches the store and this file may not.
 */
const NOT_ESTABLISHED = "NOT_ESTABLISHED" as const satisfies MeasurementCause;

/**
 * The confidence a proposed cause must carry before a person is shown it. Below it the door answers
 * no proposal at all and the inspector states nothing, which is this screen's escalation to the
 * person: abstention is the caller's decision and never the seam's (L-AI-02), and a threshold is a
 * policy evaluated on the recorded corpus rather than a number the seam routes on.
 *
 * 0.80, pending the calibration line's own read of the `coverage-cause` corpus: the only separation
 * evidence the tree holds today is the recorded caption corpus, which answered 0.97–0.99 where the
 * deterministic grammar agreed with the choice and 0.40–0.77 where the model was abstaining
 * (`docs/handoff/fable-5.1-session-4.md` §3.1). It moves only under a recorded Interpretation
 * quoting S-Audit's `coverage-cause` calibration line.
 */
export const COVERAGE_CAUSE_CONFIDENCE_FLOOR = 0.8;

/** Where the cell stands, as the model is shown it: never a surrogate id, always a reader's label. */
export type CoverageCauseCell = {
  readonly kind: string;
  readonly class: string;
  /** The storey's own LABEL as a reader reads it — the request is a fact about the drawing (I-25). */
  readonly level: string;
  readonly ordinal: number | null;
};

/** Where the class was seen: which of L-QTY-05's three channels saw it, and on which sheet. */
export type CoverageCauseSighting = { readonly channel: string; readonly layout: string };

/** What a rail reported when it read those sightings and offered no quantity (I-191's words). */
export type CoverageCauseObservation = { readonly rail: string; readonly reason: string };

/**
 * One unmeasured cell, as the question is asked over it: the cell, the sightings, the rails'
 * observations, and the one source key an answer may cite.
 *
 * No uuid enters it — no drawing id, no level id, no campaign id — so the same drawing makes the
 * same request forever and the recorded fixture replays in every lane (L-AI-01).
 */
export type CoverageCauseState = {
  readonly cell: CoverageCauseCell;
  readonly key: SourceKey;
  readonly sightings: readonly CoverageCauseSighting[];
  readonly observations: readonly CoverageCauseObservation[];
};

/**
 * What the model is told it is doing. It states the closed vocabulary and the answer's exact shape,
 * because L-AI-02 refuses an answer that is neither: a cause outside the declarable set is MALFORMED
 * and an uncited one is UNSOURCED, and a model that was not told so would spend tokens on answers
 * nobody can accept. The vocabulary is read from the one place it is written down (ARCH-02).
 */
const SYSTEM = [
  "You read the evidence a construction measurement campaign holds about one cell it published no quantity for, and you say which boundary a quantity surveyor would draw around that cell.",
  "The campaign's own arms explain every other unmeasured cell; this one they do not, so the boundary must be read from the evidence below and from nothing else.",
  'Answer with a JSON object of exactly {"payload": {"' + PROPOSAL_FIELD + '": "<CAUSE>"}, "sources": ["<key>"]}.',
  `The causes are: ${SCOPE_DECLARATION_CAUSES.join(", ")}. Spell the one you choose exactly as it is spelled here.`,
  "`sources` names the source key you were given, which is the caption anchor of the view this cell was sighted in — it is the evidence the answer rests on.",
  "Propose a classification. Do not conclude, do not measure, and do not declare: a cell whose evidence draws no boundary is not one to guess at.",
].join("\n");

/**
 * The question one unmeasured cell is asked, as a pure function of its state: the same cell of the
 * same campaign makes the same request forever, so the hash a recorded answer is filed under is a
 * fact about the drawing rather than about the run (L-AI-01).
 */
export function coverageCauseRequest(state: CoverageCauseState): ModelRequest {
  return {
    modelId: COVERAGE_CAUSE_MODEL,
    system: SYSTEM,
    messages: [{ role: "user", content: canonicalJson(contentOf(state)) }],
    question: MODEL_QUESTIONS.coverageCause,
  };
}

/** The request's canonical content: the state the adapter recognises, and nothing of this run. */
function contentOf(state: CoverageCauseState): JsonValue {
  return {
    cell: { kind: state.cell.kind, class: state.cell.class, level: state.cell.level, ordinal: state.cell.ordinal },
    key: state.key,
    observations: state.observations.map((observation) => ({ rail: observation.rail, reason: observation.reason })),
    sightings: state.sightings.map((sighting) => ({ channel: sighting.channel, layout: sighting.layout })),
  };
}

/**
 * The caption anchor embedded in a key the residue sighted a cell at, or null where the key carries
 * none. A cell of the residue has no CAD entity key of its own — a sighting cites a view key or a
 * placement key, and L-AI-02 resolves citations against the artifact as `scheme:key` (L-CAD-02) — so
 * the one lawful key an answer can cite is the anchor a view key was derived FROM (L-REG-04:
 * `v:{class}:{anchorSourceKey}`, a placement key that key followed by its own fields).
 *
 * A key whose anchor is not a source key answers null, and the cell is then never asked about:
 * nothing citable, no question, no ledger row.
 *
 * The grammar's inverse is the identity core's (`viewRefOf`), the one the Trace reads a key with
 * too: two readers splitting one grammar their own ways are two grammars (B-17).
 */
export function anchorSourceKeyOf(sourceKey: string): SourceKey | null {
  return viewRefOf(sourceKey)?.captionAnchorSourceKey ?? null;
}

/**
 * The one key this cell's answer may cite: the canonically first anchor its sightings yield. One
 * key, chosen by code from the cell's own sightings, so what the model may cite is what the campaign
 * actually saw — and the choice is a fact about the cell rather than about the order a query
 * returned its rows in.
 */
export function citableKeyOf(cell: ResidueCell): SourceKey | null {
  const anchors = cell.sightings
    .map((sighting) => anchorSourceKeyOf(sighting.sourceKey))
    .filter((key): key is SourceKey => key !== null)
    .sort(compareCanonical);
  return anchors[0] ?? null;
}

/**
 * Whether this cell is one a model is asked about at all — CODE's decision, never the model's
 * (L-AI-03). The cell must read as the measurement axis' fall-through (every other reading is
 * already explained), must be CELL-grain with a class and a level (the very rule the two doors stand
 * under, I-194: a cause proposed for a cell nobody could declare over is theatre), must carry no
 * declaration in force on either axis (a person has already drawn the boundary), and must yield a
 * citable key.
 */
export function asksACause(cell: ResidueCell): boolean {
  return (
    cell.grain === "CELL" &&
    cell.measurement === NOT_ESTABLISHED &&
    cell.bill === IN_BILL &&
    cell.class !== null &&
    cell.levelId !== null &&
    cell.measurementActId === null &&
    cell.billActId === null &&
    citableKeyOf(cell) !== null
  );
}

/**
 * The state one cell is asked about, or null where it is not a cell this question is put over. The
 * gate and the reading are one function so a caller cannot ask about a cell the gate refuses.
 */
export function coverageCauseStateOf(cell: ResidueCell): CoverageCauseState | null {
  if (!asksACause(cell)) return null;
  const key = citableKeyOf(cell);
  if (key === null) return null;
  return {
    cell: { kind: cell.kind, class: cell.class ?? "", level: cell.levelLabel, ordinal: cell.levelOrdinal },
    key,
    sightings: cell.sightings.map((sighting) => ({ channel: sighting.channel, layout: sighting.layoutName })),
    observations: cell.observations.map((observation) => ({ rail: observation.rail, reason: observation.reason })),
  };
}

/** Whether this state is one a request can be composed over — the recorder's guard over a file. */
export function isCoverageCauseState(value: unknown): value is CoverageCauseState {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const { cell, key, sightings, observations } = value as Record<string, unknown>;
  if (typeof key !== "string" || parseSourceKey(key) === null) return false;
  if (cell === null || typeof cell !== "object" || Array.isArray(cell)) return false;
  const { kind, class: klass, level, ordinal } = cell as Record<string, unknown>;
  if (typeof kind !== "string" || typeof klass !== "string" || typeof level !== "string") return false;
  if (!(ordinal === null || typeof ordinal === "number")) return false;
  return listOf(sightings, ["channel", "layout"]) && listOf(observations, ["rail", "reason"]);
}

/** Every member of a list is an object whose named fields are all strings. */
function listOf(value: unknown, fields: readonly string[]): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((item) => item !== null && typeof item === "object" && !Array.isArray(item) && fields.every((field) => typeof (item as Record<string, unknown>)[field] === "string"));
}

/**
 * What a model proposed one cell's cause to be — a cause of the caller's declarable set, and no more.
 */
export type CoverageCauseProposal<T extends string = ScopeDeclarationCause> = { readonly cause: T };

/**
 * A model's payload as a proposed cause, or the detail that says why it is not one (L-AI-02: a
 * decoder answers a result and never throws).
 *
 * The declarable set is the CALLER's: what a cell may be declared under is narrower than what the
 * question offered — the no-match outcome says no boundary at all, which is not a boundary to
 * propose — so the set stated here is the set an answer is read back OUT of, and the honest
 * abstention is refused MALFORMED rather than stored as a cause nobody may declare.
 */
export function readCoverageCauseProposal<T extends string>(declarable: readonly T[]): (payload: JsonValue) => DecodeResult<CoverageCauseProposal<T>> {
  return (payload) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, detail: `a proposed cause is an object naming ${PROPOSAL_FIELD}` };
    }
    const named = Object.keys(payload);
    if (named.length !== 1 || named[0] !== PROPOSAL_FIELD) {
      return { ok: false, detail: `a proposed cause names exactly ${PROPOSAL_FIELD}, and this one names ${named.join(", ") || "nothing"}` };
    }
    const cause = payload[PROPOSAL_FIELD];
    const answered = typeof cause === "string" ? declarable.find((candidate) => candidate === cause) : undefined;
    if (answered === undefined) {
      return { ok: false, detail: `${JSON.stringify(cause)} is no cause a person may declare a cell under — the declarable set is ${declarable.join(", ")}` };
    }
    return { ok: true, value: Object.freeze({ cause: answered }) };
  };
}

/**
 * Whether a proposal carrying this confidence is shown to a person at all. A call whose judgment
 * states no confidence stands below the floor: an unjudged proposal is one nobody can calibrate, and
 * the person reads the evidence and decides (L-AI-02).
 */
export function standsAboveFloor(confidence: number | null): boolean {
  return confidence !== null && confidence >= COVERAGE_CAUSE_CONFIDENCE_FLOOR;
}

/**
 * The way to a model, as a seam a caller may hand in (B-23). The default is the shipped `propose` —
 * live in production, replayed from the recorded corpus inside verify (L-AI-01) — and a caller that
 * hands its own hands a `propose`, never a second path to a provider.
 */
export type CoverageCausePort = { propose: typeof propose };

/** The port every call uses unless the caller names another: the model seam's own production entry. */
const PRODUCTION: CoverageCausePort = { propose };

/** One unmeasured cell, with the causes it may be read as and the artifact a citation resolves against. */
export type CoverageCauseQuestion<T extends string = ScopeDeclarationCause> = {
  readonly state: CoverageCauseState;
  readonly declarable: readonly T[];
  readonly artifact: SourceKeyResolver;
};

/**
 * What a model proposes this cell's boundary is (R-TO-052, L-AI-02). The seam's refusal is never
 * caught here: a refusal marker — a missing recorded answer, an uncited or unreadable answer, the
 * honest no-match — reaches the caller intact, and the caller decides what a cell nobody could read
 * a boundary around becomes, because abstention is not the model's decision.
 */
export async function proposeCoverageCause<T extends string>(
  ctx: ModelCallContext,
  question: CoverageCauseQuestion<T>,
  port: CoverageCausePort = PRODUCTION,
): Promise<Proposal<CoverageCauseProposal<T>>> {
  return port.propose(ctx, coverageCauseRequest(question.state), {
    artifact: question.artifact,
    decode: readCoverageCauseProposal(question.declarable),
  });
}
