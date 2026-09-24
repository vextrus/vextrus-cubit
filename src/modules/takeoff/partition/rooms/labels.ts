// The words that NAME a closed region of an architect's plan (s-takeoff I-644): a room label is a
// name written over the size the architect gives the room — `BED-01` over `17'-11" x 14'-5"` — and a
// space nobody finishes is named by a word of its own (`LIFT`, `STAIR`, `DUCT`, `SHAFT`).
//
// A name is read by grammar and by nothing else: the layer a label stands on is never read (F-ARCH
// files its labels on one layer, the Edison set on half a dozen). What the grammar reads:
//   · a ROOM label — two lines, the first a name, the second a size pair stating its unit. The size is
//     a CROSS-CHECK, never a quantity: the room's geometry governs, and a label writing a nominal
//     whole-feet size against a clear 17'-10" is flagged, not believed (T-ROOM-SIZE-NOMINAL);
//   · a VOID label — one line, a word of the void roster: a lift, a stair, a duct or a shaft is a hole
//     in the floor plate or a well nobody lays a floor finish in, and it is no room;
//   · anything else — a door tag, a grid bubble, `UP`, `RAMP UP 1:8`, a level, `CAR PARKING` — is no
//     room label. A space labelled only so is no room here, and says so as an unnamed region.
//
// Which region a label names is the region its insertion point stands in. One exception, read off
// the printed size: a label standing in a room another label of that room already names at the size it
// is drawn, whose own printed size that room does not bear, has been drawn outside its room on a
// leader (T-LABEL-OUTSIDE) — it names the nearest region within the plan's reach that NO label names
// and whose size is the size it prints, or it names nothing. Two labels in one region neither of
// which fits it (LIVING and DINING either side of an archway, A-13) are one space carrying two names.
//
// Pure: no store, no clock, no model (L-REG-04).
import { notationLines } from "@/core/entitygraph/notation";
import { exact, factorOf, type Unit } from "@/core/units/canon";
import { parseSizePair } from "../notation";
import { plainly } from "../notation/grammar";
import { insideRing, type Point, type Said } from "../placement/edge-pairs";
import { halfUnitOf } from "../placement/runs";

/** What a label says a region is: a room somebody finishes, or a void nobody does. */
export type LabelRole = "ROOM" | "VOID";

/** One label as the grammar read it. */
export type RoomLabel = {
  readonly key: string;
  readonly at: Point;
  readonly role: LabelRole;
  /** The name as written — the first line, its codes resolved and its spacing settled. */
  readonly name: string;
  /** The size the label prints, as written, or null where it prints none. */
  readonly sizeText: string | null;
  /** That size carried into the drawing's own units — the two sides, each with how near it was written — or null. */
  readonly size: { readonly sides: readonly [number, number]; readonly slack: number } | null;
};

/**
 * The void roster: the words a plan names a space by that no floor, ceiling or wall finish is laid in.
 * A closed list read as whole words, so `LIFT LOBBY` (a room) is never `LIFT` (a void).
 */
export const VOID_WORDS: readonly string[] = Object.freeze(["LIFT", "LIFT WELL", "LIFT SHAFT", "STAIR", "STAIRS", "STAIRCASE", "STAIR CASE", "DUCT", "SHAFT", "VOID", "CUT OUT", "OPEN TO SKY", "OPEN TO BELOW"]);

/**
 * The open spaces: a room whose name opens with one of these words is outside the building's skin —
 * its floor is finished, its soffit and its walls are the building's EXTERNAL faces (F-ARCH A-15,
 * A-19), which no internal finish item is. It carries its FLOOR alone.
 */
export const OPEN_SPACE_WORDS: readonly string[] = Object.freeze(["VERANDAH", "VERANDA", "BALCONY", "TERRACE", "PORCH", "SIT OUT"]);

