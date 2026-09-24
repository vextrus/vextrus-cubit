/**
 * How a text is lettered on the sheet (`src/modules/takeoff/viewer/lettering.ts`, Decision
 * I-462): glyphs at the record's own cap height and the face's own advance, the run turned by
 * the text's world rotation, and its anchor standing where the drawing sets it. And the viewer's one
 * world box of a text — the box a hit-test, a marquee, a selection mark and a fly-to meet — is that
 * lettering's outline, not the single point it was set at (`client.ts`, B-17).
 *
 * Every figure is derived from the face the test hands in, so nothing here depends on a font but the
 * one test that holds the nominal face to the vendored mono file's own figures. The
 * painter's half — the atlas that measures its face, and the quads it lays from this lettering — is
 * read off a recording WebGL context and a stand-in canvas whose metrics are stated below.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LETTERED_TEXT_PX, buildSpatialIndex, hitTest, isTextLettered, recordBox } from "../../../src/modules/takeoff/viewer/client";
import { DRAWN_ADVANCE, MONO_UNITS, NOMINAL_FACE, letter, letteredBox, type Advance, type Face, type GlyphShape } from "../../../src/modules/takeoff/viewer/lettering";
import { createPainter, type CanvasPalette, type Painter } from "../../../src/modules/takeoff/viewer/painter";
import type { Camera, RenderRecord } from "../../../src/modules/takeoff/viewer/types";
import { darkTokens } from "../../../src/ui/tokens";

/** A face with round numbers: every character advances 1 cap height, its ink 0.1 in from each side, capitals only. */
const INK: GlyphShape = { advance: 1, left: 0.1, right: 0.9, ascent: 1, descent: 0 };
const BLANK: GlyphShape = { advance: 1, left: 0, right: 0, ascent: 0, descent: 0 };
const FACE: Face = { shapeOf: (character) => (character === " " ? BLANK : INK), descent: 0.25 };
/** The same round numbers as the drawn advance (I-648): each line runs exactly as long as the face letters it, so the placement arithmetic below is read in whole cap heights. */
const FACE_ADVANCE: Advance = (character) => FACE.shapeOf(character).advance;

type Quad = { character: string; corners: number[] };

/** Every glyph a record is lettered as, and the lettering. */
function lettered(record: RenderRecord, face: Face = FACE): { quads: Quad[]; outline: (readonly [number, number])[]; height: number } {
  const quads: Quad[] = [];
  const made = letter(record, face, (character, corners) => quads.push({ character, corners: [...corners] }), FACE_ADVANCE);
  expect(made, "the record letters").not.toBeNull();
  return { quads, outline: [...(made?.outline ?? [])], height: made?.height ?? 0 };
}

const text = (fields: Partial<RenderRecord>): RenderRecord => ({ key: "DXF_HANDLE:1", type: "TEXT", rgb: [0, 0, 0], text: "C1", height: 10, anchor: [100, 200], ...fields });

function expectPoint(actual: readonly number[], expected: readonly [number, number], what: string): void {
  expect(actual[0], `${what} x`).toBeCloseTo(expected[0], 9);
  expect(actual[1], `${what} y`).toBeCloseTo(expected[1], 9);
}

