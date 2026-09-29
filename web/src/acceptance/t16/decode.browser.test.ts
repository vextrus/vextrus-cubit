/*
 * Ticket 16 (docs/plans/M0.md, "16 Sheet viewer"): "the decoder tested against `tiny-sheet.bin`";
 * the orchestrator's ruling: `decodeSheet(buffer: ArrayBuffer): DecodedSheet` "throws a typed
 * `SheetBufferError` on a bad or unknown-version buffer". The format is main's
 * (engine/render/buffers.py, version 1), which 16 never changes; its `from_bytes` refuses "a buffer
 * that breaks any rule above ... never reading past the data", and the viewer's decoder is the
 * browser's side of that trust boundary.
 *
 * Chosen by the acceptance writer (not in the authority): the module entry `@/sheet`, and the decoded
 * sheet's `paper.widthMm`, `paper.heightMm` and `lines.count`, `triangles.count`, `glyphs.count`.
 */
import { describe, expect, it } from 'vitest'
import { decodeSheet, SheetBufferError } from '@/sheet'
import { fixtureBuffer, section, HEADER_SIZE, SECTION_SIZE } from './sheet.fixture'

describe('decodeSheet: the committed fixtures', () => {
  it('decodes tiny-sheet.bin: an A5 paper of 210 x 148 mm', async () => {
    const sheet = decodeSheet(await fixtureBuffer('tiny-sheet'))
    expect(sheet.paper.widthMm).toBeCloseTo(210, 3)
    expect(sheet.paper.heightMm).toBeCloseTo(148, 3)
  })

  it("decodes tiny-sheet.bin's lines, triangles and glyphs, every record", async () => {
    const sheet = decodeSheet(await fixtureBuffer('tiny-sheet'))
    expect({ lines: sheet.lines.count, triangles: sheet.triangles.count, glyphs: sheet.glyphs.count }).toEqual({
      lines: 231,
      triangles: 32,
      glyphs: 60,
    })
  })

  it('decodes the lineweight ramp: 16 lines and nothing else', async () => {
    const sheet = decodeSheet(await fixtureBuffer('lineweight-ramp'))
    expect(sheet.paper.widthMm).toBeCloseTo(210, 3)
    expect({ lines: sheet.lines.count, triangles: sheet.triangles.count, glyphs: sheet.glyphs.count }).toEqual({
      lines: 16,
      triangles: 0,
      glyphs: 0,
    })
  })
})

type Craft = (b: ArrayBuffer) => ArrayBuffer

function edit(change: (view: DataView, buffer: ArrayBuffer) => void): Craft {
  return (b) => {
    change(new DataView(b), b)
    return b
  }
}

const BAD: [string, Craft][] = [
  ['an empty buffer', () => new ArrayBuffer(0)],
  ['a buffer shorter than its header', (b) => b.slice(0, HEADER_SIZE - 1)],
  ['a wrong magic', edit((v) => v.setUint8(0, 'X'.charCodeAt(0)))],
  ['an unknown version (2)', edit((v) => v.setUint16(4, 2, true))],
  ['version 0', edit((v) => v.setUint16(4, 0, true))],
  ['a total size larger than the buffer (cut short)', (b) => b.slice(0, b.byteLength - 8)],
  [
    'a total size smaller than the buffer (bytes after its end)',
    (b) => {
      const longer = new Uint8Array(b.byteLength + 8)
      longer.set(new Uint8Array(b))
      return longer.buffer
    },
  ],
  ['a section count far past the table (0xFFFFFFFF)', edit((v) => v.setUint32(32, 0xffffffff, true))],
  [
    'a section whose offset lies past the end',
    edit((v, b) => v.setUint32(section(b, 'LINE').entry + 4, b.byteLength + 64, true)),
  ],
  [
    'a section overlapping the section table',
    edit((v, b) => v.setUint32(section(b, 'LINE').entry + 4, HEADER_SIZE, true)),
  ],
  [
    'a record count that does not fill its section',
    edit((v, b) => {
      const line = section(b, 'LINE')
      v.setUint32(line.entry + 12, line.count + 1, true)
    }),
  ],
  [
    'a line coordinate that is not finite (NaN)',
    edit((v, b) => v.setFloat32(section(b, 'LINE').offset, Number.NaN, true)),
  ],
  [
    'a lineweight off its range (3 mm)',
    edit((v, b) => v.setFloat32(section(b, 'LINE').offset + 16, 3, true)),
  ],
  [
    "a line's primitive index past the primitive table",
    edit((v, b) => v.setUint32(section(b, 'LINE').offset + 24, 1_000_000, true)),
  ],
  [
    "a glyph's atlas index past the atlas glyphs",
    edit((v, b) => v.setUint32(section(b, 'GLYF').offset, 1_000_000, true)),
  ],
  [
    'a paper width that is not finite (Infinity)',
    edit((v) => v.setFloat32(16, Number.POSITIVE_INFINITY, true)),
  ],
]

describe('decodeSheet refuses a bad buffer with SheetBufferError, and nothing else', () => {
  it('SheetBufferError is an Error', () => {
    expect(SheetBufferError.prototype).toBeInstanceOf(Error)
  })

  it.each(BAD)('refuses %s', async (_, craft) => {
    const bad = craft(await fixtureBuffer('tiny-sheet'))
    let thrown: unknown = null
    try {
      decodeSheet(bad)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(SheetBufferError)
  })

  it('decodes the untouched fixture, whose section table the crafts above read', async () => {
    const buffer = await fixtureBuffer('tiny-sheet')
    expect(section(buffer, 'LINE').entry).toBeGreaterThanOrEqual(HEADER_SIZE + SECTION_SIZE)
    expect(() => decodeSheet(buffer)).not.toThrow()
  })
})
