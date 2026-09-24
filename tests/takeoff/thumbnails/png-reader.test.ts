/**
 * The grey PNG reader beside the encoder (M4P-4, I-684): the page raster the vectoriser writes
 * (I-584) is read back into its pixels so a scan's thumbnail tiers and the viewer's backdrop can be
 * drawn from it.
 *
 * Judged three ways, none by a hash of today's bytes (B-19): a grey canvas the encoder writes reads
 * back pixel for pixel; a PNG built here by hand — every one of the five scanline filters, its IDAT
 * split across chunks the way libpng splits one — reads back to the pixels it was filtered from; and
 * a scan the fixtures commit (written by another tool, with Sub, Up and Paeth rows) reads, and
 * writes and reads again to the same pixels. What is not a grey page raster is refused by name.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { decodeGreyPng, encodeGreyPng, encodePng } from "@/modules/takeoff/thumbnails/png";

/** A deterministic grey canvas with line work, flat paper and every byte value somewhere in it. */
function canvasOf(width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height).fill(255);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (row % 7 === 0 || column % 11 === 0) pixels[row * width + column] = (row * 31 + column * 17) & 255;
    }
  }
  return pixels;
}

/** The reference predictors of PNG § 9.2, written from the specification, not from the reader. */
function predictor(filter: number, left: number, above: number, upperLeft: number): number {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return above;
  if (filter === 3) return Math.floor((left + above) / 2);
  const p = left + above - upperLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - above);
  const pc = Math.abs(p - upperLeft);
  return pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft;
}

/** CRC-32 as the format defines it, bit by bit. */
function crc(bytes: Uint8Array): number {
  let register = -1;
  for (const byte of bytes) {
    register ^= byte;
    for (let bit = 0; bit < 8; bit += 1) register = register & 1 ? (register >>> 1) ^ 3988292384 : register >>> 1;
  }
  return (register ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const named = Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const digest = Buffer.alloc(4);
  digest.writeUInt32BE(crc(named));
  return Buffer.concat([length, named, digest]);
}

/** A grey PNG whose row `r` is filtered with filter `r % 5`, its IDAT cut into `pieces` chunks. */
function handFiltered(pixels: Uint8Array, width: number, height: number, pieces: number, header?: Partial<{ depth: number; colourType: number; interlace: number }>): Uint8Array {
  const raw = new Uint8Array((width + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const filter = row % 5;
    raw[row * (width + 1)] = filter;
    for (let column = 0; column < width; column += 1) {
      const at = row * width + column;
      const left = column > 0 ? (pixels[at - 1] as number) : 0;
      const above = row > 0 ? (pixels[at - width] as number) : 0;
      const upperLeft = row > 0 && column > 0 ? (pixels[at - width - 1] as number) : 0;
      raw[row * (width + 1) + 1 + column] = ((pixels[at] as number) - predictor(filter, left, above, upperLeft)) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = header?.depth ?? 8;
  ihdr[9] = header?.colourType ?? 0;
  ihdr[12] = header?.interlace ?? 0;
  const deflated = deflateSync(raw);
  const size = Math.ceil(deflated.length / pieces);
  const idats = Array.from({ length: pieces }, (_, index) => chunk("IDAT", deflated.subarray(index * size, (index + 1) * size)));
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), ...idats, chunk("IEND", new Uint8Array(0))]));
}

describe("the grey PNG reader (I-684)", () => {
  test("a grey canvas the encoder writes reads back pixel for pixel", () => {
    const pixels = canvasOf(97, 61);
    const read = decodeGreyPng(encodeGreyPng(pixels, 97, 61));
    expect([read.width, read.height]).toEqual([97, 61]);
    expect(Buffer.from(read.pixels).equals(Buffer.from(pixels)), "the round trip keeps every pixel").toBe(true);
  });

  test("every scanline filter the format defines is undone, whatever chunks the stream was cut into", () => {
    const pixels = canvasOf(53, 40);
    const read = decodeGreyPng(handFiltered(pixels, 53, 40, 3));
    expect(Buffer.from(read.pixels).equals(Buffer.from(pixels)), "None, Sub, Up, Average and Paeth rows all read back").toBe(true);
  });

  test("a scan another tool wrote (Sub, Up and Paeth rows) reads, and writes and reads again unchanged", () => {
    const bytes = new Uint8Array(readFileSync(join(process.cwd(), "fixtures", "rcc6-bnbc", "images", "hook-detail-scan.png")));
    const read = decodeGreyPng(bytes);
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect([read.width, read.height], "the size its header states").toEqual([header.getUint32(16), header.getUint32(20)]);
    const inked = read.pixels.filter((value) => value < 128).length;
    expect(inked, "a scan of line work on paper: some ink, mostly paper").toBeGreaterThan(0);
    expect(inked, "a scan of line work on paper: some ink, mostly paper").toBeLessThan(read.pixels.length / 2);
    const again = decodeGreyPng(encodeGreyPng(read.pixels, read.width, read.height));
    expect(Buffer.from(again.pixels).equals(Buffer.from(read.pixels))).toBe(true);
  });

  test("what is not an 8-bit grey page raster is refused by name, never read as one", () => {
    const pixels = canvasOf(8, 8);
    expect(() => decodeGreyPng(encodePng(new Uint8Array(8 * 8 * 3), 8, 8)), "a truecolour picture").toThrow(/not an 8-bit grey page raster/);
    expect(() => decodeGreyPng(handFiltered(pixels, 8, 8, 1, { interlace: 1 })), "an interlaced one").toThrow(/not an 8-bit grey page raster/);
    const altered = handFiltered(pixels, 8, 8, 1);
    altered[40] = (altered[40] as number) ^ 1;
    expect(() => decodeGreyPng(altered), "a stream whose bytes moved").toThrow(/CRC/);
    expect(() => decodeGreyPng(new Uint8Array([1, 2, 3])), "bytes that are no PNG").toThrow(/signature/);
  });
});
