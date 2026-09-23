/**
 * S-08's two rings as the committed fixture draws them (F-RCC6-BNBC, `fixtures/rcc6-bnbc/rcc6-bnbc.dxf`):
 * the SOG's own outline, POLYLINE 81D on layer Slab, and the lift pit, LWPOLYLINE 830 — the ring
 * J-000's manual leg traces and the cut-out it takes (s-measure I-393). Read from the DXF's own group
 * codes, never transcribed, so a regenerated fixture moves these suites with it (B-19).
 *
 * The view they stand in holds a DIMENSION_RATIO scale of record at 0.001 m per unit on both axes
 * (`LAYOUT_PLAN:DXF_HANDLE:2073`, read back from the J-000 project in session 8).
 *
 * In the product S-08 is a PAPER sheet: its plan is seen through VIEWPORT 2077 at 1:100, so the viewer
 * holds the rings in paper coordinates (`s08Paper`). The model-space rings stand for model space.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { RenderRecord } from "@/modules/takeoff/viewer";
import { projectRecord, windowsOf, type ViewportRecord, type Window } from "@/modules/takeoff/viewer/projection";
import { sheetWindowsOf } from "@/modules/takeoff/viewer-snap/sheet-space";
import type { SnapCalibration, SnapFactorSpace } from "@/modules/takeoff/viewer-snap/types";

type Point = readonly [number, number];
type Entity = { readonly type: string; readonly codes: ReadonlyArray<readonly [string, string]> };

const DXF = join(process.cwd(), "fixtures", "rcc6-bnbc", "rcc6-bnbc.dxf");

/** The ENTITIES section's entities in drawing order, each with its group codes in order. */
function entities(): Entity[] {
  const lines = readFileSync(DXF, "latin1").split(/\r?\n/);
  const found: Entity[] = [];
  let section: string | null = null;
  let current: { type: string; codes: Array<readonly [string, string]> } | null = null;
  for (let at = 0; at + 1 < lines.length; at += 2) {
    const code = (lines[at] as string).trim();
    const value = (lines[at + 1] as string).trim();
    if (code === "0") {
      if (section === "ENTITIES" && current !== null) found.push(current);
      current = { type: value, codes: [] };
      if (value === "ENDSEC") section = null;
    } else if (code === "2" && current?.type === "SECTION") section = value;
    else if (current !== null) current.codes.push([code, value]);
  }
  return found;
}

const held = entities();

function indexOf(handle: string): number {
  const at = held.findIndex((entity) => entity.codes.some(([code, value]) => code === "5" && value === handle));
  if (at < 0) throw new Error(`the fixture holds no entity ${handle}`);
  return at;
}

/** A heavy POLYLINE's vertices: the VERTEX entities after it, up to its SEQEND. */
function polyline(handle: string): Point[] {
  const ring: Point[] = [];
  for (const entity of held.slice(indexOf(handle) + 1)) {
    if (entity.type !== "VERTEX") break;
    const x = entity.codes.find(([code]) => code === "10")?.[1];
    const y = entity.codes.find(([code]) => code === "20")?.[1];
    ring.push([Number(x), Number(y)]);
  }
  return ring;
}

/** An LWPOLYLINE's points: each 10 with the 20 after it. */
function lwpolyline(handle: string): Point[] {
  const codes = (held[indexOf(handle)] as Entity).codes;
  const ring: Point[] = [];
  codes.forEach(([code, value], at) => {
    const next = codes[at + 1];
    if (code === "10" && next !== undefined && next[0] === "20") ring.push([Number(value), Number(next[1])]);
  });
  return ring;
}

/** 81D: the SOG's five points, the chamfer between the fourth and the fifth. */
export const S08_SOG: readonly Point[] = Object.freeze(polyline("81D"));

/** 830: the lift pit's four corners. */
export const S08_PIT: readonly Point[] = Object.freeze(lwpolyline("830"));

/** The view both stand in, and its scale of record. */
export const S08_VIEW = "LAYOUT_PLAN:DXF_HANDLE:2073";

/** The box S-08's view stands in, in model space: what the overlay door measures its members by. */
const S08_VIEW_BOX = Object.freeze({ min: [-1000, -401000] as Point, max: [22000, -383000] as Point });

/** The scale of record the J-000 project holds over S-08's view: DIMENSION_RATIO, 0.001 m per MODEL unit. */
const S08_FACTOR = "0.001000000000";

