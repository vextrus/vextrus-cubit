/*
 * A decoded sheet made ready to draw (issue #828): everything the renderer derives from the records
 * once, before its first frame, worked out where the sheet was decoded (the decode Worker) and kept
 * with it, so opening a sheet again rebuilds nothing.
 *
 *   const ready = prepareSheet(sheet)         // in the Worker: arrays for the GPU, the used box, the work grid
 *   keepPrepared(sheet, ready)                // on the main thread, beside the decoded sheet it came with
 *   prepared(sheet)                           // the renderer's: the kept one, else made here once
 *
 * The work grid bounds `frameWork` (gl.ts) from above in time linear in its cells, not the records: a
 * frame whose bound is within the budget is drawn without counting every record.
 */
import { colourRgb } from './colours'
import { usedExtents, type DecodedSheet } from './decode'

export interface PreparedSheet {
  /** Each line's colour as RGB bytes. */
  lineColours: Uint8Array
  /** Each triangle's three corners, x y, mm. */
  fillPositions: Float32Array
  /** Each triangle corner's colour as RGB bytes. */
  fillColours: Uint8Array
  /** Each glyph instance: place (4), y axis (2), atlas uv (4), rect (4), run height (1), 17 floats (gl.ts). */
  glyphInstances: Float32Array
  /** Each glyph's colour as RGB bytes. */
  glyphColours: Uint8Array
  /** The box around everything drawn, paper mm; null for a blank sheet. */
  used: { x0: number; y0: number; x1: number; y1: number } | null
  work: WorkGrid
}

/**
 * The sheet's records summed by cells of a grid over the paper, each record in the cell of its box's
 * centre. Per cell (CELL words): the union of its records' boxes (x0, y0, x1, y1, mm), its lines'
 * total length (mm), count and heaviest lineweight (mm), and its triangles' and glyphs' boxes as
 * Σ w·h (mm²), Σ (w + h) (mm) and their count.
 */
export interface WorkGrid {
  cells: Float64Array
}

const CELL = 13
const GRID_MAX = 64

const keptSheets = new WeakMap<DecodedSheet, PreparedSheet>()

/** Keeps `ready` as `sheet`'s (the Worker's result, carried beside the sheet it decoded). */
export function keepPrepared(sheet: DecodedSheet, ready: PreparedSheet): void {
  keptSheets.set(sheet, ready)
}

/** `sheet` ready to draw: the one kept with it, else made now and kept. */
export function prepared(sheet: DecodedSheet): PreparedSheet {
  let ready = keptSheets.get(sheet)
  if (!ready) {
    ready = prepareSheet(sheet)
    keptSheets.set(sheet, ready)
  }
  return ready
}

/** Every array the renderer uploads, the used box and the work grid, in one pass over the records each. */
export function prepareSheet(sheet: DecodedSheet): PreparedSheet {
  const t = sheet.triangles
  const fillPositions = new Float32Array(t.count * 6)
  for (let i = 0; i < t.count; i++) fillPositions.set(t.f32.subarray(i * t.stride, i * t.stride + 6), i * 6)

  // Each glyph instance with its atlas glyph's rectangles and its run's height, 17 floats.
  const g = sheet.glyphs
  const a = sheet.atlasGlyphs
  const runs = runHeights(sheet)
  const glyphInstances = new Float32Array(g.count * 17)
  for (let i = 0; i < g.count; i++) {
    const at = i * g.stride
    const k = g.u32[at]!
    const o = i * 17
    glyphInstances.set(g.f32.subarray(at + 1, at + 7), o)
    glyphInstances[o + 6] = a.u16[k * 12]!
    glyphInstances[o + 7] = a.u16[k * 12 + 1]!
    glyphInstances[o + 8] = a.u16[k * 12 + 2]!
    glyphInstances[o + 9] = a.u16[k * 12 + 3]!
    glyphInstances.set(a.f32.subarray(k * 6 + 2, k * 6 + 6), o + 10)
    glyphInstances[o + 16] = runs[i]!
  }

  const used = usedExtents(sheet)
  return {
    lineColours: colours(sheet.lines, 5, 1),
    fillPositions,
    fillColours: colours(t, 6, 3),
    glyphInstances,
    glyphColours: colours(g, 7, 1),
    used,
    work: workGrid(sheet, used),
  }
}

