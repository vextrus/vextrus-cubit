/*
 * The decoder's trust boundary beyond 16's acceptance list: every other rule engine/render/buffers.py's
 * `_decode` checks, each refused with SheetBufferError and nothing else (a crafted buffer from the
 * server must fail as "could not be drawn", never as a crash, a hang or a picture of garbage).
 */
import { describe, expect, it } from 'vitest'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import { decodeSheet, SheetBufferError } from './decode'
import { entry, withSection } from './buffer.fixture'

async function tiny(): Promise<ArrayBuffer> {
  return (await fetch(tinySheetUrl)).arrayBuffer()
}


const stats = (text: string, bom = false): Craft => (b) => {
  const body = new TextEncoder().encode(text)
  const payload = bom ? new Uint8Array([0xef, 0xbb, 0xbf, ...body]) : body
  return withSection(b, 'STAT', payload, 1)
}

type Craft = (b: ArrayBuffer, v: DataView) => ArrayBuffer | void

const rename = (from: string, to: string): Craft => (b) => new Uint8Array(b, entry(b, from).at, 4).set([...to].map((c) => c.charCodeAt(0)))

const BAD: [string, Craft][] = [
  ['a header size that is not 56', (_, v) => v.setUint32(8, 64, true)],
  ['an unknown paper source (3)', (_, v) => v.setUint32(36, 3, true)],
  ['an unknown flag (bit 1)', (_, v) => v.setUint16(6, 2, true)],
  ['a paper wider than 100 m', (_, v) => v.setFloat32(16, 100_001, true)],
  ['a paper of no height', (_, v) => v.setFloat32(20, 0, true)],
  ['mm per unit of 0', (_, v) => v.setFloat64(24, 0, true)],
  ['an origin that is not finite', (_, v) => v.setFloat64(40, Number.NaN, true)],
  ['a section count past 64', (_, v) => v.setUint32(32, 65, true)],
  ['a section given twice', rename('TRIS', 'LINE')],
  ['a section the version does not have', rename('STAT', 'XXXX')],
  ['a section off its 8-byte alignment', (b, v) => v.setUint32(entry(b, 'STAT').at + 4, entry(b, 'STAT').offset + 1, true)],
  ['a string that is not UTF-8', (b) => void (new Uint8Array(b)[entry(b, 'STRS').offset + 4] = 0xff)],
  ['strings that leave bytes over', (b, v) => v.setUint32(entry(b, 'STRS').at + 12, entry(b, 'STRS').count - 1, true)],
  ['more strings than the section holds', (b, v) => v.setUint32(entry(b, 'STRS').at + 12, entry(b, 'STRS').count + 1, true)],
  ['a first chain that is not empty', (b, v) => v.setUint32(entry(b, 'CHNS').offset, 1, true)],
  ['a chain of a billion strings', (b, v) => v.setUint32(entry(b, 'CHNS').offset, 1_000_000_000, true)],
  ['no chains at all', (b, v) => v.setUint32(entry(b, 'CHNS').at + 12, 0, true)],
  ['an atlas record count of 2', (b, v) => v.setUint32(entry(b, 'ATLS').at + 12, 2, true)],
  ['an atlas whose size is not its pixels', (b, v) => v.setUint32(entry(b, 'ATLS').offset, 9999, true)],
  ['counts that are not JSON', (b) => void (new Uint8Array(b)[entry(b, 'STAT').offset] = 0x78)],
  ['a counts record count that is not its names', (b, v) => v.setUint32(entry(b, 'STAT').at + 12, entry(b, 'STAT').count + 1, true)],
  ['a negative lineweight', (b, v) => v.setFloat32(entry(b, 'LINE').offset + 16, -0.1, true)],
  ['a triangle corner that is not finite', (b, v) => v.setFloat32(entry(b, 'TRIS').offset + 8, Number.POSITIVE_INFINITY, true)],
  ['a glyph axis that is not finite', (b, v) => v.setFloat32(entry(b, 'GLYF').offset + 12, Number.NaN, true)],
  ["a triangle's primitive past the table", (b, v) => v.setUint32(entry(b, 'TRIS').offset + 28, 1_000_000, true)],
  ["a glyph's primitive past the table", (b, v) => v.setUint32(entry(b, 'GLYF').offset + 32, 1_000_000, true)],
  ['a primitive naming a string past the table', (b, v) => v.setUint32(entry(b, 'PRIM').offset, 1_000_000, true)],
  ['a primitive naming a chain past the table', (b, v) => v.setUint32(entry(b, 'PRIM').offset + 12, 1_000_000, true)],
  ['an empty atlas glyph (u0 = u1)', (b, v) => v.setUint16(entry(b, 'AGLY').offset + 4, v.getUint16(entry(b, 'AGLY').offset, true), true)],
  ['an atlas glyph past the atlas', (b, v) => v.setUint16(entry(b, 'AGLY').offset + 6, 65535, true)],
  ['an atlas glyph whose text rectangle is empty', (b, v) => v.setFloat32(entry(b, 'AGLY').offset + 16, -1e9, true)],
  ['a font naming a string past the table', (b, v) => entry(b, 'FONT').count && v.setUint32(entry(b, 'FONT').offset, 1_000_000, true)],
  // The refuter's finding on 16: JavaScript read these as integers; Python refuses them.
  ['counts after a byte-order mark', stats('{"lineweight_default": 6}', true)],
  ['a count written as 6.0', stats('{"lineweight_default": 6.0}')],
  ['a count written as 6e0', stats('{"lineweight_default": 6e0}')],
  ['a record count so large that its length overflows 32 bits', (b, v) => v.setUint32(entry(b, 'LINE').at + 12, 0x40000000, true)],
]

describe('decodeSheet refuses every rule the engine checks, with SheetBufferError alone', () => {
  it.each(BAD)('refuses %s', async (_, craft) => {
    const b = await tiny()
    const bad = craft(b, new DataView(b)) ?? b
    let thrown: unknown = null
    try {
      decodeSheet(bad)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(SheetBufferError)
  })

  it('reads counts written as integers, with their section moved', async () => {
    const b = stats('{"lineweight_default": 6, "texts": -0}')(await tiny(), new DataView(new ArrayBuffer(0))) as ArrayBuffer
    const sheet = decodeSheet(withSection(b, 'STAT', new TextEncoder().encode('{"lineweight_default": 6, "texts": 0}'), 2))
    expect(sheet.stats).toEqual({ lineweight_default: 6, texts: 0 })
  })

  it('refuses what is not an ArrayBuffer', () => {
    expect(() => decodeSheet(new Uint8Array(8) as unknown as ArrayBuffer)).toThrow(SheetBufferError)
  })

  it('keeps nothing of the caller’s buffer: changing it afterwards changes nothing decoded', async () => {
    const b = await tiny()
    const sheet = decodeSheet(b)
    const first = sheet.lines.f32[0]
    new Uint8Array(b).fill(0)
    expect(sheet.lines.f32[0]).toBe(first)
  })
})
