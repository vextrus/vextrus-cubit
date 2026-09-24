// R-UI-040's WebGL half: a layer arrives, is tessellated once into a batch the GPU keeps, and every
// later frame is a handful of draw calls over buffers nobody rebuilds. Pan and zoom move two
// uniforms — the camera's centre and its scale — so the cost of a frame is the geometry in view and
// not the geometry in the sheet (PB-3).
//
// The palette is handed in, resolved from the `--canvas-*` tokens by the screen: no colour is spelled
// here (R-UI-001). Entity colour is the artifact's own, with one ruling applied and applied only
// here — a record resolved to near-white or near-black is CAD colour 7 and paints in the canvas ink,
// so it is legible on both papers (Decision I-79).
import {
  GESTURE_SETTLE_MS,
  SETTLED_MARGIN,
  isCanvasInk,
  letteredFrom,
  recordBox,
  settledFrameServes,
  viewBoxOf,
  type SettledFrame,
  type WorldBox,
} from "./client";
// The two notation readings have one home, beside each other and reachable from a unit lane (B-17).
import { alphaOf, unitChannelsOf } from "./colour-notation";
import { displayLines } from "@/core/entitygraph/text";
import { NOMINAL_FACE, letter, type Face, type GlyphShape } from "./lettering";
import type { Camera, RenderLayer, RenderRecord } from "./types";

/** The canvas surfaces and the face drawn text is lettered in, as the screen resolved them. */
export type CanvasPalette = {
  /** The sheet itself — `--canvas-paper`. */
  paper: string;
  /** The colour a record with no colour of its own paints in — `--canvas-ink`. */
  ink: string;
  /** The extents frame — `--canvas-grid`. */
  grid: string;
  /** The face sheet text is lettered in — `--font-mono`. */
  mono: string;
  /** What is held — `--canvas-selection`. */
  selection: string;
  /** What is under the pointer — `--canvas-hover`. */
  hover: string;
  /** The colour a reveal's arrival is struck in before it settles — `--canvas-pulse`. */
  pulse: string;
};

/**
 * A scan painted under the sheet (I-684): its picture, and the world corners of its top-left,
 * top-right, bottom-right and bottom-left pixels.
 */
export type Backdrop = {
  readonly image: TexImageSource;
  readonly placement: readonly (readonly [number, number])[];
};

/** What the screen drives a sheet through. */
export type Painter = {
  /** Tessellate one arrived layer into the batch it is drawn from thereafter. */
  upload: (layer: RenderLayer) => void;
  /** The world box the sheet is framed by, drawn as a hairline rectangle. */
  setExtents: (
    extents: {
      min: readonly [number, number];
      max: readonly [number, number];
    } | null,
  ) => void;
  /**
   * The scans a scanned sheet's traced lines were read from, painted under every layer in the canvas's
   * own paper and ink (I-684). An empty list paints none, which is every drawn sheet.
   */
  setBackdrops: (backdrops: readonly Backdrop[]) => void;
  /** The three canvas colours again, after the document's theme changed (Decision § 6). */
  setPalette: (palette: CanvasPalette) => void;
  /** Ask for a frame at this camera, with these layers drawn. */
  draw: (camera: Camera, state: { layerRows: () => { name: string; drawn: boolean }[] }) => void;
  /**
   * What is held, painted above the sheet from a buffer of its own: changing the selection never
   * touches a layer's batch, so a marquee over a whole sheet costs no re-tessellation (PB-3).
   */
  setSelection: (records: readonly RenderRecord[]) => void;
  /** What is under the pointer, painted the same way and just as cheaply. */
  setHover: (record: RenderRecord | null) => void;
  /**
   * Strike the selection in the pulse colour and cross-fade it back over this many milliseconds —
   * the arrival of a fly-to. A duration of zero draws no pulse frame at all, which is what reduced
   * motion leaves behind once the token is zeroed at source (Decision § 4).
   *
   * A Trace states the colour itself: the arrival of a traced number is struck in the basis that
   * number was measured on, so the reader sees the same palette on the sheet they read in the cell
   * (R-UI-002, R-UI-022). Struck without one, the arrival keeps the canvas's own pulse colour.
   */
  pulse: (durationMs: number, colour?: string) => void;
  /** Called once per frame actually painted, so a screen can publish its ledger. */
  setFrameListener: (listener: (() => void) | null) => void;
  /** The frame ledger: the middle and the tail of the last frames, in milliseconds. */
  frameStats: () => { medianMs: number; p95Ms: number };
  /**
   * The camera the frame on screen was drawn at, or null before the first — so a screen can publish
   * the box that frame was projected into beside the box the canvas stands in (I-661).
   */
  frameCamera: () => Camera | null;
  /** Release the buffers and the loop — a screen leaving takes its GPU memory with it. */
  dispose: () => void;
};

/** The frames the ledger is read over (Decision § 7). */
const LEDGER_FRAMES = 120;

/** Two frames of slack: a longer gap than this is a rest, not a frame anybody failed to deliver. */
const CONTINUOUS_GAP_MS = 100;

/**
 * How long a gesture is still in flight after its last event. A pan or a zoom arrives as a stream of
 * events, and the frames between them are the frames PB-3 is about — so the loop keeps drawing for
 * this long after the last one and then stops. A sheet nobody is touching costs no frames at all
 * (Decision § 4: the loop is input-driven, never an idle timer). It outlasts the settle, so the frame
 * a gesture ends on is always drawn in full before the loop lets go (I-345).
 */
export const GESTURE_TAIL_MS = 400;

/** The backing store never exceeds twice the layout size — the cap that holds the budget on HiDPI. */
const MAX_DEVICE_PIXEL_RATIO = 2;

/** Vertices per culling chunk: enough that the draw call dominates, few enough that culling bites. */
const CHUNK_VERTICES = 8192;

/** The stroke a mark is drawn at, in device-independent pixels (Decision § 5's closed px set). */
const MARK_STROKE_PX = 2;

/**
 * How many one-device-pixel offsets the same mark is drawn at to make that stroke. `gl.lineWidth`
 * is a no-op on ANGLE — its aliased line-width range is [1, 1] — so the 1 px run is drawn once per
 * device pixel the stroke covers. The count follows the backing store's ratio to the layout: a
 * 2 px stroke is four device pixels on a HiDPI canvas, and a step of anything but one device pixel
 * leaves unpainted rows between the runs.
 */
export const markSteps = (extentPx: number, layoutPx: number): number => Math.max(1, Math.round(MARK_STROKE_PX * (extentPx / Math.max(layoutPx, 1))));

/**
 * The offsets one mark is drawn at, and the whole cost of the mark pass: one `drawArrays` over the
 * mark's vertices each. A stroke is round, not square — its footprint is the disc of the stroke's
 * own width — so the corners of the `across × down` block are dropped: they are the offsets that lie
 * outside that disc, and they only thicken a 45° run beyond the 2 px R-UI-012 asks for. Dropping
 * them costs no coverage: along any direction the kept offsets still project one device pixel apart,
 * which is the step the runs must not exceed (PB-3 pays for the rest 16 times a second — at ratio 2
 * this is 12 calls per mark, not 16, and at ratio 1 it is the same 4 the block gave).
 */
export const markOffsets = (acrossSteps: number, downSteps: number): readonly (readonly [number, number])[] => {
  const centreAcross = (acrossSteps - 1) / 2;
  const centreDown = (downSteps - 1) / 2;
  const radiusAcross = acrossSteps / 2;
  const radiusDown = downSteps / 2;
  const offsets: (readonly [number, number])[] = [];
  for (let across = 0; across < acrossSteps; across += 1) {
    for (let down = 0; down < downSteps; down += 1) {
      const fromAcross = (across - centreAcross) / radiusAcross;
      const fromDown = (down - centreDown) / radiusDown;
      if (fromAcross * fromAcross + fromDown * fromDown > 1) continue;
      offsets.push([across, down]);
    }
  }
  return offsets;
};

/**
 * The atlas (Decision I-462): a square sheet of square cells, one glyph lettered in each at one
 * size and MEASURED as it is lettered — its advance and its ink box — so a glyph quad is laid at the
 * record's own cap height and the face's own advance, and covers its ink and nothing else. Square and
 * a power of two on each side, so it carries mipmaps: a note drawn a few pixels tall samples a glyph
 * filtered to that size rather than four texels of a large one.
 */
