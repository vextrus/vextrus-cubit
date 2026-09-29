/* eslint-disable lingui/no-unlocalized-strings -- the format's words and developer errors; nothing here is shown in the UI */
/*
 * The browser's side of the sheet buffer (engine/render/buffers.py, "The buffer format, version 1").
 * The format is the engine's; this file only reads it, and refuses what `SheetBuffers.from_bytes`
 * refuses, with one error type and never reading past the data: a buffer comes from the server, and a
 * bad one must fail as "could not be drawn", never as a hang, a crash or a picture drawn from garbage.
 *
 *   const sheet = decodeSheet(await response.arrayBuffer())   // or throws SheetBufferError
 */

export const MAGIC = 'VXSB'
export const VERSION = 1
export const HEADER_SIZE = 56
export const SECTION_SIZE = 16
const MAX_SECTIONS = 64
const MAX_PAPER_MM = 100_000
const MAX_LINEWEIGHT_MM = 2.11
const MAX_STATS_BYTES = 1 << 20

/** A buffer that is not a valid version-1 sheet buffer. Its message is for developers, never shown. */
export class SheetBufferError extends Error {
  override name = 'SheetBufferError'
}

/** Records of one fixed-size kind: `f32` and `u32` views over the same bytes, `stride` words each. */
export interface Records {
  count: number
  stride: number
  f32: Float32Array
  u32: Uint32Array
}

export interface Paper {
  widthMm: number
  heightMm: number
  mmPerUnit: number
  /** 0 the layout's own, 1 a standard sheet, 2 assumed (A1's long side). */
  source: number
  originX: number
  originY: number
}

export interface DecodedSheet {
  paper: Paper
  /** A budget was reached: the sheet is cut. */
  cut: boolean
  /** x0, y0, x1, y1, lineweight (mm), colour, primitive. */
  lines: Records
  /** x0, y0, x1, y1, x2, y2 (mm), colour, primitive. */
  triangles: Records
  /** atlas glyph, origin x, y, x axis (x, y), y axis (x, y) (mm), colour, primitive. */
  glyphs: Records
  /** u0, v0, u1, v1 (u16 pairs, two words), x0, y0, x1, y1 (text units). */
  atlasGlyphs: { count: number; u16: Uint16Array; f32: Float32Array }
  atlas: { width: number; height: number; pixels: Uint8Array }
  strings: string[]
  stats: Record<string, number>
}

const FIXED = { LINE: 28, TRIS: 32, GLYF: 36, AGLY: 24, PRIM: 20, FONT: 20 } as const
const NEEDED = ['STRS', 'CHNS', 'PRIM', 'LINE', 'TRIS', 'GLYF', 'AGLY', 'ATLS', 'FONT', 'STAT']

function fail(why: string): never {
  throw new SheetBufferError(why)
}

interface Section {
  bytes: Uint8Array
  count: number
}

