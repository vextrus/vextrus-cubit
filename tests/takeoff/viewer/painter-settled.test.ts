/**
 * I-345 and I-346, as the painter's own loop carries them out — read off every draw call it makes
 * into a recording WebGL context, frame by frame, on a clock this suite turns.
 *
 * I-345: at rest the sheet is drawn in full, straight onto the screen, exactly as before; a sheet at
 * rest whose full frame is already on screen is not drawn again; in motion the settled frame is laid
 * down as one quad — taken first, in full, where it cannot stand for the camera — and once the camera
 * has held still for the settle the sheet is drawn in full again. I-346: the glyph atlas is uploaded
 * as alpha alone.
 *
 * The context is a stand-in, so nothing here measures a millisecond (PERF-011 does that, in the perf
 * lane): it proves which frame is drawn from what. Every expectation is derived from the product's
 * own constants and cameras (B-19).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GESTURE_SETTLE_MS, SETTLED_RESAMPLE_MAX, panCamera, zoomCameraAt } from "../../../src/modules/takeoff/viewer/client";
import { GESTURE_TAIL_MS, createPainter, type CanvasPalette, type Painter } from "../../../src/modules/takeoff/viewer/painter";
import type { Camera, RenderLayer } from "../../../src/modules/takeoff/viewer/types";
import { darkTokens } from "../../../src/ui/tokens";

/** One draw call, as the context saw it: which program, into which framebuffer, how many vertices. */
type Draw = { program: string; target: string; count: number };

/** A WebGL context that answers every question plausibly and records what it is asked to draw. */
function recordingContext(): { gl: unknown; draws: Draw[]; uploads: unknown[][] } {
  const draws: Draw[] = [];
  const uploads: unknown[][] = [];
  const sources = new Map<object, string>();
  const kinds = new Map<object, string>();
  let program = "none";
  let target = "screen";
  let made = 0;
  const handle = (kind: string): object => ({ kind, id: (made += 1) });
  const methods: Record<string, (...args: never[]) => unknown> = {
    createShader: () => handle("shader"),
    shaderSource: (shader: object, source: string) => void sources.set(shader, source),
    createProgram: () => handle("program"),
    // A program is known by its fragment stage: the settled frame samples colour, lettering samples
    // alpha, and lines sample nothing.
    attachShader: (made: object, shader: object) => {
      const source = sources.get(shader) ?? "";
      if (source.includes("gl_FragColor")) kinds.set(made, source.includes(".rgb") ? "settled" : source.includes("texture2D") ? "glyph" : "line");
    },
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getAttribLocation: (_program: object, name: string) => ["a_position", "a_colour", "a_texel"].indexOf(name),
    getUniformLocation: (_program: object, name: string) => ({ name }),
    getParameter: (name: string) => (name === "MAX_TEXTURE_SIZE" ? 8192 : name === "MAX_VIEWPORT_DIMS" ? [8192, 8192] : 0),
    createBuffer: () => handle("buffer"),
    createTexture: () => handle("texture"),
    createFramebuffer: () => handle("framebuffer"),
    checkFramebufferStatus: () => "FRAMEBUFFER_COMPLETE",
    useProgram: (used: object) => {
      program = kinds.get(used) ?? "unknown";
    },
    bindFramebuffer: (_target: string, bound: object | null) => {
      target = bound === null ? "screen" : "settled";
    },
    drawArrays: (_mode: string, _first: number, count: number) => void draws.push({ program, target, count }),
    texImage2D: (...args: never[]) => void uploads.push(args),
  };
  // Constants answer their own names, so `status === gl.FRAMEBUFFER_COMPLETE` reads as it does live.
  const gl = new Proxy(
    {},
    {
      get: (_held, name) => {
        if (typeof name !== "string") return undefined;
        if (name in methods) return methods[name];
        return /^[A-Z0-9_]+$/.test(name) ? name : () => undefined;
      },
    },
  );
  return { gl, draws, uploads };
}

/** The canvas palette as the dark theme's tokens state it — read from the token source (R-UI-001). */
const token = (name: string): string => darkTokens[name] ?? "";
const PALETTE: CanvasPalette = {
  paper: token("--canvas-paper"),
  ink: token("--canvas-ink"),
  grid: token("--canvas-grid"),
  mono: token("--font-mono"),
  selection: token("--canvas-selection"),
  hover: token("--canvas-hover"),
  pulse: token("--canvas-pulse"),
};