const ATLAS_COLUMNS = 16;
const ATLAS_ROWS = 16;
const ATLAS_CELL_PX = 64;

/** The size a glyph is lettered at, and where its baseline stands down its cell — room above for accents, below for descenders. */
const ATLAS_FONT_PX = 40;
const ATLAS_BASELINE_PX = 46;

/** The pixel of edge kept around a glyph's ink, so its anti-aliased rim is never cut off by its quad. */
const ATLAS_RIM_PX = 1;

/** The first and last printable ASCII characters, every one lettered before any sheet asks for it. */
const ASCII_FIRST = 32;
const ASCII_LAST = 126;

/**
 * The signs a drawing's control codes and notes spell, lettered beside ASCII from the start: `%%c`,
 * `%%d` and `%%p` are drawn Ø, ° and ±, and the rest are what a structural note writes (× ² ³ − → ≤ ≥
 * √ Σ φ ½ ⌊ ⌋ ⌈ ⌉). Any other character a sheet holds is lettered into a free cell when the sheet
 * arrives; past the last cell it is drawn as the replacement character, never as nothing.
 */
const ATLAS_SIGNS = "Ø°±×²³·−→≤≥√Σµφ½¼¾⌀∅⌊⌋⌈⌉";

/** U+FFFD, what a character the full atlas cannot hold is drawn as. */
const REPLACEMENT = String.fromCharCode(65_533);

/** The cap height, the descent and the advance a face falls back to where a canvas cannot measure it (a stand-in context). */
const FALLBACK_CAP = 0.7;

/** The camera and the atlas, as the two programs read them. */
const LINE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec3 a_colour;
uniform vec2 u_centre;
uniform float u_scale;
uniform vec2 u_viewport;
uniform vec3 u_tint;
uniform float u_tinted;
uniform vec2 u_shift;
varying vec3 v_colour;
void main() {
  vec2 offset = (a_position - u_centre) * u_scale;
  gl_Position = vec4(offset.x / (u_viewport.x * 0.5) + u_shift.x, offset.y / (u_viewport.y * 0.5) + u_shift.y, 0.0, 1.0);
  v_colour = mix(a_colour, u_tint, u_tinted);
}`;

const LINE_FRAGMENT_SHADER = `
precision mediump float;
uniform float u_alpha;
varying vec3 v_colour;
void main() {
  gl_FragColor = vec4(v_colour, u_alpha);
}`;

const GLYPH_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texel;
attribute vec3 a_colour;
uniform vec2 u_centre;
uniform float u_scale;
uniform vec2 u_viewport;
varying vec3 v_colour;
varying vec2 v_texel;
void main() {
  vec2 offset = (a_position - u_centre) * u_scale;
  gl_Position = vec4(offset.x / (u_viewport.x * 0.5), offset.y / (u_viewport.y * 0.5), 0.0, 1.0);
  v_colour = a_colour;
  v_texel = a_texel;
}`;

const GLYPH_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_atlas;
varying vec3 v_colour;
varying vec2 v_texel;
void main() {
  gl_FragColor = vec4(v_colour, texture2D(u_atlas, v_texel).a);
}`;

/**
 * The settled frame, laid back down under a camera in motion (I-345): one quad at the world box the
 * frame holds, through the same camera as the sheet, sampling the frame's own pixels. The texel is
 * carried at the highest precision the device offers, because a frame is thousands of texels wide.
 */
const SETTLED_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texel;
uniform vec2 u_centre;
uniform float u_scale;
uniform vec2 u_viewport;
varying vec2 v_texel;
void main() {
  vec2 offset = (a_position - u_centre) * u_scale;
  gl_Position = vec4(offset.x / (u_viewport.x * 0.5), offset.y / (u_viewport.y * 0.5), 0.0, 1.0);
  v_texel = a_texel;
}`;

const SETTLED_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_atlas;
varying vec2 v_texel;
void main() {
  gl_FragColor = vec4(texture2D(u_atlas, v_texel).rgb, 1.0);
}`;

/**
 * A scan under the sheet (I-684): the settled frame's quad, sampling a scan's grey rather than a
 * frame's colour, and toned between the canvas's paper and its ink — so a scan reads on the dark
 * paper as on the light one, and at `BACKDROP_STRENGTH` of the ink, so every traced line painted over
 * it in the full ink stands out from the scanned line it was read from.
 */
const BACKDROP_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_atlas;
uniform vec3 u_paper;
uniform vec3 u_ink;
uniform float u_strength;
varying vec2 v_texel;
void main() {
  float dark = 1.0 - texture2D(u_atlas, v_texel).r;
  gl_FragColor = vec4(mix(u_paper, u_ink, dark * u_strength), 1.0);
}`;

/** How far toward the ink a scan's darkest pixel is painted: a line the reader sees, under the trace. */
export const BACKDROP_STRENGTH = 0.45;

/** One scan on the GPU: its texture, its quad in world units and the box the quad covers. */
type BackdropBatch = {
  texture: WebGLTexture;
  quad: WebGLBuffer | null;
  box: WorldBox;
};

/**
 * A mark drawn above the sheet — what is held, and what is under the pointer. It carries its own
 * positions and its own flat colour, so painting it is two draw calls over buffers no layer batch
 * shares (PB-3).
 */
type Mark = {
  positions: WebGLBuffer | null;
  colours: WebGLBuffer | null;
  vertices: number;
};

/** One run of line vertices with the world box it covers — the unit culling works at. */
type Chunk = {
  start: number;
  count: number;
  box: [number, number, number, number];
};

/**
 * A run of vertices painted one colour: the record's own, or `null` where the reading resolved
 * colour 7 and the canvas ink decides (I-79). Kept per record so a theme change re-fills the two
 * colour buffers without tessellating the sheet again — the positions, texels, chunks and heights a
 * palette does not touch stay exactly as they were uploaded.
 */
type ColourRun = {
  readonly rgb: readonly [number, number, number] | null;
  readonly vertices: number;
};

/** One layer on the GPU: its lines, and its text sorted by world height so LOD is a range. */
type Batch = {
  lineBuffer: WebGLBuffer | null;
  lineColours: WebGLBuffer | null;
  chunks: Chunk[];
  glyphBuffer: WebGLBuffer | null;
  glyphColours: WebGLBuffer | null;
  glyphTexels: WebGLBuffer | null;
  /** Ascending world heights, and where each text's vertices begin — the LOD cut is a search here. */
  heights: number[];
  starts: number[];
  glyphVertices: number;
  /** The colour of each record's vertices, in the order the two buffers hold them. */
  lineRuns: ColourRun[];
  glyphRuns: ColourRun[];
  /** Whether any run paints in the ink — a layer with none of them survives a theme change as is. */
  usesInk: boolean;
  /** The world box of everything the layer paints, lines and lettering, or null where it paints nothing (I-345). */
  box: WorldBox | null;
};

/**
 * The frame a moving camera is drawn from (I-345): a full frame of the sheet, drawn past the view's
 * edges into a texture of its own, with what it was drawn over — so a frame that no longer shows the
 * sheet as it stands is never laid down.
 */
type Settled = {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  /** The quad it is laid down as: the world box it holds, and the texels at its corners. */
  quad: WebGLBuffer | null;
  texels: WebGLBuffer | null;
  /** The texture's size, in device pixels. */
  width: number;
  height: number;
  /** The camera and the world box of the frame it holds, or null before one is drawn. */
  frame: SettledFrame | null;
  /** The sheet it holds: the scene's revision, the layers drawn, and the backing store it was cut for. */
  scene: number;
  drawn: string;
  store: string;
};


/**
 * The colour a record paints in, as three floats — or `null` where the reading resolved colour 7 and
 * the canvas ink decides, which is the one thing about a record's colour a theme changes (I-79).
 */
function recordColour(record: RenderRecord): readonly [number, number, number] | null {
  const [red, green, blue] = record.rgb;
  return isCanvasInk(record.rgb) ? null : [red / 255, green / 255, blue / 255];
}