/** A name as the grammar admits one: capitals, figures and the marks an architect joins them with. */
const NAME = /^[A-Z][A-Z0-9 .&'/-]*$/;

/** How many lines a room label is written in: its name, and its size under it. */
const ROOM_LABEL_LINES = 2;

/** How near an inch a feet-and-inches size is written: to the nearest inch, so half of one. */
const HALF_INCH = 0.5;

/**
 * One text read as a label, or null where it is no label at all. The drawing's unit is what a printed
 * size is carried into, so it can be set against the region's own extent.
 */
export function roomLabelOf(said: Said, drawnUnit: Unit): RoomLabel | null {
  const lines = notationLines(said.text)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
  const first = lines[0];
  if (first === undefined) return null;
  const word = plainly(first);
  if (lines.length === 1 && VOID_WORDS.includes(word)) return { key: said.key, at: said.at, role: "VOID", name: first, sizeText: null, size: null };
  if (lines.length !== ROOM_LABEL_LINES || !NAME.test(first.toUpperCase())) return null;
  const sizeText = lines[1] as string;
  const pair = parseSizePair(sizeText);
  if (pair === null || pair.unit === null) return null;
  const factor = exact(factorOf(pair.unit)).div(factorOf(drawnUnit));
  const slack = pair.unit === "in" ? HALF_INCH : Math.max(halfUnitOf(pair.width), halfUnitOf(pair.depth));
  return {
    key: said.key,
    at: said.at,
    role: "ROOM",
    name: first,
    sizeText,
    size: { sides: [factor.times(pair.width).toNumber(), factor.times(pair.depth).toNumber()], slack: factor.times(slack).toNumber() },
  };
}

/** Is this room open to the weather — its floor finished, its soffit and walls the building's outside? */
export function isOpenSpace(name: string): boolean {
  const word = plainly(name);
  return OPEN_SPACE_WORDS.some((open) => word === open || word.startsWith(`${open} `));
}

/** A region as the labels are put to it: its outline, holes, and the extent its box spans. */
export type LabelledRegion = { readonly outer: readonly Point[]; readonly holes: readonly (readonly Point[])[] };

/** Does a label's printed size agree with a region's extent — either way round, to half the place it was written to? */
export function sizeAgrees(label: RoomLabel, region: LabelledRegion, tolerance: number): boolean | null {
  if (label.size === null) return null;
  const [width, depth] = extentOf(region.outer);
  const [a, b] = label.size.sides;
  const near = (side: number, span: number): boolean => Math.abs(side - span) <= label.size!.slack + tolerance;
  return (near(a, width) && near(b, depth)) || (near(a, depth) && near(b, width));
}

/** The extent of a ring's box: its width and its depth. */
export function extentOf(ring: readonly Point[]): readonly [number, number] {
  const xs = ring.map((point) => point[0]);
  const ys = ring.map((point) => point[1]);
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

/** Does a region hold a point — inside its outline and in none of its holes? */
export function holds(region: LabelledRegion, point: Point): boolean {
  return insideRing(point, region.outer) && !region.holes.some((hole) => insideRing(point, hole));
}

/** How far a point stands from a region's outline (zero inside it). */
function distanceTo(region: LabelledRegion, point: Point): number {
  if (holds(region, point)) return 0;
  let best = Number.POSITIVE_INFINITY;
  const ring = region.outer;
  for (let index = 0; index < ring.length; index += 1) {
    const a = ring[index] as Point;
    const b = ring[(index + 1) % ring.length] as Point;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const ll = dx * dx + dy * dy;
    const t = ll === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / ll));
    best = Math.min(best, Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy)));
  }
  return best;
}

/**
 * Where one label stands: the region it names (null where it stands in no closed region — a room label
 * so is a room whose walls do not close, SURFACE_NOT_CLOSED), and whether it stands in that region as a
 * stranger with no home to go to — drawn outside its room, naming nothing (listed, never a name).
 */
export type LabelHome = { readonly region: number | null; readonly astray: boolean };

/**
 * Which region each label names (I-644). `reach` is how far a label drawn outside its room may
 * stand from it (the plan's near-anchor reach).
 */
export function assignLabels(labels: readonly RoomLabel[], regions: readonly LabelledRegion[], reach: number, tolerance: number): Map<string, LabelHome> {
  const named = new Map<string, LabelHome>();
  for (const label of labels) {
    const at = regions.findIndex((region) => holds(region, label.at));
    named.set(label.key, { region: at === -1 ? null : at, astray: false });
  }

  const occupants = (index: number): RoomLabel[] => labels.filter((label) => named.get(label.key)?.region === index && named.get(label.key)?.astray !== true);
  for (const label of labels) {
    const at = named.get(label.key)?.region ?? null;
    if (at === null || label.role !== "ROOM") continue;
    const region = regions[at] as LabelledRegion;
    if (sizeAgrees(label, region, tolerance) !== false) continue;
    // A stranger: another label of this room names it at the size it is drawn.
    const hosts = occupants(at).filter((other) => other.key !== label.key && other.role === "ROOM" && sizeAgrees(other, region, tolerance) === true);
    if (hosts.length === 0) continue;
    const home = regions
      .map((candidate, index) => ({ candidate, index, far: distanceTo(candidate, label.at) }))
      .filter(({ candidate, index, far }) => index !== at && far <= reach && occupants(index).length === 0 && sizeAgrees(label, candidate, tolerance) === true)
      .sort((left, right) => left.far - right.far)[0];
    named.set(label.key, home === undefined ? { region: at, astray: true } : { region: home.index, astray: false });
  }
  return named;
}
