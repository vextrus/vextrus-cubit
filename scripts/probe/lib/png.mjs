// A PNG read and written without a dependency: 8-bit RGB/RGBA, non-interlaced — the shape every
// Playwright capture, baseline and diff has. Enough to locate WHERE two pictures differ (the bands
// of rows that moved, and their x-range) and to crop a region of two captures side by side for a
// reader, which is what a lawful re-take needs before it copies a picture over a baseline.
import { crc32, deflateSync, inflateSync } from "node:zlib";

/** @typedef {{width: number, height: number, bpp: number, data: Buffer}} Image */
/** @typedef {{y0: number, y1: number, x0: number, x1: number, px: number}} Band */

/**
 * @param {Buffer} buf
 * @returns {Image}
 */
export function decodePng(buf) {
  if (buf.length < 8 || buf[0] !== 137 || buf[1] !== 80 || buf[2] !== 78 || buf[3] !== 71) throw new Error("not a PNG");
  let off = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 8;
  let interlace = 0;
  /** @type {Buffer[]} */
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`unsupported PNG: bit depth ${bitDepth}, interlace ${interlace}`);
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : null;
  if (bpp === null) throw new Error(`unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? (cur[i - bpp] ?? 0) : 0;
      const b = prev[i] ?? 0;
      const c = i >= bpp ? (prev[i - bpp] ?? 0) : 0;
      let x = line[i] ?? 0;
      if (filter === 1) x += a;
      else if (filter === 2) x += b;
      else if (filter === 3) x += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        x += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = x & 255;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width, height, bpp, data: out };
}

/**
 * @param {string} type
 * @param {Buffer} data
 */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * Encode an 8-bit RGB buffer as a PNG.
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgb
 * @returns {Buffer}
 */
export function encodeRgb(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * A region of a decoded image as 8-bit RGB, clamped to the image.
 * @param {Image} img
 * @param {number} x0
 * @param {number} y0
 * @param {number} w
 * @param {number} h
 * @returns {Buffer}
 */
export function cropRgb(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(img.width - 1, x0 + x);
      const sy = Math.min(img.height - 1, y0 + y);
      const i = (sy * img.width + sx) * img.bpp;
      const o = (y * w + x) * 3;
      out[o] = img.data[i] ?? 0;
      out[o + 1] = img.data[i + 1] ?? 0;
      out[o + 2] = img.data[i + 2] ?? 0;
    }
  }
  return out;
}

/**
 * Where a picture differs, as bands of rows: each band's y-range, x-range and pixel count. `marks`
 * says which pixels count — Playwright's diff paints a changed pixel red and an anti-aliased one
 * yellow, so the default reads both; `compareBands` hands a comparison of two captures instead.
 * @param {Image} img
 * @param {(r: number, g: number, b: number, x: number, y: number) => boolean} [marks]
 * @returns {{total: number, bands: Band[]}}
 */
export function diffBands(img, marks = (r, g, b) => r > 200 && b < 80 && (g < 80 || g > 200)) {
  const rows = new Array(img.height).fill(0);
  const minX = new Array(img.height).fill(Infinity);
  const maxX = new Array(img.height).fill(-1);
  let total = 0;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * img.bpp;
      if (!marks(img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0, x, y)) continue;
      rows[y] += 1;
      total += 1;
      if (x < minX[y]) minX[y] = x;
      if (x > maxX[y]) maxX[y] = x;
    }
  }
  /** @type {Band[]} */
  const bands = [];
  /** @type {Band | null} */
  let open = null;
  for (let y = 0; y <= img.height; y += 1) {
    const hit = y < img.height && rows[y] > 0;
    if (hit) {
      if (open === null) open = { y0: y, y1: y, x0: Infinity, x1: -1, px: 0 };
      open.y1 = y;
      open.px += rows[y];
      open.x0 = Math.min(open.x0, minX[y]);
      open.x1 = Math.max(open.x1, maxX[y]);
    } else if (open !== null) {
      const last = bands[bands.length - 1];
      if (last !== undefined && open.y0 - last.y1 <= 4) {
        last.y1 = open.y1;
        last.px += open.px;
        last.x0 = Math.min(last.x0, open.x0);
        last.x1 = Math.max(last.x1, open.x1);
      } else bands.push(open);
      open = null;
    }
  }
  return { total, bands };
}

/**
 * The pixels two same-sized captures differ in, as bands; `total` is -1 and `sizes` names them
 * where the two are not the same size.
 * @param {Image} a
 * @param {Image} b
 * @returns {{total: number, bands: Band[], sizes?: string}}
 */
export function compareBands(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { total: -1, bands: [], sizes: `${a.width}x${a.height} / ${b.width}x${b.height}` };
  /** @type {(r: number, g: number, b: number, x: number, y: number) => boolean} */
  const differs = (_r, _g, _b, x, y) => {
    const ia = (y * a.width + x) * a.bpp;
    const ib = (y * b.width + x) * b.bpp;
    return a.data[ia] !== b.data[ib] || a.data[ia + 1] !== b.data[ib + 1] || a.data[ia + 2] !== b.data[ib + 2];
  };
  return diffBands(a, differs);
}

/**
 * One line a reader can act on: `y 5-36  x 255-841  px=7676`.
 * @param {Band} band
 * @returns {string}
 */
export function bandLine(band) {
  return `y ${band.y0}-${band.y1}  x ${band.x0}-${band.x1}  px=${band.px}`;
}
