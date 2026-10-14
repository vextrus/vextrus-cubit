/*
 * The sheet in WebGL 2 (m0-screens 4.6, "How the sheet is drawn: our method"), on Paper: white ground,
 * every colour black, drawn as the engine raster draws it (engine/render/raster.py), so 16's pixel
 * test compares the two:
 * - **Lines by ruling 2.** Each line's width on screen is its lineweight x the device pixels per
 *   plotted mm, worked out per frame in the vertex shader. At 1.5 px or wider: a quad of that width,
 *   opaque, round-ended, its edge antialiased over a pixel. Thinner: a 1-px line whose alpha is that
 *   width x 1.1, never below 0.42 and never above 1. Never a non-scaling stroke.
 * - **Fills**: every pixel whose centre is inside, opaque (the context has no multisampling).
 * - **Text**: each glyph quad sampled from the signed-distance-field atlas, its edge over one pixel.
 * Where marks overlap the darker wins (the blend takes the minimum colour and the maximum alpha), as
 * the raster does; off the paper a mark is black at its own alpha, premultiplied.
 */
import type { DecodedSheet } from './decode'
import { glyphBox, prepared, workBound } from './prepare'
import type { ViewTransform } from './view'

/** The engine's atlas: 24 atlas pixels to a text unit, the field spread over 4 of them. */
const SDF_PX_PER_UNIT = 24
const SDF_SPREAD = 4
/**
 * How many times over its own pixels a frame may draw, as the engine raster's budget
 * (engine/render/raster.py, WORK_PER_PIXEL): past it the sheet is refused, not drawn for minutes. A
 * buffer of a thousand triangles each over the whole paper is small and valid, and draws over itself
 * a thousand times.
 */
export const WORK_PER_PIXEL = 64
const WORK_FLOOR = 1_000_000

