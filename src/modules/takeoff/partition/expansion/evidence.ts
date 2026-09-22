/**
 * What the expansion resolver is handed for one drawing, read back off the store — the ONE assembly
 * of it, for every reader that re-resolves a stored partition (L-CAD-07, L-REG-04, B-17).
 *
 * Two readers ask: the re-expansion (`./reexpand`), which registers what the resolver answers after
 * an act moves one of its inputs, and the typical-range reading (`./range-reading`), which answers
 * `AUTHOR_TYPICAL_RANGE` with the rows the resolver derives under the range a person proposes. Until
 * the second existed it was the act itself, reading the placements raw and re-doing the band cut,
 * and the two readers answered different rows for one drawing (C5 and C7 on F-RCC6-BNBC). One
 * assembly means a column added to the evidence is added once, and neither reader can part from the
 * other.
 *
 * Read on the caller's transaction: the re-expansion opens one of its own, and the reading is asked
 * inside the act's, so the Consequence a person is shown is computed from the state its write lands
 * in (L-ACT-02).
 */
import type { TenantTx } from "@/core/db";
import { viewKey as viewKeyOf, type ViewRef } from "@/core/identity";
import { viewRecordsOf } from "@/core/views";
import { ingestRecordIn, type IngestRecord } from "@/modules/takeoff/ingest";
import type { PlacementRow } from "../placement/rows";
import { placementRowOf, storedPlacementsIn } from "../placement/store";
import { storedMemberTypesIn } from "../schedules/store";
import { partitionStandsIn } from "../store";
import type { ExpandedView, ExpansionEvidence, FamilyBands } from "./resolve";
import { authoredRangesIn, liveStackIn } from "./store";

/** Which drawing's stored partition is read, in whose workspace and under which project. */
export type EvidenceScope = { readonly tenantId: string; readonly projectId: string; readonly drawingId: string };

/** One drawing's evidence: the current record it was read from, and what the resolver is handed. */
export type DrawingEvidence = { readonly record: IngestRecord; readonly evidence: ExpansionEvidence };

/**
 * The resolver's evidence for one drawing's CURRENT record, or null where the drawing has no record or
 * no stored partition — a drawing waiting on its first partition is not an error anybody can act on.
 * The ranges are every range authored in the project; a caller that asks a counterfactual (a range
 * proposed and not yet authored) replaces them itself.
 */
export async function expansionEvidenceIn(tx: TenantTx, scope: EvidenceScope): Promise<DrawingEvidence | null> {
  const record = await ingestRecordIn(tx, { tenantId: scope.tenantId, drawingId: scope.drawingId });
  if (record === null) return null;
  if (!(await partitionStandsIn(tx, scope.tenantId, record.ingestId))) return null;
  const ingestId = record.ingestId;

  const views = await viewRecordsOf(tx, { tenantId: scope.tenantId, ingestId });
  // Two spellings of one view's key meet here: the partition store's `TYPE:anchor` on the view row,
  // and L-REG-04's identity key `v:TYPE:anchor` on every placement row (the job keys a placement by
  // `viewKey(ref)`). The map is keyed by the placement's spelling, which is what has to be found.
  const refs = new Map<string, ViewRef>();
  const expanded: ExpandedView[] = [];
  for (const view of views) {
    if (view.anchorKey === null) continue;
    const ref: ViewRef = { viewClass: view.type, captionAnchorSourceKey: view.anchorKey };
    refs.set(viewKeyOf(ref), ref);
    expanded.push({ caption: view.caption, view: ref });
  }

  const placements: PlacementRow[] = [];
  for (const stored of await storedPlacementsIn(tx, scope.tenantId, ingestId)) {
    const ref = refs.get(stored.viewKey);
    // A placement is read in a layout-plan view with an anchor (L-CAD-06); one whose view the store
    // no longer names is not a placement the resolver can key a row off, and is left as it stands.
    if (ref === undefined) continue;
    // The conversion is the STORE's one published reading (`placementRowOf`) and never a literal
    // spelled here: this reader and the partition job's own stage resolve the same rows, and a
    // column one of them carried and the other forgot is a member standing on a different set of
    // storeys depending on which ran last (L-REG-04, B-17).
    placements.push(placementRowOf(stored, ref));
  }

  const families: FamilyBands[] = (await storedMemberTypesIn(tx, scope.tenantId, ingestId)).families.map((family) => ({
    family: family.family,
    bands: family.variants.map((variant) => ({ from: variant.bandFrom, to: variant.bandTo })),
  }));

  return {
    record,
    evidence: {
      placements,
      views: expanded,
      levels: await liveStackIn(tx, scope.tenantId, scope.projectId),
      ranges: await authoredRangesIn(tx, scope.tenantId, scope.projectId),
      families,
    },
  };
}
