// R-TO-014's data door: the stored partition of one drawing, read onto one opened sheet.
//
// Server-only by what it holds rather than by a promise — the store, the object storage and the
// sheet's manifest cache are all here, and no browser bundle reaches this file: the screen asks the
// viewer feed's `?part=partition` and the feed asks this.
//
// Nothing is re-derived that the store already holds (B-19, B-17): the views come from the
// partition's own door in its own order, the axes and deferrals from the grid's, and the two facts a
// SHEET adds — how many assignments name a view, and the box its members stand in — are measured
// with the viewer's own `recordBox` over the manifest the sheet is drawn from. A derived record is
// paint of its parent and joins that parent's view, which is exactly what `recordKey` answers
// (L-CAD-03, I-86).
import { and, eq, forTenant, viewAssignments } from "@/core/db";
import { appStorage } from "@/core/storage/app";
import { gridOf, viewsOf } from "@/modules/takeoff/partition";
import { drawingProjectOf } from "@/modules/takeoff/partition/store";
import { renderManifestOf } from "@/modules/takeoff/viewer";
import { recordBox, recordKey } from "@/modules/takeoff/viewer/client";
import type { RenderRecord } from "@/modules/takeoff/viewer";
import type { OverlayBox, OverlayRing, PartitionOverlay, PartitionOverlayAxis, PartitionOverlayView } from "./types";

/** Which drawing's overlay is being asked for, in whose workspace, under which project and sheet. */
export type PartitionOverlayScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly layoutName: string;
};

/** Every entity key one record assigned to a view, by the view it landed in (L-CAD-06). */
async function assignmentsOf(tenantId: string, ingestId: string): Promise<Map<string, string[]>> {
  const rows = await forTenant({ tenantId })
    .select({ entityKey: viewAssignments.entityKey, viewKey: viewAssignments.viewKey })
    .from(viewAssignments)
    .where(and(eq(viewAssignments.tenantId, tenantId), eq(viewAssignments.ingestId, ingestId)));

  // The bucket is grown in place, never rebuilt: `view_assignments` holds one row per model-space
  // entity (L-CAD-06), so copying the accumulated array per row would make grouping one layout plan's
  // members quadratic in them — the cost the sheet's own budget refuses to pay per feed read (PB-3).
  const byView = new Map<string, string[]>();
  for (const row of rows) {
    const held = byView.get(row.viewKey);
    if (held === undefined) byView.set(row.viewKey, [row.entityKey]);
    else held.push(row.entityKey);
  }
  return byView;
}

/**
 * Every record of the opened layout, by the identity it is painted under. A view that stands on no
 * part of this sheet finds none of its members here, which is what leaves its box null — the fact
 * the panel says as "not on this sheet" rather than hiding the row (R-UI-050's partial).
 */
async function recordsOf(scope: PartitionOverlayScope): Promise<Map<string, RenderRecord[]>> {
  const head = await renderManifestOf({ tenantId: scope.tenantId, drawingId: scope.drawingId, layoutName: scope.layoutName }, { storage: appStorage() });
  const byIdentity = new Map<string, RenderRecord[]>();
  if (head.kind !== "manifest") return byIdentity;
  for (const layer of head.manifest.layers) {
    for (const record of layer.records) {
      const identity = recordKey(record);
      if (identity === undefined) continue;
      const held = byIdentity.get(identity);
      if (held === undefined) byIdentity.set(identity, [record]);
      else held.push(record);
    }
  }
  return byIdentity;
}

/** The box that holds all of these, measured by the viewer's own reading of a record (B-17). */
function unionOf(records: readonly RenderRecord[]): OverlayBox | null {
  let held: { min: [number, number]; max: [number, number] } | null = null;
  for (const record of records) {
    const box = recordBox(record);
    if (box === null) continue;
    held =
      held === null
        ? { min: [box.min[0], box.min[1]], max: [box.max[0], box.max[1]] }
        : {
            min: [Math.min(held.min[0], box.min[0]), Math.min(held.min[1], box.min[1])],
            max: [Math.max(held.max[0], box.max[0]), Math.max(held.max[1], box.max[1])],
          };
  }
  return held;
}

/**
 * Where a ring stands and how far across it is, read off the ring's OWN vertices — never off the
 * label inside it, and never off the axis position it georeferenced (L-CAD-07: the bubble is the
 * evidence). A bubble whose ring is not on this sheet is no bubble; the axis still stands.
 */
function ringGeometry(records: readonly RenderRecord[]): OverlayRing | null {
  const points = records.flatMap((record) => record.points ?? []);
  if (points.length === 0) return null;
  const centre: [number, number] = [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
  const radius = points.reduce((sum, point) => sum + Math.hypot(point[0] - centre[0], point[1] - centre[1]), 0) / points.length;
  return { centre, radius };
}

/**
 * The overlay of one drawing on one sheet, or null where nothing has partitioned it yet.
 *
 * The absence is an answer rather than a refusal: a drawing waiting on its first partition is not an
 * error anybody can act on, and the panel teaches instead of alarming (R-UI-050). Requesting the
 * rebuild is S-Drawings' door and stays there.
 */
export async function partitionOverlayOf(scope: PartitionOverlayScope): Promise<PartitionOverlay | null> {
  const views = { tenantId: scope.tenantId, projectId: scope.projectId, drawingId: scope.drawingId };
  const grid = await gridOf(views);
  if (grid === null) return null;

  const stored = await viewsOf(views);
  // A record no partition has been rebuilt over holds no view, no axis and no deferral. A partition
  // that HAS been rebuilt holds at least one of the three, whatever it read.
  if (stored.length === 0 && grid.axes.length === 0 && grid.deferrals.length === 0) return null;

  const [assignments, records] = await Promise.all([assignmentsOf(scope.tenantId, grid.ingestId), recordsOf(scope)]);

  const overlayViews: PartitionOverlayView[] = stored.map((view) => {
    const members = assignments.get(view.viewKey) ?? [];
    return {
      viewKey: view.viewKey,
      type: view.type,
      reason: view.reason,
      caption: view.caption,
      anchorKey: view.anchorKey,
      proposed: view.proposed,
      confirmed: view.confirmed,
      entityCount: members.length,
      box: unionOf(members.flatMap((key) => records.get(key) ?? [])),
    };
  });

  const overlayAxes: PartitionOverlayAxis[] = grid.axes.map((axis) => ({ ...axis, bubble: ringGeometry(records.get(axis.bubbleKey) ?? []) }));

  return { ingestId: grid.ingestId, views: overlayViews, axes: overlayAxes, deferrals: grid.deferrals };
}

/**
 * The same overlay, for a caller that knows the workspace and the drawing but not the project — the
 * sheet feed is addressed by drawing, because a sheet is one drawing's (R-UI-040's address).
 *
 * The project is read through the partition's own door rather than derived a second time here
 * (B-17): a drawing belongs to one project, and one file answers which.
 */
export async function partitionOverlayOfSheet(scope: Omit<PartitionOverlayScope, "projectId">): Promise<PartitionOverlay | null> {
  const projectId = await drawingProjectOf(scope.tenantId, scope.drawingId);
  return projectId === null ? null : partitionOverlayOf({ ...scope, projectId });
}
