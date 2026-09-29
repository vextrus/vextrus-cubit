/*
 * Crafting sheet buffers for the sheet's own tests: the format's section table (engine/render/buffers.py,
 * version 1) read, and one section replaced.
 */

/** A section's table entry: where it is, and its offset, length and record count. */
export function entry(b: ArrayBuffer, fourcc: string) {
  const v = new DataView(b)
  for (let i = 0; i < v.getUint32(32, true); i++) {
    const at = 56 + 16 * i
    if (String.fromCharCode(...new Uint8Array(b, at, 4)) === fourcc) {
      return { at, offset: v.getUint32(at + 4, true), length: v.getUint32(at + 8, true), count: v.getUint32(at + 12, true) }
    }
  }
  throw new Error(`no ${fourcc}`)
}

/** The buffer with one section's bytes replaced by `payload` (moved to the end, 8-aligned). */
export function withSection(b: ArrayBuffer, fourcc: string, payload: Uint8Array, count: number): ArrayBuffer {
  const at = (b.byteLength + 7) & ~7
  const out = new Uint8Array(at + payload.byteLength)
  out.set(new Uint8Array(b))
  out.set(payload, at)
  const v = new DataView(out.buffer)
  const e = entry(out.buffer, fourcc)
  v.setUint32(e.at + 4, at, true)
  v.setUint32(e.at + 8, payload.byteLength, true)
  v.setUint32(e.at + 12, count, true)
  v.setUint32(12, out.byteLength, true)
  return out.buffer
}
