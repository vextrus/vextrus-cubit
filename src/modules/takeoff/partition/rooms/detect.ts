// The rooms an architect's plan encloses, read, named and registered (R-TO-036; s-takeoff I-643…d).
//
// It runs where the wall lane placed walls — a plan the lane read no wall off encloses nothing it can
// see, so a structural set's partition is the partition it was (F-RCC6-BNBC reads no wall and no room).
// On each such plan: the closed regions its walls' inner faces enclose (`./regions`), the labels that
// name them (`./labels`), and for every closed, named room the SURFACES a finish is laid on — its
// FLOOR, its CEILING and its WALLS — each a placement under the markless identity (I-378) with the
// room's outline as its POLYGON, so the expansion stands it on every storey the plan is typical of and
// the register walks it under the discipline confirmed for its sheet (I-592), exactly as a wall.
//
// What is not a room is said, never dropped silently (L-MEA-01: "out-of-band outlines dropped listed,
// never silently"; L-MEA-03: "a surface that is not a closed outline defers with a reason — never
// bounding-boxed"): a room label standing in no closed region is SURFACE_NOT_CLOSED; a region outside
// the edition's finishMinOutlineArea…finishMaxOutlineArea is ROOM_OUTLINE_OUT_OF_BAND; a region no
// label names is ROOM_UNNAMED; a region whose area its own outline does not bear out is
// ROOM_AREA_DISAGREES (L-FRM-01); a region named a lift, a stair, a duct or a shaft is a VOID.
//
// Pure over what it is handed: no store, no clock, no model (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import { ROOM_FACES, type RoomFace, type RoomOutlineStatus } from "@/core/db";
import type { RoomOutlineReason } from "@/core/errors";
import { placementKey, viewKey as viewKeyOf, type ViewRef } from "@/core/identity";
import { manualMark, placementPointOf } from "@/core/manual/identity";
import type { JudgedPoint, MeasuredGeometry } from "@/core/manual/law";
import { exact, factorOf, isUnit, type Unit } from "@/core/units/canon";
import type { GridAxisRow } from "../grid/detect";
import { saidOf, type Point } from "../placement/edge-pairs";
import { isBoundXrefContext } from "../placement/law";
import type { PlacementEvidence, PlacementRow, WallRow } from "../placement/rows";
import { nearestLabel } from "../placement/runs";
import { shareValue } from "../placement/shares";
import type { PartitionedView } from "../views/assign";
import { yieldsInstances } from "../views/law";
import { sheetOf } from "../walls/pairs";
import { assignLabels, isOpenSpace, roomLabelOf, sizeAgrees, type RoomLabel } from "./labels";
import { agreesWithShoelace, arrangementOf, type ClosedRegion, type DrawnArc, type DrawnRing, type WallBand } from "./regions";

/** The class a room's faces are registered under: L-MEA-03's surface. */
const SURFACE = "surface" satisfies ElementType;

/**
 * The kinds each face of a room bears, which its markless identity is derived over (I-378): a floor is
 * finished; a ceiling is plastered and painted (F-ARCH A-19); a wall face is plastered and painted
 * above its skirting or its dado and tiled below it (A-18). The kinds are what tell a room's three
 * faces apart — they share one outline.
 */
const FACE_KINDS: Readonly<Record<RoomFace, readonly Kind[]>> = Object.freeze({
  FLOOR: ["finish.flooring"],
  CEILING: ["finish.paint", "finish.plaster"],
  WALLS: ["finish.paint", "finish.plaster", "finish.skirting", "finish.tiling"],
});

/** The faces an open space carries: its floor alone (its soffit and walls are the building's outside). */
const OPEN_SPACE_FACES: readonly RoomFace[] = Object.freeze(["FLOOR"]);

/** The coordinate space a plan's model-space geometry is read in, as a markless identity names it. */
const MODEL_SPACE = "model";

/** The basis an outline's points stand on: measured off the plan by the vector engine (L-QTY-01). */
const MEASURED = "MEASURED";

/** How a congruence tolerance is taken off the thinnest wall — the wall lane's own share (I-593). */
const TOLERANCE_PARTS = 1000;

