// R-UI-040's WebGL half: a layer arrives, is tessellated once into a batch the GPU keeps, and every
// later frame is a handful of draw calls over buffers nobody rebuilds. Pan and zoom move two
// uniforms — the camera's centre and its scale — so the cost of a frame is the geometry in view and
// not the geometry in the sheet (PB-3).
//
// The palette is handed in, resolved from the `--canvas-*` tokens by the screen: no colour is spelled
// here (R-UI-001). Entity colour is the artifact's own, with one ruling applied and applied only
// here — a record resolved to near-white or near-black is CAD colour 7 and paints in the canvas ink,
// so it is legible on both papers (Decision I-79).
import { isTextLegible } from "./client";
import type { Camera, RenderLayer, RenderRecord } from "./types";

/** The three canvas surfaces and the face drawn text is lettered in, as the screen resolved them. */
export type CanvasPalette = {
  /** The sheet itself — `--canvas-paper`. */
  paper: string;
  /** The colour a record with no colour of its own paints in — `--canvas-ink`. */
  ink: string;
  /** The extents frame — `--canvas-grid`. */
  grid: string;
  /** The face sheet text is lettered in — `--font-mono`. */
  mono: string;
};

/** What the screen drives a sheet through. */
export type Painter = {
  /** Tessellate one arrived layer into the batch it is drawn from thereafter. */
  upload: (layer: RenderLayer) => void;
  /** The world box the sheet is framed by, drawn as a hairline rectangle. */
  setExtents: (extents: { min: readonly [number, number]; max: readonly [number, number] } | null) => void;
  /** The three canvas colours again, after the document's theme changed (Decision § 6). */
  setPalette: (palette: CanvasPalette) => void;
  /** Ask for a frame at this camera, with these layers drawn. */
  draw: (camera: Camera, state: { layerRows: () => { name: string; drawn: boolean }[] }) => void;
  /** Called once per frame actually painted, so a screen can publish its ledger. */
  setFrameListener: (listener: (() => void) | null) => void;
  /** The frame ledger: the middle and the tail of the last frames, in milliseconds. */
  frameStats: () => { medianMs: number; p95Ms: number };
  /** Release the buffers and the loop — a screen leaving takes its GPU memory with it. */
  dispose: () => void;
};

/** The frames the ledger is read over (Decision § 7). */
const LEDGER_FRAMES = 120;

/** Two frames of slack: a longer gap than this is a rest, not a frame anybody failed to deliver. */
const CONTINUOUS_GAP_MS = 100;

/** The backing store never exceeds twice the layout size — the cap that holds the budget on HiDPI. */
const MAX_DEVICE_PIXEL_RATIO = 2;

/** Vertices per culling chunk: enough that the draw call dominates, few enough that culling bites. */
const CHUNK_VERTICES = 8192;

/** A channel is "white" at or above this, and "black" at or below the other — colour 7 (I-79). */
const NEAR_WHITE = 250;
const NEAR_BLACK = 5;

/** The atlas: the printable ASCII a drawing's text is lettered from, in a grid of square cells. */
const ATLAS_FIRST = 32;
const ATLAS_LAST = 126;
const ATLAS_COLUMNS = 16;
const ATLAS_CELL_PX = 32;

/** A monospace cell is this fraction of its height wide — the advance a glyph quad is placed at. */
const GLYPH_ADVANCE = 0.6;

/** How much of the cell the letter itself fills, leaving the rest as bearing. */
const GLYPH_INSET = 0.1;

/** The camera and the atlas, as the two programs read them. */
const LINE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec3 a_colour;
uniform vec2 u_centre;
uniform float u_scale;
uniform vec2 u_viewport;
varying vec3 v_colour;
void main() {
  vec2 offset = (a_position - u_centre) * u_scale;
  gl_Position = vec4(offset.x / (u_viewport.x * 0.5), offset.y / (u_viewport.y * 0.5), 0.0, 1.0);
  v_colour = a_colour;
}`;

const LINE_FRAGMENT_SHADER = `
precision mediump float;
varying vec3 v_colour;
void main() {
  gl_FragColor = vec4(v_colour, 1.0);
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

/** One run of line vertices with the world box it covers — the unit culling works at. */
type Chunk = { start: number; count: number; box: [number, number, number, number] };

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
};