/** The runs spread out into the vertex colours a buffer takes, with the ink filled in. */
function colourFloats(runs: readonly ColourRun[], ink: readonly [number, number, number]): Float32Array {
  let vertices = 0;
  for (const run of runs) vertices += run.vertices;
  const filled = new Float32Array(vertices * 3);
  let at = 0;
  for (const run of runs) {
    const [red, green, blue] = run.rgb ?? ink;
    for (let vertex = 0; vertex < run.vertices; vertex += 1) {
      filled[at] = red;
      filled[at + 1] = green;
      filled[at + 2] = blue;
      at += 3;
    }
  }
  return filled;
}

/** A compiled program, or null where the context refused one. */
function programOf(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const compile = (kind: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(kind);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (vertex === null || fragment === null) return null;
  const program = gl.createProgram();
  if (program === null) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) === true ? program : null;
}

/** One lettered cell: the glyph's measured shape, in cap heights, and its ink box in texture coordinates. */
type Cell = {
  readonly shape: GlyphShape;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
};

/**
 * The glyph sheet: a canvas lettered cell by cell and the texture it is uploaded to. Every character
 * a sheet shows is measured and lettered here once; the face it answers is what the lettering lays
 * glyphs by, so a quad stands exactly where its ink was lettered.
 */
type Atlas = {
  readonly texture: WebGLTexture;
  /**
   * The cap height on screen, in pixels, from which a glyph is drawn from the sheet itself rather
   * than its mipmaps: half the cap height it is lettered at, where plain filtering still meets every
   * other texel of the ink.
   */
  readonly plainFromPx: number;
  readonly face: Face;
  /** Letter whatever of these characters the sheet does not hold yet. */
  readonly admit: (characters: Iterable<string>) => void;
  /** Where one character's ink stands in the texture — the replacement character's for one it could not hold. */
  readonly cellOf: (character: string) => Cell;
  /** Upload what was lettered since the last flush; true where anything was. */
  readonly flush: () => boolean;
};

/** The metrics a canvas measures one glyph by, or null where the context measures nothing. */
type Measured = { width: number; left: number; right: number; ascent: number; descent: number };

function measure(ink: CanvasRenderingContext2D, character: string): Measured | null {
  if (typeof ink.measureText !== "function") return null;
  const metrics = ink.measureText(character);
  const read = [metrics.width, metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxRight, metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent];
  if (!read.every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  return { width: metrics.width, left: metrics.actualBoundingBoxLeft, right: metrics.actualBoundingBoxRight, ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent };
}

/** The glyph sheet, lettered with ASCII and the drawing signs and uploaded once, with mipmaps; null where no canvas or texture can be had. */
function createAtlas(gl: WebGLRenderingContext, faceName: string): Atlas | null {
  const sheet = document.createElement("canvas");
  sheet.width = ATLAS_COLUMNS * ATLAS_CELL_PX;
  sheet.height = ATLAS_ROWS * ATLAS_CELL_PX;
  const ink = sheet.getContext("2d");
  if (ink === null) return null;
  ink.font = `${ATLAS_FONT_PX}px ${faceName}`;
  ink.textBaseline = "alphabetic";
  ink.textAlign = "left";

  // The face's own capitals are the unit every shape is stated in: a record's height is a cap height.
  const capPx = measure(ink, "H")?.ascent ?? 0;
  const cap = capPx > 0 ? capPx : ATLAS_FONT_PX * FALLBACK_CAP;
  const descenders = ["g", "j", "p", "q", "y"].map((character) => measure(ink, character)?.descent ?? 0);
  const descent = Math.max(...descenders) > 0 ? Math.max(...descenders) / cap : NOMINAL_FACE.descent;

  const cells = new Map<string, Cell>();
  const capacity = ATLAS_COLUMNS * ATLAS_ROWS;
  let dirty = false;

  // The sheet is a mask, never a picture: only its alpha is sampled, and the colour a glyph is
  // painted in is the record's own, decided in the shader (R-UI-001 — no colour is spelled here).
  const letterCell = (character: string): Cell => {
    const at = cells.size;
    const left = (at % ATLAS_COLUMNS) * ATLAS_CELL_PX;
    const top = Math.floor(at / ATLAS_COLUMNS) * ATLAS_CELL_PX;
    const measured = measure(ink, character);
    const advancePx = measured?.width ?? NOMINAL_FACE.shapeOf(character).advance * cap;
    const pen = left + (ATLAS_CELL_PX - advancePx) / 2;
    const baseline = top + ATLAS_BASELINE_PX;
    ink.fillText(character, pen, baseline);
    dirty = true;
    const nominal = NOMINAL_FACE.shapeOf(character);
    const inkLeft = measured === null ? pen + nominal.left * cap : pen - measured.left;
    const inkRight = measured === null ? pen + nominal.right * cap : pen + measured.right;
    const inkTop = measured === null ? baseline - nominal.ascent * cap : baseline - measured.ascent;
    const inkBottom = measured === null ? baseline + nominal.descent * cap : baseline + measured.descent;
    // A character with no ink — a space — is an advance alone, and lays no quad.
    if (!(inkRight > inkLeft) || !(inkBottom > inkTop)) {
      return { shape: { advance: advancePx / cap, left: 0, right: 0, ascent: 0, descent: 0 }, u0: 0, v0: 0, u1: 0, v1: 0 };
    }
    const x0 = Math.max(left, inkLeft - ATLAS_RIM_PX);
    const x1 = Math.min(left + ATLAS_CELL_PX, inkRight + ATLAS_RIM_PX);
    const y0 = Math.max(top, inkTop - ATLAS_RIM_PX);
    const y1 = Math.min(top + ATLAS_CELL_PX, inkBottom + ATLAS_RIM_PX);
    return {
      shape: { advance: advancePx / cap, left: (x0 - pen) / cap, right: (x1 - pen) / cap, ascent: (baseline - y0) / cap, descent: (y1 - baseline) / cap },
      u0: x0 / sheet.width,
      v0: y0 / sheet.height,
      u1: x1 / sheet.width,
      v1: y1 / sheet.height,
    };
  };

  const admitOne = (character: string): void => {
    if (cells.has(character) || cells.size >= capacity) return;
    cells.set(character, letterCell(character));
  };
  const roster = [...Array.from({ length: ASCII_LAST - ASCII_FIRST + 1 }, (_, at) => String.fromCharCode(ASCII_FIRST + at)), REPLACEMENT, ...ATLAS_SIGNS];
  for (const character of roster) admitOne(character);

  const texture = gl.createTexture();
  if (texture === null) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // The mask as alpha alone, because alpha is all the glyph shader samples: a quarter of the bytes
  // a texel costs to fetch and filter, and the very same value in each (I-346).
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, gl.ALPHA, gl.UNSIGNED_BYTE, sheet);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  dirty = false;

  const replacement = cells.get(REPLACEMENT) as Cell;
  const cellOf = (character: string): Cell => cells.get(character) ?? replacement;
  return {
    texture,
    plainFromPx: cap / 2,
    face: { shapeOf: (character) => cellOf(character).shape, descent },
    admit: (characters) => {
      for (const character of characters) admitOne(character);
    },
    cellOf,
    flush: () => {
      if (!dirty) return false;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.ALPHA, gl.UNSIGNED_BYTE, sheet);
      gl.generateMipmap(gl.TEXTURE_2D);
      dirty = false;
      return true;
    },
  };
}

/** The index of the first height at least this tall in a run sorted ascending, or the run's length. */
function firstAtLeast(heights: readonly number[], least: number): number {
  let low = 0;
  let high = heights.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((heights[middle] ?? 0) >= least) high = middle;
    else low = middle + 1;
  }
  return low;
}

/** A box grown to take in one more box, or that box where there was none yet. */
function joinBox(held: WorldBox | null, minX: number, minY: number, maxX: number, maxY: number): WorldBox {
  if (held === null) return [minX, minY, maxX, maxY];
  return [Math.min(held[0], minX), Math.min(held[1], minY), Math.max(held[2], maxX), Math.max(held[3], maxY)];
}

/**
 * The sheet's painter, or null where this browser offers no WebGL context. A null is a capability
 * and not a refusal: nothing was asked of the reader and no registered code applies (I-82).
 */