/** How many decimal places of the drawing's own square unit an area is kept to before it is carried. */
const AREA_PLACES = 3;

/** The two families of the backbone. */
const LETTER_FAMILY = "letter";
const NUMERAL_FAMILY = "numeral";


/** The finish outline band the pinned edition states (L-MEA-01), in square metres. */
export type OutlineBand = { readonly min: string; readonly max: string };

/** One label as a room carries it: what it says, what it prints and whether the room bears it out. */
export type RoomLabelRow = {
  readonly key: string;
  readonly name: string;
  readonly size: string | null;
  /** Whether the printed size agrees with the room's extent; null where none is printed. */
  readonly agrees: boolean | null;
  /** A label drawn outside its room with no room of its size to go to (listed, never a name). */
  readonly astray: boolean;
};

/** One room — or one region that is not one — as the partition stores it (`room_outlines`). */
export type RoomRow = {
  readonly roomKey: string;
  readonly viewKey: string;
  readonly sheet: string | null;
  readonly status: RoomOutlineStatus;
  readonly reason: RoomOutlineReason | null;
  /** The name its labels give it, joined in reading order — or null where none does. */
  readonly name: string | null;
  readonly labels: readonly RoomLabelRow[];
  /** The outline (anticlockwise) and its holes (clockwise), in the drawing's own coordinates — null where none closed. */
  readonly outline: { readonly outer: readonly Point[]; readonly holes: readonly (readonly Point[])[] } | null;
  /** The area the outline encloses, carried into square metres by the canon's exact factors. */
  readonly areaM2: string | null;
  /** Where the room is shown from: its first label, or a point of its outline. */
  readonly anchor: Point;
  /** The surfaces it registers, one per face, by the placement each stands as. */
  readonly faces: readonly { readonly face: RoomFace; readonly placementKey: string }[];
  /** The entities its outline was read off (L-CAD-03). */
  readonly sourceKeys: readonly string[];
};

/** What the stage read: the plans it examined, its rooms, and the surfaces they place. */
export type DetectedRooms = { readonly views: number; readonly rooms: readonly RoomRow[]; readonly placements: readonly PlacementRow[] };

/** What the stage is handed: the placement stage's evidence, the walls it placed, and the edition's band. */
export type RoomEvidence = Pick<PlacementEvidence, "graph" | "views" | "assignments" | "grid" | "shares" | "families"> & {
  readonly walls: readonly WallRow[];
  readonly band: OutlineBand;
};

/** A stage that read nothing: no plan placed a wall. */
export const NO_ROOMS: DetectedRooms = Object.freeze({ views: 0, rooms: Object.freeze([]), placements: Object.freeze([]) });

/** The rooms every plan with walls encloses (I-643…d). */
export function detectRooms(evidence: RoomEvidence): DetectedRooms {
  if (evidence.walls.length === 0) return NO_ROOMS;
  const axesByView = new Map<string, GridAxisRow[]>();
  for (const axis of evidence.grid?.axes ?? []) axesByView.set(axis.viewKey, [...(axesByView.get(axis.viewKey) ?? []), axis]);

  let views = 0;
  const rooms: RoomRow[] = [];
  const placements: PlacementRow[] = [];
  for (const view of evidence.views) {
    if (!yieldsInstances(view.type) || view.anchorKey === null) continue;
    const ref: ViewRef = { viewClass: view.type, captionAnchorSourceKey: view.anchorKey };
    const key = viewKeyOf(ref);
    const walls = evidence.walls.filter((wall) => wall.viewKey === key);
    if (walls.length === 0) continue;
    views += 1;
    const read = readPlan(evidence, view, ref, walls, axesByView.get(view.viewKey) ?? []);
    rooms.push(...read.rooms);
    placements.push(...read.placements);
  }
  return { views, rooms, placements };
}

