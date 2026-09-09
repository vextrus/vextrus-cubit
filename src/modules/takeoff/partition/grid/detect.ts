// L-CAD-07's grid backbone: the letter and numeral axes a drawing georeferences its layout plans by,
// read off the drawing itself.
//
// The rule is a CONTENT signature and nothing else — "a bare letter/numeral inside a circle, never
// layer names". A bubble is a round closed ring enclosing exactly one text whose normalised form is a
// bare label; a ring holding two texts, a ring holding a paired mark, a label standing inside no ring
// and a ring that is not round are none of them evidence. What a thing is drawn on and what DXF type
// it arrived as decide nothing here: the profile's roles decide only which entities are LOOKED at
// (L-CAD-08 resolves those roles from geometry statistics, never from a name), and the signature
// decides everything after that.
//
// Only layout-plan-class views are read, through the view law's own predicate (L-CAD-06: "only
// layout-plan-class views may yield instances"). A layout plan the drawing offered no lawful evidence
// for georeferences as DEFERRED under the register's code — never as a grid guessed off gridlines and
// loose letters (L-QTY-04).
//
// Pure over the artifact and the stages before it: no store, no clock, no model. The same artifact
// detects the same grid forever, which is what makes the stored partition rebuildable (L-REG-04).
import type { GridAxis, GridDeferralReason, GridFamily } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { REFUSALS } from "@/core/errors";
import { CONVENTION_ROLES, type ConventionProfile } from "@/core/rulesets/methods/conventions/resolve";
import type { PartitionedView } from "../views/assign";
import { yieldsInstances } from "../views/law";
import { gridFamilyOf, normaliseGridLabel } from "./law";

/** One georeferenced bubble, as the store holds one and as the overlay and placement read one. */
export type GridAxisRow = {
  readonly viewKey: string;
  readonly family: GridFamily;
  readonly label: string;
  readonly axis: GridAxis;
  readonly position: number;
  /** The ring the bubble was read from, and the text inside it (L-CAD-03: a reading names its atoms). */
  readonly bubbleKey: string;
  readonly labelKey: string;
  /** The whole view's minimum grid spacing — what placement scales its shares by (L-MEA-01). */
  readonly minSpacing: number;
};

/** A layout plan that georeferenced as deferred, and the closed reason it did (L-CAD-07). */
export type GridDeferralRow = {
  readonly viewKey: string;
  readonly reason: GridDeferralReason;
};

/** What one artifact's grid stage read: how many layout plans it examined, and what it found in them. */
export type DetectedGrid = {
  readonly views: number;
  readonly axes: readonly GridAxisRow[];
  readonly deferrals: readonly GridDeferralRow[];
};

/** What the stage is handed: the artifact, and what the stages before it derived from it. */
export type GridEvidence = {
  readonly graph: EntityGraph;
  readonly views: readonly PartitionedView[];
  /** Entity source key → view key, as the views stage assigned them (L-CAD-06). */
  readonly assignments: ReadonlyMap<string, string>;
  /** What the conventions stage resolved, or null where no such stage ran (L-CAD-08). */
  readonly profile: ConventionProfile | null;
};

/** The two world axes, named as members of the seam's closed roster — see ./law on why by name. */
const AXIS_X = "x" satisfies GridAxis;
const AXIS_Y = "y" satisfies GridAxis;

/**
 * How far two vertices of one ring may disagree about their distance from its centre, as a share of
 * that distance. A circle crosses the seam flattened into a polygon (L-CAD-02), so its vertices are
 * a cosine apart from exact; a ring drawn as a real rectangle is nowhere near this.
 *
 * The margin is a part in a thousand because a flattened ring is compared against the centroid of
 * its own vertices rather than against the centre it was drawn about: the flattening spaces those
 * vertices to a sagitta tolerance rather than evenly, and the closing vertex is dropped on the way
 * across (L-CAD-02), so the centroid sits slightly off centre and the radii spread by about a part
 * in ten thousand on the corpus this reads. A rectangle's vertices disagree by a sixth — two orders
 * of magnitude clear of this — so the signature still tells a bubble from a box.
 */