/** A CSS colour as three floats. Only the two spellings a computed token value takes are read. */
function channelsOf(colour: string): [number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour.trim());
  if (hex !== null) return [Number.parseInt(hex[1] ?? "", 16) / 255, Number.parseInt(hex[2] ?? "", 16) / 255, Number.parseInt(hex[3] ?? "", 16) / 255];
  const numbers = colour.match(/-?\d+(\.\d+)?/g) ?? [];
  const [red, green, blue] = numbers.slice(0, 3).map((part) => Number(part) / 255);
  return [red ?? 0, green ?? 0, blue ?? 0];
}

/** The colour a record paints in: its own, unless the reading resolved colour 7 (I-79). */
function paintColour(record: RenderRecord, ink: [number, number, number]): [number, number, number] {
  const [red, green, blue] = record.rgb;
  const white = red >= NEAR_WHITE && green >= NEAR_WHITE && blue >= NEAR_WHITE;
  const black = red <= NEAR_BLACK && green <= NEAR_BLACK && blue <= NEAR_BLACK;
  return white || black ? ink : [red / 255, green / 255, blue / 255];
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

/** The glyph sheet, lettered once into a texture: printable ASCII in a grid of square cells. */
function atlasTexture(gl: WebGLRenderingContext, face: string): WebGLTexture | null {
  const rows = Math.ceil((ATLAS_LAST - ATLAS_FIRST + 1) / ATLAS_COLUMNS);
  const sheet = document.createElement("canvas");
  sheet.width = ATLAS_COLUMNS * ATLAS_CELL_PX;
  sheet.height = rows * ATLAS_CELL_PX;
  const ink = sheet.getContext("2d");
  if (ink === null) return null;
  ink.font = `${Math.round(ATLAS_CELL_PX * (1 - GLYPH_INSET * 2))}px ${face}`;
  ink.textBaseline = "middle";
  ink.textAlign = "center";
  // The sheet is a mask, never a picture: only its alpha is sampled, and the colour a glyph is
  // painted in is the record's own, decided in the shader (R-UI-001 — no colour is spelled here).
  for (let code = ATLAS_FIRST; code <= ATLAS_LAST; code += 1) {
    const cell = code - ATLAS_FIRST;
    const column = cell % ATLAS_COLUMNS;
    const row = Math.floor(cell / ATLAS_COLUMNS);
    ink.fillText(String.fromCharCode(code), (column + 0.5) * ATLAS_CELL_PX, (row + 0.5) * ATLAS_CELL_PX);
  }

  const texture = gl.createTexture();
  if (texture === null) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/** Where one character sits in the atlas, as texture coordinates. */
function cellOf(character: string): { left: number; top: number; size: [number, number] } {
  const code = character.charCodeAt(0);
  const cell = code >= ATLAS_FIRST && code <= ATLAS_LAST ? code - ATLAS_FIRST : 0;
  const rows = Math.ceil((ATLAS_LAST - ATLAS_FIRST + 1) / ATLAS_COLUMNS);
  return { left: (cell % ATLAS_COLUMNS) / ATLAS_COLUMNS, top: Math.floor(cell / ATLAS_COLUMNS) / rows, size: [1 / ATLAS_COLUMNS, 1 / rows] };
}

/**
 * The sheet's painter, or null where this browser offers no WebGL context. A null is a capability
 * and not a refusal: nothing was asked of the reader and no registered code applies (I-82).
 */
export function createPainter(canvas: HTMLCanvasElement, tokens: CanvasPalette): Painter | null {
  // A document that does not know what a WebGL context is is not asked for one: the question itself
  // is what a headless DOM reports as unimplemented, and the answer is the same either way (I-82).
  if (typeof WebGLRenderingContext === "undefined") return null;
  const gl = (canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: true }) ?? null) as WebGLRenderingContext | null;
  if (gl === null) return null;

  const lineProgram = programOf(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
  const glyphProgram = programOf(gl, GLYPH_VERTEX_SHADER, GLYPH_FRAGMENT_SHADER);
  if (lineProgram === null || glyphProgram === null) return null;

  let palette = tokens;
  let atlas = atlasTexture(gl, palette.mono);
  const batches = new Map<string, Batch>();
  let frame: Chunk | null = null;
  let frameBuffer: WebGLBuffer | null = null;
  let frameColours: WebGLBuffer | null = null;

  const ledger: number[] = [];
  let scheduled = 0;
  let lastFrameAt = 0;
  let pending: { camera: Camera; drawn: Set<string> } | null = null;
  let listener: (() => void) | null = null;

  /** One buffer, filled once. */
  const bufferOf = (data: Float32Array): WebGLBuffer | null => {
    const buffer = gl.createBuffer();
    if (buffer === null) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
  };

  /** Bind an attribute to the buffer that feeds it. */
  const attribute = (program: WebGLProgram, name: string, buffer: WebGLBuffer | null, size: number): void => {
    const at = gl.getAttribLocation(program, name);
    if (at < 0 || buffer === null) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, size, gl.FLOAT, false, 0, 0);
  };

  /** The camera, as both programs take it. */
  const camera3 = (program: WebGLProgram, camera: Camera): void => {
    gl.uniform2f(gl.getUniformLocation(program, "u_centre"), camera.centre[0], camera.centre[1]);
    gl.uniform1f(gl.getUniformLocation(program, "u_scale"), camera.scale);
    gl.uniform2f(gl.getUniformLocation(program, "u_viewport"), canvas.width, canvas.height);
  };

  /** The backing store, at the layout size and the capped device ratio. */
  const resize = (): void => {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    const width = Math.max(Math.round(canvas.clientWidth * ratio), 1);
    const height = Math.max(Math.round(canvas.clientHeight * ratio), 1);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  };

  /** The world box a camera can see, in drawing units. */
  const viewBox = (camera: Camera): [number, number, number, number] => {
    const halfWidth = camera.viewport.width / 2 / camera.scale;
    const halfHeight = camera.viewport.height / 2 / camera.scale;
    return [camera.centre[0] - halfWidth, camera.centre[1] - halfHeight, camera.centre[0] + halfWidth, camera.centre[1] + halfHeight];
  };

  const render = (): void => {
    const request = pending;
    if (request === null) return;
    resize();
    const paper = channelsOf(palette.paper);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(paper[0], paper[1], paper[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);

    const camera = { ...request.camera, viewport: { width: canvas.width, height: canvas.height } };
    const box = viewBox(request.camera);

    gl.useProgram(lineProgram);
    camera3(lineProgram, camera);
    if (frame !== null) {
      attribute(lineProgram, "a_position", frameBuffer, 2);
      attribute(lineProgram, "a_colour", frameColours, 3);
      gl.drawArrays(gl.LINES, 0, frame.count);
    }
    for (const [name, batch] of batches) {
      if (!request.drawn.has(name) || batch.chunks.length === 0) continue;
      attribute(lineProgram, "a_position", batch.lineBuffer, 2);
      attribute(lineProgram, "a_colour", batch.lineColours, 3);
      for (const chunk of batch.chunks) {
        // Culling by viewport (R-UI-040): a run of the sheet that cannot be seen is not sent.
        if (chunk.box[0] > box[2] || chunk.box[2] < box[0] || chunk.box[1] > box[3] || chunk.box[3] < box[1]) continue;
        gl.drawArrays(gl.LINES, chunk.start, chunk.count);
      }
    }

    // Text, above the geometry, and only what a reader could read at this scale (R-UI-040's LOD).
    if (atlas !== null) {
      gl.useProgram(glyphProgram);
      camera3(glyphProgram, camera);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas);
      gl.uniform1i(gl.getUniformLocation(glyphProgram, "u_atlas"), 0);
      for (const [name, batch] of batches) {
        if (!request.drawn.has(name) || batch.glyphVertices === 0) continue;
        let at = 0;
        while (at < batch.heights.length && !isTextLegible(batch.heights[at] ?? 0, request.camera.scale)) at += 1;
        const start = batch.starts[at] ?? batch.glyphVertices;
        if (start >= batch.glyphVertices) continue;
        attribute(glyphProgram, "a_position", batch.glyphBuffer, 2);
        attribute(glyphProgram, "a_texel", batch.glyphTexels, 2);
        attribute(glyphProgram, "a_colour", batch.glyphColours, 3);
        gl.drawArrays(gl.TRIANGLES, start, batch.glyphVertices - start);
      }
      gl.disable(gl.BLEND);
    }

    gl.flush();
    const now = performance.now();
    // A gap longer than a rest is not a frame anybody dropped: the ledger measures the cadence of a
    // gesture in flight, which is what 60 fps means (PB-3).
    if (lastFrameAt > 0 && now - lastFrameAt <= CONTINUOUS_GAP_MS) {
      ledger.push(now - lastFrameAt);
      if (ledger.length > LEDGER_FRAMES) ledger.shift();
    }
    lastFrameAt = now;
    pending = null;
    listener?.();
  };

  const quantile = (sorted: readonly number[], fraction: number): number => {
    if (sorted.length === 0) return 0;
    const at = Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))));
    return sorted[at] ?? 0;
  };

  return {
    upload: (layer) => {
      const ink = channelsOf(palette.ink);
      const positions: number[] = [];
      const colours: number[] = [];
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
        const [red, green, blue] = paintColour(record, ink);
        for (let at = 1; at < points.length; at += 1) {
          const from = points[at - 1] as readonly [number, number];
          const to = points[at] as readonly [number, number];
          positions.push(from[0], from[1], to[0], to[1]);
          colours.push(red, green, blue, red, green, blue);
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

      // Text is tessellated in world units at its own height, so a quad is camera-independent and
      // level-of-detail is a range of one buffer rather than a rebuild (R-UI-040).
      const texts = layer.records
        .filter((record) => record.text !== undefined && record.anchor !== undefined && (record.height ?? 0) > 0)
        .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
      const glyphs: number[] = [];
      const texels: number[] = [];
      const glyphColours: number[] = [];
      const heights: number[] = [];
      const starts: number[] = [];

      for (const record of texts) {
        heights.push(record.height ?? 0);
        starts.push(glyphs.length / 2);
        const height = record.height ?? 0;
        const [originX, originY] = record.anchor as readonly [number, number];
        const [red, green, blue] = paintColour(record, ink);
        const advance = height * GLYPH_ADVANCE;
        [...(record.text ?? "")].forEach((character, index) => {
          const cell = cellOf(character);
          const left = originX + index * advance;
          const right = left + advance;
          const top = originY + height;
          const [cellWidth, cellHeight] = cell.size;
          glyphs.push(left, originY, right, originY, right, top, left, originY, right, top, left, top);
          texels.push(
            cell.left,
            cell.top + cellHeight,
            cell.left + cellWidth,
            cell.top + cellHeight,
            cell.left + cellWidth,
            cell.top,
            cell.left,
            cell.top + cellHeight,
            cell.left + cellWidth,
            cell.top,
            cell.left,
            cell.top,
          );
          for (let corner = 0; corner < 6; corner += 1) glyphColours.push(red, green, blue);
        });
      }

      batches.set(layer.name, {
        lineBuffer: bufferOf(new Float32Array(positions)),
        lineColours: bufferOf(new Float32Array(colours)),
        chunks,
        glyphBuffer: bufferOf(new Float32Array(glyphs)),
        glyphTexels: bufferOf(new Float32Array(texels)),
        glyphColours: bufferOf(new Float32Array(glyphColours)),
        heights,
        starts,
        glyphVertices: glyphs.length / 2,
      });
    },

    setExtents: (extents) => {
      if (extents === null) {
        frame = null;
        return;
      }
      const [minX, minY] = extents.min;
      const [maxX, maxY] = extents.max;
      const outline = [minX, minY, maxX, minY, maxX, minY, maxX, maxY, maxX, maxY, minX, maxY, minX, maxY, minX, minY];
      const [red, green, blue] = channelsOf(palette.grid);
      frameBuffer = bufferOf(new Float32Array(outline));
      frameColours = bufferOf(new Float32Array(Array.from({ length: 8 }, () => [red, green, blue]).flat()));
      frame = { start: 0, count: 8, box: [minX, minY, maxX, maxY] };
    },

    setPalette: (next) => {
      palette = next;
      if (atlas !== null) gl.deleteTexture(atlas);
      atlas = atlasTexture(gl, palette.mono);
    },

    draw: (camera, state) => {
      pending = { camera, drawn: new Set(state.layerRows().filter((row) => row.drawn).map((row) => row.name)) };
      if (scheduled !== 0) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        render();
      });
    },

    setFrameListener: (next) => {
      listener = next;
    },

    frameStats: () => {
      const sorted = [...ledger].sort((a, b) => a - b);
      return { medianMs: quantile(sorted, 0.5), p95Ms: quantile(sorted, 0.95) };
    },

    dispose: () => {
      if (scheduled !== 0) cancelAnimationFrame(scheduled);
      scheduled = 0;
      listener = null;
      pending = null;
      for (const batch of batches.values()) {
        for (const buffer of [batch.lineBuffer, batch.lineColours, batch.glyphBuffer, batch.glyphColours, batch.glyphTexels]) {
          if (buffer !== null) gl.deleteBuffer(buffer);
        }
      }
      batches.clear();
      if (atlas !== null) gl.deleteTexture(atlas);
      atlas = null;
    },
  };
}