describe("a glyph stands at the record's own cap height and the face's own advance", () => {
  test("a square text left on its baseline: the first capital's ink rises exactly one height from the anchor's baseline", () => {
    const { quads, height } = lettered(text({}));
    expect(quads.map((quad) => quad.character)).toEqual(["C", "1"]);
    expect(height, "the cap height it is drawn at is the record's").toBe(10);
    // Bottom left, bottom right, top right, top left of C's ink: 1 to 9 along, 0 to 10 up.
    expect(quads[0]?.corners).toEqual([101, 200, 109, 200, 109, 210, 101, 210]);
    expect(quads[1]?.corners.slice(0, 2), "the next glyph starts one advance on — no tracking added").toEqual([111, 200]);
  });

  test("a space is an advance with no quad, and what the text SHOWS is lettered — %%C is one glyph, Ø", () => {
    const { quads } = lettered(text({ text: "8-16%%C A" }));
    expect(quads.map((quad) => quad.character).join("")).toBe("8-16ØA");
    expect(quads[5]?.corners[0], "A stands after the space's advance").toBeCloseTo(100 + 6 * 10 + 1, 9);
  });

  test("the nominal face is the product's mono face by the file's own figures — the box the index reads is the box the painter letters", () => {
    const font = readFileSync(join(process.cwd(), "src/ui/fonts/spline-sans-mono-regular.ttf"));
    const tables = new Map<string, number>();
    for (let at = 0; at < font.readUInt16BE(4); at += 1) tables.set(font.toString("latin1", 12 + at * 16, 16 + at * 16), font.readUInt32BE(20 + at * 16));
    const unitsPerEm = font.readUInt16BE((tables.get("head") ?? 0) + 18);
    // A monospace's pitch is the advance nearly every glyph in its `hmtx` takes.
    const hhea = tables.get("hhea") ?? 0;
    const hmtx = tables.get("hmtx") ?? 0;
    const counts = new Map<number, number>();
    for (let at = 0; at < font.readUInt16BE(hhea + 34); at += 1) {
      const width = font.readUInt16BE(hmtx + at * 4);
      if (width > 0) counts.set(width, (counts.get(width) ?? 0) + 1);
    }
    const [advance] = [...counts.entries()].reduce((best, next) => (next[1] > best[1] ? next : best));
    const capHeight = font.readInt16BE((tables.get("OS/2") ?? 0) + 88);
    const typoDescender = -font.readInt16BE((tables.get("OS/2") ?? 0) + 70);
    expect([unitsPerEm, capHeight, advance], "Spline Sans Mono: 2000 to the em, a capital 1454, every character 1200 across").toEqual([2000, MONO_UNITS.cap, MONO_UNITS.advance]);
    const shape = NOMINAL_FACE.shapeOf("W");
    expect(shape.advance, "a character advances 0.825 of a cap, never the 6/7 a generic monospace would").toBeCloseTo(advance / capHeight, 12);
    expect(shape.ascent, "its capitals are the cap height").toBe(1);
    expect(NOMINAL_FACE.descent, "its descenders reach a j's ink, within the face's own descender").toBeLessThanOrEqual(typoDescender / capHeight);
    expect(NOMINAL_FACE.descent).toBeGreaterThan(0.3);
  });
});

describe("the anchor stands where the drawing sets it", () => {
  test("centred on the middle: the run is centred on the anchor, and the capitals straddle it", () => {
    const { outline, quads } = lettered(text({ justify: { x: "centre", y: "middle" } }));
    // Two glyphs of 10 across: the run spans 90 to 110; the cap height spans 195 to 205.
    expectPoint(outline[0] as readonly [number, number], [90, 195 - 2.5], "the block's bottom left, descenders included");
    expectPoint(outline[2] as readonly [number, number], [110, 205], "its top right");
    expect(quads[0]?.corners.slice(0, 2), "C sits half the run left of the anchor, never starting at it").toEqual([91, 195]);
  });

  test("right on the top, and at the bottom of the descenders", () => {
    const top = lettered(text({ justify: { x: "right", y: "top" } }));
    expectPoint(top.outline[2] as readonly [number, number], [100, 200], "the run ends at the anchor, and its cap top is there");
    const bottom = lettered(text({ justify: { x: "left", y: "bottom" } }));
    expectPoint(bottom.outline[0] as readonly [number, number], [100, 200], "the descenders stand on the anchor");
    expect(bottom.quads[0]?.corners[1], "so the baseline is a descent above it").toBeCloseTo(202.5, 9);
  });

  test("an MTEXT attached top left: its first capitals hang from the anchor, and each paragraph stands five thirds of a height lower", () => {
    const { quads, outline } = lettered(text({ type: "MTEXT", text: "AB\\PCD", justify: { x: "left", y: "top" } }));
    expect(quads.map((quad) => quad.character)).toEqual(["A", "B", "C", "D"]);
    expect(quads[0]?.corners[7], "A's cap top is the anchor").toBeCloseTo(200, 9);
    expect(quads[0]?.corners[1], "A's baseline is one height below it").toBeCloseTo(190, 9);
    expect(quads[2]?.corners[1], "C's baseline one line pitch below that").toBeCloseTo(190 - (10 * 5) / 3, 9);
    expectPoint(outline[0] as readonly [number, number], [100, 190 - (10 * 5) / 3 - 2.5], "the block reaches the last line's descenders");
  });

  test("an MTEXT set on its middle centres the block, first cap top to last baseline, on the anchor", () => {
    const { quads } = lettered(text({ type: "MTEXT", text: "A\\PB", justify: { x: "centre", y: "middle" } }));
    const capTop = quads[0]?.corners[7] ?? 0;
    const lastBaseline = quads[1]?.corners[1] ?? 0;
    expect((capTop + lastBaseline) / 2).toBeCloseTo(200, 9);
  });
});