const ROUNDNESS_TOLERANCE = 1e-3;

/** How many vertices a ring must carry before equidistance means anything — see `roundnessOf`. */
const FEWEST_ROUND_VERTICES = 5;

/** A point in the drawing's own plane. */
type Point = readonly [number, number];

/** An entity as this detection reads one — the artifact's own shape, narrowed to what it needs. */
type Drawn = EntityGraph["entities"][number];

/** One lawful bubble, before its family has been georeferenced against the rest of its view. */
type Bubble = {
  readonly bubbleKey: string;
  readonly labelKey: string;
  readonly label: string;
  readonly family: GridFamily;
  readonly centre: Point;
};

/**
 * The grid of one artifact (L-CAD-07). Every layout-plan view is examined; each one either yields the
 * rows its bubbles georeference to, or one deferral saying it offered no evidence. A view yields rows
 * or a deferral, never both and never neither.
 */
export function detectGrid(evidence: GridEvidence): DetectedGrid {
  const standing = candidatesOf(evidence);

  const axes: GridAxisRow[] = [];
  const deferrals: GridDeferralRow[] = [];
  let examined = 0;

  for (const view of evidence.views) {
    if (!yieldsInstances(view.type)) continue;
    examined += 1;
    const read = georeference(bubblesAmong(standing.get(view.viewKey) ?? []));
    if (read.length === 0) {
      deferrals.push({ viewKey: view.viewKey, reason: REFUSALS.GRID_NO_BUBBLE_EVIDENCE.code });
      continue;
    }
    for (const row of read) axes.push({ viewKey: view.viewKey, ...row });
  }

  return { views: examined, axes, deferrals };
}

/**
 * The entities detection may look at, by the view they stand in — FILTERED BEFORE DETECTION, as
 * L-CAD-07 asks. An entity is a candidate where it stands in a view and on a layer the profile gave
 * one of its four roles to; a layer whose own geometry says nothing carries no role, and nothing
 * standing on it is evidence of anything (L-CAD-08).
 *
 * Membership is what is asked of the role, not which role it is: a real grid layer carries the rings,
 * the labels and the lines together, so reading rings only off `outlines` layers would exclude the
 * very drawings this stage exists for.
 */
function candidatesOf(evidence: GridEvidence): Map<string, Drawn[]> {
  const roleLayers = new Set<string>();
  for (const role of CONVENTION_ROLES) for (const layer of evidence.profile?.roles[role] ?? []) roleLayers.add(layer);

  const byView = new Map<string, Drawn[]>();
  for (const entity of evidence.graph.entities) {
    if (!roleLayers.has(entity.layer)) continue;
    const viewKey = evidence.assignments.get(entity.key);
    // The assignment is what puts an entity in model space at all: L-CAD-06 partitions model space,
    // so a paper layout's furniture is assigned to nothing and is a candidate for nothing.
    if (viewKey === undefined) continue;
    const held = byView.get(viewKey);
    if (held === undefined) byView.set(viewKey, [entity]);
    else held.push(entity);
  }
  return byView;
}

/**
 * The lawful bubbles among one view's candidates: for each round closed ring, the one text standing
 * inside it, where that text says a bare label. "Exactly one" is the whole of it — a ring enclosing a
 * label and a dimension mark says two things, and a reading that picked one of them would be a guess.
 *
 * One LABEL is one bubble. Draughtsmen ring a bubble twice — an inner circle and an outer one about
 * the same letter — and each ring encloses exactly that text, so read ring by ring the drawing grows
 * an axis it does not have: a duplicate at the same position, and a backbone claiming twice the grid
 * lines. Among the rings enclosing one text the SMALLEST is the bubble, which is the one the tightest
 * reading of "inside this circle" names (L-CAD-07).
 */