/**
 * The calibration the feed answers for S-08's rings on MODEL space once its view's scale is affirmed:
 * 0.001 m per unit, read in model space, and no window — the sheet's coordinates are the model's.
 */
export function s08Calibration(): SnapCalibration {
  return {
    ingestId: "s08",
    views: [{ viewKey: S08_VIEW, box: { min: [...S08_VIEW_BOX.min], max: [...S08_VIEW_BOX.max] }, factorX: S08_FACTOR, factorY: S08_FACTOR, space: "model" }],
    windows: [],
  };
}

/** Model space, as the product names its sheet. */
export const S08_MODEL_SHEET = "Model";

/**
 * The paper sheet S-08 IS in the product: a layout that shows the plan through VIEWPORT 2077 at 1:100.
 * The viewport is read from the DXF's own group codes (10/20 centre, 40/41 size, 12/22 view centre, 45
 * view height, 51 twist), never transcribed.
 */
export const S08_PAPER_SHEET = "S-08";

/** A VIEWPORT's group codes, wherever the file keeps it: a paper layout's own entities live in its block. */
function viewportCodes(handle: string): ReadonlyArray<readonly [string, string]> {
  const lines = readFileSync(DXF, "latin1").split(/\r?\n/);
  let current: Array<readonly [string, string]> | null = null;
  for (let at = 0; at + 1 < lines.length; at += 2) {
    const code = (lines[at] as string).trim();
    const value = (lines[at + 1] as string).trim();
    if (code === "0") {
      if (current !== null && current.some(([c, v]) => c === "5" && v === handle)) return current;
      current = value === "VIEWPORT" ? [] : null;
    } else if (current !== null) current.push([code, value]);
  }
  throw new Error(`the fixture holds no VIEWPORT ${handle}`);
}

function viewport(handle: string): ViewportRecord {
  const codes = viewportCodes(handle);
  const read = (code: string): number => Number(codes.find(([at]) => at === code)?.[1]);
  return {
    handle,
    on: true,
    centre: [read("10"), read("20")],
    size: [read("40"), read("41")],
    view_centre: [read("12"), read("22")],
    view_height: read("45"),
    twist: read("51"),
    clipped: false,
  };
}

/** The layout inventory of S-08 as the artifact carries it: paper, one window onto model space. */
export function s08PaperLayout(): EntityGraph["layouts"][number] {
  return { name: S08_PAPER_SHEET, kind: "paper", bbox: null, strays_rejected: 0, viewports: [viewport("2077")] };
}

/** One model ring seen on S-08's paper: the viewer's own projection through window 2077, as the manifest carries it. */
function onPaper(key: string, ring: readonly Point[]): RenderRecord {
  const window = windowsOf(s08PaperLayout())[0] as Window;
  const [projected] = projectRecord({ key, type: "LWPOLYLINE", rgb: [40, 40, 40], closed: true, points: ring.map((point) => [...point] as [number, number]) }, window);
  if (projected === undefined) throw new Error(`${key} is not seen through window 2077`);
  return projected;
}

/**
 * S-08 as the product draws it: 81D and 830 in PAPER coordinates, each named by the window that showed
 * it (`via`), the view's box as the overlay door measures it there (its model box, projected), and the
 * calibration the door answers — the stored model-space factor carried whole, and the window read off
 * the layout by the door's own `sheetWindowsOf`.
 */
export function s08Paper(o: { space?: SnapFactorSpace } = {}): { sog: RenderRecord; pit: RenderRecord; calibration: SnapCalibration } {
  const box = onPaper("VIEW", [S08_VIEW_BOX.min, [S08_VIEW_BOX.max[0], S08_VIEW_BOX.min[1]], S08_VIEW_BOX.max, [S08_VIEW_BOX.min[0], S08_VIEW_BOX.max[1]]]);
  const corners = box.points ?? [];
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  return {
    sog: onPaper("DXF_HANDLE:81D", S08_SOG),
    pit: onPaper("DXF_HANDLE:830", S08_PIT),
    calibration: {
      ingestId: "s08",
      views: [{ viewKey: S08_VIEW, box: { min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] }, factorX: S08_FACTOR, factorY: S08_FACTOR, space: o.space ?? "model" }],
      windows: sheetWindowsOf(s08PaperLayout()),
    },
  };
}
