// R-TO-015's data door: the rendered campaign's published quantities, read onto one opened sheet.
//
// Server-only by what it holds — the store, the object storage and the sheet's manifest cache are all
// here, and no browser bundle reaches this file: the screen asks the viewer feed's `?part=quantities`
// and the feed asks this.
//
// WHICH campaign: the one the register renders, the project's latest (the Trace's own rule, I-173) —
// a figure on the sheet that the register's table does not show would be a figure nobody can follow.
// WHICH lines: that campaign's lines read off this drawing, less every object a person struck (they are
// withheld from the register's totals too), grouped per MEMBER — a rail line's placement, a hand
// measurement's own object — because a member is what a reader sees drawn and what the sheet paints.
//
// WHETHER a member stands on this sheet is answered as the partition overlay answers it for a view
// (I-633): its outline and its mark are looked up among the records of the opened layout, by the
// identity each record is painted under (`recordKey`), and its box is `recordBox`'s union over them. A
// member no record of this sheet names is not painted here; the resolver only NAMES the sheet it stands
// on (`sheetOfKey` over the pinned record), so the legend can say where the rest of the campaign is.
import { campaignsOf } from "@/core/campaigns";
import { isElementType } from "@/core/catalogue/classes";
import { isKind } from "@/core/catalogue/kinds";
import { and, conditions, eq, forTenant, inArray, isUuid, manualMeasurements, quantityLines, queueItems, registerObjects } from "@/core/db";
import { CONDITION_COLOURS, CONDITION_HATCHES, ringsOf, type ConditionColour, type ConditionHatch, type MeasuredGeometry } from "@/core/manual/law";
import { artifactAt } from "@/core/entitygraph/artifact";
import { projectDrawingsOf } from "@/core/sheets";
import { modelSheetOf, sheetOfKey, sheetShowing } from "@/core/sheets/frames";
import { appStorage } from "@/core/storage/app";
import { drawingProjectOf } from "@/modules/takeoff/partition/store";
import { repudiatedObjectsOf } from "@/modules/takeoff/register";
import { pinnedRecordsOf } from "@/modules/takeoff/trace";
import { renderManifestOf } from "@/modules/takeoff/viewer";
import type { RenderRecord } from "@/modules/takeoff/viewer";
import { recordBox, recordKey } from "@/modules/takeoff/viewer/client";
import { windowsOf } from "@/modules/takeoff/viewer/projection";
import { chestCondition, classCondition, figuresOf, ringsOnPaper, type PaperWindow, type PlacementLine, type PlacementQueued } from "./scene";
import type { OverlayBox, QuantityCondition, QuantityElsewhere, QuantityOverlay, QuantityPlacement } from "./types";

/** Which sheet's quantities are asked for, in whose workspace and under which project. */
export type QuantityOverlayScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly drawingId: string;
  readonly layoutName: string;
};

type Point = readonly [number, number];

/** Every record of the opened layout, by the identity it is painted under (the partition overlay's reading). */
async function recordsOf(scope: QuantityOverlayScope): Promise<Map<string, RenderRecord[]>> {
  const head = await renderManifestOf({ tenantId: scope.tenantId, projectId: scope.projectId, drawingId: scope.drawingId, layoutName: scope.layoutName }, { storage: appStorage() });
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

/**
 * The windows the opened sheet shows model space through, read off the drawing's current record by the
 * viewer's own `windowsOf` — the projection it painted the sheet by (I-620). Model space, a sheet of
 * no window and a drawing not read yet answer none.
 */
async function paperWindowsOf(scope: QuantityOverlayScope): Promise<PaperWindow[]> {
  const drawing = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => (await projectDrawingsOf(tx, scope)).find((held) => held.drawingId === scope.drawingId));
  const record = drawing?.record ?? null;
  if (record === null) return [];
  const graph = await artifactAt(scope.tenantId, record.artifactSha256, appStorage(), `the quantity overlay's windows on drawing ${scope.drawingId}`);
  const layout = graph.layouts.find((held) => held.name === scope.layoutName);
  return layout?.kind === "paper" ? windowsOf(layout) : [];
}

/** The box that holds every one of these points, or null where there are none. */
function boxOfPoints(points: readonly Point[]): OverlayBox | null {
  if (points.length === 0) return null;
  let min: [number, number] = [points[0]?.[0] ?? 0, points[0]?.[1] ?? 0];
  let max: [number, number] = [...min];
  for (const [x, y] of points) {
    min = [Math.min(min[0], x), Math.min(min[1], y)];
    max = [Math.max(max[0], x), Math.max(max[1], y)];
  }
  return { min, max };
}

/** The box that holds all of these records, measured by the viewer's own reading of a record (B-17). */
function boxOfRecords(records: readonly RenderRecord[]): OverlayBox | null {
  const corners: Point[] = [];
  for (const record of records) {
    const box = recordBox(record);
    if (box !== null) corners.push([box.min[0], box.min[1]], [box.max[0], box.max[1]]);
  }
  return boxOfPoints(corners);
}

