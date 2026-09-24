// L-QTY-05's third channel: view membership from the layout inventory, within the campaign's pinned
// manifest.
//
// A layout's inventory is its views, and a view's membership is what stands inside it — so a class
// is sighted here when a view of a sheet of the manifest holds a member of that class. The reading
// is keyed on the VIEW rather than on the placement row, which is what makes this a third channel
// and not a second spelling of the partition's: a sheet whose views were rebuilt keeps its
// membership under the same view key, and the union of EXISTS is over what each channel saw
// (L-QTY-05).
//
// A view is stored under the partition's own key (`<class>:<anchor>`, L-CAD-06) and a placement names
// the view it was read in by L-REG-04's address (`v:<class>:<anchor>`): two spellings of one view. So
// the two are met at the view's ADDRESS, asked of `viewAddressOf` — core's one home of what a
// placement, a register row and an offer name a stored view by (B-17, ARCH-02) — and never by
// comparing the two strings, which no placement ever matched (I-549).
import { and, eq, inArray, partitionViews, placements, type TenantTx } from "../../db";
import { viewAddressOf, type AddressableView } from "../../views";
import type { Sighting } from "../law";
import { drawingIdsOf, sheetOf, type SightingScope } from "./scope";

/** The channel this reader answers for, spelled once. */
const LAYOUT = "LAYOUT" as const;

/**
 * One stored view, as far as membership reads it: the record it was cut from, and the three facts its
 * address is derived from — the partition's key, its class and the caption that anchors it (null for
 * the view no caption anchors).
 */
export type StoredView = AddressableView & {
  readonly drawingId: string;
  readonly ingestId: string;
};

/** One stored placement, as far as membership reads it: the record, the view it names, its class. */
export type StoredMember = {
  readonly ingestId: string;
  readonly viewKey: string;
  readonly class: string;
};

/** A member met in the view it was read in: the view's drawing, its identity key, and the member. */
export type ViewMembership<M extends StoredMember = StoredMember> = {
  readonly member: M;
  readonly drawingId: string;
  readonly viewKey: string;
};

/**
 * Every member the stored views of a record hold, met at the view's address (I-549): a member
 * stands in the view of its own record whose address — `viewAddressOf`'s, L-REG-04's key over the
 * view's class and caption anchor — it names. Nothing here decides how a view is addressed: a view no
 * caption anchors is addressed by the partition's own name for it, which no placement the partition
 * mints names (placements are read only in anchored views, L-CAD-07), so it holds nobody for as long
 * as that is so and meets its members the day it is not. A member whose view its record did not store
 * is in none, which is what the partition saw and nothing more.
 */
export function membershipOf<M extends StoredMember>(views: readonly StoredView[], members: readonly M[]): ViewMembership<M>[] {
  const byKey = new Map<string, { drawingId: string; viewKey: string }>();
  for (const view of views) {
    // An anchor stored empty is no source key, and the grammar refuses to derive an address from an
    // empty field (L-REG-04): no placement was minted in such a view, so a reading passes it over
    // rather than throwing on a row it could not have met anyone in.
    if (view.anchorKey === "") continue;
    const address = viewAddressOf(view);
    byKey.set(`${view.ingestId}\u0000${address}`, { drawingId: view.drawingId, viewKey: address });
  }
  const met: ViewMembership<M>[] = [];
  for (const member of members) {
    const view = byKey.get(`${member.ingestId}\u0000${member.viewKey}`);
    if (view !== undefined) met.push({ member, drawingId: view.drawingId, viewKey: view.viewKey });
  }
  return met;
}

/** Every class a view of a sheet of this manifest holds a member of, on the sheet the view stands on. */
export async function layoutSightings(tx: TenantTx, scope: SightingScope): Promise<Sighting[]> {
  const drawingIds = drawingIdsOf(scope);
  if (drawingIds.length === 0) return [];

  const [views, members] = await Promise.all([
    tx
      .select({ drawingId: partitionViews.drawingId, ingestId: partitionViews.ingestId, viewKey: partitionViews.viewKey, type: partitionViews.type, anchorKey: partitionViews.anchorKey })
      .from(partitionViews)
      .where(and(eq(partitionViews.tenantId, scope.tenantId), eq(partitionViews.projectId, scope.projectId), inArray(partitionViews.drawingId, drawingIds))),
    tx
      .selectDistinct({ ingestId: placements.ingestId, viewKey: placements.viewKey, class: placements.elementType })
      .from(placements)
      .where(and(eq(placements.tenantId, scope.tenantId), eq(placements.projectId, scope.projectId), inArray(placements.drawingId, drawingIds))),
  ]);

  // One sighting per class a view holds, whichever record of the drawing the view was cut from: the
  // reading is keyed on the view (L-QTY-05), so two records' identical views are one sighting.
  const sighted = new Map<string, Sighting>();
  for (const held of membershipOf(views, members)) {
    const at = `${held.member.class}\u0000${held.drawingId}\u0000${held.viewKey}`;
    if (sighted.has(at)) continue;
    sighted.set(at, {
      class: held.member.class,
      levelId: null,
      channel: LAYOUT,
      drawingId: held.drawingId,
      layoutName: sheetOf(scope, held.drawingId, held.viewKey),
      sourceKey: held.viewKey,
    });
  }
  return [...sighted.values()];
}
