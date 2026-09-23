// The markless key (I-378, L-REG-02, L-REG-04): a hand measurement has no drawn mark, and the store
// binds `object_key = placement_key ‖ level segment` with a placement key that needs one. So a hand
// row spells a mark derived from its own content — never minted, never a clock, never a counter —
// and the same trace of the same scope under the same class and kinds re-derives the same key, which
// is what makes a second identical measurement DUPLICATE_IDENTITY at the register's door for free.
//
// Pure and storeless. The grammars a key is spelled in are the identity core's (`instanceKey`,
// `quantise`, `viewKey`); the canonical JSON a mark is hashed over is the one home's (`canonical`).
import { createHash } from "node:crypto";
import { canonical } from "../acts/consequence";
import type { ElementType } from "../catalogue/classes";
import type { Kind } from "../catalogue/kinds";
import { instanceKey, quantise, type LevelRef, type ViewRef } from "../identity";
import { exact } from "../units/canon";
import { latticeOf, twiceSignedArea } from "./exact";
import { ANCHORLESS_VIEW_CLASS, normalisedGeometry, type JudgedPoint, type MeasuredGeometry } from "./law";

/** What every hand mark opens with: `~` appears in no mark grammar, so no drawn mark can be one (I-378). */
const MARK_PREFIX = "~m.";

/** How many hex digits of the digest a mark keeps: 64 bits, where a collision refuses and never double-counts. */
const MARK_HEX = 16;

/** The version of the mark's content form, so a later form can never re-derive an earlier key. */
const MARK_FORM = 1;

/** What the anchorless view's key is anchored to instead of a caption: the drawing revision's own bytes (I-375). */
const FILE_ANCHOR = "FILE:";

/** One point on the key's lattice: the fixed one-decimal spellings `quantise` writes. */
type KeyPoint = readonly [string, string];

/** Compare two lattice points: x, then y, as exact decimals. */
function compareKeyPoints(a: KeyPoint, b: KeyPoint): number {
  return exact(a[0]).comparedTo(b[0]) || exact(a[1]).comparedTo(b[1]);
}

/** Compare two sequences of lattice points, point by point, the shorter first where one is a prefix. */
function compareSequences(a: readonly KeyPoint[], b: readonly KeyPoint[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const order = compareKeyPoints(a[index] as KeyPoint, b[index] as KeyPoint);
    if (order !== 0) return order;
  }
  return a.length - b.length;
}

/** A point on the key's lattice — the key grammar's own quantisation of the point's exact spelling. */
function keyPointOf(point: JudgedPoint): KeyPoint {
  return [quantise(Number(point.x)), quantise(Number(point.y))];
}

/**
 * A closed ring in its canonical form: turning the way asked (decided on the EXACT points, so two
 * quantised spellings of one ring cannot turn two ways), starting at its least lattice point — and
 * where two rotations start there, the least whole sequence.
 */
function canonicalRing(ring: readonly JudgedPoint[], anticlockwise: boolean): KeyPoint[] {
  const lift = latticeOf([ring]);
  const turning = twiceSignedArea(ring.map(lift));
  const ordered = (turning >= 0n) === anticlockwise ? [...ring] : [...ring].reverse();
  const points = ordered.map(keyPointOf);
  let best: KeyPoint[] | null = null;
  for (let start = 0; start < points.length; start += 1) {
    const rotated = [...points.slice(start), ...points.slice(0, start)];
    if (best === null || compareSequences(rotated, best) < 0) best = rotated;
  }
  return best ?? [];
}

/**
 * Every ring of a geometry in the key's canonical form (I-378): an outline anticlockwise from its
 * least point, each cut-out clockwise from its own least point and the cut-outs sorted by that point;
 * a run from its lesser end; a set of points sorted.
 */
export function canonicalRings(geometry: MeasuredGeometry): KeyPoint[][] {
  const whole = normalisedGeometry(geometry);
  switch (whole.geometry) {
    case "POLYGON":
      return [canonicalRing(whole.outer, true), ...whole.cutouts.map((cutout) => canonicalRing(cutout.ring, false)).sort(compareSequences)];
    case "POLYLINE": {
      const forward = whole.run.map(keyPointOf);
      const backward = [...forward].reverse();
      return [compareSequences(backward, forward) < 0 ? backward : forward];
    }
    case "POINT_SET":
      return [whole.points.map(keyPointOf).sort(compareKeyPoints)];
  }
}