/** A small sheet: lines across it and one note legible at the camera below. */
const LAYER: RenderLayer = {
  name: "A-WALL",
  rgb: [200, 80, 40],
  entityCount: 3,
  records: [
    { key: "DXF_HANDLE:1", type: "LINE", rgb: [200, 80, 40], points: [[0, 0], [100, 100]] },
    { key: "DXF_HANDLE:2", type: "LWPOLYLINE", rgb: [200, 80, 40], points: [[10, 90], [90, 90], [90, 10]] },
    { key: "DXF_HANDLE:3", type: "TEXT", rgb: [200, 80, 40], text: "C1", height: 5, anchor: [40, 40] },
  ],
};
const STATE = { layerRows: () => [{ name: LAYER.name, drawn: true }] };
const STAGE = { width: 400, height: 300 };
const AT: Camera = { centre: [50, 50], scale: 3, viewport: STAGE };
const CENTRE = { x: STAGE.width / 2, y: STAGE.height / 2 };

/** One display refresh, in milliseconds — the cadence the loop is driven at here. */
const VSYNC_MS = 16;

let clock = 1000;
let queued: FrameRequestCallback[] = [];
let context: ReturnType<typeof recordingContext>;
let atlasSheet: object;
let painter: Painter;

/** One refresh: the clock moves on and every frame asked for is run. */
function refresh(): void {
  clock += VSYNC_MS;
  const due = queued;
  queued = [];
  for (const callback of due) callback(clock);
}

/** Refreshes until the loop lets go, and every draw made on the way. */
function runOut(): Draw[] {
  const from = context.draws.length;
  for (let at = 0; at < Math.ceil(GESTURE_TAIL_MS / VSYNC_MS) + 2; at += 1) refresh();
  return context.draws.slice(from);
}

/** The draws one refresh makes. */
function oneRefresh(): Draw[] {
  const from = context.draws.length;
  refresh();
  return context.draws.slice(from);
}

const onto = (draws: Draw[], target: string, program?: string): Draw[] => draws.filter((draw) => draw.target === target && (program === undefined || draw.program === program));

beforeEach(() => {
  clock = 1000;
  queued = [];
  context = recordingContext();
  atlasSheet = { width: 0, height: 0, getContext: () => ({ font: "", textBaseline: "", textAlign: "", fillText: () => undefined }) };
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.stubGlobal("document", { createElement: () => atlasSheet });
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queued.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const canvas = { clientWidth: STAGE.width, clientHeight: STAGE.height, width: 0, height: 0, getContext: () => context.gl };
  const made = createPainter(canvas as unknown as HTMLCanvasElement, PALETTE);
  expect(made, "the recording context is a context the painter accepts").not.toBeNull();
  painter = made as Painter;
  painter.upload(LAYER);
  painter.setExtents({ min: [0, 0], max: [100, 100] });
});