/** One plan's rooms. */
function readPlan(evidence: RoomEvidence, view: PartitionedView, ref: ViewRef, walls: readonly WallRow[], axes: readonly GridAxisRow[]): { rooms: RoomRow[]; placements: PlacementRow[] } {
  const unit = walls[0]?.length.unit;
  if (unit === undefined || !isUnit(unit)) return { rooms: [], placements: [] };
  const drawnUnit: Unit = unit;
  const bands: WallBand[] = walls.flatMap((wall) => {
    if (!isUnit(wall.thickness.unit)) return [];
    const drawn = exact(wall.thickness.value).times(factorOf(wall.thickness.unit)).div(factorOf(drawnUnit)).toNumber();
    return [{ key: wall.placementKey, from: wall.from, to: wall.to, drawn, sourceKeys: wall.length.sourceKeys.filter((one) => one !== "") }];
  });
  if (bands.length === 0) return { rooms: [], placements: [] };
  const tolerance = Math.min(...bands.map((band) => band.drawn)) / TOLERANCE_PARTS;

  // What another drawing bound in as background is none of this plan's rooms (I-342).
  const standing = evidence.graph.entities.filter((entity) => evidence.assignments.get(entity.key) === view.viewKey && !isBoundXrefContext(entity.layer));
  const pointsOf = (entity: (typeof standing)[number]): Point[] => (entity.points ?? []).map((point): Point => [point[0] ?? 0, point[1] ?? 0]);
  const rings: DrawnRing[] = standing.filter((entity) => entity.closed === true).map((entity) => ({ key: entity.key, points: pointsOf(entity) }));
  const arcs: DrawnArc[] = standing.filter((entity) => entity.type === "ARC" && entity.closed !== true).map((entity) => ({ key: entity.key, points: pointsOf(entity) }));
  const said = standing.flatMap((entity) => saidOf(entity) ?? []);
  const arrangement = arrangementOf({ walls: bands, rings, arcs, words: said.map((one) => one.at), tolerance });
  const regions = arrangement.regions;

  const labels: RoomLabel[] = said.flatMap((one) => roomLabelOf(one, drawnUnit) ?? []);
  const reach = shareValue(evidence.shares, "nearAnchor") * (axes[0]?.minSpacing ?? 0);
  const homes = assignLabels(labels, regions, reach, tolerance);
  const sheet = sheetOf(evidence, view);
  const key = viewKeyOf(ref);
  const square = exact(factorOf(drawnUnit)).pow(2);

  const rooms: RoomRow[] = [];
  const placements: PlacementRow[] = [];
  regions.forEach((region, index) => {
    const here = labels.filter((label) => homes.get(label.key)?.region === index);
    const naming = here.filter((label) => label.role === "ROOM" && homes.get(label.key)?.astray !== true);
    const voids = here.filter((label) => label.role === "VOID");
    const areaM2 = region.area.toDecimalPlaces(AREA_PLACES).times(square);
    const status = statusOf(region, areaM2.toString(), evidence.band, naming.length, voids.length);
    const geometry = polygonOf(region);
    const at = placementPointOf(geometry);
    const roomMark = manualMark({ elementClass: SURFACE, kinds: [], geometry, space: MODEL_SPACE, supersedes: null });
    const roomKey = placementKey({ view: ref, mark: roomMark, x: Number(at.x), y: Number(at.y) });
    const ordered = readingOrder(naming.length > 0 ? naming : voids);
    const name = ordered.length === 0 ? null : ordered.map((label) => label.name).join(" / ");
    const faces: { face: RoomFace; placementKey: string }[] = [];
    if (status.status === "CLOSED" && name !== null) {
      for (const face of isOpenSpace(name) ? OPEN_SPACE_FACES : ROOM_FACES) {
        const mark = manualMark({ elementClass: SURFACE, kinds: FACE_KINDS[face], geometry, space: MODEL_SPACE, supersedes: null });
        const x = Number(at.x);
        const y = Number(at.y);
        const faceKey = placementKey({ view: ref, mark, x, y });
        faces.push({ face, placementKey: faceKey });
        const centre = anchorOf(region, ordered);
        placements.push({
          viewKey: key,
          view: ref,
          placementKey: faceKey,
          mark,
          markText: name,
          elementType: SURFACE,
          x,
          y,
          gridLetter: nearestLabel(axes, LETTER_FAMILY, centre),
          gridNumeral: nearestLabel(axes, NUMERAL_FAMILY, centre),
          // The first face line bounding it is the entity a reader goes back to (L-CAD-03).
          outlineKey: region.sourceKeys[0] ?? "",
          // What named it is its first label.
          markKey: ordered[0]?.key ?? "",
          memberFamily: null,
          note: null,
          sheet,
        });
      }
    }
    rooms.push({
      roomKey,
      viewKey: key,
      sheet,
      status: status.status,
      reason: status.reason,
      name,
      labels: readingOrder(here).map((label) => ({
        key: label.key,
        name: label.name,
        size: label.sizeText,
        agrees: sizeAgrees(label, region, tolerance),
        astray: homes.get(label.key)?.astray === true,
      })),
      outline: { outer: region.outer, holes: region.holes },
      areaM2: areaM2.toString(),
      anchor: anchorOf(region, ordered),
      faces,
      sourceKeys: region.sourceKeys,
    });
  });

  // A room label standing in no closed region: a room whose walls do not close (L-MEA-03).
  for (const label of labels) {
    if (label.role !== "ROOM" || homes.get(label.key)?.region !== null) continue;
    const geometry: MeasuredGeometry = { geometry: "POINT_SET", points: [judged(label.at, [label.key])] };
    const mark = manualMark({ elementClass: SURFACE, kinds: [], geometry, space: MODEL_SPACE, supersedes: null });
    rooms.push({
      roomKey: placementKey({ view: ref, mark, x: label.at[0], y: label.at[1] }),
      viewKey: key,
      sheet,
      status: "NOT_CLOSED",
      reason: "SURFACE_NOT_CLOSED",
      name: label.name,
      labels: [{ key: label.key, name: label.name, size: label.sizeText, agrees: null, astray: false }],
      outline: null,
      areaM2: null,
      anchor: label.at,
      faces: [],
      sourceKeys: [label.key],
    });
  }
  return { rooms, placements };
}

