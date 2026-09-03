// The PNG encoder R-SPINE-022's rasters are written with: 8-bit truecolour, one filter byte of zero
// per scanline, one IDAT deflated by node:zlib. It is deliberately the whole of the format this lane
// needs and nothing more — no palette, no alpha, no interlacing — because a raster is a picture of a
// sheet and every byte of it is written here rather than by a native dependency.
//
// The numbers below are spelled in decimal on purpose: a 6-to-8-digit hex literal reads as a packed
// colour to this tree's lint (R-UI-001), and none of these is a colour.
import { deflateSync } from "node:zlib";

/** The eight bytes every PNG opens with. */
const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** How many bytes one pixel takes in the only colour type this encoder writes. */
export const CHANNELS = 3;

/** The header's fixed tail: 8 bits a channel, colour type 2 (truecolour), no compression method,
 * no filter method and no interlacing besides the ones the format defines as zero. */
const BIT_DEPTH = 8;
const COLOUR_TYPE_RGB = 2;

/** The reversed CRC-32 polynomial the format specifies, and the all-ones register it runs in. */
const CRC_POLYNOMIAL = 3988292384;
const CRC_ALL_ONES = 4294967295;

/** The lookup the digest is taken through — built once, so a raster set does not rebuild it per chunk. */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? (CRC_POLYNOMIAL ^ (value >>> 1)) >>> 0 : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

/** The CRC-32 of some bytes, as every PNG chunk carries it. */
function crc32(bytes: Uint8Array): number {
  let register = CRC_ALL_ONES;
  for (const byte of bytes) {
    const entry = CRC_TABLE[(register ^ byte) & 255] ?? 0;
    register = (entry ^ (register >>> 8)) >>> 0;
  }
  return (register ^ CRC_ALL_ONES) >>> 0;
}

/** One chunk, whole: its length, its type, its data and the digest of the two of them. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const named = new Uint8Array(4 + data.length);
  for (let index = 0; index < 4; index += 1) named[index] = type.charCodeAt(index);
  named.set(data, 4);

  const framed = new Uint8Array(named.length + 8);
  const view = new DataView(framed.buffer);
  view.setUint32(0, data.length);
  framed.set(named, 4);
  view.setUint32(framed.length - 4, crc32(named));
  return framed;
}

/** The IHDR this encoder always writes: the size, and the one colour type it knows. */
function header(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = BIT_DEPTH;
  data[9] = COLOUR_TYPE_RGB;
  return data;
}

/**
 * A canvas of `width` × `height` RGB triples, encoded as a PNG.
 *
 * `pixels` is row-major, three bytes a pixel, top row first — the order the format itself stores
 * scanlines in, so the encoder copies rather than reorders.
 */
export function encodePng(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * CHANNELS;
  if (width < 1 || height < 1 || pixels.length !== stride * height) {
    throw new Error(`png: a ${width}×${height} canvas is ${stride * height} bytes, and ${pixels.length} were given`);
  }

  // Every scanline is filtered "None": the geometry these rasters carry is line work on white, which
  // a filter would cost time on without paying for itself in bytes.
  const raw = new Uint8Array((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    raw.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  }

  const parts = [SIGNATURE, chunk("IHDR", header(width, height)), chunk("IDAT", new Uint8Array(deflateSync(raw))), chunk("IEND", new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}
