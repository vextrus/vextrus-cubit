// The edge-line PAIR, as a plan draws a member it cuts through: two straight lines drawn alike —
// congruent, parallel, one the other translated square to their run — and the member is the band
// between them. A structural plan draws its beams so (`./runs`) and an architect's plan draws its
// walls so (`../walls/pairs`); what differs between the two is which gaps a pair may be drawn at and
// whether the two lines must stand on one layer, never how a pair is recognised. So the geometry has
// one home, here, and each reader states only its own admission rule (B-17, ARCH-02).
//
// Pure over the artifact: no store, no clock, no model (L-REG-04). Nothing here spells a distance in
// drawing units — every tolerance is a share of a distance its caller read off the drawing.
import type { EntityGraph } from "@/core/entitygraph/schema";

/** A point in the drawing's own plane. */
export type Point = readonly [number, number];

/** An entity as a plan reader reads one — the artifact's own shape. */
export type Drawn = EntityGraph["entities"][number];

/** One straight edge line of a plan: where it runs from and to, and what it was drawn on. */
export type Edge = { readonly key: string; readonly layer: string; readonly from: Point; readonly to: Point };

/**
 * One text of a plan, where it stands, and which way it is written: the world angle of its baseline,
 * counter-clockwise in degrees, as the artifact states it (I-415) — null where the artifact is an
 * older one that states no angle, which no reader takes for 0 (L-QTY-04).
 */
export type Said = { readonly key: string; readonly text: string; readonly at: Point; readonly turn: number | null };

/** A member drawn as two edge lines: the axis between them, and how far apart they were drawn. */
export type Axis = {
  readonly keys: readonly [string, string];
  readonly from: Point;
  readonly to: Point;
  /** Which of the plane's two directions the axis runs along — the dominant one of its direction. */
  readonly along: "x" | "y";
  /** The coordinate the axis holds constant, and the two the run is measured between. */
  readonly at: number;
  readonly start: number;
  readonly end: number;
  readonly width: number;
};

/** How many points an edge line is drawn from: two, and a polyline of three is not one. */
const EDGE_LINE_POINTS = 2;

/** This entity read as one straight edge line, or nothing where it is not one. */
export function edgeOf(entity: Drawn): [Edge] | null {
  if (entity.closed === true) return null;
  const points = (entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0]);
  if (points.length !== EDGE_LINE_POINTS) return null;
  const [from, to] = points as [Point, Point];
  if (from[0] === to[0] && from[1] === to[1]) return null;
  return [{ key: entity.key, layer: entity.layer, from, to }];
}

/** This entity read as a piece of the drawing's text, or nothing where it says none. */
export function saidOf(entity: Drawn): [Said] | null {
  const text = entity.text ?? "";
  const at = (entity.points ?? [])[0];
  if (text === "" || at === undefined) return null;
  return [{ key: entity.key, text, at: [at[0] ?? 0, at[1] ?? 0], turn: entity.rotation ?? null }];
}

/**
 * How far one edge line stands off another, where the two are one member's two edges — null where they
 * are not. They are when the second is the first, translated: same direction, same length, and the
 * translation square to the direction they both run.
 */
export function translationBetween(left: Edge, right: Edge, tolerance: number): number | null {
  const direction: Point = [left.to[0] - left.from[0], left.to[1] - left.from[1]];
  const length = Math.hypot(direction[0], direction[1]);
  if (!(length > 0)) return null;
  // Either end of the second line may be the one that answers the first's start: a plan draws its two
  // edges in whichever direction it drew them, and the member is the same member either way.
  for (const [from, to] of [
    [right.from, right.to],
    [right.to, right.from],
  ] as [Point, Point][]) {
    const offset: Point = [from[0] - left.from[0], from[1] - left.from[1]];
    const closing: Point = [to[0] - left.to[0], to[1] - left.to[1]];
    if (Math.hypot(offset[0] - closing[0], offset[1] - closing[1]) > tolerance) continue;
    const along = (offset[0] * direction[0] + offset[1] * direction[1]) / length;
    if (Math.abs(along) > tolerance) continue;
    return Math.hypot(offset[0], offset[1]);
  }
  return null;
}

/** The member two edge lines enclose: the axis midway between them, and the width they were drawn apart. */
export function axisBetween(left: Edge, right: Edge, gap: number): Axis {
  const near = Math.hypot(right.from[0] - left.from[0], right.from[1] - left.from[1]);
  const far = Math.hypot(right.to[0] - left.from[0], right.to[1] - left.from[1]);
  const [otherFrom, otherTo] = near <= far ? [right.from, right.to] : [right.to, right.from];
  const from: Point = [(left.from[0] + otherFrom[0]) / 2, (left.from[1] + otherFrom[1]) / 2];
  const to: Point = [(left.to[0] + otherTo[0]) / 2, (left.to[1] + otherTo[1]) / 2];
  const along = Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1]) ? "x" : "y";
  const at = along === "x" ? (from[1] + to[1]) / 2 : (from[0] + to[0]) / 2;
  const [start, end] = along === "x" ? [from[0], to[0]] : [from[1], to[1]];
  return { keys: [left.key, right.key], from, to, along, at, start: Math.min(start, end), end: Math.max(start, end), width: gap };
}