/** Reads and checks a sheet buffer; the caller may change or drop `buffer` afterwards. */
export function decodeSheet(buffer: ArrayBuffer): DecodedSheet {
  if (!(buffer instanceof ArrayBuffer)) fail('a sheet buffer is an ArrayBuffer')
  const size = buffer.byteLength
  if (size < HEADER_SIZE) fail('shorter than its header')
  const view = new DataView(buffer)
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4))
  if (magic !== MAGIC) fail('not a sheet buffer (its magic is wrong)')
  const version = view.getUint16(4, true)
  if (version !== VERSION) fail(`version ${version}, and this code reads only ${VERSION}`)
  const flags = view.getUint16(6, true)
  if (view.getUint32(8, true) !== HEADER_SIZE) fail('its header size is wrong')
  const total = view.getUint32(12, true)
  if (total !== size) fail(`it says it is ${total} bytes long, and it is ${size}`)
  const width = view.getFloat32(16, true)
  const height = view.getFloat32(20, true)
  const mmPerUnit = view.getFloat64(24, true)
  const count = view.getUint32(32, true)
  const source = view.getUint32(36, true)
  const originX = view.getFloat64(40, true)
  const originY = view.getFloat64(48, true)
  if (!(count <= MAX_SECTIONS && HEADER_SIZE + count * SECTION_SIZE <= size)) fail('its section table does not fit it')
  if (![width, height, mmPerUnit, originX, originY].every(Number.isFinite)) fail('its paper is not finite')
  if (!(width > 0 && width <= MAX_PAPER_MM && height > 0 && height <= MAX_PAPER_MM && mmPerUnit > 0)) fail('its paper is no sheet’s')
  if (source > 2 || flags > 1) fail('its paper source or flags are unknown')

  const tableEnd = HEADER_SIZE + count * SECTION_SIZE
  const found = new Map<string, Section>()
  const spans: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const entry = HEADER_SIZE + i * SECTION_SIZE
    const fourcc = String.fromCharCode(...new Uint8Array(buffer, entry, 4))
    const offset = view.getUint32(entry + 4, true)
    const length = view.getUint32(entry + 8, true)
    const records = view.getUint32(entry + 12, true)
    if (offset < tableEnd || offset + length > size || offset % 8) fail(`section ${fourcc} lies outside the buffer`)
    if (found.has(fourcc)) fail(`section ${fourcc} is given twice`)
    spans.push([offset, offset + length])
    // A copy: the caller's buffer may change after decoding, and a copy starts aligned.
    found.set(fourcc, { bytes: new Uint8Array(buffer.slice(offset, offset + length)), count: records })
  }
  spans.sort((a, b) => a[0] - b[0])
  for (let i = 1; i < spans.length; i++) if (spans[i - 1]![1] > spans[i]![0]) fail('two sections overlap')
  if (found.size !== NEEDED.length || !NEEDED.every((f) => found.has(f))) fail('its sections are not the version’s')
  const get = (fourcc: string) => found.get(fourcc)!

  const fixed = (fourcc: keyof typeof FIXED): Records => {
    const { bytes, count: n } = get(fourcc)
    if (bytes.byteLength !== n * FIXED[fourcc]) fail(`section ${fourcc}'s length is not its records'`)
    return { count: n, stride: FIXED[fourcc] / 4, f32: new Float32Array(bytes.buffer), u32: new Uint32Array(bytes.buffer) }
  }
  const lines = fixed('LINE')
  const triangles = fixed('TRIS')
  const glyphs = fixed('GLYF')
  const agly = fixed('AGLY')
  const prims = fixed('PRIM')
  const fonts = fixed('FONT')
  const strings = readStrings(get('STRS'))
  const chains = readChains(get('CHNS'), strings.length)
  if (get('ATLS').count !== 1) fail('the atlas section’s record count is not 1')
  const atlas = readAtlas(get('ATLS').bytes)
  const stats = readStats(get('STAT'))

  // Every float finite (AGLY's floats are its words 2..5; its first two words are u16 pairs).
  finite(lines, [0, 1, 2, 3, 4], 'LINE')
  finite(triangles, [0, 1, 2, 3, 4, 5], 'TRIS')
  finite(glyphs, [1, 2, 3, 4, 5, 6], 'GLYF')
  finite(agly, [2, 3, 4, 5], 'AGLY')
  for (let i = 0; i < lines.count; i++) {
    const w = lines.f32[i * lines.stride + 4]!
    if (!(w >= 0 && w <= MAX_LINEWEIGHT_MM + 1e-6)) fail('a lineweight is off its range')
  }
  below(prims, [0, 1, 2, 4], strings.length, 'a primitive names a string past the table')
  below(prims, [3], chains, 'a primitive names a chain past the table')
  below(lines, [6], prims.count, 'a LINE record names a primitive past the table')
  below(triangles, [7], prims.count, 'a TRIS record names a primitive past the table')
  below(glyphs, [8], prims.count, 'a GLYF record names a primitive past the table')
  below(glyphs, [0], agly.count, 'a glyph names an atlas glyph past the table')
  const u16 = new Uint16Array(agly.u32.buffer)
  for (let i = 0; i < agly.count; i++) {
    const [u0, v0, u1, v1] = [u16[i * 12]!, u16[i * 12 + 1]!, u16[i * 12 + 2]!, u16[i * 12 + 3]!]
    const f = i * agly.stride
    if (!(u0 < u1 && v0 < v1 && u1 <= atlas.width && v1 <= atlas.height && agly.f32[f + 2]! < agly.f32[f + 4]! && agly.f32[f + 3]! < agly.f32[f + 5]!)) {
      fail('an atlas glyph lies outside the atlas or is empty')
    }
  }
  below(fonts, [0, 1, 2, 3], strings.length, 'a font names a string past the table')

  return {
    paper: { widthMm: width, heightMm: height, mmPerUnit, source, originX, originY },
    cut: (flags & 1) === 1,
    lines,
    triangles,
    glyphs,
    atlasGlyphs: { count: agly.count, u16, f32: agly.f32 },
    atlas,
    strings,
    stats,
  }
}

