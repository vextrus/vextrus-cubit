// R-AI-001's one door (ARCH-02): what one sheet of a drawing set is, and what a person did with the
// answer. A caller — a sheet card, the takeoff lane, a later screen — speaks to sheet understanding
// through this file and never reaches past it.
//
// The order is the law's own: L-AI-03 prefers "a deterministic grammar where the text is vector", so
// the title-block grammar answers first and no model is asked at all where it read anything. Only a
// layout the grammar is silent on — a title block carried by block attributes, exploded paint,
// nothing readable in TEXT/MTEXT at all — reaches `claude-opus-5` (AS-05), through the model seam's
// own `propose`, which is the tree's only path to a model (L-AI-01).
//
// What comes back is a Proposal and stays one (L-AI-02): a reading presented for disposition. This
// module writes no register row, no confirmed discipline and no act — a person confirming the
// discipline performs CONFIRM_DISCIPLINE, which is the act seam's, and a screen's composition.
import { propose, sourceKeyResolver } from "@/core/model";
import type { ModelCallContext } from "@/core/model";
import { readTitleBlock } from "@/core/sheets";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { readSheetReading, readingOf, type SheetUnderstanding } from "./law";
import { citableKeysOn, sheetUnderstandingRequest } from "./request";

export { UNDERSTANDING_BASES, UNDERSTANDING_MODEL, type SheetReading, type SheetUnderstanding, type UnderstandingBasis } from "./law";
export { sheetUnderstandingRequest } from "./request";
export {
  dispositionCountsOf,
  dispositionsOf,
  recordDisposition,
  type DispositionCounts,
  type DispositionInput,
  type DispositionScope,
  type RecordedDisposition,
} from "./dispositions";
export { DISPOSITIONS, type Disposition } from "@/core/db";

/** Which sheet is being understood: the artifact, the layout inside it, and the artifact's identity. */
export type SheetUnderstandingInput = {
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
export type SheetUnderstandingPort = { propose: typeof propose };

/** The port every call uses unless the caller names another: the model seam's own production entry. */
const PRODUCTION: SheetUnderstandingPort = { propose };

/**
 * What one sheet is (R-AI-001). The grammar first; the model only where it read nothing at all.
 *
 * Field-level silence is not silence: a sheet the grammar read a title off but no number for stands
 * as GRAMMAR with `number: null`, and no call is made to fill the gap. A reading assembled from two
 * bases could not be dispositioned as one proposal — a person accepting it would be accepting the
 * grammar's work as the model's — so the basis is a fact about the whole reading.
 *
 * The seam's rejection is never caught here: a refusal marker reaches the caller intact, and a fault
 * propagates as the fault it is (ARCH-03). The caller decides what a sheet nobody could read becomes
 * — a queue item, an exclusion — because abstention is not the model's decision (L-AI-02).
 */
export async function understandSheet(ctx: ModelCallContext, input: SheetUnderstandingInput, port: SheetUnderstandingPort = PRODUCTION): Promise<SheetUnderstanding> {
  const grammar = readTitleBlock(input.graph, input.layoutName);
  if (grammar.basis === "GRAMMAR") {
    // The grammar reads a title block, not a drawing: view captions are L-CAD-06's classification and
    // this basis invents none. `cited` is the block it read, entity for entity.
    return Object.freeze({
      basis: "GRAMMAR",
      reading: readingOf({ number: grammar.number, title: grammar.title, discipline: grammar.discipline, captions: [] }),
      cited: Object.freeze([...grammar.cited]),
      callId: null,
      model: null,
    });
  }

  // Scoped to this sheet's own entities: a reading of this sheet resting on an entity of another one
  // is evidence for a different sheet, and those keys are the artifact's either way (L-AI-02).
  const citable = citableKeysOn(input.graph, input.layoutName);
  if (citable.length === 0) {
    // No key on this layout can be cited, so no answer could be a proposal: every one of them would
    // earn UNSOURCED or SOURCE_UNRESOLVED. The call is not made — a model asked a question with no
    // admissible answer still spends a tenant's money (L-AI-01 attributes what it spends) — and the
    // caller hears the defect it is, never a refusal a person could act on (ARCH-03).
    throw new Error(`the artifact carries no entity on layout ${JSON.stringify(input.layoutName)}, so a reading of it could cite nothing — no model is asked (L-AI-02)`);
  }

  const proposal = await port.propose(ctx, sheetUnderstandingRequest(input.graph, input.layoutName), {
    artifact: sourceKeyResolver(input.artifactDigest, citable),
    decode: readSheetReading,
  });

  return Object.freeze({
    basis: "MODEL",
    reading: proposal.payload,
    cited: proposal.sources,
    callId: proposal.callId,
    model: proposal.model,
  });
}