/** Two edge lines that may be one member's two edges, and the gap they stand apart. */
export type PairCandidate = { readonly left: Edge; readonly right: Edge; readonly gap: number };

/**
 * What a reader admits as a pair: the tolerance two lines are judged congruent within, whether the two
 * must stand on one layer, and which gaps it reads a member at.
 */
export type PairAdmission = {
  readonly tolerance: number;
  readonly sameLayer: boolean;
  readonly admits: (gap: number) => boolean;
};

/**
 * Every two lines of a plan drawn as one member's two edges at a gap the reader admits, closest first
 * and then by the lower key — the order a greedy pairing takes them in, so one artifact pairs one way
 * every time (L-REG-04).
 */
export function pairCandidates(edges: readonly Edge[], admission: PairAdmission): PairCandidate[] {
  const candidates: PairCandidate[] = [];
  for (let index = 0; index < edges.length; index += 1) {
    for (let other = index + 1; other < edges.length; other += 1) {
      const left = edges[index] as Edge;
      const right = edges[other] as Edge;
      if (admission.sameLayer && left.layer !== right.layer) continue;
      const gap = translationBetween(left, right, admission.tolerance);
      if (gap === null || !admission.admits(gap)) continue;
      candidates.push({ left, right, gap });
    }
  }
  candidates.sort((left, right) => left.gap - right.gap || (left.left.key < right.left.key ? -1 : left.left.key > right.left.key ? 1 : 0));
  return candidates;
}

/** The pairs a greedy pass keeps over ordered candidates: each line taken once, the first to ask it wins. */
export function greedyPairs(candidates: readonly PairCandidate[]): Axis[] {
  const taken = new Set<string>();
  const members: Axis[] = [];
  for (const candidate of candidates) {
    if (taken.has(candidate.left.key) || taken.has(candidate.right.key)) continue;
    taken.add(candidate.left.key);
    taken.add(candidate.right.key);
    members.push(axisBetween(candidate.left, candidate.right, candidate.gap));
  }
  return members;
}

/** Does this edge line run along one of the plane's two axes, to within the pairing's own tolerance? */
export function squareToThePlane(edge: Edge, tolerance: number): boolean {
  return Math.min(Math.abs(edge.to[0] - edge.from[0]), Math.abs(edge.to[1] - edge.from[1])) <= tolerance;
}

/**
 * A direction of the plane a plan's lines run in, and the frame it reads them in: `along` the unit
 * direction (turned so it points up the sheet, or along +x where it runs across), `across` the normal
 * a quarter-turn anticlockwise from it. A line's `u` is how far along the frame it stands and its `v`
 * how far across — so two lines of one frame are the two faces of one band exactly where their `v`s
 * differ by the band's width and their `u`s overlap.
 */
export type Frame = { readonly along: Point; readonly across: Point };

/** One edge line read in a frame: its stretch along it, and where it stands across it. */
export type FramedEdge = { readonly edge: Edge; readonly from: number; readonly to: number; readonly at: number };

/** The frame a line runs in: its direction, turned to point up the sheet (or along +x). */
export function frameOf(edge: Edge): Frame {
  const length = Math.hypot(edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]);
  let along: Point = [(edge.to[0] - edge.from[0]) / length, (edge.to[1] - edge.from[1]) / length];
  if (along[1] < 0 || (along[1] === 0 && along[0] < 0)) along = [-along[0], -along[1]];
  return { along, across: [-along[1], along[0]] };
}

/** Where a point stands in a frame: how far along it, and how far across. */
export function inFrame(point: Point, frame: Frame): { readonly u: number; readonly v: number } {
  return { u: point[0] * frame.along[0] + point[1] * frame.along[1], v: point[0] * frame.across[0] + point[1] * frame.across[1] };
}

/** The point standing `u` along a frame and `v` across it. */
export function outOfFrame(u: number, v: number, frame: Frame): Point {
  return [frame.along[0] * u + frame.across[0] * v, frame.along[1] * u + frame.across[1] * v];
}

/**
 * The plan's straight lines grouped by the direction they run, each read in its group's frame. Two
 * lines are one direction where the second, carried along the first's frame, holds its `v` to within
 * the tolerance over its whole length — the same test `translationBetween` puts to a translation, so a
 * line drawn a hair off square is still a face of the band it bounds, and one drawn visibly askew is
 * not. The groups come in the order their first line was drawn, and so do their lines (L-REG-04).
 */
