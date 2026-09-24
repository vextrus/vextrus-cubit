/**
 * `ViewerScreen` mounted over S-08's two rings (the SOG outline 81D and the lift pit 830, read from the
 * committed DXF by `./s08.ts`), in a stated 800 × 600 box, with the scale of record the J-000 project
 * holds over S-08's view (0.001 m per unit) — so a case drives the armed tools exactly as a QS's hand
 * and keyboard do: a hover, a press, a release and the click that follows, and the keys on the canvas.
 *
 * The scale doors and the partition feed are stand-ins with the route's own shapes: a case states which
 * views no act names (the absence the hatch and the refusal read) and whether the reader holds MEASURE.
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { expect, vi } from "vitest";
import { fitCamera, worldAt } from "@/modules/takeoff/viewer/client";
import { TESTIDS } from "@/ui/testids";
import { installInertResizeObserver } from "../../viewer/support/viewer-support";
import type { SnapFactorSpace } from "@/modules/takeoff/viewer-snap/types";
import { S08_MODEL_SHEET, S08_PAPER_SHEET, S08_PIT, S08_SOG, S08_VIEW, s08Calibration, s08Paper } from "./s08";
import { memoryChest } from "../../manual/support/chest-doors";
import type { ChestDoors } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/measure-chest";
import type { CardDoors } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/measure-card";

type Point = readonly [number, number];

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const DRAWING = "33333333-3333-4333-8333-333333333333";
const STAGE = Object.freeze({ width: 800, height: 600 });
const EXTENTS = Object.freeze({ min: [-1000, -401000] as [number, number], max: [22000, -383000] as [number, number] });
const RGB: [number, number, number] = [40, 40, 40];

/** The source keys the two rings are drawn under, as the snap meets them. */
export const SOG_KEY = "DXF_HANDLE:81D";
export const PIT_KEY = "DXF_HANDLE:830";

/**
 * The sheet a case is mounted over: its name, its world box, its two rings as the manifest carries
 * them, and the calibration the door answers for it.
 * - MODEL space: the rings at the DXF's own coordinates, no window;
 * - S-08 as the product draws it (`paper`): the rings projected through viewport 2077 at 1:100 by the
 *   viewer's own projection, each naming the window it was seen through (`via`), the view's box on the
 *   paper, and the window the door reads off the layout.
 */
type Staged = {
  readonly layoutName: string;
  readonly extents: { readonly min: Point; readonly max: Point };
  readonly records: readonly [Record<string, unknown>, Record<string, unknown>];
  readonly calibration: ReturnType<typeof s08Calibration>;
};

function staged(o: { paper?: boolean; space?: SnapFactorSpace }): Staged {
  if (o.paper !== true) {
    return {
      layoutName: S08_MODEL_SHEET,
      extents: EXTENTS,
      records: [
        { key: SOG_KEY, type: "POLYLINE", rgb: RGB, closed: true, points: S08_SOG.map((point) => [...point]) },
        { key: PIT_KEY, type: "LWPOLYLINE", rgb: RGB, closed: true, points: S08_PIT.map((point) => [...point]) },
      ],
      calibration: s08Calibration(),
    };
  }
  const { sog, pit, calibration } = s08Paper({ space: o.space });
  const frame = calibration.windows[0]?.frame ?? { min: EXTENTS.min, max: EXTENTS.max };
  return { layoutName: S08_PAPER_SHEET, extents: frame, records: [{ ...sog }, { ...pit }], calibration };
}

/** The head the feed answers for a staged sheet. */
function head(sheet: Staged): Record<string, unknown> {
  return {
    kind: "manifest",
    cache: "miss",
    facts: {},
    manifest: {
      version: 1,
      layoutName: sheet.layoutName,
      extents: { min: [...sheet.extents.min], max: [...sheet.extents.max] },
      insunits: { code: 4, unit: "mm", unmapped: false },
      digest: "measure-support",
      layers: [
        { name: "Slab", rgb: RGB, entityCount: 1, records: [sheet.records[0]] },
        { name: "Foundation", rgb: RGB, entityCount: 1, records: [sheet.records[1]] },
      ],
    },
  };
}