function bubblesAmong(candidates: readonly Drawn[]): Bubble[] {
  const texts = candidates.filter((entity) => typeof entity.text === "string" && (entity.points ?? []).length > 0);

  const tightest = new Map<string, { bubble: Bubble; radius: number }>();
  for (const ring of candidates) {
    if (ring.closed !== true) continue;
    const round = roundnessOf(ring);
    if (round === null) continue;

    const inside = texts.filter((text) => distanceBetween(centroidOf(text), round.centre) < round.radius);
    if (inside.length !== 1) continue;
    const only = inside[0] as Drawn;
    const said = only.text ?? "";
    const family = gridFamilyOf(said);
    if (family === null) continue;

    const held = tightest.get(only.key);
    if (held !== undefined && held.radius <= round.radius) continue;
    tightest.set(only.key, {
      bubble: { bubbleKey: ring.key, labelKey: only.key, label: normaliseGridLabel(said), family, centre: round.centre },
      radius: round.radius,
    });
  }
  return [...tightest.values()].map((held) => held.bubble);
}

/**
 * One view's bubbles, georeferenced: each family along the world axis its own members spread along,
 * each bubble at its position on that axis, and the view's minimum spacing on every row. Per VIEW,
 * both of them: a drawing may carry a plan whose letters run down the page beside one whose letters
 * run across it, and each plan is georeferenced by its own bubbles and scaled by its own spacing.
 *
 * A spacing is the distance BETWEEN AXES of one family, and an axis is named by its label — so a
 * family georeferences a spacing only where it carries two or more DISTINCT labels, and the spacing
 * is the least non-zero distance between the positions of two DIFFERENT labels of that family. Two
 * bubbles saying the same label are one axis bubbled at both ends, which is ordinary drafting: the
 * width of an axis is not a spacing between axes (L-CAD-07, L-MEA-01).
 *
 * An empty answer is the deferral: a view whose bubbles do not amount to a grid — no family carrying
 * two distinct labels, or none whose labels stand at two distinct places — has no spacing for
 * placement to scale by, and half a backbone is not one.
 */
function georeference(bubbles: readonly Bubble[]): Omit<GridAxisRow, "viewKey">[] {
  const families = [...new Set(bubbles.map((bubble) => bubble.family))];
  const spreadOf = new Map<GridFamily, Spread>(
    families.map((family) => {
      const members = bubbles.filter((bubble) => bubble.family === family);
      return [family, { x: spanOf(members.map((member) => member.centre[0])), y: spanOf(members.map((member) => member.centre[1])) }];
    }),
  );
  const axisOf = new Map<GridFamily, GridAxis>(families.map((family) => [family, axisAlong(family, families, spreadOf)]));
  const positionOf = (bubble: Bubble): number => (axisOf.get(bubble.family) === AXIS_X ? bubble.centre[0] : bubble.centre[1]);

  let minSpacing = Number.POSITIVE_INFINITY;
  for (const family of families) {
    const members = bubbles.filter((bubble) => bubble.family === family);
    // Two distinct labels are what makes a family a backbone: one axis, however often it is bubbled,
    // is a mark on the drawing and no spacing at all.
    if (new Set(members.map((member) => member.label)).size < 2) continue;
    for (const one of members) {
      for (const other of members) {
        if (one.label === other.label) continue;
        const gap = Math.abs(positionOf(one) - positionOf(other));
        if (gap > 0) minSpacing = Math.min(minSpacing, gap);
      }
    }
  }
  if (!(minSpacing > 0) || !Number.isFinite(minSpacing)) return [];

  return bubbles.map((bubble) => ({
    family: bubble.family,
    label: bubble.label,
    axis: axisOf.get(bubble.family) as GridAxis,
    position: positionOf(bubble),
    bubbleKey: bubble.bubbleKey,
    labelKey: bubble.labelKey,
    minSpacing,
  }));
}

/** How far one family's bubbles reach along each world axis. */
type Spread = { readonly x: number; readonly y: number };