export function directionGroups(edges: readonly Edge[], tolerance: number): { readonly frame: Frame; readonly edges: readonly FramedEdge[] }[] {
  const groups: { frame: Frame; edges: FramedEdge[] }[] = [];
  for (const edge of edges) {
    const read = (frame: Frame): FramedEdge | null => {
      const from = inFrame(edge.from, frame);
      const to = inFrame(edge.to, frame);
      if (Math.abs(from.v - to.v) > tolerance) return null;
      return { edge, from: Math.min(from.u, to.u), to: Math.max(from.u, to.u), at: (from.v + to.v) / 2 };
    };
    let placed = false;
    for (const group of groups) {
      const framed = read(group.frame);
      if (framed === null) continue;
      group.edges.push(framed);
      placed = true;
      break;
    }
    if (placed) continue;
    const frame = frameOf(edge);
    const framed = read(frame);
    if (framed !== null) groups.push({ frame, edges: [framed] });
  }
  return groups;
}

/** One line of a face, as a stretch cites it: its key, and where it runs along the frame. */
export type FaceLine = { readonly key: string; readonly from: number; readonly to: number };

/** One stretch of a face: where it runs from and to along its frame, and the lines that draw it. */
export type FaceStretch = { readonly from: number; readonly to: number; readonly lines: readonly FaceLine[] };

/** The lines of a stretch that draw some of `[from, to]` — what a piece of it cites (L-CAD-03). */
export function linesOver(lines: readonly FaceLine[], from: number, to: number, tolerance: number): string[] {
  return lines.filter((line) => Math.min(line.to, to) - Math.max(line.from, from) > tolerance).map((line) => line.key);
}

/** One face of a frame: where it stands across it, and the stretches its lines draw, in order. */
export type Face = { readonly at: number; readonly stretches: readonly FaceStretch[] };

/**
 * The faces one direction's lines draw: the lines standing on one `v` (to within the tolerance)
 * folded into the stretches they cover — two lines that touch or overlap are one stretch, and a line
 * drawn twice over itself is the stretch it draws once (T-DOUBLE-LINE). In the order they stand across
 * the frame.
 */
export function facesOf(edges: readonly FramedEdge[], tolerance: number): Face[] {
  const sorted = [...edges].sort((left, right) => left.at - right.at || left.from - right.from);
  const clusters: FramedEdge[][] = [];
  for (const edge of sorted) {
    const last = clusters[clusters.length - 1];
    const first = last?.[0];
    if (last !== undefined && first !== undefined && edge.at - first.at <= tolerance) last.push(edge);
    else clusters.push([edge]);
  }
  return clusters.map((cluster) => {
    const along = [...cluster].sort((left, right) => left.from - right.from || (left.edge.key < right.edge.key ? -1 : left.edge.key > right.edge.key ? 1 : 0));
    const stretches: { from: number; to: number; lines: FaceLine[] }[] = [];
    for (const edge of along) {
      const held = stretches[stretches.length - 1];
      const line: FaceLine = { key: edge.edge.key, from: edge.from, to: edge.to };
      if (held !== undefined && edge.from <= held.to + tolerance) {
        held.to = Math.max(held.to, edge.to);
        held.lines.push(line);
      } else stretches.push({ from: edge.from, to: edge.to, lines: [line] });
    }
    return { at: (cluster[0] as FramedEdge).at, stretches };
  });
}

/**
 * Where two faces of one frame are BOTH drawn: the stretches of the one that overlap stretches of the
 * other, each cut to the overlap and citing the lines of both. A band of a member cut through by the
 * plan is exactly this — the plan draws both of its faces over the stretch it stands — and a face drawn
 * on one side only (the far face of a T, the side a junction opens) is no band there.
 */
export function bothDrawn(lower: Face, upper: Face, tolerance: number): FaceStretch[] {
  const overlaps: FaceStretch[] = [];
  for (const one of lower.stretches) {
    for (const other of upper.stretches) {
      const from = Math.max(one.from, other.from);
      const to = Math.min(one.to, other.to);
      if (to - from > tolerance) overlaps.push({ from, to, lines: [...one.lines, ...other.lines].filter((line) => Math.min(line.to, to) - Math.max(line.from, from) > tolerance) });
    }
  }
  return overlaps.sort((left, right) => left.from - right.from);
}

/** Is this point inside this closed ring (the even-odd rule over its edges)? */
export function insideRing(point: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index] as Point;
    const b = ring[(index + 1) % ring.length] as Point;
    if (a[1] > point[1] !== b[1] > point[1]) {
      const x = a[0] + ((point[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (point[0] < x) inside = !inside;
    }
  }
  return inside;
}
