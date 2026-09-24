/**
 * I-684, as the painter carries it out: a scan handed to it is one textured quad at the corners
 * its record states, drawn under every layer — in the frame at rest and in the settled frame a camera
 * in motion is laid from — toned between the canvas's paper and ink; a drawn sheet, handed none,
 * draws exactly what it drew before.
 *
 * Read off every call the painter makes into a recording WebGL context (the stand-in
 * painter-settled.test.ts uses, taught to tell the scan's program apart), frame by frame on a clock
 * this suite turns. Every expectation is derived from the product's own constants and cameras (B-19).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { panCamera } from "../../../src/modules/takeoff/viewer/client";
import { unitChannelsOf } from "../../../src/modules/takeoff/viewer/colour-notation";
import { BACKDROP_STRENGTH, GESTURE_TAIL_MS, createPainter, type CanvasPalette, type Painter } from "../../../src/modules/takeoff/viewer/painter";
import type { Camera, RenderLayer } from "../../../src/modules/takeoff/viewer/types";
import { darkTokens } from "../../../src/ui/tokens";

type Draw = { program: string; target: string; count: number; texture: number | null; quad: number[] | null };

function recordingContext(): { gl: unknown; draws: Draw[]; uploads: unknown[][]; uniforms: Map<string, number[]> } {
  const draws: Draw[] = [];
  const uploads: unknown[][] = [];
  const uniforms = new Map<string, number[]>();
  const sources = new Map<object, string>();
  const kinds = new Map<object, string>();
  const data = new Map<object, number[]>();
  let program = "none";
  let target = "screen";
  let texture: number | null = null;
  let buffer: object | null = null;
  let position: object | null = null;
  let made = 0;
  const handle = (kind: string): { kind: string; id: number } => ({ kind, id: (made += 1) });
  const methods: Record<string, (...args: never[]) => unknown> = {
    createShader: () => handle("shader"),
    shaderSource: (shader: object, source: string) => void sources.set(shader, source),
    createProgram: () => handle("program"),
    attachShader: (made: object, shader: object) => {
      const source = sources.get(shader) ?? "";
      if (!source.includes("gl_FragColor")) return;
      kinds.set(made, source.includes("u_strength") ? "backdrop" : source.includes(".rgb") ? "settled" : source.includes("texture2D") ? "glyph" : "line");
    },
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getAttribLocation: (_program: object, name: string) => ["a_position", "a_colour", "a_texel"].indexOf(name),
    getUniformLocation: (_program: object, name: string) => ({ name }),
    getParameter: (name: string) => (name === "MAX_TEXTURE_SIZE" ? 8192 : name === "MAX_VIEWPORT_DIMS" ? [8192, 8192] : 0),
    createBuffer: () => handle("buffer"),
    bindBuffer: (_target: string, bound: object | null) => {
      buffer = bound;
    },
    bufferData: (_target: string, values: Float32Array) => {
      if (buffer !== null) data.set(buffer, [...values]);
    },
    vertexAttribPointer: (at: number) => {
      if (at === 0) position = buffer;
    },
    createTexture: () => handle("texture"),
    bindTexture: (_target: string, bound: { id: number } | null) => {
      texture = bound?.id ?? null;
    },
    createFramebuffer: () => handle("framebuffer"),
    checkFramebufferStatus: () => "FRAMEBUFFER_COMPLETE",
    useProgram: (used: object) => {
      program = kinds.get(used) ?? "unknown";
    },
    bindFramebuffer: (_target: string, bound: object | null) => {
      target = bound === null ? "screen" : "settled";
    },
    uniform3f: (at: { name: string }, x: number, y: number, z: number) => void uniforms.set(`${program}:${at.name}`, [x, y, z]),
    uniform1f: (at: { name: string }, x: number) => void uniforms.set(`${program}:${at.name}`, [x]),
    drawArrays: (_mode: string, _first: number, count: number) =>
      void draws.push({ program, target, count, texture: program === "backdrop" ? texture : null, quad: program === "backdrop" && position !== null ? (data.get(position) ?? null) : null }),
    texImage2D: (...args: never[]) => void uploads.push(args),
  };
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
  return { gl, draws, uploads, uniforms };
}

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

/** The traced lines of a scanned page, on their own layer. */
const TRACE: RenderLayer = {
  name: "TRACE",
  rgb: [0, 0, 0],
  entityCount: 2,
  records: [
    { key: "RASTER_TRACE:a", type: "LINE", rgb: [0, 0, 0], points: [[10, 10], [90, 10]] },
    { key: "RASTER_TRACE:b", type: "LINE", rgb: [0, 0, 0], points: [[50, 0], [50, 100]] },
  ],
};
const STATE = { layerRows: () => [{ name: TRACE.name, drawn: true }] };
const STAGE = { width: 400, height: 300 };
const AT: Camera = { centre: [50, 50], scale: 3, viewport: STAGE };
/** The scan's four corners, top-left first, as its record states them (I-584). */
const PLACEMENT: [number, number][] = [
  [0, 100],
  [100, 100],
  [100, 0],
  [0, 0],
];
const IMAGE = { width: 64, height: 64 } as unknown as TexImageSource;
const VSYNC_MS = 16;

