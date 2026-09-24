// The rooms stage's store: the rooms one ingest record's architect's plans enclose (s-takeoff
// I-643…d), written with the placements their surfaces stand as and read back by the overlay.
//
// Rewritten inside the partition's ONE transaction (`../store`), cleared first, so a rebuild that now
// reads fewer rooms leaves exactly what it derived and nothing of what it replaced (L-REG-04). Every row
// is keyed by its content-derived room key, so a re-derivation of the same artifact writes the same rows.
import { and, asc, eq, forTenant, roomOutlines, type TenantTx } from "@/core/db";
import { projectRulesetView } from "@/core/rulesets/editions";
import { convert } from "@/core/units/canon";
import type { DetectedRooms, OutlineBand } from "./detect";

/** The two parameters of the pinned edition a room's outline is judged against (L-MEA-01). */
const BAND_PARAMETERS = Object.freeze({ min: "finishMinOutlineArea", max: "finishMaxOutlineArea" });

/** The unit the band is carried into before a room's area is set against it. */
const SQUARE_METRE = "m2";

/**
 * The finish outline band one project's pin states, in square metres — or null where the project is
 * pinned to no edition, or its edition states neither end of the band in a unit of area. "Out-of-band
 * outlines dropped listed, never silently" (L-MEA-01): by the edition's numbers and by no others.
 */
export async function roomBandOf(scope: { readonly tenantId: string; readonly projectId: string }): Promise<OutlineBand | null> {
  const view = await projectRulesetView(scope);
  if (!view.pinned) return null;
  const read: Partial<Record<keyof OutlineBand, string>> = {};
  for (const end of ["min", "max"] as const) {
    const stated = view.parameters[BAND_PARAMETERS[end]];
    if (stated === undefined) return null;
    const carried = convert(stated.value, stated.unit, SQUARE_METRE);
    if (!carried.ok) return null;
    read[end] = carried.value;
  }
  return read.min === undefined || read.max === undefined ? null : { min: read.min, max: read.max };
}

/** One stored room, whole — every column the store holds, as it holds it. */
export type StoredRoom = typeof roomOutlines.$inferSelect;

/** One record's rooms, as a rebuild hands them over to be written. */
export type RoomWrite = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  /** What the rooms stage read, or null where the stage list ran no such stage. */
  readonly rooms: DetectedRooms | null;
};

/** Rewrite one record's rooms inside the partition's transaction. */
export async function rewriteRoomRows(tx: TenantTx, write: RoomWrite): Promise<void> {
  await tx.delete(roomOutlines).where(and(eq(roomOutlines.tenantId, write.tenantId), eq(roomOutlines.ingestId, write.ingestId)));
  const rooms = write.rooms?.rooms ?? [];
  if (rooms.length === 0) return;
  const stamp = { tenantId: write.tenantId, projectId: write.projectId, drawingId: write.drawingId, ingestId: write.ingestId };
  // Two regions of one outline are one room: the key is its content, and the first reading stands.
  const seen = new Set<string>();
  const rows = rooms.filter((room) => (seen.has(room.roomKey) ? false : (seen.add(room.roomKey), true)));
  await tx.insert(roomOutlines).values(
    rows.map((room) => ({
      ...stamp,
      roomKey: room.roomKey,
      viewKey: room.viewKey,
      layoutName: room.sheet,
      status: room.status,
      reason: room.reason,
      name: room.name,
      labels: room.labels.map((label) => ({ ...label })),
      outline: room.outline === null ? null : { outer: room.outline.outer.map((point) => [point[0], point[1]] as const), holes: room.outline.holes.map((hole) => hole.map((point) => [point[0], point[1]] as const)) },
      areaM2: room.areaM2,
      anchorX: room.anchor[0],
      anchorY: room.anchor[1],
      faces: room.faces.map((face) => ({ ...face })),
      sourceKeys: [...room.sourceKeys],
    })),
  );
}

/** The rooms one record stands under, in the key's own order so two reads answer one list (L-REG-05). */
export async function storedRoomsOf(tenantId: string, ingestId: string): Promise<StoredRoom[]> {
  return forTenant({ tenantId })
    .select()
    .from(roomOutlines)
    .where(and(eq(roomOutlines.tenantId, tenantId), eq(roomOutlines.ingestId, ingestId)))
    .orderBy(asc(roomOutlines.roomKey));
}
