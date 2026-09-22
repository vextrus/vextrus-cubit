// R-TO-004's revision question, and its one door (ARCH-02): how current one sheet's issue state is,
// read off what that sheet prints against what its set prints beside it. A caller — a later screen,
// a set's pin surface — speaks to it through this file and never reaches past it.
//
// What comes back is a Proposal and stays one (L-AI-02): a classification held until confirmed.
// Nothing here writes a revision, a set, a pin or an act, and no act judges this reading today —
// PIN_DRAWING_SET judges a content-addressed manifest of (drawing, revision) pairs, never a printed
// REV mark, so a pin that also wrote CONFIRMED against a recency score would be an act claiming
// something it does not claim (L-AI-03). Until an act exists, the proposal stands in the ledger as
// what it is: proposed, awaiting, and read as such on S-Audit's calibration line.
//
// L-AI-03's order holds as it does for the sheet reading: every figure this question reasons over is
// found by CODE first — the marks, the rows, the set's lines — and the model only selects among them
// and places the sheet on the spectrum. It spells no mark, no date and no key of its own.
import { propose, sourceKeyResolver } from "@/core/model";
import type { ModelCallContext, Proposal } from "@/core/model";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { readRevisionRecency, type RevisionRecency } from "./law";
import { carriesRevisionEvidence, revisionCitableKeysOn, sheetRevisionRequest } from "./request";

export { RECENCY_LEVELS, REVISION_RECENCY_MODEL, TOP_LEVEL, readRevisionRecency, type RevisionRecency } from "./law";
export {
  carriesRevisionEvidence,
  revisionCitableKeysOn,
  revisionEvidenceOn,
  setEvidenceOn,
  sheetRevisionRequest,
  type RevisionMark,
  type RevisionRow,
  type SetSheetEvidence,
  type SheetRevisionEvidence,
} from "./request";

/** Which sheet's issue state is being read: the artifact, the layout inside it, and the artifact's identity. */
export type SheetRevisionInput = {
  readonly graph: EntityGraph;
  readonly layoutName: string;
  /** What the sources are resolved against, as the caller names it (L-AI-02's `artifact`). */
  readonly artifactDigest: string;
};

/**
 * The way to a model, as a seam a caller may hand in (B-23). The default is the shipped `propose` —
 * live in production, replayed from the recorded corpus inside verify (L-AI-01) — and a caller that
 * hands its own hands a `propose`, never a second path to a provider.
 */
export type SheetRevisionPort = { propose: typeof propose };

/** The port every call uses unless the caller names another: the model seam's own production entry. */
const PRODUCTION: SheetRevisionPort = { propose };

/**
 * What a model proposes this sheet's issue state to be (R-TO-004, L-AI-02).
 *
 * A sheet that prints nothing about its revision is never asked: its only answer would cite nothing,
 * every such answer earns UNSOURCED, and a model asked a question with no admissible answer still
 * spends a tenant's money (L-AI-01 attributes what it spends). The caller gates on
 * `carriesRevisionEvidence` and hears the defect it is where it did not (ARCH-03) — never a refusal
 * a person could act on.
 *
 * The seam's own refusal is never caught here: a refusal marker — a missing recorded answer, an
 * uncited or unreadable answer — reaches the caller intact, and the caller decides what a sheet
 * nobody could date becomes, because abstention is not the model's decision (L-AI-02).
 */
export async function proposeSheetRevisionRecency(ctx: ModelCallContext, input: SheetRevisionInput, port: SheetRevisionPort = PRODUCTION): Promise<Proposal<RevisionRecency>> {
  if (!carriesRevisionEvidence(input.graph, input.layoutName)) {
    throw new Error(`the sheet ${JSON.stringify(input.layoutName)} prints no revision mark and no revision row, so a reading of it could cite nothing — no model is asked (L-AI-02)`);
  }
  return port.propose(ctx, sheetRevisionRequest(input.graph, input.layoutName), {
    artifact: sourceKeyResolver(input.artifactDigest, revisionCitableKeysOn(input.graph, input.layoutName)),
    decode: readRevisionRecency,
  });
}