function stubbedBox(): DOMRect {
  const box = { x: 0, y: 0, left: 0, top: 0, right: STAGE.width, bottom: STAGE.height, width: STAGE.width, height: STAGE.height };
  return { ...box, toJSON: () => box } as DOMRect;
}

function stubBrowser(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ media: query, matches: false, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => true }),
  });
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto["setPointerCapture"] ??= function setPointerCapture(): void {};
  proto["releasePointerCapture"] ??= function releasePointerCapture(): void {};
  proto["hasPointerCapture"] ??= function hasPointerCapture(): boolean {
    return false;
  };
  installInertResizeObserver();
}

let restore: (() => void) | null = null;

export function unmountMeasure(): void {
  cleanup();
  vi.unstubAllGlobals();
  restore?.();
  restore = null;
}

export type MeasureMount = {
  screen: HTMLElement;
  canvas: HTMLElement;
  /** An element of the mount by its test id — the registry's own spelling, handed in by the case. */
  one: (testid: string) => HTMLElement | null;
  all: (testid: string) => HTMLElement[];
  /** Where a world point stands in the mount's client pixels, through the shipped projection. */
  pxOf: (world: Point) => { x: number; y: number };
};

/**
 * The screen over S-08. `unscaled` names S-08's view as one no act names (the partition draws it, the
 * scale door declares its absence); `denied` has the scale door refuse the reader PERMISSION_NOT_HELD;
 * `paper` mounts S-08 as the product draws it, through viewport 2077, with its view's factor read in
 * `space` (model, the DIMENSION_RATIO J-000 holds, unless a case says otherwise). `chest` is the
 * condition chest's doors — an empty chest in memory unless a case hands its own, so no mount reaches
 * a server (S5). `card` is the card's three doors (S6); a case that finishes a shape under a condition
 * hands its own, so no card reaches a server either.
 */
export async function mountMeasure(o: { unscaled?: boolean; denied?: boolean; paper?: boolean; space?: SnapFactorSpace; chest?: ChestDoors; card?: CardDoors } = {}): Promise<MeasureMount> {
  stubBrowser();
  const original = Element.prototype.getBoundingClientRect;
  const context = HTMLCanvasElement.prototype.getContext;
  Element.prototype.getBoundingClientRect = stubbedBox;
  // jsdom draws nothing: a canvas answers no context, as a browser with no canvas would, and the
  // layer says what it holds through its hooks, never its pixels.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  restore = () => {
    Element.prototype.getBoundingClientRect = original;
    HTMLCanvasElement.prototype.getContext = context;
  };

  const sheet = staged(o);
  const box = sheet.calibration.views[0]?.box ?? { min: sheet.extents.min, max: sheet.extents.max };
  const overlay = {
    ingestId: "s08",
    views: [{ viewKey: S08_VIEW, type: "LAYOUT_PLAN", reason: null, caption: "GRADE BEAM LAYOUT & GF SLAB ON GRADE", anchorKey: null, proposed: null, confirmed: null, entityCount: 2, box }],
    axes: [],
    deferrals: [],
  };
  vi.stubGlobal("fetch", async (url: string) => {
    const body = String(url).includes("part=partition") ? { overlay } : {};
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
  const views = [{ viewKey: S08_VIEW, type: "LAYOUT_PLAN", caption: "GRADE BEAM LAYOUT & GF SLAB ON GRADE", proposals: [], affirmed: null, refusal: o.unscaled === true ? "SCALE_NO_EVIDENCE" : null }];
  const scale = {
    read: async () => (o.denied === true ? { read: false, refusal: "PERMISSION_NOT_HELD" } : { read: true, views, tolerances: { anisotropy: "0.01", verification: "0.01" } }),
    preview: async () => ({ previewed: false, refusal: "PERMISSION_NOT_HELD" }),
    commit: async () => ({ committed: false, refusal: "PERMISSION_NOT_HELD" }),
  };

  const { ViewerScreen } = await import("../../../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-screen");
  const props = { tenantId: TENANT, projectId: PROJECT, drawingId: DRAWING, layoutName: sheet.layoutName, initialViewport: null, initialSelection: null, head: head(sheet), calibration: sheet.calibration, scale, chest: o.chest ?? memoryChest({ canAuthor: o.denied !== true }), ...(o.card === undefined ? {} : { card: o.card }) };
  const view = render(createElement(ViewerScreen as never, props as never));
  const screen = await waitFor(() => view.getByTestId(TESTIDS.viewer.screen));
  const canvas = screen.querySelector<HTMLElement>(`[data-testid="${TESTIDS.viewer.canvas}"]`) as HTMLElement;
  const camera = fitCamera({ min: [...sheet.extents.min], max: [...sheet.extents.max] }, { ...STAGE });
  await waitFor(() => expect(Number(screen.querySelector(`[data-testid="${TESTIDS.viewer.status}"]`)?.getAttribute("data-scale"))).toBeCloseTo(camera.scale, 6));
  const origin = worldAt(camera, { x: 0, y: 0 });
  const unit = worldAt(camera, { x: 1, y: 1 });
  return {
    screen,
    canvas,
    one: (testid) => document.querySelector<HTMLElement>(`[data-testid="${testid}"]`),
    all: (testid) => [...document.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)],
    pxOf: (world) => ({ x: (world[0] - origin[0]) / (unit[0] - origin[0]), y: (world[1] - origin[1]) / (unit[1] - origin[1]) }),
  };
}