/* eslint-disable lingui/no-unlocalized-strings -- shader source and developer errors, never shown */
const PREAMBLE = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uScale;
uniform vec2 uOffset;
vec2 toPx(vec2 mm) { return vec2(uOffset.x + mm.x * uScale, uOffset.y - mm.y * uScale); }
vec4 toClip(vec2 px) { return vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0); }
`
const FRAGMENT_PREAMBLE = `#version 300 es
precision highp float;
uniform vec2 uSize;
out vec4 outColor;
// Canvas pixel coordinates, rows from the top, a pixel's centre at +0.5 (the raster's convention).
vec2 here() { return vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y); }
// The palette (Palette, below): 0 Paper, every colour black; 1 CAD-dark, each mark's colour over the ground;
// 2 Compare, the ink colour at 55 % on white; 3 Compare on CAD-dark, the ink colour on black.
uniform int uPalette;
uniform vec3 uGround;
uniform vec3 uInk;
flat in vec3 vColour;
void ink(float a) {
  if (a <= 0.0) discard;
  if (uPalette == 1) outColor = vec4(mix(uGround, vColour, a), 1.0);
  else if (uPalette == 2) outColor = vec4(mix(vec3(1.0), uInk, 0.55 * a), 0.55 * a);
  else if (uPalette == 3) outColor = vec4(uInk * a, 1.0);
  else outColor = vec4(1.0 - a, 1.0 - a, 1.0 - a, a);
}
`

const FILL_VS = `${PREAMBLE}
in vec2 aPos;
in vec3 aColour;
flat out vec3 vColour;
void main() { vColour = aColour; gl_Position = toClip(toPx(aPos)); }`
const FILL_FS = `${FRAGMENT_PREAMBLE}
uniform vec4 uColor;
uniform int uInked;
void main() { if (uInked == 1) ink(1.0); else outColor = uColor; }`

const LINE_VS = `${PREAMBLE}
in vec2 aCorner;
in vec4 aSeg;
in float aWeight;
in vec3 aColour;
flat out vec3 vColour;
flat out vec2 vA;
flat out vec2 vB;
flat out float vHalf;
flat out float vAlpha;
flat out float vThick;
void main() {
  vec2 a = toPx(aSeg.xy);
  vec2 b = toPx(aSeg.zw);
  float w = aWeight * uScale;
  bool thick = w >= 1.5;
  vHalf = thick ? w * 0.5 : 0.5;
  vAlpha = thick ? 1.0 : clamp(w * 1.1, 0.42, 1.0);
  vThick = thick ? 1.0 : 0.0;
  vColour = aColour;
  vA = a;
  vB = b;
  vec2 d = b - a;
  float len = length(d);
  d = len > 0.0 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  float reach = vHalf + 1.0;
  vec2 p = mix(a, b, aCorner.x * 0.5 + 0.5) + d * aCorner.x * reach + n * aCorner.y * reach;
  gl_Position = toClip(p);
}`
const LINE_FS = `${FRAGMENT_PREAMBLE}
flat in vec2 vA;
flat in vec2 vB;
flat in float vHalf;
flat in float vAlpha;
flat in float vThick;
void main() {
  vec2 p = here();
  vec2 ab = vB - vA;
  float len2 = dot(ab, ab);
  if (vThick > 0.5) {
    float t = len2 > 0.0 ? clamp(dot(p - vA, ab) / len2, 0.0, 1.0) : 0.0;
    ink(clamp(vHalf + 0.5 - distance(p, vA + t * ab), 0.0, 1.0));
    return;
  }
  // A 1-px line: a tent across it (a line through a pixel's centre inks that pixel alone), cut at
  // its ends half a pixel out, as the raster marks every pixel its samples fall in.
  float len = sqrt(len2);
  vec2 d = len > 0.0 ? ab / len : vec2(1.0, 0.0);
  float s = dot(p - vA, d);
  float across = abs(dot(p - vA, vec2(-d.y, d.x)));
  float along = clamp(s + 0.5, 0.0, 1.0) * clamp(len - s + 0.5, 0.0, 1.0);
  ink(vAlpha * clamp(1.0 - across, 0.0, 1.0) * along);
}`

const GLYPH_VS = `${PREAMBLE}
uniform vec2 uAtlasSize;
in vec2 aCorner;
in vec4 aPlace;   // origin, x axis (mm)
in vec2 aAxisY;   // y axis (mm)
in vec4 aUv;      // u0, v0, u1, v1 (atlas pixels, v from the top row)
in vec4 aRect;    // x0, y0, x1, y1 (text units)
in float aRun;    // the run's text height (mm): its glyphs greek together
in vec3 aColour;
uniform float uGreekPx;
flat out vec3 vColour;
out vec2 vUv;
flat out float vTextPx;
flat out float vGreek;
void main() {
  vec2 g = mix(aRect.xy, aRect.zw, aCorner);
  vec2 mm = aPlace.xy + g.x * aPlace.zw + g.y * aAxisY;
  vUv = vec2(mix(aUv.x, aUv.z, aCorner.x), mix(aUv.w, aUv.y, aCorner.y)) / uAtlasSize;
  float det = aPlace.z * aAxisY.y - aPlace.w * aAxisY.x;
  vTextPx = sqrt(abs(det)) * uScale;
  vGreek = aRun * uScale < uGreekPx ? 1.0 : 0.0;
  vColour = aColour;
  gl_Position = toClip(toPx(mm));
}`
const GLYPH_FS = `${FRAGMENT_PREAMBLE}
uniform sampler2D uAtlas;
uniform float uGreekInk;
in vec2 vUv;
flat in float vTextPx;
flat in float vGreek;
void main() {
  if (vGreek > 0.5) { ink(uGreekInk); return; }
  float value = texture(uAtlas, vUv).r * 255.0;
  float distancePx = (value - 127.5) / 127.5 * ${SDF_SPREAD.toFixed(1)} / ${SDF_PX_PER_UNIT.toFixed(1)} * vTextPx;
  ink(clamp(distancePx + 0.5, 0.0, 1.0));
}`

export class SheetGlError extends Error {
  override name = 'SheetGlError'
}

interface Program {
  program: WebGLProgram
  uniform(name: string): WebGLUniformLocation | null
  attribute(name: string): number
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const program = gl.createProgram()
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      throw new SheetGlError(`shader: ${gl.getShaderInfoLog(shader) ?? ''}`)
    }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new SheetGlError(`program: ${gl.getProgramInfoLog(program) ?? ''}`)
  }
  const uniforms = new Map<string, WebGLUniformLocation | null>()
  return {
    program,
    uniform: (name) => {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name))
      return uniforms.get(name)!
    },
    attribute: (name) => gl.getAttribLocation(program, name),
  }
}

interface Uploaded {
  sheet: DecodedSheet
  paper: WebGLVertexArrayObject
  fills: WebGLVertexArrayObject
  fillCount: number
  lines: WebGLVertexArrayObject
  /** The lines' records and colours, whose instanced attributes a part re-points at its first line. */
  lineData: WebGLBuffer
  lineColours: WebGLBuffer
  glyphs: WebGLVertexArrayObject
  glyphData: WebGLBuffer
  glyphColours: WebGLBuffer
  atlas: WebGLTexture
  buffers: WebGLBuffer[]
}

/** A frame being drawn a part at a time (`SheetRenderer.begin`). */
export interface DrawJob {
  /** Draws the next part, at most `records` records; true while parts are left. */
  step(records?: number): boolean
}

/**
 * How many records a part of a frame draws: learned from how long parts take on this GPU (it is the
 * machine's, so every renderer shares it), aiming at PART_MS a frame, between PART_MIN and PART_MAX.
 */
const PART_MS = 50
const PART_MIN = 1 << 10
const PART_MAX = 1 << 24
let partSize = 1 << 14

/**
 * How the marks are coloured (4.6, "Colour"): Paper, every colour black on white; CAD-dark, each
 * mark's AutoCAD colour on #101318; Compare, every mark #D0342C at 55 % on white (laid over the Plot by
 * multiplying); Compare on CAD-dark, every mark orange on black (laid over the inverted Plot by screening).
 */
export type Palette = 'paper' | 'dark' | 'compare' | 'compare-dark'

const PALETTE: Record<Palette, number> = { paper: 0, dark: 1, compare: 2, 'compare-dark': 3 }
/** 4.6's colours, 0 to 1. */
export const CAD_DARK_GROUND = [0x10 / 255, 0x13 / 255, 0x18 / 255] as const
/** Off the paper on CAD-dark: a shade darker, so the paper's edge shows. */
const CAD_DARK_OFF_PAPER = [0x0a / 255, 0x0c / 255, 0x10 / 255] as const
const COMPARE_RED = [0xd0 / 255, 0x34 / 255, 0x2c / 255] as const
const COMPARE_ORANGE = [0xff / 255, 0x9a / 255, 0x2e / 255] as const

export interface DrawOptions {
  /** Paper unless said (4.6). */
  palette?: Palette
  /** Text whose glyphs are shorter than this on screen, in device px, is drawn as grey bars (4.6). */
  greekBelowPx?: number
  /** Those bars' ink, 0 to 1 (`--canvas-dim-greek` on white). */
  greekInk?: number
}

/** One WebGL 2 context drawing one sheet at a time on its canvas. */
export class SheetRenderer {
  readonly gl: WebGL2RenderingContext
  private readonly fill: Program
  private readonly line: Program
  private readonly glyph: Program
  private readonly corners: WebGLBuffer
  private current: Uploaded | null = null
  /** The frame being drawn; a new one ends it. */
  private job: DrawJob | null = null
  readonly canvas: HTMLCanvasElement | OffscreenCanvas

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      depth: false,
      stencil: false,
    }) as WebGL2RenderingContext | null
    if (!gl) throw new SheetGlError('WebGL 2 is not available')
    this.gl = gl
    this.fill = compile(gl, FILL_VS, FILL_FS)
    this.line = compile(gl, LINE_VS, LINE_FS)
    this.glyph = compile(gl, GLYPH_VS, GLYPH_FS)
    this.corners = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corners)
    // A quad as a strip, for lines (-1..1) and glyphs (0..1, the second four).
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
  }

  /** Draws `sheet` at `view` over the whole canvas (its size in device pixels), all at once. */
  draw(sheet: DecodedSheet, view: ViewTransform, options: DrawOptions = {}): void {
    const job = this.begin(sheet, view, options)
    let more = job !== null
    while (more) more = job!.step(Infinity)
  }

  /**
   * Starts drawing `sheet` at `view`: the paper now, its marks a part at a time with `step` (issue #828:
   * a million lines at once kept a slow GPU, and the page waiting on it, busy for seconds). Marks blend
   * by minimum or maximum, so the parts give the picture `draw` gives, in any order. Null when the
   * context is lost; throws SheetGlError for a frame past the work budget, before drawing anything.
   */
  begin(sheet: DecodedSheet, view: ViewTransform, { greekBelowPx = 0, greekInk = 0.3, palette = 'paper' }: DrawOptions = {}): DrawJob | null {
    const gl = this.gl
    this.job = null
    if (gl.isContextLost()) return null
    const up = this.upload(sheet)
    const width = gl.drawingBufferWidth
    const height = gl.drawingBufferHeight
    const budget = WORK_PER_PIXEL * width * height + WORK_FLOOR
    // The bound first (linear in the work grid's cells); the count over every record only when it is past
    // the budget, or not a number (a scale so large its square overflows): never skipped on a NaN.
    if (!(workBound(prepared(sheet).work, view, width, height) <= budget) && !(frameWork(sheet, view, width, height) <= budget)) {
      throw new SheetGlError('the sheet draws over itself too many times to draw')
    }
    const dark = palette === 'dark' || palette === 'compare-dark'
    gl.viewport(0, 0, width, height)
    if (palette === 'dark') gl.clearColor(...CAD_DARK_OFF_PAPER, 1)
    else gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const ground = palette === 'dark' ? CAD_DARK_GROUND : palette === 'compare-dark' ? ([0, 0, 0] as const) : ([1, 1, 1] as const)
    const inkColour = palette === 'compare-dark' ? COMPARE_ORANGE : COMPARE_RED
    const common = (p: Program) => {
      gl.viewport(0, 0, width, height)
      gl.useProgram(p.program)
      gl.uniform2f(p.uniform('uSize'), width, height)
      gl.uniform1f(p.uniform('uScale'), view.scale)
      gl.uniform2f(p.uniform('uOffset'), view.x, view.y)
      gl.uniform1i(p.uniform('uPalette'), PALETTE[palette])
      gl.uniform3f(p.uniform('uGround'), ...ground)
      gl.uniform3f(p.uniform('uInk'), ...inkColour)
    }
    // The paper, its ground and opaque.
    gl.disable(gl.BLEND)
    common(this.fill)
    gl.uniform1i(this.fill.uniform('uInked'), 0)
    gl.uniform4f(this.fill.uniform('uColor'), ...ground, 1)
    gl.bindVertexArray(up.paper)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindVertexArray(null)

    // Ink: on white the darker wins; on a dark ground the lighter. Fills, then lines, then glyphs, each
    // from where the part before stopped.
    const ink = () => {
      gl.enable(gl.BLEND)
      if (dark) gl.blendEquation(gl.MAX)
      else gl.blendEquationSeparate(gl.MIN, gl.MAX)
      gl.blendFunc(gl.ONE, gl.ONE)
    }
    const kinds = [
      {
        count: up.fillCount,
        draw: (first: number, n: number) => {
          common(this.fill)
          gl.uniform1i(this.fill.uniform('uInked'), 1)
          gl.bindVertexArray(up.fills)
          gl.drawArrays(gl.TRIANGLES, first * 3, n * 3)
        },
      },
      {
        count: sheet.lines.count,
        draw: (first: number, n: number) => {
          common(this.line)
          gl.bindVertexArray(up.lines)
          this.pointLines(up, first)
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n)
        },
      },
      {
        count: sheet.glyphs.count,
        draw: (first: number, n: number) => {
          common(this.glyph)
          gl.uniform2f(this.glyph.uniform('uAtlasSize'), sheet.atlas.width, sheet.atlas.height)
          gl.activeTexture(gl.TEXTURE0)
          gl.bindTexture(gl.TEXTURE_2D, up.atlas)
          gl.uniform1i(this.glyph.uniform('uAtlas'), 0)
          gl.uniform1f(this.glyph.uniform('uGreekPx'), greekBelowPx)
          gl.uniform1f(this.glyph.uniform('uGreekInk'), greekInk)
          gl.bindVertexArray(up.glyphs)
          this.pointGlyphs(up, first)
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n)
        },
      },
    ]
    let kind = 0
    let next = 0
    const job: DrawJob = {
      step: (records = partSize) => {
        if (this.job !== job || this.current !== up || gl.isContextLost()) return false
        // Whole records: a part starts and ends on one (its attributes point at a record's first byte).
        let left = Math.max(1, Math.floor(records) || 1)
        ink()
        while (left > 0 && kind < kinds.length) {
          const k = kinds[kind]!
          const n = Math.min(left, k.count - next)
          if (n > 0) k.draw(next, n)
          left -= n
          next += n
          if (next >= k.count) {
            kind++
            next = 0
          }
        }
        gl.bindVertexArray(null)
        if (kind < kinds.length) return true
        this.job = null
        return false
      },
    }
    this.job = job
    return job
  }

  /**
   * Sizes the next part by how long the last one's frame took (from one part to the next: the GPU's
   * work and any wait the page had on it, as a browser that reads the canvas back each frame has),
   * aiming at PART_MS a frame: a fast GPU soon draws a sheet in one part, a slow one never holds the
   * page long. A fence alone cannot tell it: where the browser reads the canvas back, the page has
   * already waited on the GPU before any fence is polled.
   */
  static paced(frameMs: number): void {
    const factor = Math.min(2, Math.max(0.25, PART_MS / Math.max(1, frameMs)))
    partSize = Math.round(Math.min(PART_MAX, Math.max(PART_MIN, partSize * factor)))
  }

  /** How many records the next part draws. */
  static get partRecords(): number {
    return partSize
  }

  /** The lines' instanced attributes from line `first` on (a part's first). */
  private pointLines(up: Uploaded, first: number) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, up.lineData)
    this.point(this.line, 'aSeg', 4, 28, first * 28)
    this.point(this.line, 'aWeight', 1, 28, first * 28 + 16)
    gl.bindBuffer(gl.ARRAY_BUFFER, up.lineColours)
    this.pointColour(this.line, first * 3)
  }

  private pointGlyphs(up: Uploaded, first: number) {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, up.glyphData)
    const at = first * 68
    this.point(this.glyph, 'aPlace', 4, 68, at)
    this.point(this.glyph, 'aAxisY', 2, 68, at + 16)
    this.point(this.glyph, 'aUv', 4, 68, at + 24)
    this.point(this.glyph, 'aRect', 4, 68, at + 40)
    this.point(this.glyph, 'aRun', 1, 68, at + 64)
    gl.bindBuffer(gl.ARRAY_BUFFER, up.glyphColours)
    this.pointColour(this.glyph, first * 3)
  }

  private point(p: Program, name: string, size: number, stride: number, offset: number) {
    const at = p.attribute(name)
    if (at >= 0) this.gl.vertexAttribPointer(at, size, this.gl.FLOAT, false, stride, offset)
  }

  private pointColour(p: Program, offset: number) {
    const at = p.attribute('aColour')
    if (at >= 0) this.gl.vertexAttribPointer(at, 3, this.gl.UNSIGNED_BYTE, true, 3, offset)
  }

  /** Ends the frame being drawn and leaves the canvas empty (a new sheet is on its way). */
  clear(): void {
    const gl = this.gl
    this.job = null
    if (gl.isContextLost()) return
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /**
   * Frees this sheet's GPU buffers. The context itself is left alive: a canvas has one WebGL context
   * for life, and a remount on the same canvas (React's StrictMode, 22 paging) must draw again.
   */
  dispose(): void {
    this.release()
  }

  private release() {
    const gl = this.gl
    this.job = null
    const up = this.current
    if (!up) return
    for (const b of up.buffers) gl.deleteBuffer(b)
    for (const v of [up.paper, up.fills, up.lines, up.glyphs]) gl.deleteVertexArray(v)
    gl.deleteTexture(up.atlas)
    this.current = null
  }

  private upload(sheet: DecodedSheet): Uploaded {
    if (this.current?.sheet === sheet) return this.current
    this.release()
    const gl = this.gl
    const buffers: WebGLBuffer[] = []
    const data = (array: Float32Array) => {
      const b = gl.createBuffer()
      buffers.push(b)
      gl.bindBuffer(gl.ARRAY_BUFFER, b)
      gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW)
      return b
    }
    const attribute = (p: Program, name: string, size: number, stride: number, offset: number, divisor: number) => {
      const at = p.attribute(name)
      if (at < 0) return
      gl.enableVertexAttribArray(at)
      gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride, offset)
      gl.vertexAttribDivisor(at, divisor)
    }
    const bytes = (array: Uint8Array) => {
      const b = gl.createBuffer()
      buffers.push(b)
      gl.bindBuffer(gl.ARRAY_BUFFER, b)
      gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW)
      return b
    }
    /** Each record's colour as three bytes (the buffer bound last), for CAD-dark. */
    const colour = (p: Program, divisor: number) => {
      const at = p.attribute('aColour')
      if (at < 0) return
      gl.enableVertexAttribArray(at)
      gl.vertexAttribPointer(at, 3, gl.UNSIGNED_BYTE, true, 3, 0)
      gl.vertexAttribDivisor(at, divisor)
    }
    const { widthMm: w, heightMm: h } = sheet.paper

    const paper = gl.createVertexArray()
    gl.bindVertexArray(paper)
    data(new Float32Array([0, 0, w, 0, 0, h, w, h]))
    attribute(this.fill, 'aPos', 2, 8, 0, 0)

    const ready = prepared(sheet)
    const t = sheet.triangles
    const fills = gl.createVertexArray()
    gl.bindVertexArray(fills)
    data(ready.fillPositions)
    attribute(this.fill, 'aPos', 2, 8, 0, 0)
    bytes(ready.fillColours)
    colour(this.fill, 0)

    const lines = gl.createVertexArray()
    gl.bindVertexArray(lines)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corners)
    attribute(this.line, 'aCorner', 2, 8, 0, 0)
    const lineData = data(sheet.lines.f32)
    attribute(this.line, 'aSeg', 4, 28, 0, 1)
    attribute(this.line, 'aWeight', 1, 28, 16, 1)
    const lineColours = bytes(ready.lineColours)
    colour(this.line, 1)

    // Each glyph instance with its atlas glyph's rectangles and its run's height, 17 floats (prepare.ts).
    const glyphs = gl.createVertexArray()
    gl.bindVertexArray(glyphs)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corners)
    attribute(this.glyph, 'aCorner', 2, 8, 32, 0)
    const glyphData = data(ready.glyphInstances)
    attribute(this.glyph, 'aPlace', 4, 68, 0, 1)
    attribute(this.glyph, 'aAxisY', 2, 68, 16, 1)
    attribute(this.glyph, 'aUv', 4, 68, 24, 1)
    attribute(this.glyph, 'aRect', 4, 68, 40, 1)
    attribute(this.glyph, 'aRun', 1, 68, 64, 1)
    const glyphColours = bytes(ready.glyphColours)
    colour(this.glyph, 1)
    gl.bindVertexArray(null)

    const atlas = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, atlas)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    const { width: aw, height: ah, pixels } = sheet.atlas
    if (aw > 0 && ah > 0) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, aw, ah, 0, gl.RED, gl.UNSIGNED_BYTE, pixels)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(1))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.current = { sheet, paper, fills, fillCount: t.count, lines, lineData, lineColours, glyphs, glyphData, glyphColours, atlas, buffers }
    return this.current
  }
}

/**
 * The pixels one frame would shade, summed: a line's quad, a triangle's or a glyph's box on screen,
 * each cut to the canvas. Linear in the records, so it costs far less than the drawing.
 */
export function frameWork(sheet: DecodedSheet, view: ViewTransform, width: number, height: number): number {
  const { scale, x, y } = view
  let work = 0
  const box = (x0: number, y0: number, x1: number, y1: number, pad: number) => {
    // Paper mm to canvas px: x grows right, y grows down.
    const left = Math.max(0, x + Math.min(x0, x1) * scale - pad)
    const right = Math.min(width, x + Math.max(x0, x1) * scale + pad)
    const top = Math.max(0, y - Math.max(y0, y1) * scale - pad)
    const bottom = Math.min(height, y - Math.min(y0, y1) * scale + pad)
    if (right > left && bottom > top) work += (right - left) * (bottom - top)
  }
  const l = sheet.lines
  for (let i = 0; i < l.count; i++) {
    const o = i * l.stride
    // A line shades its quad: its length plus a reach at each end, by twice its reach across (a
    // diagonal hatch line costs its own strip, never its whole box), cut to the canvas.
    const reach = Math.max(0.5, (l.f32[o + 4]! * scale) / 2) + 1
    const shown = clippedLength(x + l.f32[o]! * scale, y - l.f32[o + 1]! * scale, x + l.f32[o + 2]! * scale, y - l.f32[o + 3]! * scale, -reach, -reach, width + reach, height + reach)
    if (shown !== null) work += (shown + 2 * reach) * 2 * reach
  }
  const t = sheet.triangles
  for (let i = 0; i < t.count; i++) {
    const o = i * t.stride
    const f = t.f32
    box(Math.min(f[o]!, f[o + 2]!, f[o + 4]!), Math.min(f[o + 1]!, f[o + 3]!, f[o + 5]!), Math.max(f[o]!, f[o + 2]!, f[o + 4]!), Math.max(f[o + 1]!, f[o + 3]!, f[o + 5]!), 1)
  }
  for (let i = 0; i < sheet.glyphs.count; i++) {
    const [x0, y0, x1, y1] = glyphBox(sheet, i)
    box(x0, y0, x1, y1, 1)
  }
  return work
}

/** The length of segment (x0, y0)–(x1, y1) inside the box, or null when it misses it (Liang–Barsky). */
function clippedLength(x0: number, y0: number, x1: number, y1: number, left: number, top: number, right: number, bottom: number): number | null {
  const dx = x1 - x0
  const dy = y1 - y0
  let t0 = 0
  let t1 = 1
  // The four edges as (p, q) pairs, without an array per call: a dense sheet counts a million lines a frame.
  for (let edge = 0; edge < 4; edge++) {
    const p = edge === 0 ? -dx : edge === 1 ? dx : edge === 2 ? -dy : dy
    const q = edge === 0 ? x0 - left : edge === 1 ? right - x0 : edge === 2 ? y0 - top : bottom - y0
    if (p === 0) {
      if (q < 0) return null
    } else {
      const r = q / p
      if (p < 0) t0 = Math.max(t0, r)
      else t1 = Math.min(t1, r)
      if (t0 > t1) return null
    }
  }
  return (t1 - t0) * Math.hypot(dx, dy)
}

export { runHeights } from './prepare'

let shared: SheetRenderer | null = null

/**
 * Draws `sheet` on Paper into a 2D canvas at `view` (the pixel test's entry, and a thumbnail's): drawn
 * by WebGL on one shared canvas, then copied over `ctx`'s whole canvas.
 */
export function drawSheet(ctx: CanvasRenderingContext2D, sheet: DecodedSheet, view: ViewTransform): void {
  const { width, height } = ctx.canvas
  if (!shared || shared.gl.isContextLost()) shared = new SheetRenderer(document.createElement('canvas'))
  const canvas = shared.canvas
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  shared.draw(sheet, view)
  ctx.drawImage(canvas, 0, 0)
}