/** An outline's own rings on this sheet: every record of it that carries three vertices or more. */
function ringsOfRecords(records: readonly RenderRecord[]): Point[][] {
  return records.filter((record) => (record.points?.length ?? 0) >= 3).map((record) => (record.points ?? []).map((point) => [point[0], point[1]] as Point));
}

/** A stored colour or hatch read back into its roster, or null where the row carries none of them. */
function colourOf(value: string | null | undefined): ConditionColour | null {
  return (CONDITION_COLOURS as readonly string[]).includes(value ?? "") ? (value as ConditionColour) : null;
}
function hatchOf(value: string | null | undefined): ConditionHatch | null {
  return (CONDITION_HATCHES as readonly string[]).includes(value ?? "") ? (value as ConditionHatch) : null;
}

/** One member being assembled: its condition, its mark, and the lines and queue items measured off it. */
type Member = {
  readonly key: string;
  readonly source: QuantityPlacement["source"];
  readonly condition: QuantityCondition;
  readonly mark: string;
  readonly lines: PlacementLine[];
  readonly queued: PlacementQueued[];
  /** The hand measurement a manual member is, where it is one. */
  readonly hand: HandRow | null;
};

/** One hand measurement as this door reads it: where it was traced, what it was traced under, and its geometry. */
type HandRow = {
  readonly objectKey: string;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly conditionName: string;
  readonly elementClass: string;
  readonly traced: unknown;
  readonly colour: string | null;
  readonly hatch: string | null;
};

/**
 * The quantities of the rendered campaign on one sheet, or null where the project has no campaign yet
 * — an absence is an answer, not a refusal, and the legend teaches rather than alarming (R-UI-050).
 */