/** Everything a hand mark is derived from (I-378) — and nothing a person may correct or rename. */
export type MarkContent = {
  readonly elementClass: ElementType;
  readonly kinds: readonly Kind[];
  readonly geometry: MeasuredGeometry;
  /** The coordinate space the points are in: `model`, or a paper layout's name (two spaces never compare). */
  readonly space: string;
  /** The object key this measurement succeeds, or null (I-379). */
  readonly supersedes: string | null;
};

/**
 * The hand mark: `~m.` and the first 16 hex of the sha-256 of the canonical JSON of the class, the
 * kinds (code-point sorted), the geometry type, the space, the quantised canonical rings and what it
 * supersedes. The condition's id and name never enter: an id is minted and a name is a label
 * (L-REG-02, L-REG-04). Attributes never enter: they are correctable (L-REG-02).
 */
export function manualMark(content: MarkContent): string {
  const kinds = [...new Set(content.kinds)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const form = {
    v: MARK_FORM,
    class: content.elementClass,
    kinds,
    geometry: content.geometry.geometry,
    space: content.space,
    rings: canonicalRings(content.geometry),
    supersedes: content.supersedes,
  };
  const digest = createHash("sha256").update(canonical(form), "utf8").digest("hex");
  return `${MARK_PREFIX}${digest.slice(0, MARK_HEX)}`;
}

/**
 * Where the placement stands: the first point of the canonical first ring — an outline's least point,
 * a run's lesser end, the least of a set of points (I-378). Its exact spelling carries the number the
 * placement key quantises, so the key and the mark stand on one lattice point.
 */
export function placementPointOf(geometry: MeasuredGeometry): JudgedPoint {
  const whole = normalisedGeometry(geometry);
  const [first] = canonicalRings(whole);
  const at = first?.[0];
  if (at === undefined) throw new Error("a geometry with no point has no placement (I-378)");
  const candidates = whole.geometry === "POLYGON" ? whole.outer : whole.geometry === "POLYLINE" ? whole.run : whole.points;
  const found = candidates.find((point) => compareKeyPoints(keyPointOf(point), at) === 0);
  if (found === undefined) throw new Error("the canonical ring's first point is none of the geometry's own points (I-378)");
  return found;
}

/**
 * The view a hand row is keyed under (I-375, L-REG-04): an anchored view by its class and its
 * caption's source key, as every register row names a view; the anchorless view by the drawing
 * revision's own bytes, `v:UNASSIGNED:FILE:<sha256>` — content-derived, minting nothing, and never
 * shared by two drawings as the partition's bare `UNASSIGNED` is.
 */
export function manualViewRef(view: { readonly viewClass: string; readonly anchorKey: string | null }, drawingSha256: string): ViewRef {
  if (view.anchorKey !== null) return { viewClass: view.viewClass, captionAnchorSourceKey: view.anchorKey };
  return { viewClass: ANCHORLESS_VIEW_CLASS, captionAnchorSourceKey: `${FILE_ANCHOR}${drawingSha256}` };
}

/** A hand row's identity, whole: the mark, where it is placed, and the object key the register stands it at. */
export type ManualIdentity = {
  readonly mark: string;
  readonly view: ViewRef;
  readonly x: number;
  readonly y: number;
  readonly level: LevelRef;
  readonly objectKey: string;
};

/**
 * The object key a hand measurement stands at (I-378): its view, its mark, its placement point on the
 * lattice and its level segment — `instanceKey`'s own grammar, so the store's CHECK
 * (`register_objects_level_stated_once`) holds with no change.
 */
export function manualIdentityOf(content: MarkContent, view: ViewRef, level: LevelRef): ManualIdentity {
  const mark = manualMark(content);
  const point = placementPointOf(content.geometry);
  const x = Number(point.x);
  const y = Number(point.y);
  return { mark, view, x, y, level, objectKey: instanceKey({ placement: { view, mark, x, y }, level }) };
}
