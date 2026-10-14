/* eslint-disable lingui/no-unlocalized-strings -- developer errors; nothing here is shown in the UI */
/*
 * The decoded sheets (issue #828): a sheet's render buffer decoded once, off the main thread, and
 * kept, so paging back to a sheet already opened neither decodes it nor rebuilds what it draws from.
 *
 *   const sheet = await openDecodedSheet(buffer)   // the viewer's one way to decode; or rejects with SheetBufferError
 *   decodedSheets.size, decodedSheets.capacity, decodedSheets.clear()
 *
 * Keyed by the ArrayBuffer itself, as the query cache hands the same one back for a sheet. The buffer
 * is posted to the Worker as a copy, never transferred: the caller keeps it whole, to open it again
 * once its decoded sheet has been dropped. At most `capacity` sheets are kept, and at most
 * `MAX_BYTES` of them (the most recent always), the least recently opened dropped first; a refusal
 * is never kept, so Try again decodes again.
 */
import { decodeSheet, SheetBufferError, type DecodedSheet } from './decode'
import type { DecodeReply, DecodeRequest } from './decode.worker'
import { keepPrepared, prepareSheet } from './prepare'

/** How many decoded sheets are kept. */
const CAPACITY = 8
/** How many bytes of decoded sheets are kept, beside the one opened last (the densest is about 40 MB). */
const MAX_BYTES = 200 * 1024 * 1024

interface Kept {
  sheet: Promise<DecodedSheet>
  /** The bytes it holds, once decoded. */
  bytes: number
}

const kept = new Map<ArrayBuffer, Kept>()

/** The sheet in `buffer`, decoded off the main thread; the same object again for the same buffer while it is kept. */
export function openDecodedSheet(buffer: ArrayBuffer): Promise<DecodedSheet> {
  const hit = kept.get(buffer)
  if (hit) {
    kept.delete(buffer)
    kept.set(buffer, hit)
    return hit.sheet
  }
  const entry: Kept = { sheet: decode(buffer), bytes: 0 }
  kept.set(buffer, entry)
  entry.sheet.then(
    (sheet) => {
      entry.bytes = bytesOf(sheet)
      trim()
    },
    () => {
      if (kept.get(buffer) === entry) kept.delete(buffer)
    },
  )
  trim()
  return entry.sheet
}

/** The decoded sheets kept: how many, at most how many, and dropping them all. */
export const decodedSheets = {
  get size(): number {
    return kept.size
  },
  capacity: CAPACITY,
  clear(): void {
    kept.clear()
  },
}

function trim() {
  let bytes = 0
  for (const e of kept.values()) bytes += e.bytes
  for (const [buffer, e] of kept) {
    if (kept.size <= 1 || (kept.size <= CAPACITY && bytes <= MAX_BYTES)) break
    kept.delete(buffer)
    bytes -= e.bytes
  }
}

function bytesOf(sheet: DecodedSheet): number {
  const { lines, triangles, glyphs, atlasGlyphs, atlas } = sheet
  // The prepared arrays are about as large again as the records they come from.
  return 2 * (lines.f32.byteLength + triangles.f32.byteLength + glyphs.f32.byteLength + atlasGlyphs.f32.byteLength) + atlas.pixels.byteLength
}

let worker: Worker | null = null
let nextId = 1
const waiting = new Map<number, { resolve: (sheet: DecodedSheet) => void; reject: (error: Error) => void }>()

function decode(buffer: ArrayBuffer): Promise<DecodedSheet> {
  if (!(buffer instanceof ArrayBuffer)) return Promise.reject(new SheetBufferError('a sheet buffer is an ArrayBuffer'))
  if (typeof Worker === 'undefined') {
    // No Worker (a script outside a browser): on this thread, as before.
    return new Promise((resolve) => {
      const sheet = decodeSheet(buffer)
      keepPrepared(sheet, prepareSheet(sheet))
      resolve(sheet)
    })
  }
  const id = nextId++
  return new Promise<DecodedSheet>((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    const request: DecodeRequest = { id, buffer }
    // A copy, not a transfer: the caller's buffer stays whole.
    decoder().postMessage(request)
  })
}

function decoder(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (event: MessageEvent<DecodeReply>) => {
    const reply = event.data
    const wait = waiting.get(reply.id)
    if (!wait) return
    waiting.delete(reply.id)
    if ('refused' in reply) {
      wait.reject(new SheetBufferError('not a sheet buffer the decoder accepts'))
      return
    }
    keepPrepared(reply.sheet, reply.ready)
    wait.resolve(reply.sheet)
  }
  // A Worker that fails (it could not load, or ran out of memory), or a reply that cannot be read, fails
  // what it was asked, never leaves it waiting; the next ask starts a new Worker.
  const stop = () => {
    w.terminate()
    if (worker === w) worker = null
    const failed = [...waiting.values()]
    waiting.clear()
    for (const f of failed) f.reject(new SheetBufferError('the sheet decoder stopped'))
  }
  w.onerror = (event) => {
    event.preventDefault()
    stop()
  }
  w.onmessageerror = stop
  worker = w
  return w
}