describe("the run is turned by the text's world rotation", () => {
  test("a mark turned 90° runs up the sheet — along its beam — its capitals leaning left of the run", () => {
    const { quads, outline } = lettered(text({ text: "2B", rotation: 90 }));
    // Along the run is +y; up the letters is −x.
    expect(quads[0]?.corners[0]).toBeCloseTo(100, 9);
    expect(quads[0]?.corners[1], "the first glyph's ink starts 1 up the run").toBeCloseTo(201, 9);
    expect(quads[0]?.corners[4], "its top is a height to the left").toBeCloseTo(90, 9);
    expect(quads[1]?.corners[1], "the second glyph stands one advance further up").toBeCloseTo(211, 9);
    const box = letteredBox(text({ text: "2B", rotation: 90 }), FACE, FACE_ADVANCE);
    expect(box, "the world box of a turned mark is tall, not wide").toEqual([90, 200, 102.5, 220]);
    expect(outline.length).toBe(4);
  });

  test("a turned, centred mark is centred on its anchor along its own run", () => {
    const box = letteredBox(text({ text: "2B7", rotation: 90, justify: { x: "centre", y: "middle" } }), FACE, FACE_ADVANCE) ?? [0, 0, 0, 0];
    expect((box[1] + box[3]) / 2, "centred up the sheet").toBeCloseTo(200, 9);
  });

  test("an aligned text runs exactly from its anchor to its second point, turned along them, its height scaled", () => {
    const { quads, height } = lettered(text({ text: "AB", anchor: [0, 0], fit: { to: [30, 40], height: "scaled" } }));
    // Natural run 20, distance 50: everything is 2.5 times, and the turn is atan2(40, 30).
    expect(height).toBeCloseTo(25, 9);
    const last = quads[1]?.corners ?? [];
    const end = 0.9 * 25 + 25; // B's ink right edge along the run
    expect(last[2]).toBeCloseTo((end * 3) / 5, 9);
    expect(last[3]).toBeCloseTo((end * 4) / 5, 9);
  });

  test("a fitted text keeps its height and stretches its advances", () => {
    const { quads, height } = lettered(text({ text: "AB", anchor: [0, 0], fit: { to: [40, 0], height: "kept" } }));
    expect(height).toBe(10);
    expect(quads[1]?.corners[2], "B's ink ends 0.9 of its stretched advance past the first").toBeCloseTo(20 + 0.9 * 20, 9);
    expect(quads[1]?.corners[5], "and stands the height it was written at").toBeCloseTo(10, 9);
  });

  test("nothing letters where there is no text, no anchor or no height", () => {
    expect(letter({ ...text({}), height: 0 }, FACE)).toBeNull();
    expect(letter({ key: "DXF_HANDLE:2", type: "LINE", rgb: [0, 0, 0], points: [[0, 0], [1, 1]] }, FACE)).toBeNull();
    const unplaced = Object.fromEntries(Object.entries(text({})).filter(([field]) => field !== "anchor")) as RenderRecord;
    expect(letter(unplaced, FACE)).toBeNull();
  });
});