export function createPainter(canvas: HTMLCanvasElement, tokens: CanvasPalette): Painter | null {
  // A document that does not know what a WebGL context is is not asked for one: the question itself
  // is what a headless DOM reports as unimplemented, and the answer is the same either way (I-82).
  if (typeof WebGLRenderingContext === "undefined") return null;
  const gl = (canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  }) ?? null) as WebGLRenderingContext | null;
  if (gl === null) return null;

  const lineProgram = programOf(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
  const glyphProgram = programOf(gl, GLYPH_VERTEX_SHADER, GLYPH_FRAGMENT_SHADER);
  if (lineProgram === null || glyphProgram === null) return null;
  // A context that will not compile the settled frame's program draws every frame in full — slower
  // in motion, never different (I-345).
  const settledProgram = programOf(gl, SETTLED_VERTEX_SHADER, SETTLED_FRAGMENT_SHADER);
  // A context that will not compile the scan's program paints the traced lines without it — the
  // sheet whole, only without the picture to check them against (I-684).
  const backdropProgram = programOf(gl, SETTLED_VERTEX_SHADER, BACKDROP_FRAGMENT_SHADER);
  /** The scans under the sheet, in the order they were handed over. */
  let backdrops: BackdropBatch[] = [];
  /** One texel per corner of a scan's quad: top-left, top-right, bottom-right, top-left, bottom-right, bottom-left. */
  let backdropTexels: WebGLBuffer | null = null;

  let palette = tokens;
  let atlas = createAtlas(gl, palette.mono);
  const batches = new Map<string, Batch>();
  /** Each layer as it was uploaded — what a change of face lays its lettering again from. */
  const uploaded = new Map<string, RenderLayer>();
  /** The face glyphs are laid by: the atlas's measure of the face it lettered, or the nominal one where it has none. */
  const faceOf = (): Face => atlas?.face ?? NOMINAL_FACE;

  /**
   * The sheet's revision: every change to what a full frame would draw — a layer arriving, the
   * extents, the palette, the atlas — moves it, and a settled frame of an older revision is never
   * laid down again (I-345). The marks have their own, because they are drawn live over every frame.
   */
  let scene = 0;
  let marks = 0;
  /** When the camera last moved — the settle is counted from here, never from a hover or a mark. */
  let movedAt = Number.NEGATIVE_INFINITY;
  /** The settled frame, once one has been asked for; `false` where this context cannot keep one. */
  let settled: Settled | null | false = settledProgram === null ? false : null;
  /** What is on screen now, so a sheet at rest is not drawn again for nothing (Decision § 4). */
  let shown: { camera: Camera; scene: number; drawn: string; marks: number; struck: number; store: string; full: boolean } | null = null;
  let frame: Chunk | null = null;
  let frameBuffer: WebGLBuffer | null = null;
  let frameColours: WebGLBuffer | null = null;
  let framed: {
    min: readonly [number, number];
    max: readonly [number, number];
  } | null = null;

  const ledger: number[] = [];
  let scheduled = 0;
  let lastFrameAt = 0;
  let lastAskedAt = 0;
  let pending: { camera: Camera; drawn: Set<string>; key: string } | null = null;
  let listener: (() => void) | null = null;

  /** What is held and what is under the pointer, as records and as the buffers they paint from. */
  let selected: readonly RenderRecord[] = [];
  let hovered: RenderRecord | null = null;
  let selectionMark: Mark | null = null;
  let hoverMark: Mark | null = null;

  /** The pulse in flight, if one is: when it began and how long it lasts (Decision § 4). */
  let pulseFrom = 0;
  let pulseMs = 0;
  /** The colour this strike carries, where the striker named one — a basis colour (R-UI-022). */
  let pulseColour: string | null = null;

  /** A buffer already on the GPU, filled again — the whole of a colour change (Decision § 6). */
  const refill = (buffer: WebGLBuffer | null, data: Float32Array): void => {
    if (buffer === null) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  };

  /** One buffer, filled once. */
  const bufferOf = (data: Float32Array): WebGLBuffer | null => {
    const buffer = gl.createBuffer();
    if (buffer === null) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  };

  /**
   * Where a program's inputs live, asked for once. Every `getAttribLocation` and
   * `getUniformLocation` is a synchronous round trip to the driver, and a frame that asked for them
   * again would spend its budget on questions it already knows the answer to (PB-3).
   */
  const slots = (program: WebGLProgram) => ({
    position: gl.getAttribLocation(program, "a_position"),
    colour: gl.getAttribLocation(program, "a_colour"),
    texel: gl.getAttribLocation(program, "a_texel"),
    centre: gl.getUniformLocation(program, "u_centre"),
    scale: gl.getUniformLocation(program, "u_scale"),
    viewport: gl.getUniformLocation(program, "u_viewport"),
    atlas: gl.getUniformLocation(program, "u_atlas"),
    tint: gl.getUniformLocation(program, "u_tint"),
    tinted: gl.getUniformLocation(program, "u_tinted"),
    shift: gl.getUniformLocation(program, "u_shift"),
    alpha: gl.getUniformLocation(program, "u_alpha"),
    paper: gl.getUniformLocation(program, "u_paper"),
    ink: gl.getUniformLocation(program, "u_ink"),
    strength: gl.getUniformLocation(program, "u_strength"),
  });
  const lineSlots = slots(lineProgram);
  const glyphSlots = slots(glyphProgram);
  const settledSlots = settledProgram === null ? null : slots(settledProgram);
  const backdropSlots = backdropProgram === null ? null : slots(backdropProgram);

  /** Bind an attribute to the buffer that feeds it. */
  const attribute = (at: number, buffer: WebGLBuffer | null, size: number): void => {
    if (at < 0 || buffer === null) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, size, gl.FLOAT, false, 0, 0);
  };

  /**
   * The camera, as both programs take it. The viewport is the camera's own — in the layout pixels
   * `scale` is stated in — and never the backing store's: the device ratio is the GL viewport's
   * business, and mixing the two would zoom the sheet by the ratio on a HiDPI screen.
   */
  const camera3 = (where: ReturnType<typeof slots>, camera: Camera): void => {
    gl.uniform2f(where.centre, camera.centre[0], camera.centre[1]);
    gl.uniform1f(where.scale, camera.scale);
    gl.uniform2f(where.viewport, Math.max(camera.viewport.width, 1), Math.max(camera.viewport.height, 1));
  };

  /** The backing store, at the layout size and the capped device ratio. */
  const resize = (): void => {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    const width = Math.max(Math.round(canvas.clientWidth * ratio), 1);
    const height = Math.max(Math.round(canvas.clientHeight * ratio), 1);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  };

  /** The offsets the mark pass draws at, and the step counts they were built for. */
  let shiftSteps: [number, number] = [0, 0];
  let shifts: readonly (readonly [number, number])[] = [];

  /** A mark's two buffers, let go of before the next pair takes their place. */
  const releaseMark = (mark: Mark | null): void => {
    if (mark === null) return;
    if (mark.positions !== null) gl.deleteBuffer(mark.positions);
    if (mark.colours !== null) gl.deleteBuffer(mark.colours);
  };

  /**
   * The segments of these records, in one flat colour. Text is marked by the outline its lettering
   * stands in — turned with it — rather than by its glyphs: a mark says where a thing is, and a reader
   * reads the thing itself from the sheet under it.
   */
  const markOf = (records: readonly RenderRecord[], colour: string): Mark | null => {
    const positions: number[] = [];
    for (const record of records) {
      const lettered = record.text === undefined ? null : letter(record, faceOf());
      if (lettered !== null) {
        lettered.outline.forEach((from, at) => {
          const to = lettered.outline[(at + 1) % lettered.outline.length] as readonly [number, number];
          positions.push(from[0], from[1], to[0], to[1]);
        });
        continue;
      }
      const box = recordBox(record);
      if (record.points !== undefined && record.points.length >= 2) {
        for (let at = 1; at < record.points.length; at += 1) {
          const from = record.points[at - 1] as readonly [number, number];
          const to = record.points[at] as readonly [number, number];
          positions.push(from[0], from[1], to[0], to[1]);
        }
        if (record.closed === true && record.points.length >= 3) {
          const from = record.points[record.points.length - 1] as readonly [number, number];
          const to = record.points[0] as readonly [number, number];
          positions.push(from[0], from[1], to[0], to[1]);
        }
        continue;
      }
      if (box === null) continue;
      const [minX, minY] = box.min;
      const [right, top] = box.max;
      positions.push(minX, minY, right, minY, right, minY, right, top, right, top, minX, top, minX, top, minX, minY);
    }
    if (positions.length === 0) return null;
    const [red, green, blue] = unitChannelsOf(colour);
    const vertices = positions.length / 2;
    // Filled in place: one allocation for the whole run rather than an array and a spread per
    // vertex, because a whole layer selected is hundreds of thousands of them (PB-3).
    const colours = new Float32Array(vertices * 3);
    for (let at = 0; at < colours.length; at += 3) {
      colours[at] = red;
      colours[at + 1] = green;
      colours[at + 2] = blue;
    }
    return {
      positions: bufferOf(new Float32Array(positions)),
      colours: bufferOf(colours),
      vertices,
    };
  };

  /**
   * One mark rebuilt, never both. A pointer moving over a sheet answers a new hover every few
   * milliseconds, and re-tessellating what is *held* on each of those answers would put the whole
   * selection's geometry through this function sixty times a second — the exact cost these separate
   * buffers exist to avoid (PB-3, Decision § 4).
   */
  const remarkSelection = (): void => {
    releaseMark(selectionMark);
    selectionMark = markOf(selected, palette.selection);
    marks += 1;
  };

  const remarkHover = (): void => {
    releaseMark(hoverMark);
    hoverMark = markOf(hovered === null ? [] : [hovered], palette.hover);
    marks += 1;
  };

  /**
   * One mark drawn above the sheet at the Decision's stroke, tinted by however much of a pulse is
   * still owed and carried at whatever opacity its own token states — `--canvas-hover` is a wash,
   * and painting it opaque would put a solid block where the reading meant a tint (R-UI-001: the
   * token's value is the surface's colour, alpha included).
   */
  const drawMark = (mark: Mark | null, colour: string, tint: readonly [number, number, number], amount: number): void => {
    if (mark === null || mark.vertices === 0) return;
    const alpha = alphaOf(colour);
    gl.uniform3f(lineSlots.tint, tint[0], tint[1], tint[2]);
    gl.uniform1f(lineSlots.tinted, amount);
    gl.uniform1f(lineSlots.alpha, alpha);
    if (alpha < 1) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    attribute(lineSlots.position, mark.positions, 2);
    attribute(lineSlots.colour, mark.colours, 3);
    // Clip space spans two units over the backing store, so one device pixel is 2 / canvas.width —
    // the step the runs are laid down at, whatever ratio `resize` gave the store.
    const acrossSteps = markSteps(canvas.width, canvas.clientWidth);
    const downSteps = markSteps(canvas.height, canvas.clientHeight);
    // The offset list only moves when the store's ratio does, so it is built then and not per frame.
    if (acrossSteps !== shiftSteps[0] || downSteps !== shiftSteps[1]) {
      shiftSteps = [acrossSteps, downSteps];
      shifts = markOffsets(acrossSteps, downSteps);
    }
    for (const [across, down] of shifts) {
      gl.uniform2f(lineSlots.shift, (across * 2) / Math.max(canvas.width, 1), (down * 2) / Math.max(canvas.height, 1));
      gl.drawArrays(gl.LINES, 0, mark.vertices);
    }
    gl.uniform2f(lineSlots.shift, 0, 0);
    gl.uniform1f(lineSlots.tinted, 0);
    gl.uniform1f(lineSlots.alpha, 1);
    if (alpha < 1) gl.disable(gl.BLEND);
  };

  /** How much of the pulse colour the selection still carries, 1 at the strike and 0 once settled. */
  const pulseAmount = (now: number): number => {
    if (pulseMs <= 0) return 0;
    const gone = (now - pulseFrom) / pulseMs;
    if (gone >= 1) {
      pulseMs = 0;
      return 0;
    }
    return 1 - Math.max(gone, 0);
  };

  /**
   * The sheet in full at a camera, into whatever framebuffer is bound over whatever viewport is set:
   * the paper, the extents frame, every drawn layer's lines inside the view, and the lettering the
   * LOD admits. The screen's frame at rest and the settled frame are both this, and nothing else.
   */
  const drawSheet = (camera: Camera, drawn: ReadonlySet<string>): void => {
    const paper = unitChannelsOf(palette.paper);
    gl.clearColor(paper[0], paper[1], paper[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);

    const box = viewBoxOf(camera);

    // The scans first, so every line and letter the sheet paints stands over the picture it was read
    // from (I-684); a scan wholly out of view is not sent.
    if (backdropProgram !== null && backdropSlots !== null && backdrops.length > 0) {
      const ink = unitChannelsOf(palette.ink);
      gl.useProgram(backdropProgram);
      camera3(backdropSlots, camera);
      gl.uniform3f(backdropSlots.paper, paper[0], paper[1], paper[2]);
      gl.uniform3f(backdropSlots.ink, ink[0], ink[1], ink[2]);
      gl.uniform1f(backdropSlots.strength, BACKDROP_STRENGTH);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(backdropSlots.atlas, 0);
      attribute(backdropSlots.texel, backdropTexels, 2);
      for (const backdrop of backdrops) {
        if (backdrop.box[0] > box[2] || backdrop.box[2] < box[0] || backdrop.box[1] > box[3] || backdrop.box[3] < box[1]) continue;
        gl.bindTexture(gl.TEXTURE_2D, backdrop.texture);
        attribute(backdropSlots.position, backdrop.quad, 2);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }

    gl.useProgram(lineProgram);
    camera3(lineSlots, camera);
    // The sheet paints in its own colours: only a mark is ever tinted (Decision § 6).
    gl.uniform3f(lineSlots.tint, 0, 0, 0);
    gl.uniform1f(lineSlots.tinted, 0);
    gl.uniform2f(lineSlots.shift, 0, 0);
    gl.uniform1f(lineSlots.alpha, 1);
    if (frame !== null) {
      attribute(lineSlots.position, frameBuffer, 2);
      attribute(lineSlots.colour, frameColours, 3);
      gl.drawArrays(gl.LINES, 0, frame.count);
    }
    for (const [name, batch] of batches) {
      if (!drawn.has(name) || batch.chunks.length === 0) continue;
      attribute(lineSlots.position, batch.lineBuffer, 2);
      attribute(lineSlots.colour, batch.lineColours, 3);
      for (const chunk of batch.chunks) {
        // Culling by viewport (R-UI-040): a run of the sheet that cannot be seen is not sent.
        if (chunk.box[0] > box[2] || chunk.box[2] < box[0] || chunk.box[1] > box[3] || chunk.box[3] < box[1]) continue;
        gl.drawArrays(gl.LINES, chunk.start, chunk.count);
      }
    }

    // Text, above the geometry, and only what a reader could read at this scale (R-UI-040's LOD).
    if (atlas !== null) {
      gl.useProgram(glyphProgram);
      camera3(glyphSlots, camera);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.uniform1i(glyphSlots.atlas, 0);
      // Two runs of one buffer, cut by height: text drawn at under half its lettered size samples the
      // mipmaps, and the rest — the large notes that are nearly all of the lettering's fill — samples
      // the sheet itself, which a software rasteriser filters at about two thirds of the cost.
      const plainFrom = atlas.plainFromPx / camera.scale;
      for (const [name, batch] of batches) {
        if (!drawn.has(name) || batch.glyphVertices === 0) continue;
        const start = batch.starts[letteredFrom(batch.heights, camera.scale)] ?? batch.glyphVertices;
        if (start >= batch.glyphVertices) continue;
        const plain = Math.max(start, batch.starts[firstAtLeast(batch.heights, plainFrom)] ?? batch.glyphVertices);
        attribute(glyphSlots.position, batch.glyphBuffer, 2);
        attribute(glyphSlots.texel, batch.glyphTexels, 2);
        attribute(glyphSlots.colour, batch.glyphColours, 3);
        if (plain > start) {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.drawArrays(gl.TRIANGLES, start, plain - start);
        }
        if (batch.glyphVertices > plain) {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.drawArrays(gl.TRIANGLES, plain, batch.glyphVertices - plain);
        }
      }
      gl.disable(gl.BLEND);
    }
  };

  /** Whether two cameras are the same camera, value for value. */
  const sameCamera = (one: Camera, other: Camera): boolean =>
    one.scale === other.scale &&
    one.centre[0] === other.centre[0] &&
    one.centre[1] === other.centre[1] &&
    one.viewport.width === other.viewport.width &&
    one.viewport.height === other.viewport.height;

  /** Everything the drawn layers and the extents frame can paint, as one world box (I-345). */
  const contentOf = (drawn: ReadonlySet<string>): WorldBox | null => {
    let box: WorldBox | null = frame === null ? null : frame.box;
    for (const backdrop of backdrops) box = joinBox(box, backdrop.box[0], backdrop.box[1], backdrop.box[2], backdrop.box[3]);
    for (const [name, batch] of batches) {
      if (!drawn.has(name) || batch.box === null) continue;
      box = joinBox(box, batch.box[0], batch.box[1], batch.box[2], batch.box[3]);
    }
    return box;
  };

  /** The LOD ladder of every drawn layer that letters anything (I-345). */
  const laddersOf = (drawn: ReadonlySet<string>): number[][] => {
    const ladders: number[][] = [];
    for (const [name, batch] of batches) if (drawn.has(name) && batch.glyphVertices > 0) ladders.push(batch.heights);
    return ladders;
  };

  /** The largest texture a settled frame may be drawn into, on either side. */
  const settledLimit = ((): number => {
    const texture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as ArrayLike<number> | null;
    return Math.min(texture, viewport?.[0] ?? 0, viewport?.[1] ?? 0);
  })();

  /** The settled frame's texture, framebuffer and buffers, let go of. */
  const releaseSettled = (): void => {
    if (settled === null || settled === false) return;
    gl.deleteFramebuffer(settled.framebuffer);
    gl.deleteTexture(settled.texture);
    if (settled.quad !== null) gl.deleteBuffer(settled.quad);
    if (settled.texels !== null) gl.deleteBuffer(settled.texels);
    settled = null;
  };

  /** The settled frame's texture, framebuffer and quad, made once; `false` where the context refuses. */
  const settledStore = (width: number, height: number): Settled | false => {
    if (settled === false) return false;
    let held = settled;
    if (held === null) {
      const texture = gl.createTexture();
      const framebuffer = gl.createFramebuffer();
      if (texture === null || framebuffer === null) return (settled = false);
      held = { texture, framebuffer, quad: bufferOf(new Float32Array(12)), texels: bufferOf(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1])), width: 0, height: 0, frame: null, scene: -1, drawn: "", store: "" };
      settled = held;
    }
    if (held.width !== width || held.height !== height) {
      gl.bindTexture(gl.TEXTURE_2D, held.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, held.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, held.texture, 0);
      const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!complete) {
        releaseSettled();
        return (settled = false);
      }
      held.width = width;
      held.height = height;
      held.frame = null;
    }
    return held;
  };

  /**
   * Draw the sheet in full into the settled frame at this camera: the same centre and scale, over a
   * box `SETTLED_MARGIN` of the view wider on every side, in whole device pixels so the view sits
   * in it exactly (I-345). False where no frame can be kept — the caller then draws in full.
   */
  const takeSettled = (request: { camera: Camera; drawn: Set<string>; key: string }, store: string): Settled | false => {
    const camera = request.camera;
    const marginX = Math.round(canvas.width * SETTLED_MARGIN);
    const marginY = Math.round(canvas.height * SETTLED_MARGIN);
    const width = canvas.width + marginX * 2;
    const height = canvas.height + marginY * 2;
    if (width > settledLimit || height > settledLimit) return false;
    const held = settledStore(width, height);
    if (held === false) return false;
    // The camera states its viewport in layout pixels and the store is in device pixels: the frame's
    // viewport is its own size in the camera's units, so a world unit is the same pixels in both.
    const layoutPerDeviceX = Math.max(camera.viewport.width, 1) / canvas.width;
    const layoutPerDeviceY = Math.max(camera.viewport.height, 1) / canvas.height;
    const at: Camera = { centre: camera.centre, scale: camera.scale, viewport: { width: width * layoutPerDeviceX, height: height * layoutPerDeviceY } };
    gl.bindFramebuffer(gl.FRAMEBUFFER, held.framebuffer);
    gl.viewport(0, 0, width, height);
    drawSheet(at, request.drawn);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const holds = viewBoxOf(at);
    refill(held.quad, new Float32Array([holds[0], holds[1], holds[2], holds[1], holds[2], holds[3], holds[0], holds[1], holds[2], holds[3], holds[0], holds[3]]));
    held.frame = { at: camera, holds };
    held.scene = scene;
    held.drawn = request.key;
    held.store = store;
    return held;
  };

  /**
   * A frame in motion (I-345): the settled frame laid down under this camera — moved and scaled, never
   * redrawn — where it still shows the sheet exactly as a full frame would, else a new settled frame
   * taken here first. False where this context keeps none, and the caller draws in full.
   */
  const laySettled = (request: { camera: Camera; drawn: Set<string>; key: string }, store: string): boolean => {
    if (settledProgram === null || settledSlots === null) return false;
    const camera = request.camera;
    const current =
      settled !== null &&
      settled !== false &&
      settled.frame !== null &&
      settled.scene === scene &&
      settled.drawn === request.key &&
      settled.store === store &&
      settledFrameServes(settled.frame, camera, contentOf(request.drawn), laddersOf(request.drawn));
    const held = current ? (settled as Settled) : takeSettled(request, store);
    if (held === false) return false;

    const paper = unitChannelsOf(palette.paper);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(paper[0], paper[1], paper[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(settledProgram);
    camera3(settledSlots, camera);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, held.texture);
    gl.uniform1i(settledSlots.atlas, 0);
    attribute(settledSlots.position, held.quad, 2);
    attribute(settledSlots.texel, held.texels, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  };

  const render = (): void => {
    const request = pending;
    if (request === null) return;
    resize();
    const store = `${canvas.width}x${canvas.height}`;
    const camera = request.camera;
    // In motion until the camera has held still for the settle (Decision § 4, I-345).
    const moving = performance.now() - movedAt < GESTURE_SETTLE_MS;
    // A sheet at rest whose full frame is already on screen — this camera, this sheet, these marks,
    // no pulse in flight — is not drawn again: the canvas keeps what it shows, and a still sheet
    // costs no frames (Decision § 4).
    if (
      !moving &&
      pulseMs <= 0 &&
      shown !== null &&
      shown.full &&
      shown.struck === 0 &&
      shown.scene === scene &&
      shown.drawn === request.key &&
      shown.marks === marks &&
      shown.store === store &&
      sameCamera(shown.camera, camera)
    )
      return;

    // In motion, the settled frame stands for the sheet; at rest — and wherever no frame can be kept
    // — the sheet is drawn in full, straight onto the screen, exactly as it always was (I-345).
    const full = !(moving && laySettled(request, store));
    if (full) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      drawSheet(camera, request.drawn);
    }

    // What is under the pointer, then what is held, above the sheet and above its text: a selection
    // is the stronger fact and is never covered by the reading that led to it (Decision § 1).
    const now = performance.now();
    // A pulse is spent by the clock, not by what is still held: read it before the marks are, so a
    // strike whose selection was cleared mid-flight retires here instead of holding the loop open.
    const struck = pulseAmount(now);
    if (selectionMark !== null || hoverMark !== null) {
      gl.useProgram(lineProgram);
      camera3(lineSlots, camera);
      drawMark(hoverMark, palette.hover, [0, 0, 0], 0);
      drawMark(selectionMark, palette.selection, unitChannelsOf(pulseColour ?? palette.pulse), struck);
    }

    // A gap longer than a rest is not a frame anybody dropped: the ledger measures the cadence of a
    // gesture in flight, which is what 60 fps means (PB-3).
    if (lastFrameAt > 0 && now - lastFrameAt <= CONTINUOUS_GAP_MS) {
      ledger.push(now - lastFrameAt);
      if (ledger.length > LEDGER_FRAMES) ledger.shift();
    }
    lastFrameAt = now;
    shown = { camera, scene, drawn: request.key, marks, struck, store, full };
    listener?.();
  };

  /**
   * One frame, then the next while the gesture lasts. The ledger is read over consecutive frames of
   * a gesture in flight, so the loop runs at the display's own cadence between events rather than
   * once per event — and stops itself when the sheet goes still.
   */
  const tick = (): void => {
    scheduled = 0;
    render();
    // A pulse owes its own frames and stops when it is spent, so an arrival fades out even on a
    // sheet nobody is touching (Decision § 4).
    const busy = performance.now() - lastAskedAt <= GESTURE_TAIL_MS || pulseMs > 0;
    if (pending !== null && busy) scheduled = requestAnimationFrame(tick);
  };

  const quantile = (sorted: readonly number[], fraction: number): number => {
    if (sorted.length === 0) return 0;
    const at = Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))));
    return sorted[at] ?? 0;
  };

  /** Every buffer one batch owns, let go of — a re-upload otherwise leaks five per layer. */
  const releaseBatch = (batch: Batch): void => {
    for (const buffer of [batch.lineBuffer, batch.lineColours, batch.glyphBuffer, batch.glyphColours, batch.glyphTexels]) {
      if (buffer !== null) gl.deleteBuffer(buffer);
    }
  };

  /** Every scan's texture and quad, let go of before the next set takes their place. */
  const releaseBackdrops = (): void => {
    for (const backdrop of backdrops) {
      gl.deleteTexture(backdrop.texture);
      if (backdrop.quad !== null) gl.deleteBuffer(backdrop.quad);
    }
    backdrops = [];
  };

  /**
   * The scans under the sheet, uploaded once each: a texture sampled linearly and clamped at its
   * edges (a scan is rarely a power of two on a side, which WebGL 1 then asks of no mipmaps and no
   * repeat), and a quad at the four corners its record states — two triangles, so a picture turned
   * or placed askew on its page stands exactly where the trace says it does.
   */
  const uploadBackdrops = (next: readonly Backdrop[]): void => {
    releaseBackdrops();
    if (backdropProgram !== null && backdropTexels === null) backdropTexels = bufferOf(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]));
    for (const backdrop of next) {
      const [topLeft, topRight, bottomRight, bottomLeft] = backdrop.placement;
      if (topLeft === undefined || topRight === undefined || bottomRight === undefined || bottomLeft === undefined) continue;
      const texture = gl.createTexture();
      if (texture === null) continue;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backdrop.image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const corners = [topLeft, topRight, bottomRight, bottomLeft];
      const xs = corners.map((corner) => corner[0]);
      const ys = corners.map((corner) => corner[1]);
      backdrops.push({
        texture,
        quad: bufferOf(new Float32Array([...topLeft, ...topRight, ...bottomRight, ...topLeft, ...bottomRight, ...bottomLeft])),
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      });
    }
    scene += 1;
  };

  /** The extents' own two buffers, let go of before the next pair takes their place. */
  const releaseFrame = (): void => {
    if (frameBuffer !== null) gl.deleteBuffer(frameBuffer);
    if (frameColours !== null) gl.deleteBuffer(frameColours);
    frameBuffer = null;
    frameColours = null;
  };

  const uploadLayer = (layer: RenderLayer): void => {
    uploaded.set(layer.name, layer);
    const ink = unitChannelsOf(palette.ink);
    const positions: number[] = [];
    const lineRuns: ColourRun[] = [];
    const chunks: Chunk[] = [];
    let chunkStart = 0;
    let chunkBox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

    const closeChunk = (): void => {
      const count = positions.length / 2 - chunkStart;
      if (count > 0) chunks.push({ start: chunkStart, count, box: chunkBox });
      chunkStart = positions.length / 2;
      chunkBox = [Infinity, Infinity, -Infinity, -Infinity];
    };

    for (const record of layer.records) {
      const points = record.points;
      if (points === undefined || points.length < 2) continue;
      const isClosed = record.closed === true && points.length >= 3;
      const segCount = points.length - 1 + (isClosed ? 1 : 0);
      lineRuns.push({ rgb: recordColour(record), vertices: segCount * 2 });
      for (let at = 1; at < points.length; at += 1) {
        const from = points[at - 1] as readonly [number, number];
        const to = points[at] as readonly [number, number];
        positions.push(from[0], from[1], to[0], to[1]);
        chunkBox = [
          Math.min(chunkBox[0], from[0], to[0]),
          Math.min(chunkBox[1], from[1], to[1]),
          Math.max(chunkBox[2], from[0], to[0]),
          Math.max(chunkBox[3], from[1], to[1]),
        ];
      }
      if (isClosed) {
        const from = points[points.length - 1] as readonly [number, number];
        const to = points[0] as readonly [number, number];
        positions.push(from[0], from[1], to[0], to[1]);
        chunkBox = [
          Math.min(chunkBox[0], from[0], to[0]),
          Math.min(chunkBox[1], from[1], to[1]),
          Math.max(chunkBox[2], from[0], to[0]),
          Math.max(chunkBox[3], from[1], to[1]),
        ];
      }
      if (positions.length / 2 - chunkStart >= CHUNK_VERTICES) closeChunk();
    }
    closeChunk();
    let box: WorldBox | null = null;
    for (const chunk of chunks) box = joinBox(box, chunk.box[0], chunk.box[1], chunk.box[2], chunk.box[3]);

    // Text is lettered in world units at its own cap height, turned and set as the drawing states it
    // (`./lettering`, I-462), so a quad is camera-independent and level-of-detail is a range of
    // one buffer rather than a rebuild (R-UI-040). What is lettered is what the text SHOWS — its
    // control codes resolved by the one display reading (`@/core/entitygraph/text`, B-17) — and every
    // character it shows is in the atlas before a quad is laid from it.
    const texts = layer.records.filter((record) => record.text !== undefined && record.anchor !== undefined && (record.height ?? 0) > 0);
    if (atlas !== null) {
      for (const record of texts) for (const line of displayLines(record.text ?? "", record.type)) atlas.admit(line);
      atlas.flush();
    }
    const face = faceOf();
    const laid: { height: number; rgb: ColourRun["rgb"]; glyphs: number[]; texels: number[] }[] = [];
    for (const record of texts) {
      const quads: number[] = [];
      const cells: number[] = [];
      const lettered = letter(record, face, (character, corner) => {
        // Two triangles, bottom left – bottom right – top right and bottom left – top right – top left,
        // each corner sampling the same corner of the glyph's ink in the atlas.
        quads.push(corner[0], corner[1], corner[2], corner[3], corner[4], corner[5], corner[0], corner[1], corner[4], corner[5], corner[6], corner[7]);
        // What the layer paints is every glyph's own quad — an accent, a bracket or a rim may stand a
        // hair past the lettering's outline, and the settled frame must hold it (I-345).
        for (let at = 0; at < 8; at += 2) box = joinBox(box, corner[at] as number, corner[at + 1] as number, corner[at] as number, corner[at + 1] as number);
        const cell = atlas?.cellOf(character);
        if (cell === undefined) cells.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        else cells.push(cell.u0, cell.v1, cell.u1, cell.v1, cell.u1, cell.v0, cell.u0, cell.v1, cell.u1, cell.v0, cell.u0, cell.v0);
      });
      if (lettered === null) continue;
      for (const [x, y] of lettered.outline) box = joinBox(box, x, y, x, y);
      laid.push({ height: lettered.height, rgb: recordColour(record), glyphs: quads, texels: cells });
    }
    // Sorted by the cap height each is drawn at, so the LOD cut is one index into the buffer.
    laid.sort((a, b) => a.height - b.height);
    const glyphs: number[] = [];
    const texels: number[] = [];
    const glyphRuns: ColourRun[] = [];
    const heights: number[] = [];
    const starts: number[] = [];
    for (const one of laid) {
      heights.push(one.height);
      starts.push(glyphs.length / 2);
      glyphRuns.push({ rgb: one.rgb, vertices: one.glyphs.length / 2 });
      for (const value of one.glyphs) glyphs.push(value);
      for (const value of one.texels) texels.push(value);
    }

    const stale = batches.get(layer.name);
    if (stale !== undefined) releaseBatch(stale);
    batches.set(layer.name, {
      lineBuffer: bufferOf(new Float32Array(positions)),
      lineColours: bufferOf(colourFloats(lineRuns, ink)),
      chunks,
      glyphBuffer: bufferOf(new Float32Array(glyphs)),
      glyphTexels: bufferOf(new Float32Array(texels)),
      glyphColours: bufferOf(colourFloats(glyphRuns, ink)),
      heights,
      starts,
      glyphVertices: glyphs.length / 2,
      lineRuns,
      glyphRuns,
      usesInk: lineRuns.some((run) => run.rgb === null) || glyphRuns.some((run) => run.rgb === null),
      box,
    });
    scene += 1;
  };

  const frameExtents = (
    extents: {
      min: readonly [number, number];
      max: readonly [number, number];
    } | null,
  ): void => {
    framed = extents;
    releaseFrame();
    if (extents === null) {
      frame = null;
      scene += 1;
      return;
    }
    const [minX, minY] = extents.min;
    const [maxX, maxY] = extents.max;
    const outline = [minX, minY, maxX, minY, maxX, minY, maxX, maxY, maxX, maxY, minX, maxY, minX, maxY, minX, minY];
    const [red, green, blue] = unitChannelsOf(palette.grid);
    frameBuffer = bufferOf(new Float32Array(outline));
    frameColours = bufferOf(new Float32Array(Array.from({ length: 8 }, () => [red, green, blue]).flat()));
    frame = { start: 0, count: 8, box: [minX, minY, maxX, maxY] };
    scene += 1;
  };

  /**
   * The lettering laid again by the face as it is measured now: a new atlas, every uploaded layer's
   * glyphs from the records it came with, and both marks, whose outlines are lettered by the face too.
   */
  const reletter = (): void => {
    if (atlas !== null) gl.deleteTexture(atlas.texture);
    atlas = createAtlas(gl, palette.mono);
    scene += 1;
    for (const layer of [...uploaded.values()]) uploadLayer(layer);
    remarkSelection();
    remarkHover();
  };

  let disposed = false;

  /**
   * The atlas measures the face the document has loaded when it is made, and a web font that has not
   * arrived yet is measured as its fallback — advances, cap height and glyphs alike, for as long as
   * the sheet is open. So where the face is still to load, the lettering is laid again once it has,
   * and a frame is asked for (I-462 (3)). A document that cannot say (no `document.fonts`, a
   * face spelled so it cannot be checked, a face that never loads) keeps the lettering it measured —
   * the fallback's, drawn and readable, never a blank sheet.
   *
   * The question is asked a microtask on, inside the chain, so a spelling `check` cannot parse is a
   * rejection here and never a throw through the painter's making; no task runs between, so a face
   * cannot arrive unseen in the gap.
   */
  const whenFaceLoaded = (face: string): void => {
    const fonts = typeof document === "undefined" ? undefined : (document as Partial<Document>).fonts;
    if (fonts === undefined || typeof fonts.check !== "function" || typeof fonts.load !== "function") return;
    const spelled = `${ATLAS_FONT_PX}px ${face}`;
    void Promise.resolve()
      .then(() => (fonts.check(spelled) ? null : fonts.load(spelled)))
      .then(
        (arrived) => {
          if (arrived === null || disposed || palette.mono !== face) return;
          reletter();
          if (pending !== null && scheduled === 0) scheduled = requestAnimationFrame(tick);
        },
        () => undefined,
      );
  };
  whenFaceLoaded(palette.mono);

  return {
    upload: uploadLayer,

    setExtents: frameExtents,

    setBackdrops: uploadBackdrops,

    setPalette: (next) => {
      const was = palette;
      palette = next;
      // Every colour and the face are what a full frame is drawn in: a settled frame of the old
      // palette is never laid down again (I-345).
      scene += 1;
      if (next.mono !== was.mono) {
        // A new face is new glyph shapes: every quad was laid by the old face's measure, so the
        // lettering is laid again — every layer, from the records it was uploaded with — and again
        // when the face arrives, where it has not yet.
        reletter();
        whenFaceLoaded(next.mono);
      }
      // The ink a record resolved to is written into its vertices at upload, so a sheet lettered for
      // the abandoned theme would stay lettered for it — near-black lines all but invisible on dark
      // paper. Only those vertices change: a theme moves no geometry, so the two colour buffers of
      // every layer that paints in the ink are filled again and the positions, texels, chunks and
      // heights are left alone — re-tessellating the sheet here would spend hundreds of milliseconds
      // of the main thread on a `data-theme` flip (R-TO-010's light and dark canvas, Decision § 6).
      const ink = unitChannelsOf(palette.ink);
      if (next.ink !== was.ink) {
        for (const batch of batches.values()) {
          if (!batch.usesInk) continue;
          refill(batch.lineColours, colourFloats(batch.lineRuns, ink));
          refill(batch.glyphColours, colourFloats(batch.glyphRuns, ink));
        }
      }
      if (next.grid !== was.grid) frameExtents(framed);
      // The marks carry their colour in their own vertices too, and they are small: a theme flip
      // rebuilds them outright rather than leaving a selection painted in the abandoned theme.
      if (next.selection !== was.selection) remarkSelection();
      if (next.hover !== was.hover) remarkHover();
    },

    setSelection: (records) => {
      selected = records;
      remarkSelection();
    },

    setHover: (record) => {
      hovered = record;
      remarkHover();
    },

    pulse: (durationMs, colour) => {
      // At zero no pulse frame is drawn at all: the selection paints straight in its own colour
      // rather than flashing for one frame (Decision § 4).
      if (!(durationMs > 0)) return;
      pulseFrom = performance.now();
      pulseMs = durationMs;
      // A colour that could not be read is no colour: the canvas's own pulse stands rather than a
      // strike in whatever an empty string tessellates to (R-UI-022).
      pulseColour = colour !== undefined && colour.length > 0 ? colour : null;
      if (scheduled === 0) scheduled = requestAnimationFrame(tick);
    },

    draw: (camera, state) => {
      const drawn = state
        .layerRows()
        .filter((row) => row.drawn)
        .map((row) => row.name);
      const asked = performance.now();
      // A move is the centre or the scale changing over the same stage — a pan, a zoom, a fit, a
      // travel. A stage that changed size is not a gesture, and a hover or a mark is not a move
      // (I-345).
      const held = pending?.camera;
      if (
        held !== undefined &&
        held.viewport.width === camera.viewport.width &&
        held.viewport.height === camera.viewport.height &&
        (held.scale !== camera.scale || held.centre[0] !== camera.centre[0] || held.centre[1] !== camera.centre[1])
      )
        movedAt = asked;
      pending = { camera, drawn: new Set(drawn), key: drawn.join("\n") };
      lastAskedAt = asked;
      if (scheduled === 0) scheduled = requestAnimationFrame(tick);
    },

    setFrameListener: (next) => {
      listener = next;
    },

    frameStats: () => {
      const sorted = [...ledger].sort((a, b) => a - b);
      return { medianMs: quantile(sorted, 0.5), p95Ms: quantile(sorted, 0.95) };
    },

    frameCamera: () => shown?.camera ?? null,

    dispose: () => {
      disposed = true;
      if (scheduled !== 0) cancelAnimationFrame(scheduled);
      scheduled = 0;
      listener = null;
      pending = null;
      for (const batch of batches.values()) releaseBatch(batch);
      batches.clear();
      releaseMark(selectionMark);
      releaseMark(hoverMark);
      selectionMark = null;
      hoverMark = null;
      selected = [];
      hovered = null;
      pulseMs = 0;
      releaseFrame();
      frame = null;
      framed = null;
      releaseBackdrops();
      if (backdropTexels !== null) gl.deleteBuffer(backdropTexels);
      backdropTexels = null;
      releaseSettled();
      shown = null;
      uploaded.clear();
      if (atlas !== null) gl.deleteTexture(atlas.texture);
      atlas = null;
    },
  };
}