let clock = 1000;
let queued: FrameRequestCallback[] = [];
let context: ReturnType<typeof recordingContext>;
let painter: Painter;

function refresh(): void {
  clock += VSYNC_MS;
  const due = queued;
  queued = [];
  for (const callback of due) callback(clock);
}

function oneRefresh(): Draw[] {
  const from = context.draws.length;
  refresh();
  return context.draws.slice(from);
}

function runOut(): void {
  for (let at = 0; at < Math.ceil(GESTURE_TAIL_MS / VSYNC_MS) + 2; at += 1) refresh();
}

beforeEach(() => {
  clock = 1000;
  queued = [];
  context = recordingContext();
  const atlasSheet = { width: 0, height: 0, getContext: () => ({ font: "", textBaseline: "", textAlign: "", fillText: () => undefined }) };
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.stubGlobal("document", { createElement: () => atlasSheet });
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queued.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const canvas = { clientWidth: STAGE.width, clientHeight: STAGE.height, width: 0, height: 0, getContext: () => context.gl };
  painter = createPainter(canvas as unknown as HTMLCanvasElement, PALETTE) as Painter;
  expect(painter).not.toBeNull();
  painter.upload(TRACE);
  painter.setExtents({ min: [0, 0], max: [100, 100] });
});

afterEach(() => {
  painter.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("I-684: the scan is painted under its trace", () => {
  test("a drawn sheet, handed no scan, draws no scan and nothing else new", () => {
    painter.setBackdrops([]);
    painter.draw(AT, STATE);
    const drawn = oneRefresh();
    expect(drawn.filter((draw) => draw.program === "backdrop")).toEqual([]);
    expect(drawn.map((draw) => draw.program), "the extents frame and the traced lines, as before").toEqual(["line", "line"]);
  });

  test("the scan is one quad at its stated corners, uploaded once, drawn first — under the extents frame and every layer", () => {
    painter.setBackdrops([{ image: IMAGE, placement: PLACEMENT }]);
    expect(context.uploads.filter((upload) => upload.includes(IMAGE as never)), "the picture is uploaded as a texture once").toHaveLength(1);
    painter.draw(AT, STATE);
    const drawn = oneRefresh();
    expect(drawn.map((draw) => draw.program), "the scan, then the frame, then the traced lines").toEqual(["backdrop", "line", "line"]);
    const [scan] = drawn;
    expect(scan?.count, "two triangles").toBe(6);
    const [topLeft, topRight, bottomRight, bottomLeft] = PLACEMENT;
    expect(scan?.quad, "top-left, top-right, bottom-right; top-left, bottom-right, bottom-left").toEqual([...(topLeft ?? []), ...(topRight ?? []), ...(bottomRight ?? []), ...(topLeft ?? []), ...(bottomRight ?? []), ...(bottomLeft ?? [])]);
  });

  test("it is toned between the canvas's own paper and ink, at the stated strength", () => {
    painter.setBackdrops([{ image: IMAGE, placement: PLACEMENT }]);
    painter.draw(AT, STATE);
    oneRefresh();
    const close = (actual: number[] | undefined, expected: readonly number[]): void => {
      expect(actual).toHaveLength(expected.length);
      expected.forEach((value, index) => expect(actual?.[index]).toBeCloseTo(value, 6));
    };
    close(context.uniforms.get("backdrop:u_paper"), unitChannelsOf(PALETTE.paper));
    close(context.uniforms.get("backdrop:u_ink"), unitChannelsOf(PALETTE.ink));
    close(context.uniforms.get("backdrop:u_strength"), [BACKDROP_STRENGTH]);
  });

  test("the settled frame a moving camera is laid from holds the scan too, and a scan wholly out of view is not sent", () => {
    painter.setBackdrops([{ image: IMAGE, placement: PLACEMENT }]);
    painter.draw(AT, STATE);
    runOut();
    painter.draw(panCamera(AT, 12, 0), STATE);
    const taking = oneRefresh();
    expect(taking.filter((draw) => draw.target === "settled").map((draw) => draw.program)[0], "the settled frame is drawn scan first").toBe("backdrop");

    painter.setBackdrops([{ image: IMAGE, placement: PLACEMENT.map(([x, y]) => [x + 10_000, y] as [number, number]) }]);
    runOut();
    const from = context.draws.length;
    painter.draw({ ...AT, centre: [50, 60] }, STATE);
    runOut();
    const away = context.draws.slice(from).filter((draw) => draw.target === "screen" && draw.program !== "settled");
    expect(away.length, "the sheet was drawn in full again").toBeGreaterThan(0);
    expect(away.filter((draw) => draw.program === "backdrop"), "and the scan, out of view, was not sent").toEqual([]);
  });
});