describe("the viewer's one world box of a text is its lettering, not its point (B-17)", () => {
  test("recordBox of a text is the box its lettering stands in", () => {
    const record = text({ text: "C2", justify: { x: "centre", y: "middle" } });
    const box = recordBox(record);
    const lettered = letteredBox(record);
    expect(box, "a query, a selection row and a fly-to read the lettered box").toEqual({ min: [lettered?.[0], lettered?.[1]], max: [lettered?.[2], lettered?.[3]] });
    expect((box?.max[0] ?? 0) - (box?.min[0] ?? 0), "which has the run's width").toBeGreaterThan(10);
  });

  test("a pick on the words finds the text, though it is far from the point the text was set at", () => {
    const record = text({ text: "FLOATING COLUMN", height: 2 });
    const index = buildSpatialIndex({ layers: [{ name: "Text-1", rgb: [0, 0, 0], entityCount: 1, records: [record] }] });
    const box = letteredBox(record) ?? [0, 0, 0, 0];
    const onTheWords: [number, number] = [box[2] - 1, (box[1] + box[3]) / 2];
    expect(Math.hypot(onTheWords[0] - 100, onTheWords[1] - 200), "the pick is a whole run away from the anchor").toBeGreaterThan(20);
    expect(hitTest(index, onTheWords, 0.5)).toEqual(["DXF_HANDLE:1"]);
    expect(hitTest(index, [box[2] + 5, box[3] + 5], 0.5), "and a pick beside it finds nothing").toEqual([]);
  });

  test("a line drawn through the lettering under the pointer is met before the words it crosses", () => {
    const note = text({ key: "DXF_HANDLE:5", text: "N12345", height: 100, anchor: [0, 0] });
    const line: RenderRecord = { key: "DXF_HANDLE:6", type: "LINE", rgb: [0, 0, 0], points: [[0, 50], [400, 50]] };
    const index = buildSpatialIndex({ layers: [{ name: "SYN-00", rgb: [0, 0, 0], entityCount: 2, records: [note, line] }] });
    expect(hitTest(index, [150, 50.2], 1), "on the line, inside the note: the line first, the note still answers").toEqual(["DXF_HANDLE:6", "DXF_HANDLE:5"]);
    expect(hitTest(index, [150, 80], 1), "on the words away from the line: the note alone").toEqual(["DXF_HANDLE:5"]);
  });

  /** The hover's reach at S-01's fit: 4 px at 1.2 px per unit, so a pixel is 1/1.2 of a unit. */
  const PX = 1 / 1.2;
  const HOVER_REACH = 4 * PX;

  test("of two stacked notes, the pointer on one reads that one, though the other's words are within reach", () => {
    const lower = text({ key: "DXF_HANDLE:A", text: "3000 PSI CONCRETE", height: 2.5, anchor: [0, 4] });
    const upper = text({ key: "DXF_HANDLE:B", text: "60 GRADE REINFORCEMENT", height: 2.5, anchor: [0, 8] });
    const index = buildSpatialIndex({ layers: [{ name: "Text-1", rgb: [0, 0, 0], entityCount: 2, records: [lower, upper] }] });
    const onLower: [number, number] = [5, 5.5];
    const [, lowerBottom, , lowerTop] = letteredBox(lower) ?? [0, 0, 0, 0];
    const [, upperBottom] = letteredBox(upper) ?? [0, 0, 0, 0];
    expect(onLower[1], "the pointer is inside the lower note's words").toBeGreaterThan(lowerBottom);
    expect(onLower[1]).toBeLessThan(lowerTop);
    expect(upperBottom - onLower[1], "and the upper note's outline is within the reach of it").toBeLessThan(HOVER_REACH);
    expect(hitTest(index, onLower, HOVER_REACH), "the words under the pointer first, the near note after").toEqual(["DXF_HANDLE:A", "DXF_HANDLE:B"]);
    expect(hitTest(index, [5, 9.5], HOVER_REACH), "and on the upper note, the upper one first").toEqual(["DXF_HANDLE:B", "DXF_HANDLE:A"]);
  });

  test("a line three pixels beside the words does not beat them; a line through them within a pixel does", () => {
    const note = text({ key: "DXF_HANDLE:5", text: "N12345", height: 2.5, anchor: [0, 0] });
    const beside: RenderRecord = { key: "DXF_HANDLE:6", type: "LINE", rgb: [0, 0, 0], points: [[-5, 1 + 3 * PX], [20, 1 + 3 * PX]] };
    const through: RenderRecord = { key: "DXF_HANDLE:7", type: "LINE", rgb: [0, 0, 0], points: [[-5, 1 + 0.6 * PX], [20, 1 + 0.6 * PX]] };
    const onTheWords: [number, number] = [4, 1];
    const [, bottom, , top] = letteredBox(note) ?? [0, 0, 0, 0];
    expect(3 * PX + 1, "the line beside stands off the lettering").toBeGreaterThan(top);
    expect(onTheWords[1]).toBeGreaterThan(bottom);
    const besideOnly = buildSpatialIndex({ layers: [{ name: "SYN-00", rgb: [0, 0, 0], entityCount: 2, records: [note, beside] }] });
    expect(hitTest(besideOnly, onTheWords, HOVER_REACH), "the words first, the line within reach after them").toEqual(["DXF_HANDLE:5", "DXF_HANDLE:6"]);
    const throughToo = buildSpatialIndex({ layers: [{ name: "SYN-00", rgb: [0, 0, 0], entityCount: 2, records: [note, through] }] });
    expect(hitTest(throughToo, onTheWords, HOVER_REACH), "a line the pointer is on, drawn across the words, first").toEqual(["DXF_HANDLE:7", "DXF_HANDLE:5"]);
  });

  test("a text beside the pointer comes after a line equally near: only the words the pointer is on stand before geometry", () => {
    const note = text({ key: "DXF_HANDLE:5", text: "N1", height: 2.5, anchor: [0, 0] });
    const line: RenderRecord = { key: "DXF_HANDLE:6", type: "LINE", rgb: [0, 0, 0], points: [[-5, -3], [20, -3]] };
    const index = buildSpatialIndex({ layers: [{ name: "SYN-00", rgb: [0, 0, 0], entityCount: 2, records: [note, line] }] });
    const [, bottom] = letteredBox(note) ?? [0, 0, 0, 0];
    const between: [number, number] = [1, (bottom + -3) / 2];
    expect(hitTest(index, between, HOVER_REACH), "halfway between a line and a note's outline, the line").toEqual(["DXF_HANDLE:6", "DXF_HANDLE:5"]);
  });

  test("a pick on a turned mark's words finds it along its run", () => {
    const record = text({ text: "2B7", rotation: 90, height: 2 });
    const index = buildSpatialIndex({ layers: [{ name: "Beam", rgb: [0, 0, 0], entityCount: 1, records: [record] }] });
    expect(hitTest(index, [99, 204], 0.1), "up the run, inside the capitals").toEqual(["DXF_HANDLE:1"]);
    expect(hitTest(index, [104, 200], 0.1), "to the right of a run that leans left is not on it").toEqual([]);
  });
});

