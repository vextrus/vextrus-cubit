// L-CAD-06's partitioning: which view each model-space original entity belongs to. "Every model-space
// original entity belongs to exactly one view" — so this is total over model space, and the entity no
// caption reaches belongs to the one view that has no caption rather than to none.
//
// Pure over the artifact: no store, no clock, no model. The same artifact partitions the same way
// forever, which is what makes the stored partition rebuildable and its keys re-derivable (L-REG-04).
//
// Paper layouts are not partitioned and derived paint is not assigned: L-CAD-06 partitions MODEL
// space, and L-CAD-03 makes an original entity the only atom a source key names — exploded paint is
// carried by the entity it came out of, which is assigned in its own right.
import type { EntityGraph } from "@/core/entitygraph/schema";
import { classifyCaption } from "./grammar";
import { VIEW_TYPE, type ViewType } from "./law";

/** One view of the partition: its content-derived key, what it is, and the caption that anchors it. */
export type PartitionedView = {
  readonly viewKey: string;
  readonly type: ViewType;
  readonly reason: string | null;
  readonly caption: string;
  readonly anchorKey: string | null;
};

/** A partition of one artifact's model space: the views, and which view each entity landed in. */
export type ViewPartition = {
  readonly views: readonly PartitionedView[];
  /** Entity source key → view key, one entry per model-space original entity. */
  readonly assignments: ReadonlyMap<string, string>;
};

/**
 * How tall a text has to stand, as a share of the tallest text in model space, to be read as a
 * caption rather than as a label inside a view. The share is fixed rather than resolved from the
 * drawing's own conventions, which is L-CAD-08's own question: what separates a title from a bar
 * mark here is the rule a draughtsman draws by — a caption is the big text on the sheet.
 *
 * The share stands near one rather than near a half because a sheet titles its views at ONE size:
 * the biggest text on the sheet is the title, and a text drawn materially smaller is a label inside
 * a view however large it looks beside the bar marks. A grid bubble three quarters the height of the
 * title is an ordinary way to draw a plan, and reading each bubble as the caption of its own view
 * would cut a plan into as many views as it has gridlines and leave the plan itself with nothing in
 * it (L-CAD-06: every model-space entity belongs to exactly one view — the right one).
 */
const CAPTION_HEIGHT_SHARE = 0.8;

/**
 * How far a caption reaches, in multiples of its own text height. A caption is drawn at the scale of
 * the view it titles, so its height is the drawing's own statement of how large that view is — which
 * makes the reach scale-free where a fixed distance in drawing units would not be. Geometry standing
 * outside every caption's reach belongs to no view, and that is what the anchorless view is for.
 */
const CAPTION_REACH_IN_HEIGHTS = 30;

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/** One caption, resolved: the view it anchors, where it stands, and how far it reaches. */
type Anchor = { readonly viewKey: string; readonly at: Point; readonly reach: number };

/** An entity as this partitioning reads one — the artifact's own shape, narrowed to what it needs. */
type Drawn = EntityGraph["entities"][number];

/**
 * Cut one artifact's model space into views (L-CAD-06). Each caption anchors a view of the class its
 * own text says it is; every other entity joins the view whose caption stands nearest to it, within
 * that caption's reach; and whatever no caption reaches joins the one view that has no caption.
 */
export function partitionArtifact(graph: EntityGraph): ViewPartition {
  const modelSpace = graph.layouts.find((layout) => layout.kind === "model")?.name;
  if (modelSpace === undefined) return { views: [], assignments: new Map() };

  const standing = graph.entities.filter((entity) => entity.space === modelSpace);
  const captions = captionsAmong(standing);

  const views = new Map<string, PartitionedView>();
  const anchors: Anchor[] = [];
  for (const caption of captions) {
    const said = classifyCaption(caption.text ?? "");
    const viewKey = `${said.type}:${caption.key}`;
    views.set(viewKey, { viewKey, type: said.type, reason: said.reason, caption: (caption.text ?? "").trim(), anchorKey: caption.key });
    anchors.push({ viewKey, at: pointsOf(caption)[0] as Point, reach: (caption.height ?? 0) * CAPTION_REACH_IN_HEIGHTS });
  }

  const assignments = new Map<string, string>();
  let anchorless = false;
  for (const entity of standing) {
    const nearest = nearestAnchor(entity, anchors);
    if (nearest === null) anchorless = true;
    assignments.set(entity.key, nearest ?? VIEW_TYPE.UNASSIGNED);
  }

  // The anchorless view exists only where something is really in it: a partition of a drawing whose
  // every entity a caption reaches holds no view nobody could name.
  if (anchorless) {
    views.set(VIEW_TYPE.UNASSIGNED, { viewKey: VIEW_TYPE.UNASSIGNED, type: VIEW_TYPE.UNASSIGNED, reason: null, caption: "", anchorKey: null });
  }

  return {
    views: [...views.values()].sort((left, right) => (left.viewKey < right.viewKey ? -1 : left.viewKey > right.viewKey ? 1 : 0)),
    assignments,
  };
}

/**
 * The texts standing tall enough to be captions, in artifact order. A text the extractor gave no
 * height or no position to anchors nothing: it cannot say how far its view reaches or where it is.
 */
function captionsAmong(standing: readonly Drawn[]): Drawn[] {
  const texts = standing.filter((entity) => (entity.text ?? "").trim() !== "" && (entity.height ?? 0) > 0 && pointsOf(entity).length > 0);
  const tallest = texts.reduce((held, entity) => Math.max(held, entity.height ?? 0), 0);
  return tallest === 0 ? [] : texts.filter((entity) => (entity.height ?? 0) >= tallest * CAPTION_HEIGHT_SHARE);
}

/**
 * The view whose caption stands nearest this entity, or null where none reaches it. Ties go to the
 * lower view key so that two captions equidistant from one entity partition the same way every time
 * (L-REG-04: an identical re-derivation reproduces the identical key multiset).
 */
function nearestAnchor(entity: Drawn, anchors: readonly Anchor[]): string | null {
  const at = centreOf(entity);
  if (at === null) return null;
  let held: { viewKey: string; distance: number } | null = null;
  for (const anchor of anchors) {
    const distance = distanceBetween(at, anchor.at);
    if (distance > anchor.reach) continue;
    if (held === null || distance < held.distance || (distance === held.distance && anchor.viewKey < held.viewKey)) {
      held = { viewKey: anchor.viewKey, distance };
    }
  }
  return held?.viewKey ?? null;
}

/** Where an entity stands: the mean of the points it is drawn from, or null where it has none. */
function centreOf(entity: Drawn): Point | null {
  const points = pointsOf(entity);
  if (points.length === 0) return null;
  const summed = points.reduce<[number, number]>((held, point) => [held[0] + point[0], held[1] + point[1]], [0, 0]);
  return [summed[0] / points.length, summed[1] / points.length];
}

function pointsOf(entity: Drawn): readonly Point[] {
  return entity.points ?? [];
}

function distanceBetween(left: Point, right: Point): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
