// The PNG encoder R-SPINE-022's rasters are written with: 8-bit truecolour (or 8-bit grey, for a
// scan's backdrop), one filter byte of zero per scanline, one IDAT deflated by node:zlib. Beside it
// stands the one reader this lane needs: 8-bit grey, the shape the vectoriser writes a page raster in
// (I-584), every filter the format defines, IDAT split however the writer split it. It is
// deliberately the whole of the format this lane needs and nothing more — no palette, no alpha, no
// interlacing — because a raster is a picture of a sheet and every byte of it is handled here rather
// than by a native dependency.
//
// The numbers below are spelled in decimal on purpose: a 6-to-8-digit hex literal reads as a packed
// colour to this tree's lint (R-UI-001), and none of these is a colour.
import { deflateSync, inflateSync } from "node:zlib";

/** The eight bytes every PNG opens with. */
const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** How many bytes one pixel takes in the only colour type this encoder writes. */
export const CHANNELS = 3;

/** The header's fixed tail: 8 bits a channel, colour type 2 (truecolour), no compression method,
 * no filter method and no interlacing besides the ones the format defines as zero. */
const BIT_DEPTH = 8;
const COLOUR_TYPE_GREY = 0;
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

/** The IHDR this encoder writes: the size, and one of the two colour types it knows. */
function header(width: number, height: number, colourType: number): Uint8Array {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = BIT_DEPTH;
  data[9] = colourType;
  return data;
}

/**
 * A canvas of `width` × `height` RGB triples, encoded as a PNG.
 *
 * `pixels` is row-major, three bytes a pixel, top row first — the order the format itself stores
 * scanlines in, so the encoder copies rather than reorders.
 */
export function encodePng(pixels: Uint8Array, width: number, height: number): Uint8Array {
  return encode(pixels, width, height, CHANNELS, COLOUR_TYPE_RGB);
}

/** A canvas of `width` × `height` grey bytes, one a pixel, top row first, encoded as a grey PNG. */
export function encodeGreyPng(pixels: Uint8Array, width: number, height: number): Uint8Array {
  return encode(pixels, width, height, 1, COLOUR_TYPE_GREY);
}

function encode(pixels: Uint8Array, width: number, height: number, channels: number, colourType: number): Uint8Array {
  const stride = width * channels;
  if (width < 1 || height < 1 || pixels.length !== stride * height) {
    throw new Error(`png: a ${width}×${height} canvas is ${stride * height} bytes, and ${pixels.length} were given`);
  }

  // Every scanline is filtered "None": the geometry these rasters carry is line work on white, which
  // a filter would cost time on without paying for itself in bytes.
  const raw = new Uint8Array((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    raw.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  }

  const parts = [SIGNATURE, chunk("IHDR", header(width, height, colourType)), chunk("IDAT", new Uint8Array(deflateSync(raw))), chunk("IEND", new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}

/** A decoded grey picture: one byte a pixel, row-major, top row first. */
export type GreyImage = { readonly width: number; readonly height: number; readonly pixels: Uint8Array };

/** The five scanline filters the format defines (PNG § 9.2). */
const FILTER_NONE = 0;
const FILTER_SUB = 1;
const FILTER_UP = 2;
const FILTER_AVERAGE = 3;
const FILTER_PAETH = 4;

/** Paeth's predictor: whichever of left, above and upper-left is nearest their linear estimate. */
function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const toLeft = Math.abs(estimate - left);
  const toAbove = Math.abs(estimate - above);
  const toUpperLeft = Math.abs(estimate - upperLeft);
  if (toLeft <= toAbove && toLeft <= toUpperLeft) return left;
  return toAbove <= toUpperLeft ? above : upperLeft;
}

/**
 * Read an 8-bit grey PNG — the page raster the vectoriser wrote beside its artifact (I-584) — into
 * its pixels. Anything else (a colour picture, a palette, another depth, interlacing, a truncated or
 * altered stream) is not a page raster this product wrote, and is thrown as the fault it is: the
 * bytes stood at the address their own sha256 names, so a picture that will not read is ours.
 */
export function decodeGreyPng(png: Uint8Array): GreyImage {
  for (let index = 0; index < SIGNATURE.length; index += 1) {
    if (png[index] !== SIGNATURE[index]) throw new Error("png: the bytes do not open with the PNG signature");
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = SIGNATURE.length;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  let ended = false;
  while (at + 8 <= png.length && !ended) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    if (data.length !== length || at + 12 + length > png.length) throw new Error(`png: the ${type} chunk runs past the end of the bytes`);
    const named = png.subarray(at + 4, at + 8 + length);
    if (crc32(named) !== view.getUint32(at + 8 + length)) throw new Error(`png: the ${type} chunk's CRC does not match its bytes`);
    if (type === "IHDR") {
      const fields = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = fields.getUint32(0);
      height = fields.getUint32(4);
      const [depth, colourType, , , interlace] = [data[8], data[9], data[10], data[11], data[12]];
      if (depth !== BIT_DEPTH || colourType !== COLOUR_TYPE_GREY || interlace !== 0) {
        throw new Error(`png: a ${String(depth)}-bit picture of colour type ${String(colourType)}, interlace ${String(interlace)}, is not an 8-bit grey page raster`);
      }
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") ended = true;
    at += 12 + length;
  }
  if (width < 1 || height < 1) throw new Error("png: no header states the picture's size");
  if (!ended) throw new Error("png: the stream ends without its IEND");

  const raw = new Uint8Array(inflateSync(Buffer.concat(idat)));
  if (raw.length !== (width + 1) * height) throw new Error(`png: a ${width}×${height} grey picture inflates to ${(width + 1) * height} bytes, and ${raw.length} came out`);

  // Unfiltered in place, a row at a time, each filter its own loop: a page raster is tens of millions
  // of pixels, and a branch per pixel costs the reader seconds a sheet (measured on R1's S-10).
  const pixels = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (width + 1)];
    const from = row * (width + 1) + 1;
    const out = row * width;
    const prior = out - width;
    const first = row === 0;
    if (filter === FILTER_NONE) {
      pixels.set(raw.subarray(from, from + width), out);
    } else if (filter === FILTER_SUB) {
      let left = 0;
      for (let column = 0; column < width; column += 1) {
        left = ((raw[from + column] as number) + left) & 255;
        pixels[out + column] = left;
      }
    } else if (filter === FILTER_UP) {
      if (first) pixels.set(raw.subarray(from, from + width), out);
      else for (let column = 0; column < width; column += 1) pixels[out + column] = ((raw[from + column] as number) + (pixels[prior + column] as number)) & 255;
    } else if (filter === FILTER_AVERAGE) {
      let left = 0;
      for (let column = 0; column < width; column += 1) {
        const above = first ? 0 : (pixels[prior + column] as number);
        left = ((raw[from + column] as number) + ((left + above) >>> 1)) & 255;
        pixels[out + column] = left;
      }
    } else if (filter === FILTER_PAETH) {
      let left = 0;
      let upperLeft = 0;
      for (let column = 0; column < width; column += 1) {
        const above = first ? 0 : (pixels[prior + column] as number);
        left = ((raw[from + column] as number) + paeth(left, above, upperLeft)) & 255;
        upperLeft = above;
        pixels[out + column] = left;
      }
    } else {
      throw new Error(`png: scanline ${row} names filter ${String(filter)}, which the format does not define`);
    }
  }
  return { width, height, pixels };
}