afterEach(() => {
  painter.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("I-345: the sheet is drawn in full at rest, from its settled frame in motion, and in full again once it settles", () => {
  test("I-345: a sheet opened at rest is drawn in full onto the screen, and a still sheet is not drawn again", () => {
    painter.draw(AT, STATE);
    const first = oneRefresh();
    expect(onto(first, "screen", "line").length, "the extents frame and the lines, on the screen").toBeGreaterThan(0);
    expect(onto(first, "screen", "glyph").length, "and the legible lettering").toBe(1);
    expect(first.filter((draw) => draw.program === "settled" || draw.target === "settled"), "no settled frame is taken or laid at rest").toEqual([]);
    expect(runOut(), "the frame on screen is the frame: nothing is drawn again while the loop runs out").toEqual([]);
  });

  test("I-345: in motion the settled frame is taken in full once, then laid down as one quad per frame", () => {
    painter.draw(AT, STATE);
    runOut();

    painter.draw(panCamera(AT, 12, 0), STATE);
    const taking = oneRefresh();
    expect(onto(taking, "settled", "line").length, "the settled frame is drawn in full, off screen").toBeGreaterThan(0);
    expect(onto(taking, "settled", "glyph").length, "lettering and all").toBe(1);
    expect(onto(taking, "screen"), "and the screen is that frame, laid down as one quad").toEqual([{ program: "settled", target: "screen", count: 6 }]);

    for (const dx of [24, 36, 48]) {
      painter.draw(panCamera(AT, dx, 0), STATE);
      expect(oneRefresh(), `a pan of ${dx} px inside the margin draws the quad and nothing else`).toEqual([{ program: "settled", target: "screen", count: 6 }]);
    }
    expect(oneRefresh(), "a refresh between events inside the settle is still a frame in motion").toEqual([{ program: "settled", target: "screen", count: 6 }]);
  });

  test("I-345: once the camera has held still for the settle, the sheet is drawn in full again — once", () => {
    painter.draw(AT, STATE);
    runOut();
    painter.draw(panCamera(AT, 12, 0), STATE);
    const movedAt = clock;
    oneRefresh();

    const after = runOut();
    const full = after.filter((draw) => draw.target === "screen" && draw.program !== "settled");
    expect(full.filter((draw) => draw.program === "glyph").length, "exactly one full frame follows the settle").toBe(1);
    expect(onto(after, "settled"), "and no settled frame is taken at rest").toEqual([]);
    // The full frame is the last thing drawn: every quad came before the settle, none after.
    const lastQuad = after.map((draw) => draw.program).lastIndexOf("settled");
    const fullAt = after.findIndex((draw) => draw.target === "screen" && draw.program !== "settled");
    expect(lastQuad, "no quad is laid down after the sheet is drawn in full").toBeLessThan(fullAt);
    expect(clock - movedAt, "and the loop ran long enough to reach the settle").toBeGreaterThan(GESTURE_SETTLE_MS);
  });

  test("I-345: a zoom past the resample limit takes the settled frame again rather than stretching it", () => {
    painter.draw(AT, STATE);
    runOut();
    // The motion begins at the open's own scale, so the frame it takes is drawn at AT's scale.
    painter.draw(panCamera(AT, 1, 0), STATE);
    expect(onto(oneRefresh(), "settled", "line").length, "the first frame in motion takes the frame").toBeGreaterThan(0);
    painter.draw(zoomCameraAt(AT, SETTLED_RESAMPLE_MAX, CENTRE), STATE);
    expect(onto(oneRefresh(), "settled"), "within the limit the frame stands").toEqual([]);
    painter.draw(zoomCameraAt(AT, SETTLED_RESAMPLE_MAX * 1.1, CENTRE), STATE);
    expect(onto(oneRefresh(), "settled", "line").length, "past it the frame is taken again, in full").toBeGreaterThan(0);
  });

  test("I-345: a sheet that changed while in motion is never laid down from the frame of the old one", () => {
    painter.draw(AT, STATE);
    runOut();
    painter.draw(panCamera(AT, 12, 0), STATE);
    oneRefresh();
    painter.upload({ ...LAYER, records: LAYER.records.slice(0, 1) });
    painter.draw(panCamera(AT, 24, 0), STATE);
    expect(onto(oneRefresh(), "settled", "line").length, "a layer arriving takes the frame again").toBeGreaterThan(0);
  });

  test("I-345: the frames of a gesture are the frames the ledger reads", () => {
    painter.draw(AT, STATE);
    runOut();
    for (let step = 1; step <= 8; step += 1) {
      painter.draw(panCamera(AT, step * 4, 0), STATE);
      oneRefresh();
    }
    expect(painter.frameStats().medianMs, "one refresh a frame").toBe(VSYNC_MS);
  });
});

describe("I-346: the glyph atlas is uploaded as alpha alone", () => {
  test("I-346: the atlas the lettering samples is an ALPHA texture of the lettered sheet", () => {
    const atlas = context.uploads.filter((args) => args[args.length - 1] === atlasSheet);
    expect(atlas.length, "the sheet is uploaded once").toBe(1);
    expect(atlas[0]?.slice(2, 5), "internal format, format and type").toEqual(["ALPHA", "ALPHA", "UNSIGNED_BYTE"]);
  });
});

describe("I-661: the painter says which camera the frame on screen was drawn at", () => {
  test("nothing before the first frame, then the camera of the frame drawn — the box a screen publishes beside the canvas's own", () => {
    expect(painter.frameCamera(), "no frame, no camera").toBeNull();
    painter.draw(AT, STATE);
    runOut();
    expect(painter.frameCamera(), "the frame on screen was drawn at the camera asked for").toEqual(AT);
    const narrower: Camera = { ...AT, viewport: { width: STAGE.width - 320, height: STAGE.height } };
    painter.draw(narrower, STATE);
    runOut();
    expect(painter.frameCamera()?.viewport, "and a new box is a new frame, reported as drawn").toEqual(narrower.viewport);
  });
});