function finite(r: Records, words: number[], fourcc: string) {
  for (let i = 0; i < r.count; i++) {
    for (const w of words) if (!Number.isFinite(r.f32[i * r.stride + w]!)) fail(`a ${fourcc} value is not finite`)
  }
}

function below(r: Records, words: number[], limit: number, why: string) {
  for (let i = 0; i < r.count; i++) {
    for (const w of words) if (r.u32[i * r.stride + w]! >= limit) fail(why)
  }
}

const utf8 = new TextDecoder('utf-8', { fatal: true })

function readStrings({ bytes, count }: Section): string[] {
  const view = new DataView(bytes.buffer)
  const out: string[] = []
  let at = 0
  for (let i = 0; i < count; i++) {
    if (at + 4 > bytes.byteLength) fail('the strings run past their section')
    const length = view.getUint32(at, true)
    at += 4
    if (at + length > bytes.byteLength) fail('a string runs past its section')
    try {
      out.push(utf8.decode(bytes.subarray(at, at + length)))
    } catch {
      fail('a string is not UTF-8')
    }
    at += length
  }
  if (at !== bytes.byteLength) fail('the strings section has bytes left over')
  return out
}

/** Checks the insert chains and returns how many there are (the viewer draws none of them). */
function readChains({ bytes, count }: Section, strings: number): number {
  const view = new DataView(bytes.buffer)
  let at = 0
  for (let i = 0; i < count; i++) {
    if (at + 4 > bytes.byteLength) fail('the chains run past their section')
    const n = view.getUint32(at, true)
    at += 4
    if (i === 0 && n !== 0) fail('chain 0 is not the empty chain')
    if (n > (bytes.byteLength - at) / 4) fail('a chain runs past its section')
    for (let k = 0; k < n; k++, at += 4) if (view.getUint32(at, true) >= strings) fail('a chain names a string past the table')
  }
  if (at !== bytes.byteLength || count === 0) fail('the chains section is not a list of chains starting with the empty one')
  return count
}

function readAtlas(bytes: Uint8Array): DecodedSheet['atlas'] {
  if (bytes.byteLength < 8) fail('the atlas has no size')
  const view = new DataView(bytes.buffer)
  const width = view.getUint32(0, true)
  const height = view.getUint32(4, true)
  if (width * height !== bytes.byteLength - 8) fail('the atlas’s size is not its pixels’')
  return { width, height, pixels: bytes.subarray(8) }
}

function readStats({ bytes, count }: Section): Record<string, number> {
  if (bytes.byteLength > MAX_STATS_BYTES) fail('its counts are larger than a megabyte')
  let stats: unknown
  try {
    stats = JSON.parse(utf8.decode(bytes))
  } catch {
    fail('its counts are not JSON')
  }
  if (typeof stats !== 'object' || stats === null || Array.isArray(stats)) fail('its counts are not names to integers')
  const entries = Object.entries(stats)
  if (!entries.every(([, v]) => Number.isInteger(v))) fail('its counts are not names to integers')
  if (entries.length !== count) fail('the counts section’s record count is not its names’')
  return Object.fromEntries(entries) as Record<string, number>
}

/** The box around everything drawn on the sheet, in paper mm; null for a blank sheet. */
export function usedExtents(sheet: DecodedSheet): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const add = (x: number, y: number) => {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  const { lines: l, triangles: t, glyphs: g } = sheet
  for (let i = 0; i < l.count; i++) {
    const o = i * l.stride
    add(l.f32[o]!, l.f32[o + 1]!)
    add(l.f32[o + 2]!, l.f32[o + 3]!)
  }
  for (let i = 0; i < t.count; i++) for (let k = 0; k < 3; k++) add(t.f32[i * t.stride + 2 * k]!, t.f32[i * t.stride + 2 * k + 1]!)
  for (let i = 0; i < g.count; i++) add(g.f32[i * g.stride + 1]!, g.f32[i * g.stride + 2]!)
  return x1 < x0 ? null : { x0, y0, x1, y1 }
}