/** Each record's colour (the u32 at word `at`) as RGB bytes, `repeat` times over (a triangle's corners). */
function colours(records: { count: number; stride: number; u32: Uint32Array }, at: number, repeat: number): Uint8Array {
  const out = new Uint8Array(records.count * 3 * repeat)
  let last = -1
  let rgb: readonly [number, number, number] = [0, 0, 0]
  for (let i = 0; i < records.count; i++) {
    const colour = records.u32[i * records.stride + at]!
    if (colour !== last) {
      rgb = colourRgb(colour)
      last = colour
    }
    for (let r = 0; r < repeat; r++) out.set(rgb, (i * repeat + r) * 3)
  }
  return out
}

/**
 * Each glyph's run height in mm on paper: the tallest glyph box (its atlas rectangle's height in text
 * units x its y axis's length) among the glyphs of its primitive, so a run below the greeking size
 * draws as bars as a whole, never letter by letter (4.6), and a run is judged by its height as drawn:
 * the y axis alone is not the text height for every font's text units.
 */
export function runHeights(sheet: DecodedSheet): Float32Array {
  const g = sheet.glyphs
  const a = sheet.atlasGlyphs
  const tallest = new Map<number, number>()
  const own = new Float32Array(g.count)
  for (let i = 0; i < g.count; i++) {
    const o = i * g.stride
    const k = g.u32[o]! * 6
    own[i] = (a.f32[k + 5]! - a.f32[k + 3]!) * Math.hypot(g.f32[o + 5]!, g.f32[o + 6]!)
    const prim = g.u32[o + 8]!
    tallest.set(prim, Math.max(tallest.get(prim) ?? 0, own[i]!))
  }
  for (let i = 0; i < g.count; i++) own[i] = tallest.get(g.u32[i * g.stride + 8]!)!
  return own
}

/** A glyph's box on paper (mm), as `frameWork` counts it: its atlas rectangle through its axes. */
export function glyphBox(sheet: DecodedSheet, i: number): [number, number, number, number] {
  const g = sheet.glyphs
  const a = sheet.atlasGlyphs
  const o = i * g.stride
  const k = g.u32[o]! * 6
  const ox = g.f32[o + 1]!
  const oy = g.f32[o + 2]!
  const ax = g.f32[o + 3]!
  const ay = g.f32[o + 4]!
  const bx = g.f32[o + 5]!
  const by = g.f32[o + 6]!
  const gx0 = a.f32[k + 2]!
  const gy0 = a.f32[k + 3]!
  const gx1 = a.f32[k + 4]!
  const gy1 = a.f32[k + 5]!
  const x00 = gx0 * ax + gy0 * bx
  const x10 = gx1 * ax + gy0 * bx
  const x01 = gx0 * ax + gy1 * bx
  const x11 = gx1 * ax + gy1 * bx
  const y00 = gx0 * ay + gy0 * by
  const y10 = gx1 * ay + gy0 * by
  const y01 = gx0 * ay + gy1 * by
  const y11 = gx1 * ay + gy1 * by
  return [ox + Math.min(x00, x10, x01, x11), oy + Math.min(y00, y10, y01, y11), ox + Math.max(x00, x10, x01, x11), oy + Math.max(y00, y10, y01, y11)]
}

