// S-Coverage's reading, composed once (ARCH-02): the residue query in core answers the grid, and the
// two boundary statements are computed off exactly the cells the grid paints.
//
// This file computes nothing of its own. The arms are L-QTY-05's and live in `@/core/residue`, so
// M7's certificate reads the same answer through the same functions without ever importing a module
// (B-17, ARCH-01).
import { and, eq, forTenant, quantityLines } from "@/core/db";
// The ledger's judgment reader is the seam's own and is reached at its home: the db barrel publishes
// main's names and the schema tree's, never a name of its own invention (ARCH-02, B-17).
import { modelJudgmentOf } from "@/core/db/model-outcomes";
import { SCOPE_DECLARATION_CAUSES } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { sourceKeyResolver } from "@/core/model";
import { billStatementOf, cellRef, measurementStatementOf, parseCellRef, partialStatementOf, residueOf, unclassedStatementOf } from "@/core/residue";
import { entitySelectionOf, pinnedRecordsOf } from "@/modules/takeoff/trace";
import { coverageCauseStateOf, proposeCoverageCause, standsAboveFloor, type CoverageCausePort } from "./cause-proposal";
import type { CertificatePreview, CoverageCauseProposalView, CoverageCellView, CoverageView } from "./view";

/** Which project's coverage is read, in whose workspace. */
export type CoverageScope = { readonly tenantId: string; readonly projectId: string };

/** The whole screen's reading, in one answer. */
export async function coverageViewOf(scope: CoverageScope): Promise<CoverageView> {
  const residue = await residueOf(scope);
  return {
    tenantId: residue.tenantId,
    projectId: residue.projectId,
    campaignId: residue.campaign?.campaignId ?? null,
    setRevisionId: residue.campaign?.setRevisionId ?? null,
    input: residue.input,
    cells: residue.cells,
    measurement: measurementStatementOf(residue.cells),
    bill: billStatementOf(residue.cells),
    // The measurement boundary's other two enumerations (I-481/e), off the same residue.
    partial: partialStatementOf(residue.cells),
    unclassed: unclassedStatementOf(residue.input.unclassed ?? []),
    declaredLineIds: residue.campaign === null ? [] : await declaredLinesOf(scope.tenantId, residue.campaign.campaignId),
    sightingSelections: residue.campaign === null ? {} : await sightingSelectionsOf(scope, residue.campaign.setRevisionId, residue.cells.flatMap((cell) => cell.sightings)),
  };
}

/**
 * What each sighting's Trace selects on the sheet it names (s-coverage I-556): the record each
 * sighted drawing of the pinned revision was read on, read once, and every sighting's key resolved
 * against it by the Trace's own reading (`entitySelectionOf`) — a placement to the outline and the
 * mark it was read off, a caption to itself. Only the keys that stand on the sighting's own sheet are
 * kept, so the link never lands on a key the sheet cannot hold; a sighting that resolves none is not
 * answered, and its row keeps the key with no link (I-181).
 */
async function sightingSelectionsOf(
  scope: CoverageScope,
  setRevisionId: string,
  sightings: readonly { readonly drawingId: string; readonly layoutName: string; readonly sourceKey: string }[],
): Promise<Record<string, Record<string, string[]>>> {
  const named = sightings.filter((seen) => seen.layoutName !== "");
  if (named.length === 0) return {};
  const records = await pinnedRecordsOf(scope, setRevisionId, named.map((seen) => seen.drawingId));
  const held: Record<string, Record<string, string[]>> = {};
  for (const seen of named) {
    const onDrawing = (held[seen.drawingId] ??= {});
    if (seen.sourceKey in onDrawing) continue;
    const selection = entitySelectionOf(seen.sourceKey, records, { drawingId: seen.drawingId, layoutName: seen.layoutName });
    if (selection !== null) onDrawing[seen.sourceKey] = selection.sourceKeys;
  }
  return held;
}

/** The coverage every line carries that bears its quantity (L-QTY-02): anything else declared an omission. */
const COMPLETE = "COMPLETE";

/**
 * The campaign's published lines kept with no quantity (s-coverage I-cov-1): read off the lines
 * themselves, one pass over the campaign, and nothing judged here — a line is PARTIAL_DECLARED
 * because the gate stored it so, with every omitted component enumerated on it (L-QTY-02).
 */
async function declaredLinesOf(tenantId: string, campaignId: string): Promise<string[]> {
  const rows = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ lineId: quantityLines.lineId, coverage: quantityLines.coverage })
      .from(quantityLines)
      .where(and(eq(quantityLines.tenantId, tenantId), eq(quantityLines.campaignId, campaignId))),
  );
  return rows.filter((row) => row.coverage !== COMPLETE).map((row) => row.lineId);
}