export async function quantityOverlayOf(scope: QuantityOverlayScope): Promise<QuantityOverlay | null> {
  if (!isUuid(scope.tenantId) || !isUuid(scope.projectId) || !isUuid(scope.drawingId)) return null;
  const open = await campaignsOf({ tenantId: scope.tenantId, projectId: scope.projectId });
  const rendered = open[open.length - 1];
  if (rendered === undefined) return null;

  const { lines, queued } = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => ({
    lines: await tx
      .select({
        objectKey: quantityLines.objectKey,
        kind: quantityLines.kind,
        coverage: quantityLines.coverage,
        value: quantityLines.value,
        unit: quantityLines.unit,
        quantityBasis: quantityLines.quantityBasis,
        omitted: quantityLines.omitted,
      })
      .from(quantityLines)
      .where(
        and(
          eq(quantityLines.tenantId, scope.tenantId),
          eq(quantityLines.projectId, scope.projectId),
          eq(quantityLines.campaignId, rendered.campaignId),
          eq(quantityLines.drawingId, scope.drawingId),
        ),
      ),
    queued: await tx
      .select({ objectKey: queueItems.objectKey, kind: queueItems.kind, cause: queueItems.cause })
      .from(queueItems)
      .where(and(eq(queueItems.tenantId, scope.tenantId), eq(queueItems.campaignId, rendered.campaignId))),
  }));

  const struck = new Set((await repudiatedObjectsOf({ tenantId: scope.tenantId, projectId: scope.projectId, setRevisionId: rendered.setRevisionId })).map((row) => row.objectKey));
  const wanted = [...new Set([...lines.map((line) => line.objectKey), ...queued.map((item) => item.objectKey)])].filter((key) => !struck.has(key));
  if (wanted.length === 0) return { campaignId: rendered.campaignId, placements: [], elsewhere: [] };

  const { objects, hand } = await forTenant({ tenantId: scope.tenantId }).transaction(async (tx) => ({
    objects: await tx
      .select({ objectKey: registerObjects.objectKey, placementKey: registerObjects.placementKey, mark: registerObjects.mark, elementType: registerObjects.elementType })
      .from(registerObjects)
      .where(and(eq(registerObjects.tenantId, scope.tenantId), eq(registerObjects.setRevisionId, rendered.setRevisionId), inArray(registerObjects.objectKey, wanted))),
    hand: await tx
      .select({
        objectKey: manualMeasurements.objectKey,
        drawingId: manualMeasurements.drawingId,
        layoutName: manualMeasurements.layoutName,
        conditionName: manualMeasurements.conditionName,
        elementClass: manualMeasurements.elementClass,
        traced: manualMeasurements.traced,
        colour: conditions.colour,
        hatch: conditions.hatch,
      })
      .from(manualMeasurements)
      .leftJoin(conditions, and(eq(conditions.tenantId, manualMeasurements.tenantId), eq(conditions.conditionId, manualMeasurements.conditionId)))
      .where(and(eq(manualMeasurements.tenantId, scope.tenantId), eq(manualMeasurements.setRevisionId, rendered.setRevisionId), inArray(manualMeasurements.objectKey, wanted))),
  }));

  const [records, pinned] = await Promise.all([recordsOf(scope), pinnedRecordsOf(scope, rendered.setRevisionId, [scope.drawingId])]);
  const record = pinned.get(scope.drawingId);
  const handByObject = new Map<string, HandRow>(hand.map((row) => [row.objectKey, row]));
  // A ring traced on a paper sheet is stated in model space (I-620): the sheet's windows say whether it
  // shows here, and the ring itself which sheet shows it elsewhere (I-666). Read only where a
  // hand measurement of this drawing was stated in another space than the opened sheet's.
  const modelSheet = record === undefined ? null : modelSheetOf(record.standing.sheets);
  const windows = hand.some((row) => row.drawingId === scope.drawingId && row.layoutName !== scope.layoutName) ? await paperWindowsOf(scope) : [];

  // Every member, by the key it is painted under: a rail line's placement, a hand measurement's object.
  const members = new Map<string, Member>();
  const memberOf = new Map<string, string>();
  for (const object of objects) {
    const measured = handByObject.get(object.objectKey);
    const klass = measured?.elementClass ?? object.elementType;
    if (!isElementType(klass)) continue;
    const key = measured === undefined ? object.placementKey : object.objectKey;
    const condition =
      measured === undefined ? classCondition(klass) : chestCondition({ name: measured.conditionName, class: klass, colour: colourOf(measured.colour), hatch: hatchOf(measured.hatch) });
    if (!members.has(key)) members.set(key, { key, source: condition.source, condition, mark: object.mark, lines: [], queued: [], hand: measured ?? null });
    memberOf.set(object.objectKey, key);
  }
  for (const line of lines) {
    const key = memberOf.get(line.objectKey);
    if (key !== undefined) members.get(key)?.lines.push(line);
  }
  for (const item of queued) {
    const key = memberOf.get(item.objectKey);
    if (key !== undefined && isKind(item.kind)) members.get(key)?.queued.push({ kind: item.kind, cause: item.cause });
  }

  const placements: QuantityPlacement[] = [];
  const elsewhere = new Map<string, number>();
  for (const member of members.values()) {
    // A queue item names an object, not a drawing: a member of another drawing that only queued stands
    // on no sheet of this one, and is neither painted here nor counted elsewhere.
    if (member.lines.length === 0 && member.queued.length === 0) continue;
    const figures = figuresOf(member.lines, member.queued);

    if (member.source === "manual") {
      const measured = member.hand;
      if (measured === null || measured.drawingId !== scope.drawingId) continue;
      const geometry = measured.traced as MeasuredGeometry;
      const stated = ringsOf(geometry).map((ring) => ring.map((point) => [Number(point.x), Number(point.y)] as Point));
      const onPaper = measured.layoutName === scope.layoutName || measured.layoutName !== modelSheet ? null : ringsOnPaper(stated, windows);
      if (measured.layoutName !== scope.layoutName && onPaper === null) {
        // Filed under the sheet its ring was traced on, where its space is model and one sheet's windows hold it (I-666).
        const traced = measured.layoutName === modelSheet && record !== undefined ? sheetShowing(stated[0] ?? [], record.standing.frames) : null;
        const sheet = traced ?? measured.layoutName;
        if (sheet !== scope.layoutName) elsewhere.set(sheet, (elsewhere.get(sheet) ?? 0) + 1);
        continue;
      }
      const traced = onPaper ?? stated;
      const box = boxOfPoints(traced.flat());
      if (box === null) continue;
      placements.push({ key: member.key, source: "manual", class: member.condition.class, mark: member.mark, condition: member.condition, keys: [], box, rings: geometry.geometry === "POLYGON" ? traced : [], ...figures });
      continue;
    }

    const standing = record?.standing.members.get(member.key);
    if (standing === undefined) continue;
    const outline = records.get(standing.outlineKey) ?? [];
    const mark = records.get(standing.markKey) ?? [];
    const box = boxOfRecords(outline.length > 0 ? outline : mark);
    if (box === null) {
      // Not on this sheet: the resolver names the sheet the member's outline stands on, and nothing more.
      const sheet = record === undefined ? null : sheetOfKey(standing.outlineKey, record.standing.spaces, record.standing.sheets, record.standing.frames);
      if (sheet !== null && sheet !== scope.layoutName) elsewhere.set(sheet, (elsewhere.get(sheet) ?? 0) + 1);
      continue;
    }
    const keys = [standing.outlineKey, standing.markKey].filter((key) => records.has(key));
    placements.push({ key: member.key, source: "rail", class: member.condition.class, mark: member.mark, condition: member.condition, keys, box, rings: ringsOfRecords(outline), ...figures });
  }

  const others: QuantityElsewhere[] = [...elsewhere.entries()]
    .map(([layoutName, count]) => ({ layoutName, label: record?.labelOf(layoutName) ?? layoutName, placements: count }))
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  return { campaignId: rendered.campaignId, placements, elsewhere: others };
}

/**
 * The same overlay, for a caller that knows the workspace and the drawing but not the project — the
 * sheet feed is addressed by drawing. The project is read through the partition's own door (B-17).
 */
export async function quantityOverlayOfSheet(scope: Omit<QuantityOverlayScope, "projectId">): Promise<QuantityOverlay | null> {
  const projectId = await drawingProjectOf(scope.tenantId, scope.drawingId);
  return projectId === null ? null : quantityOverlayOf({ ...scope, projectId });
}