/** The pointer moved onto a world point. */
export async function hover(mount: MeasureMount, world: Point, o: { shiftKey?: boolean } = {}): Promise<void> {
  const at = mount.pxOf(world);
  await act(async () => {
    fireEvent.pointerMove(mount.canvas, { clientX: at.x, clientY: at.y, pointerId: 1, pointerType: "mouse", shiftKey: o.shiftKey === true, bubbles: true });
  });
}

/**
 * A click at a world point as a browser delivers one: the pointer comes to it, is pressed, released,
 * and the click that follows carries its count — 2 for a double-click's second click.
 */
export async function click(mount: MeasureMount, world: Point, o: { detail?: number; shiftKey?: boolean; altKey?: boolean } = {}): Promise<void> {
  await hover(mount, world, o);
  const at = mount.pxOf(world);
  const shared = { clientX: at.x, clientY: at.y, pointerId: 1, pointerType: "mouse", button: 0, shiftKey: o.shiftKey === true, altKey: o.altKey === true, bubbles: true };
  await act(async () => {
    fireEvent.pointerDown(mount.canvas, shared);
    fireEvent.pointerUp(mount.canvas, shared);
    fireEvent.click(mount.canvas, { ...shared, detail: o.detail ?? 1 });
  });
}

/** A press and a drag well past the drag tolerance, and its release: a pan. */
export async function drag(mount: MeasureMount, from: Point, byPx: { x: number; y: number }): Promise<void> {
  const at = mount.pxOf(from);
  const start = { clientX: at.x, clientY: at.y, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true };
  const end = { ...start, clientX: at.x + byPx.x, clientY: at.y + byPx.y };
  await act(async () => {
    fireEvent.pointerDown(mount.canvas, start);
    fireEvent.pointerMove(mount.canvas, end);
    fireEvent.pointerUp(mount.canvas, end);
    fireEvent.click(mount.canvas, { ...end, detail: 1 });
  });
}

/** One key pressed on the sheet, as a keyboard reaches it. */
export async function key(mount: MeasureMount, init: { key: string; shiftKey?: boolean; ctrlKey?: boolean }): Promise<void> {
  await act(async () => {
    fireEvent.keyDown(mount.canvas, { ...init, bubbles: true });
    fireEvent.keyUp(mount.canvas, { ...init, bubbles: true });
  });
}