function workGrid(sheet: DecodedSheet, used: PreparedSheet['used']): WorkGrid {
  const records = sheet.lines.count + sheet.triangles.count + sheet.glyphs.count
  const side = Math.max(1, Math.min(GRID_MAX, Math.ceil(Math.sqrt(records / 16))))
  const cells = new Float64Array(side * side * CELL)
  for (let c = 0; c < side * side; c++) cells.set([Infinity, Infinity, -Infinity, -Infinity], c * CELL)
  if (!used) return { cells }
  const { x0: ux, y0: uy } = used
  const cw = Math.max(used.x1 - ux, 1e-9) / side
  const ch = Math.max(used.y1 - uy, 1e-9) / side
  const cellOf = (x0: number, y0: number, x1: number, y1: number): number => {
    const cx = Math.min(side - 1, Math.max(0, Math.floor(((x0 + x1) / 2 - ux) / cw)))
    const cy = Math.min(side - 1, Math.max(0, Math.floor(((y0 + y1) / 2 - uy) / ch)))
    const at = (cy * side + cx) * CELL
    if (x0 < cells[at]!) cells[at] = x0
    if (y0 < cells[at + 1]!) cells[at + 1] = y0
    if (x1 > cells[at + 2]!) cells[at + 2] = x1
    if (y1 > cells[at + 3]!) cells[at + 3] = y1
    return at
  }
  const l = sheet.lines
  for (let i = 0; i < l.count; i++) {
    const o = i * l.stride
    const [xa, ya, xb, yb, w] = [l.f32[o]!, l.f32[o + 1]!, l.f32[o + 2]!, l.f32[o + 3]!, l.f32[o + 4]!]
    const at = cellOf(Math.min(xa, xb), Math.min(ya, yb), Math.max(xa, xb), Math.max(ya, yb))
    cells[at + 4]! += Math.hypot(xb - xa, yb - ya)
    cells[at + 5]! += 1
    if (w > cells[at + 6]!) cells[at + 6] = w
  }
  const box = (at: number, x0: number, y0: number, x1: number, y1: number, k: number) => {
    const w = x1 - x0
    const h = y1 - y0
    cells[at + k]! += w * h
    cells[at + k + 1]! += w + h
    cells[at + k + 2]! += 1
  }
  const t = sheet.triangles
  for (let i = 0; i < t.count; i++) {
    const o = i * t.stride
    const f = t.f32
    const x0 = Math.min(f[o]!, f[o + 2]!, f[o + 4]!)
    const y0 = Math.min(f[o + 1]!, f[o + 3]!, f[o + 5]!)
    const x1 = Math.max(f[o]!, f[o + 2]!, f[o + 4]!)
    const y1 = Math.max(f[o + 1]!, f[o + 3]!, f[o + 5]!)
    box(cellOf(x0, y0, x1, y1), x0, y0, x1, y1, 7)
  }
  for (let i = 0; i < sheet.glyphs.count; i++) {
    const [x0, y0, x1, y1] = glyphBox(sheet, i)
    box(cellOf(x0, y0, x1, y1), x0, y0, x1, y1, 10)
  }
  return { cells }
}

/**
 * An upper bound on `frameWork(sheet, view, width, height)` (gl.ts): every cell whose records' box
 * comes near the canvas counted whole, unclipped, at its heaviest lineweight. Never below the count
 * itself, so a frame within the budget by this bound is within it by the count.
 */
export function workBound(grid: WorkGrid, view: { scale: number; x: number; y: number }, width: number, height: number): number {
  const { cells } = grid
  const { scale: s, x, y } = view
  let bound = 0
  for (let at = 0; at < cells.length; at += CELL) {
    const lines = cells[at + 5]!
    const tris = cells[at + 9]!
    const glyphs = cells[at + 12]!
    if (lines === 0 && tris === 0 && glyphs === 0) continue
    const reach = Math.max(0.5, (cells[at + 6]! * s) / 2) + 1
    const margin = reach + 1
    const left = x + cells[at]! * s
    const right = x + cells[at + 2]! * s
    const top = y - cells[at + 3]! * s
    const bottom = y - cells[at + 1]! * s
    if (right + margin < 0 || left - margin > width || bottom + margin < 0 || top - margin > height) continue
    bound += (cells[at + 4]! * s + 2 * reach * lines) * 2 * reach
    bound += s * s * cells[at + 7]! + 2 * s * cells[at + 8]! + 4 * tris
    bound += s * s * cells[at + 10]! + 2 * s * cells[at + 11]! + 4 * glyphs
  }
  // The count sums float32 records in another order: a little room for its rounding.
  return bound * 1.001 + 1
}
