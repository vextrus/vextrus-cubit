/*
 * The decoded sheets (issue #828) at the seam: the caller's buffer is never taken from it (the query
 * cache keeps it, to open the sheet again once its decoded sheet is dropped), what the Worker sends
 * back draws like the sheet decoded here, and a refusal is not kept.
 */
import { afterEach, describe, expect, it } from 'vitest'
import tinySheetUrl from '../../../engine/render/fixtures/tiny-sheet.bin?url'
import { decodeSheet } from './decode'
import { decodedSheets, openDecodedSheet } from './decoded'
import { prepared, prepareSheet } from './prepare'

async function tiny(): Promise<ArrayBuffer> {
  return (await fetch(tinySheetUrl)).arrayBuffer()
}

afterEach(() => decodedSheets.clear())

describe('openDecodedSheet', () => {
  it('leaves the buffer whole, so a sheet dropped from the cache opens again from it', async () => {
    const buffer = await tiny()
    const size = buffer.byteLength
    const first = await openDecodedSheet(buffer)
    expect(buffer.byteLength).toBe(size)
    decodedSheets.clear()
    const again = await openDecodedSheet(buffer)
    expect(again).not.toBe(first)
    expect(again.lines.count).toBe(first.lines.count)
  })

  it('gives the sheet and its prepared arrays as decoding it here would', async () => {
    const buffer = await tiny()
    const here = decodeSheet(buffer)
    const sheet = await openDecodedSheet(buffer)
    expect(Array.from(sheet.lines.f32)).toEqual(Array.from(here.lines.f32))
    expect(Array.from(sheet.glyphs.u32)).toEqual(Array.from(here.glyphs.u32))
    expect(sheet.strings).toEqual(here.strings)
    expect(sheet.atlas.pixels.byteLength).toBe(here.atlas.pixels.byteLength)
    const ours = prepareSheet(here)
    const theirs = prepared(sheet)
    expect(Array.from(theirs.glyphInstances)).toEqual(Array.from(ours.glyphInstances))
    expect(Array.from(theirs.lineColours)).toEqual(Array.from(ours.lineColours))
    expect(Array.from(theirs.work.cells)).toEqual(Array.from(ours.work.cells))
    expect(theirs.used).toEqual(ours.used)
  })

  it('keeps no refusal: the same bytes are read again on the next open', async () => {
    const garbage = new Uint8Array(4096).fill(0x5a).buffer
    await expect(openDecodedSheet(garbage)).rejects.toThrow()
    expect(decodedSheets.size).toBe(0)
    await expect(openDecodedSheet(garbage)).rejects.toThrow()
  })

  it('opens the same buffer twice at once as one decode', async () => {
    const buffer = await tiny()
    const [a, b] = await Promise.all([openDecodedSheet(buffer), openDecodedSheet(buffer)])
    expect(a).toBe(b)
    expect(decodedSheets.size).toBe(1)
  })
})
