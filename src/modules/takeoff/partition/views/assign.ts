// L-CAD-06's partitioning: which view each model-space original entity belongs to. "Every model-space
// original entity belongs to exactly one view" — so this is total over model space, and the entity no
// caption reaches belongs to the one view that has no caption rather than to none.
//
// Pure over the artifact: no store, no clock, no model. The same artifact partitions the same way
// forever, which is what makes the stored partition rebuildable and its keys re-derivable (L-REG-04).
//
// Paper layouts are not partitioned and derived paint is not assigned: L-CAD-06 partitions MODEL
// space, and L-CAD-03 makes an original entity the only atom a source key names — exploded paint is
// carried by the entity it came out of, which is assigned in its own right. A paper layout is READ,
// though: its windows frame pieces of model space and its titles caption them, which is the regions
// reading beside this file (`./regions`, L-CAD-05).
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { Box } from "../../viewer/projection";
import { classifyCaption } from "./grammar";
import { VIEW_TYPE, type ViewType } from "./law";
import { regionAt, regionsOf, type RegionCaption } from "./regions";

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
  /**
   * How many of those views a paper sheet's own window framed (L-CAD-05), as against the views the
   * caption competition read out of model space alone. Reported by the stage so a reader of a
   * rebuild can see which reading the drawing was partitioned by (R-TO-030).
   */
  readonly framed: number;
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
 * How far a caption reaches AT LEAST, in multiples of its own text height. A caption is drawn at the
 * scale of the view it titles, so its height is the drawing's own statement of how large that view
 * is — which makes the floor scale-free where a fixed distance in drawing units would not be.
 */
const CAPTION_REACH_IN_HEIGHTS = 30;

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/** One caption, resolved: the view it anchors, where it stands, and how far it reaches. */
type Anchor = { readonly viewKey: string; readonly at: Point; readonly reach: number };

/** An entity as this partitioning reads one — the artifact's own shape, narrowed to what it needs. */
type Drawn = EntityGraph["entities"][number];

/**
 * Cut one artifact's model space into views (L-CAD-06).
 *
 * Two readings, in this order. First the FRAMES: every window a paper layout opens onto model space
 * is a region captioned by the sheet that opens it, and an entity standing inside a region belongs
 * to that region's view (`./regions`, L-CAD-05). Then, for whatever no frame shows, the reading this
 * module has always made: each remaining caption anchors a view of the class its own text says it
 * is, every other entity joins the view whose caption stands nearest to it within that caption's
 * reach, and whatever no caption reaches joins the one view that has no caption.
 *
 * A drawing with no viewports frames no region, so the whole of it is the second reading: the same
 * captions mint the same views under the same keys, and every entity drawn from points of its own
 * lands in the view it has always landed in (AM-01). What moved is the original the extractor gave
 * NO points — a block instance, a dimension — which competes for a caption from the centre of its
 * paint's box now rather than from nowhere at all, so F-RCC6's 29 pointless dimensions stand in the
 * plans they were drawn in rather than in the view no caption anchors. A byte-frozen fixture's
 * partition is what the law derives from it, and one place for where a thing stands is the law
 * (L-CAD-03, L-CAD-06).
 */
export function partitionArtifact(graph: EntityGraph): ViewPartition {
  const modelSpace = graph.layouts.find((layout) => layout.kind === "model")?.name;
  if (modelSpace === undefined) return { views: [], assignments: new Map(), framed: 0 };

  const standing = graph.entities.filter((entity) => entity.space === modelSpace);
  // A caption stands where it is DRAWN, judged by the same reading every other entity is judged by
  // — its centroid. Anchoring it at its first point instead puts the view metres from where the
  // words actually stand the moment the extractor gives a caption more than one point (a two-line
  // title, a justified string given both its ends), and geometry nearer that caption than any
  // other is then handed to a neighbouring view. One rule for where a thing stands (L-CAD-06).
  const captions: RegionCaption[] = captionsAmong(standing).map((caption) => {
    const said = classifyCaption(caption.text ?? "");
    return { key: caption.key, text: (caption.text ?? "").trim(), height: caption.height ?? 0, at: centreOf(caption) ?? ORIGIN, type: said.type, reason: said.reason };
  });
  const regions = regionsOf(graph, captions);

  const views = new Map<string, PartitionedView>();
  for (const region of regions) {
    views.set(region.viewKey, { viewKey: region.viewKey, type: region.type, reason: region.reason, caption: region.caption, anchorKey: region.anchorKey });
  }
  const framed = views.size;

  // A caption a region frames is that region's — its anchor where it typed it, its content where it
  // did not — and competes for nothing outside the frame that shows it. Its REACH is still read over
  // the whole model space exactly as before, because how far a caption carries is a fact about how
  // the drawing spaces its titles and not about which of them a window happened to claim.
  const residue = captions.filter((caption) => regionAt(caption.at, regions) === null);
  for (const caption of residue) {
    views.set(`${caption.type}:${caption.key}`, { viewKey: `${caption.type}:${caption.key}`, type: caption.type, reason: caption.reason, caption: caption.text, anchorKey: caption.key });
  }
  const anchors: Anchor[] = residue.map((caption) => ({ viewKey: `${caption.type}:${caption.key}`, at: caption.at, reach: reachOf(caption, captions) }));

  const painted = paintBoxes(graph, modelSpace);
  const assignments = new Map<string, string>();
  let anchorless = false;
  for (const entity of standing) {
    const at = standsAt(entity, painted);
    const region = regionAt(at, regions);
    if (region !== null) {
      assignments.set(entity.key, region.viewKey);
      continue;
    }
    const nearest = nearestAnchor(at, anchors);
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
    framed,
  };
}