/** What a region is, and the reason it is not a room where it is not one — in the order they are asked. */
function statusOf(region: ClosedRegion, areaM2: string, band: OutlineBand, named: number, voids: number): { status: RoomOutlineStatus; reason: RoomOutlineReason | null } {
  // L-MEA-01's band first: a sliver between two lines and the whole world around a plan are no rooms,
  // whatever label stands in them.
  if (exact(areaM2).lt(band.min) || exact(areaM2).gt(band.max)) return { status: "DROPPED", reason: "ROOM_OUTLINE_OUT_OF_BAND" };
  if (!agreesWithShoelace(region)) return { status: "DROPPED", reason: "ROOM_AREA_DISAGREES" };
  if (named > 0) return { status: "CLOSED", reason: null };
  if (voids > 0) return { status: "VOID", reason: null };
  return { status: "DROPPED", reason: "ROOM_UNNAMED" };
}

/** A region's outline as L-FRM-01's POLYGON, each point measured off the plan (I-645). */
function polygonOf(region: ClosedRegion): MeasuredGeometry {
  return {
    geometry: "POLYGON",
    outer: region.outer.map((point) => judged(point, [])),
    cutouts: region.holes.map((hole) => ({ role: "MEMBER" as const, ring: hole.map((point) => judged(point, [])) })),
  };
}

/** One point as a markless identity is derived over. */
function judged(point: Point, sources: readonly string[]): JudgedPoint {
  return { x: String(point[0]), y: String(point[1]), basis: MEASURED, sources };
}

/** Labels in the order a plan is read: top to bottom, then left to right. */
function readingOrder(labels: readonly RoomLabel[]): RoomLabel[] {
  return [...labels].sort((left, right) => right.at[1] - left.at[1] || left.at[0] - right.at[0]);
}

/** Where a room is shown from: its first name's label, or the mean of its outline's points. */
function anchorOf(region: ClosedRegion, labels: readonly RoomLabel[]): Point {
  const first = labels[0];
  if (first !== undefined) return first.at;
  const n = region.outer.length;
  return [region.outer.reduce((sum, point) => sum + point[0], 0) / n, region.outer.reduce((sum, point) => sum + point[1], 0) / n];
}