/* ------------------------------------------------------------------ the painter lays the lettering */

/** The stand-in face's metrics, in atlas pixels: a capital 28 tall, every character 24 across, ink from 0 to 20. */
const CAP_PX = 28;
const ADVANCE_PX = 24;
const INK_PX = 20;
const DESCENDERS = new Set(["g", "j", "p", "q", "y"]);

type Recorded = {
  gl: unknown;
  /** Every array a buffer was filled with, in the order they were filled. */
  data: number[][];
  lettered: string[];
  calls: string[];
  draws: { program: string; count: number }[];
};

/** A WebGL context and an atlas canvas that answer plausibly and record what they are asked. */
function recording(): Recorded {
  const recorded: Recorded = { gl: null, data: [], lettered: [], calls: [], draws: [] };
  const sources = new Map<object, string>();
  const kinds = new Map<object, string>();
  let program = "none";
  let made = 0;
  const handle = (kind: string): object => ({ kind, id: (made += 1) });
  const methods: Record<string, (...args: never[]) => unknown> = {
    createShader: () => handle("shader"),
    shaderSource: (shader: object, source: string) => void sources.set(shader, source),
    createProgram: () => handle("program"),
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
    bufferData: (_target: string, data: Float32Array) => void recorded.data.push([...data]),
    drawArrays: (_mode: string, _first: number, count: number) => {
      recorded.draws.push({ program, count });
      recorded.calls.push(`draw:${program}`);
    },
    texImage2D: () => void recorded.calls.push("texImage2D"),
    texSubImage2D: () => void recorded.calls.push("texSubImage2D"),
    generateMipmap: () => void recorded.calls.push("generateMipmap"),
    texParameteri: (_target: string, name: string, value: string) => void recorded.calls.push(`${name}=${value}`),
  };
  recorded.gl = new Proxy(
    {},
    {
      get: (_held, name) => {
        if (typeof name !== "string") return undefined;
        if (name in methods) return methods[name];
        return /^[A-Z0-9_]+$/.test(name) ? name : () => undefined;
      },
    },
  );
  const ink = {
    font: "",
    textBaseline: "",
    textAlign: "",
    fillText: (character: string) => void recorded.lettered.push(character),
    measureText: (character: string) =>
      character === " "
        ? { width: ADVANCE_PX, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }
        : {
            width: ADVANCE_PX,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: INK_PX,
            actualBoundingBoxAscent: CAP_PX,
            actualBoundingBoxDescent: DESCENDERS.has(character) ? 8 : 0,
          },
  };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ink }) });
  return recorded;
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

/** The arrays a layer's upload filled with glyph positions: every value near the anchor, twelve per glyph. */
function glyphPositions(recorded: Recorded, near: readonly [number, number], from: number): number[][] {
  return recorded.data.slice(from).filter((values) => values.length > 0 && values.length % 12 === 0 && values.every((value, at) => Math.abs(value - (at % 2 === 0 ? near[0] : near[1])) < 1000));
}