/** Where a caption with no point at all would stand — unreachable: `captionsAmong` demands points. */
const ORIGIN: Point = [0, 0];

/**
 * Where an entity stands, for every question this file asks about where it is: the mean of its own
 * points, or — where the extractor gave it none, as it does for an INSERT, a DIMENSION and a LEADER
 * — the centre of the box its derived paint occupies.
 *
 * The paint's EXTENT, never the mean of its vertices: an INSERT that paints one flattened circle of
 * 608 points beside one line of two would otherwise stand wherever the circle is, and L-CAD-02's
 * flattening cap makes that vertex count an artefact of a tolerance rather than a fact about the
 * drawing. A box has no such opinion.
 *
 * Paint is what is drawn, and it is drawn where the original that emitted it is (L-CAD-03: the paint
 * carries `src`, the original it came out of). So the frame test and the caption competition below
 * both read an entity HERE: a block-drawn grid bubble stands in the plan its ring was drawn in
 * whether that plan is framed by a window or captioned in model space, and an entity read at two
 * places could belong to two views (L-CAD-06: exactly one view — the right one).
 *
 * An original with no points and no paint stands nowhere: nothing in the artifact says where it was
 * drawn, no frame can be said to show it, no caption can be said to reach it, and it is honestly
 * unassigned.
 */
function standsAt(entity: Drawn, painted: ReadonlyMap<string, Box>): Point | null {
  const own = centreOf(entity);
  if (own !== null) return own;
  const box = painted.get(entity.key);
  return box === undefined ? null : [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

/** The box each model-space original's derived paint occupies, by the key that paint names as `src`. */
function paintBoxes(graph: EntityGraph, modelSpace: string): Map<string, Box> {
  const boxes = new Map<string, Box>();
  for (const paint of graph.derived) {
    if (paint.space !== modelSpace) continue;
    let box = boxes.get(paint.src);
    for (const [x, y] of paint.points ?? []) {
      box = box === undefined ? [x, y, x, y] : [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
    }
    if (box !== undefined) boxes.set(paint.src, box);
  }
  return boxes;
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
 * How far one caption reaches: as far as the nearest OTHER caption on the sheet stands from it, and
 * never less than its own text height's floor.
 *
 * A sheet lays its views out side by side and titles each of them, so the distance between two
 * titles is the drawing's own statement of how much room a view was given — a plan is drawn several
 * times its title's height tall, and a fixed multiple of that height cuts the far half of an
 * ordinary plan off its own view. Geometry farther from every caption than the captions stand from
 * each other is beyond any view the sheet lays out, and that is what the anchorless view is for
 * (L-CAD-06: every model-space entity belongs to exactly one view — the right one).
 */
function reachOf(caption: { readonly at: Point; readonly height: number }, captions: readonly { readonly at: Point; readonly height: number }[]): number {
  const floor = caption.height * CAPTION_REACH_IN_HEIGHTS;
  const neighbours = captions.filter((other) => other !== caption).map((other) => distanceBetween(caption.at, other.at));
  return neighbours.length === 0 ? floor : Math.max(floor, Math.min(...neighbours));
}

/**
 * The view whose caption stands nearest the place an entity stands, or null where no caption reaches
 * it — or where it stands nowhere at all. Ties go to the lower view key so that two captions
 * equidistant from one entity partition the same way every time (L-REG-04: an identical
 * re-derivation reproduces the identical key multiset).
 */
function nearestAnchor(at: Point | null, anchors: readonly Anchor[]): string | null {
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