/**
 * One cell of the residue, addressed. An address this residue holds no cell for answers `null`: a
 * stale address is a fact about the address, and nothing is invented for it (I-193).
 */
export async function coverageCellOf(scope: CoverageScope, address: string): Promise<CoverageCellView | null> {
  const named = parseCellRef(address);
  if (named === null) return null;
  const residue = await residueOf(scope);
  const held = residue.cells.find((cell) => cellRef(cell) === cellRef(named));
  return held === undefined ? null : { cell: held, sightings: held.sightings };
}

/** The certificate's two boundary statements, as they will print (L-QTY-07). */
export async function certificatePreviewOf(scope: CoverageScope): Promise<CertificatePreview> {
  const residue = await residueOf(scope);
  return {
    measurement: measurementStatementOf(residue.cells),
    bill: billStatementOf(residue.cells),
    partial: partialStatementOf(residue.cells),
    unclassed: unclassedStatementOf(residue.input.unclassed ?? []),
  };
}

/** Who is asking, for the ledger row every model call writes (L-AI-01). */
export type CoverageCaller = { readonly actor: string; readonly requestId: string };

/**
 * How the confidence a call carried is read back. It is a LEDGER fact, not a member of the Proposal
 * (L-AI-02 closes that list), so the default reads the row the seam just wrote; a caller that hands
 * its own hands a reader of the same fact, never a second source of it.
 */
export type CoverageJudgmentReader = (scope: CoverageScope, callId: string) => Promise<{ readonly confidence: number | null } | null>;

/** The two seams this reading stands on: the way to a model, and the way to what it judged. */
export type CoverageCauseSeam = {
  readonly port?: CoverageCausePort;
  readonly judgmentOf?: CoverageJudgmentReader;
};

/** The ledger's own answer: the judgment recorded against that call, for this tenant and project. */
const LEDGER_JUDGMENT: CoverageJudgmentReader = async (scope, callId) => modelJudgmentOf(forTenant({ tenantId: scope.tenantId }), scope, callId);

/**
 * The boundary a model proposes for one unmeasured cell, or none (R-TO-052, L-AI-02, s-coverage
 * I-297). CODE decides the question is asked at all — `coverageCauseStateOf` is the gate — and CODE
 * decides what a low-confidence answer is worth; the model only chooses among the causes a PERSON
 * may declare, and nothing here writes a declaration, a quantity or an act (L-AI-03).
 *
 * Every way of having no answer lands on the same `null`, because a reader does the same thing with
 * each of them: a stale address, a cell the gate never asks about, the seam's refusal (a missing
 * fixture, an uncited answer, the honest no-match refused MALFORMED by the decoder) and a confidence
 * under the floor. A refusal is caught exactly as `rebuild.ts` catches a refused caption proposal —
 * by its registered code, with anything that is not a refusal travelling on as the fault it is
 * (ARCH-03, B-21).
 */
export async function coverageCauseProposalOf(
  scope: CoverageScope,
  address: string,
  caller: CoverageCaller,
  seam: CoverageCauseSeam = {},
): Promise<CoverageCauseProposalView> {
  const named = parseCellRef(address);
  if (named === null) return { proposal: null };
  const residue = await residueOf(scope);
  if (residue.campaign === null) return { proposal: null };
  const held = residue.cells.find((cell) => cellRef(cell) === cellRef(named));
  if (held === undefined) return { proposal: null };
  const state = coverageCauseStateOf(held);
  if (state === null) return { proposal: null };

  const ctx = { tenantId: scope.tenantId, projectId: scope.projectId, actor: caller.actor, requestId: caller.requestId };
  try {
    const proposal = await proposeCoverageCause(
      ctx,
      {
        state,
        declarable: SCOPE_DECLARATION_CAUSES,
        // The citation resolves against the revision the campaign is pinned at, over exactly the one
        // key code found for this cell: an answer citing anything else is SOURCE_UNRESOLVED, so the
        // model cannot rest a boundary on evidence this cell was never sighted at (L-AI-02).
        artifact: sourceKeyResolver(residue.campaign.setRevisionId, [state.key]),
      },
      seam.port,
    );
    const judgment = await (seam.judgmentOf ?? LEDGER_JUDGMENT)(scope, proposal.callId);
    if (!standsAboveFloor(judgment?.confidence ?? null)) return { proposal: null };
    return { proposal: { callId: proposal.callId, cause: proposal.payload.cause } };
  } catch (failure) {
    if (refusalCodeOf(failure) === null) throw failure;
    return { proposal: null };
  }
}
