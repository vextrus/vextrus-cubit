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
void ink(float a) { if (a <= 0.0) discard; outColor = vec4(1.0 - a, 1.0 - a, 1.0 - a, a); }
`

const FILL_VS = `${PREAMBLE}
in vec2 aPos;
void main() { gl_Position = toClip(toPx(aPos)); }`
const FILL_FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main() { outColor = uColor; }`

const LINE_VS = `${PREAMBLE}
in vec2 aCorner;
in vec4 aSeg;
in float aWeight;
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
uniform float uGreekPx;
out vec2 vUv;
flat out float vTextPx;
flat out float vGreek;
void main() {
  vec2 g = mix(aRect.xy, aRect.zw, aCorner);
  vec2 mm = aPlace.xy + g.x * aPlace.zw + g.y * aAxisY;
  vUv = vec2(mix(aUv.x, aUv.z, aCorner.x), mix(aUv.w, aUv.y, aCorner.y)) / uAtlasSize;
  float det = aPlace.z * aAxisY.y - aPlace.w * aAxisY.x;
  vTextPx = sqrt(abs(det)) * uScale;
  vGreek = (aRect.w - aRect.y) * length(aAxisY) * uScale < uGreekPx ? 1.0 : 0.0;
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
  glyphs: WebGLVertexArrayObject
  atlas: WebGLTexture
  buffers: WebGLBuffer[]
}

export interface DrawOptions {
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

  /** Draws `sheet` at `view` over the whole canvas (its size in device pixels). */
  draw(sheet: DecodedSheet, view: ViewTransform, { greekBelowPx = 0, greekInk = 0.3 }: DrawOptions = {}): void {
    const gl = this.gl
    if (gl.isContextLost()) return
    const up = this.upload(sheet)
    const width = gl.drawingBufferWidth
    const height = gl.drawingBufferHeight
    if (frameWork(sheet, view, width, height) > WORK_PER_PIXEL * width * height + WORK_FLOOR) {
      throw new SheetGlError('the sheet draws over itself too many times to draw')
    }
    gl.viewport(0, 0, width, height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const common = (p: Program) => {
      gl.useProgram(p.program)
      gl.uniform2f(p.uniform('uSize'), width, height)
      gl.uniform1f(p.uniform('uScale'), view.scale)
      gl.uniform2f(p.uniform('uOffset'), view.x, view.y)
    }
    // The paper, white and opaque.
    gl.disable(gl.BLEND)
    common(this.fill)
    gl.uniform4f(this.fill.uniform('uColor'), 1, 1, 1, 1)
    gl.bindVertexArray(up.paper)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    // Ink: the darker wins.
    gl.enable(gl.BLEND)
    gl.blendEquationSeparate(gl.MIN, gl.MAX)
    gl.blendFunc(gl.ONE, gl.ONE)
    if (up.fillCount) {
      gl.uniform4f(this.fill.uniform('uColor'), 0, 0, 0, 1)
      gl.bindVertexArray(up.fills)
      gl.drawArrays(gl.TRIANGLES, 0, up.fillCount * 3)
    }
    if (sheet.lines.count) {
      common(this.line)
      gl.bindVertexArray(up.lines)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, sheet.lines.count)
    }
    if (sheet.glyphs.count) {
      common(this.glyph)
      gl.uniform2f(this.glyph.uniform('uAtlasSize'), sheet.atlas.width, sheet.atlas.height)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, up.atlas)
      gl.uniform1i(this.glyph.uniform('uAtlas'), 0)
      gl.uniform1f(this.glyph.uniform('uGreekPx'), greekBelowPx)
      gl.uniform1f(this.glyph.uniform('uGreekInk'), greekInk)
      gl.bindVertexArray(up.glyphs)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, sheet.glyphs.count)
    }
    gl.bindVertexArray(null)
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
    const { widthMm: w, heightMm: h } = sheet.paper

    const paper = gl.createVertexArray()
    gl.bindVertexArray(paper)
    data(new Float32Array([0, 0, w, 0, 0, h, w, h]))
    attribute(this.fill, 'aPos', 2, 8, 0, 0)

    const t = sheet.triangles
    const positions = new Float32Array(t.count * 6)
    for (let i = 0; i < t.count; i++) positions.set(t.f32.subarray(i * t.stride, i * t.stride + 6), i * 6)
    const fills = gl.createVertexArray()
    gl.bindVertexArray(fills)
    data(positions)
    attribute(this.fill, 'aPos', 2, 8, 0, 0)

    const lines = gl.createVertexArray()
    gl.bindVertexArray(lines)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corners)
    attribute(this.line, 'aCorner', 2, 8, 0, 0)
    data(sheet.lines.f32)
    attribute(this.line, 'aSeg', 4, 28, 0, 1)
    attribute(this.line, 'aWeight', 1, 28, 16, 1)

    // Each glyph instance with its atlas glyph's rectangles, 16 floats.
    const g = sheet.glyphs
    const a = sheet.atlasGlyphs
    const instances = new Float32Array(g.count * 16)
    for (let i = 0; i < g.count; i++) {
      const at = i * g.stride
      const k = g.u32[at]!
      const o = i * 16
      instances.set(g.f32.subarray(at + 1, at + 7), o)
      instances[o + 6] = a.u16[k * 12]!
      instances[o + 7] = a.u16[k * 12 + 1]!
      instances[o + 8] = a.u16[k * 12 + 2]!
      instances[o + 9] = a.u16[k * 12 + 3]!
      instances.set(a.f32.subarray(k * 6 + 2, k * 6 + 6), o + 10)
    }
    const glyphs = gl.createVertexArray()
    gl.bindVertexArray(glyphs)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corners)
    attribute(this.glyph, 'aCorner', 2, 8, 32, 0)
    data(instances)
    attribute(this.glyph, 'aPlace', 4, 64, 0, 1)
    attribute(this.glyph, 'aAxisY', 2, 64, 16, 1)
    attribute(this.glyph, 'aUv', 4, 64, 24, 1)
    attribute(this.glyph, 'aRect', 4, 64, 40, 1)
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

    this.current = { sheet, paper, fills, fillCount: t.count, lines, glyphs, atlas, buffers }
    return this.current
  }
}

/**
 * The pixels one frame would shade: each primitive's box on screen, cut to the canvas (what the
 * rasteriser visits for it), summed. Linear in the records, so it costs far less than the drawing.
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
    // A line's quad reaches its half width and a pixel past its box on every side.
    box(l.f32[o]!, l.f32[o + 1]!, l.f32[o + 2]!, l.f32[o + 3]!, Math.max(0.5, (l.f32[o + 4]! * scale) / 2) + 1)
  }
  const t = sheet.triangles
  for (let i = 0; i < t.count; i++) {
    const o = i * t.stride
    const f = t.f32
    box(Math.min(f[o]!, f[o + 2]!, f[o + 4]!), Math.min(f[o + 1]!, f[o + 3]!, f[o + 5]!), Math.max(f[o]!, f[o + 2]!, f[o + 4]!), Math.max(f[o + 1]!, f[o + 3]!, f[o + 5]!), 1)
  }
  const g = sheet.glyphs
  const a = sheet.atlasGlyphs
  for (let i = 0; i < g.count; i++) {
    const o = i * g.stride
    const k = g.u32[o]! * 6
    const [ox, oy, ax, ay, bx, by] = [g.f32[o + 1]!, g.f32[o + 2]!, g.f32[o + 3]!, g.f32[o + 4]!, g.f32[o + 5]!, g.f32[o + 6]!]
    const [gx0, gy0, gx1, gy1] = [a.f32[k + 2]!, a.f32[k + 3]!, a.f32[k + 4]!, a.f32[k + 5]!]
    const xs = [gx0 * ax + gy0 * bx, gx1 * ax + gy0 * bx, gx0 * ax + gy1 * bx, gx1 * ax + gy1 * bx]
    const ys = [gx0 * ay + gy0 * by, gx1 * ay + gy0 * by, gx0 * ay + gy1 * by, gx1 * ay + gy1 * by]
    box(ox + Math.min(...xs), oy + Math.min(...ys), ox + Math.max(...xs), oy + Math.max(...ys), 1)
  }
  return work
}

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