/**
 * The world axis a family georeferences along: the one its own bubbles are spread out along, since a
 * family of bubbles marks a run of parallel grid lines and stands across them.
 *
 * A family whose bubbles all stand at one place — a plan with a single numeral, an edge of the grid
 * bubbled once — has no spread to read, and reading x anyway is an arbitrary default no drawing
 * stated. Grid families CROSS each other: the family that stands still runs perpendicular to the
 * family that spreads, and that is what a lone bubble's axis is read from. Where nothing spreads at
 * all there is nothing to read, and x is then a stated convention rather than an accident
 * (L-CAD-07).
 */
function axisAlong(family: GridFamily, families: readonly GridFamily[], spreadOf: ReadonlyMap<GridFamily, Spread>): GridAxis {
  const own = spreadOf.get(family);
  if (own !== undefined && spreads(own)) return own.x >= own.y ? AXIS_X : AXIS_Y;

  // Which family it crosses is the one that spreads MOST — read from the whole drawing rather than
  // from whichever family the reader met first, since bubble order is the planner's accident and a
  // third family, or two that disagree about their direction, would otherwise decide it. A tie of
  // reach is settled by the family's own name, so the answer is the same on every read.
  let crossing: Spread | undefined;
  let crossingName = "";
  for (const other of families) {
    const spread = spreadOf.get(other);
    if (spread === undefined || !spreads(spread)) continue;
    if (crossing !== undefined && (reachOf(crossing) > reachOf(spread) || (reachOf(crossing) === reachOf(spread) && crossingName <= other))) continue;
    crossing = spread;
    crossingName = other;
  }
  if (crossing === undefined) return AXIS_X;
  return crossing.x >= crossing.y ? AXIS_Y : AXIS_X;
}

/** How far a family reaches along the axis it reaches furthest on — how decisively it spreads. */
function reachOf(spread: Spread): number {
  return Math.max(spread.x, spread.y);
}

/** Whether a family reaches anywhere at all — one bubble, or several stacked, reaches nowhere. */
function spreads(spread: Spread): boolean {
  return spread.x > 0 || spread.y > 0;
}

/** How far a set of coordinates reaches, end to end. */
function spanOf(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

/**
 * A ring's centre and radius where it is round, or null where it is not. Round is: more vertices than
 * a quadrilateral, every one of them standing the ring's own MEAN radius from the centroid, to within
 * a share of that radius. The vertex count carries its weight — a square's four corners are all
 * equidistant from its own centre, so equidistance alone would read a rectangular tag as a bubble
 * (L-CAD-07 asks for a circle); the mean carries the rest, because a circle crosses the seam
 * flattened into a polygon and no one of its vertices is the true radius (L-CAD-02).
 */
function roundnessOf(ring: Drawn): { centre: Point; radius: number } | null {
  const points = ring.points ?? [];
  if (points.length < FEWEST_ROUND_VERTICES) return null;
  const centre = centroidOf(ring);
  const radii = points.map((point) => distanceBetween(pointOf(point), centre));
  const mean = radii.reduce((held, radius) => held + radius, 0) / radii.length;
  if (!(mean > 0)) return null;
  return radii.every((radius) => Math.abs(radius - mean) <= ROUNDNESS_TOLERANCE * mean) ? { centre, radius: mean } : null;
}

/** Where an entity stands: the mean of the points it is drawn from — a ring's own vertex centroid. */
function centroidOf(entity: Drawn): Point {
  const points = entity.points ?? [];
  if (points.length === 0) return [0, 0];
  const summed = points.reduce<[number, number]>((held, point) => [held[0] + (point[0] ?? 0), held[1] + (point[1] ?? 0)], [0, 0]);
  return [summed[0] / points.length, summed[1] / points.length];
}

/** One of the artifact's coordinate pairs, as a point. */
function pointOf(point: readonly number[]): Point {
  return [point[0] ?? 0, point[1] ?? 0];
}

function distanceBetween(left: Point, right: Point): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