describe("the painter lays each glyph at its true cap height, turned, from a measured atlas (I-462)", () => {
  let recorded: Recorded;
  let painter: Painter;
  let queued: FrameRequestCallback[] = [];

  beforeEach(() => {
    queued = [];
    recorded = recording();
    vi.stubGlobal("WebGLRenderingContext", class {});
    vi.stubGlobal("devicePixelRatio", 1);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queued.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const canvas = { clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => recorded.gl };
    painter = createPainter(canvas as unknown as HTMLCanvasElement, PALETTE) as Painter;
    expect(painter, "the recording context is a context the painter accepts").not.toBeNull();
  });

  afterEach(() => {
    painter.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("the atlas letters ASCII and the signs the control codes spell — Ø, ° and ± — once, with mipmaps", () => {
    for (const sign of ["Ø", "°", "±", "A", "~"]) expect(recorded.lettered, `${sign} is in the atlas from the start`).toContain(sign);
    expect(recorded.calls.filter((call) => call === "texImage2D"), "the sheet is uploaded once").toHaveLength(1);
    expect(recorded.calls, "and carries mipmaps, so a small note samples a glyph filtered to its size").toContain("generateMipmap");
    expect(recorded.calls).toContain("TEXTURE_MIN_FILTER=LINEAR_MIPMAP_LINEAR");
  });

  test("S-11's bar call is lettered as it shows — `8-16Ø`, five glyphs — each a capital's true height, the run turned 90°", () => {
    const anchor: [number, number] = [1000, 2000];
    const from = recorded.data.length;
    painter.upload({ name: "Text-2", rgb: [255, 255, 255], entityCount: 1, records: [{ key: "DXF_HANDLE:B1", type: "TEXT", rgb: [255, 255, 255], text: "8-16%%C", height: 10, anchor, rotation: 90 }] });
    const [positions] = glyphPositions(recorded, anchor, from);
    expect(positions?.length, "five glyphs of two triangles each — %%C is one glyph, Ø").toBe(5 * 12);
    const quad = positions?.slice(0, 12) ?? [];
    // Turned 90°: along the run is +y, up the letters is −x. A capital's ink spans its cap height
    // plus the atlas's one-pixel rim on each side, in world units: (28 + 2) / 28 × 10.
    const across = Math.max(quad[0] ?? 0, quad[2] ?? 0, quad[4] ?? 0) - Math.min(quad[0] ?? 0, quad[2] ?? 0, quad[4] ?? 0);
    expect(across, "each glyph stands its record's cap height, rims included — never two thirds of it").toBeCloseTo(((CAP_PX + 2) / CAP_PX) * 10, 3);
    const starts = [0, 1, 2, 3, 4].map((at) => positions?.[at * 12 + 1] ?? 0);
    // The stand-in face advances every glyph alike, so its five glyphs share the run the drawing
    // letters `8-16Ø` at evenly (I-648): each a fifth of it up from the last.
    const drawnRun = [..."8-16Ø"].reduce((run, character) => run + DRAWN_ADVANCE(character), 0) * 10;
    expect(starts[1]! - starts[0]!, "and each stands a fifth of the drawn run up from the last — never the face's own 24/28 of a cap").toBeCloseTo(drawnRun / 5, 3);
    expect(drawnRun / 5, "which is not the face's own advance").not.toBeCloseTo((ADVANCE_PX / CAP_PX) * 10, 1);
  });

  test("a character the atlas does not hold yet is lettered into it when its sheet arrives, and the sheet re-uploaded once", () => {
    const before = recorded.calls.filter((call) => call === "texSubImage2D").length;
    painter.upload({ name: "Title", rgb: [0, 0, 0], entityCount: 1, records: [{ key: "DXF_HANDLE:B2", type: "TEXT", rgb: [0, 0, 0], text: "ঢাকা ⌊L⌋", height: 3, anchor: [0, 0] }] });
    expect(recorded.lettered, "the Bengali letter joins the atlas").toContain("ঢ");
    expect(recorded.calls.filter((call) => call === "texSubImage2D").length - before, "and the sheet is uploaded again, once").toBe(1);
    painter.upload({ name: "Again", rgb: [0, 0, 0], entityCount: 1, records: [{ key: "DXF_HANDLE:B3", type: "TEXT", rgb: [0, 0, 0], text: "ঢাকা", height: 3, anchor: [0, 0] }] });
    expect(recorded.calls.filter((call) => call === "texSubImage2D").length - before, "a character it already holds costs no upload").toBe(1);
  });

  test("a new face lays every uploaded layer's lettering again, by the new face's measure", () => {
    const anchor: [number, number] = [3000, 4000];
    painter.upload({ name: "Text-1", rgb: [0, 0, 0], entityCount: 1, records: [{ key: "DXF_HANDLE:B8", type: "TEXT", rgb: [0, 0, 0], text: "C3", height: 5, anchor }] });
    const from = recorded.data.length;
    const uploads = recorded.calls.filter((call) => call === "texImage2D").length;
    painter.setPalette({ ...PALETTE, mono: "'Another Mono', monospace" });
    expect(recorded.calls.filter((call) => call === "texImage2D").length - uploads, "the face is lettered into an atlas of its own").toBe(1);
    expect(glyphPositions(recorded, anchor, from), "and the layer's glyphs are laid again from the records it was uploaded with").toHaveLength(1);
  });

  /** Every microtask the painter's question of the face chains, run out. */
  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
  };

  /** A painter made over a document whose `fonts` answers `check` as given and loads when `arrive` is called. */
  function paintedBeforeTheFace(loaded: boolean): { late: Painter; arrive: () => Promise<void>; asked: string[] } {
    let resolve: () => void = () => undefined;
    const loading = new Promise<void>((done) => {
      resolve = done;
    });
    const asked: string[] = [];
    const fonts = {
      check: (spelled: string) => {
        asked.push(spelled);
        return loaded;
      },
      load: () => loading,
    };
    vi.stubGlobal("document", { ...(document as unknown as Record<string, unknown>), fonts });
    const canvas = { clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => recorded.gl };
    const late = createPainter(canvas as unknown as HTMLCanvasElement, PALETTE) as Painter;
    return {
      late,
      asked,
      arrive: async () => {
        resolve();
        await loading;
        await settle();
      },
    };
  }

  test("a painter made before its face has loaded letters every layer again once it has, and asks for a frame", async () => {
    const { late, arrive, asked } = paintedBeforeTheFace(false);
    const anchor: [number, number] = [5000, 6000];
    late.upload({ name: "Text-1", rgb: [0, 0, 0], entityCount: 1, records: [{ key: "DXF_HANDLE:B9", type: "TEXT", rgb: [0, 0, 0], text: "C4", height: 5, anchor }] });
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    late.draw({ centre: anchor, scale: 4, viewport: { width: 400, height: 300 } }, { layerRows: () => [{ name: "Text-1", drawn: true }] });
    // Long after the ask, so the frame drawn is the last one: the sheet is at rest.
    clock.mockReturnValue(10_000);
    for (const callback of queued.splice(0)) callback(0);
    await settle();
    expect(queued, "the sheet is at rest, and asks for no frame").toHaveLength(0);
    expect(asked[0], "the face asked after is the one the atlas letters in, at the atlas's size").toBe(`40px ${PALETTE.mono}`);
    const uploads = recorded.calls.filter((call) => call === "texImage2D").length;
    const from = recorded.data.length;

    await arrive();

    expect(recorded.calls.filter((call) => call === "texImage2D").length - uploads, "the loaded face is measured into an atlas of its own").toBe(1);
    expect(glyphPositions(recorded, anchor, from), "and the layer's glyphs are laid again by its measure").toHaveLength(1);
    expect(queued, "and the sheet at rest is drawn again with them").toHaveLength(1);
    late.dispose();
  });

  test("a face spelled so it cannot be checked keeps the lettering measured, and the painter is made all the same", async () => {
    vi.stubGlobal("document", {
      ...(document as unknown as Record<string, unknown>),
      fonts: {
        check: () => {
          throw new SyntaxError("not a font");
        },
        load: () => Promise.reject(new SyntaxError("not a font")),
      },
    });
    const canvas = { clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => recorded.gl };
    const odd = createPainter(canvas as unknown as HTMLCanvasElement, PALETTE);
    expect(odd, "a face the document cannot parse costs no painter").not.toBeNull();
    const uploads = recorded.calls.filter((call) => call === "texImage2D").length;
    await settle();
    expect(recorded.calls.filter((call) => call === "texImage2D").length - uploads, "and lays nothing again").toBe(0);
    odd?.dispose();
  });

  test("a face already loaded is measured once; a painter disposed before its face arrives letters nothing more", async () => {
    const ready = paintedBeforeTheFace(true);
    const uploads = recorded.calls.filter((call) => call === "texImage2D").length;
    await ready.arrive();
    expect(recorded.calls.filter((call) => call === "texImage2D").length - uploads, "loaded: nothing to lay again").toBe(0);
    ready.late.dispose();

    const gone = paintedBeforeTheFace(false);
    const before = recorded.calls.filter((call) => call === "texImage2D").length;
    gone.late.dispose();
    await gone.arrive();
    expect(recorded.calls.filter((call) => call === "texImage2D").length - before, "a screen that left takes its lettering with it").toBe(0);
  });

  test("a turned note's selection mark is the outline its lettering stands in", () => {
    const record: RenderRecord = { key: "DXF_HANDLE:B4", type: "TEXT", rgb: [0, 0, 0], text: "2B7", height: 10, anchor: [500, 500], rotation: 90 };
    const from = recorded.data.length;
    painter.setSelection([record]);
    const mark = recorded.data.slice(from).find((values) => values.length === 16);
    expect(mark, "four edges, eight points").toBeDefined();
    const xs = (mark ?? []).filter((_, at) => at % 2 === 0);
    const ys = (mark ?? []).filter((_, at) => at % 2 === 1);
    expect(Math.max(...ys) - Math.min(...ys), "the mark runs up the sheet with the text").toBeGreaterThan(Math.max(...xs) - Math.min(...xs));
    expect(Math.max(...xs), "and leans left of the anchor, as its capitals do").toBeCloseTo(500 + (1 / 3) * 10, 0);
  });

  test("level of detail (D-006): at S-10's fitted scale its 2 m-high marks are lettered, and a 1.3-unit label is not", () => {
    const FIT = 1.2886;
    expect(isTextLettered(200 * 0.01, FIT), "a column mark, 200 high at 1:100, stands 2.6 px at fit").toBe(true);
    expect(isTextLettered(1.3, FIT), "a title block label 1.3 high stands 1.7 px: under the floor").toBe(false);
    expect(LETTERED_TEXT_PX, "the floor is a cap height of two pixels").toBe(2);

    painter.upload({ name: "Column", rgb: [255, 0, 0], entityCount: 1, records: [{ key: "DXF_HANDLE:B5", type: "TEXT", rgb: [255, 0, 0], text: "C2", height: 2, anchor: [0, 0] }] });
    const at: Camera = { centre: [0, 0], scale: FIT, viewport: { width: 400, height: 300 } };
    painter.draw(at, { layerRows: () => [{ name: "Column", drawn: true }] });
    for (const callback of queued.splice(0)) callback(0);
    expect(recorded.draws.filter((draw) => draw.program === "glyph"), "the mark's two glyphs are drawn at fit").toEqual([{ program: "glyph", count: 12 }]);
    const drawnAt = recorded.calls.lastIndexOf("draw:glyph");
    const filter = recorded.calls.slice(0, drawnAt).filter((call) => call.startsWith("TEXTURE_MIN_FILTER=")).at(-1);
    expect(filter, "a mark drawn a few pixels tall samples the atlas's mipmaps, not four texels of a large glyph").toBe("TEXTURE_MIN_FILTER=LINEAR_MIPMAP_LINEAR");
  });

  test("a note drawn at half its lettered size or more samples the sheet itself — the cheap filter carries nearly all the fill", () => {
    painter.upload({ name: "Notes", rgb: [0, 0, 0], entityCount: 2, records: [
      { key: "DXF_HANDLE:B6", type: "TEXT", rgb: [0, 0, 0], text: "SMALL", height: 1, anchor: [0, 0] },
      { key: "DXF_HANDLE:B7", type: "TEXT", rgb: [0, 0, 0], text: "LARGE", height: 10, anchor: [0, 20] },
    ] });
    const at: Camera = { centre: [0, 0], scale: 3, viewport: { width: 400, height: 300 } };
    painter.draw(at, { layerRows: () => [{ name: "Notes", drawn: true }] });
    for (const callback of queued.splice(0)) callback(0);
    // SMALL stands 3 px (under half the 28 px the stand-in letters a capital at), LARGE 30 px.
    const glyphDraws = recorded.calls.filter((call) => call === "draw:glyph" || call.startsWith("TEXTURE_MIN_FILTER=")).slice(-4);
    expect(glyphDraws).toEqual(["TEXTURE_MIN_FILTER=LINEAR_MIPMAP_LINEAR", "draw:glyph", "TEXTURE_MIN_FILTER=LINEAR", "draw:glyph"]);
    expect(recorded.draws.filter((draw) => draw.program === "glyph").map((draw) => draw.count), "five glyphs each, one run apiece").toEqual([30, 30]);
  });
});
