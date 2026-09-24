/**
 * I-684 — a scanned page's tiers are drawn from the scan, laid at the page-space corners its
 * record states (I-584's `placement`), and the viewer's backdrop is that scan alone, fitted to a
 * tier's edge.
 *
 * The sheet is built here, in page space, with one scan whose only ink is a known column: every
 * expectation is where that column must land through the stated corners — a whole page, a quarter of
 * it (a picture pasted onto a PDF page, as S-03's), the page turned half round — and what an area
 * average of it must read, computed from the picture's own pixels.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { decodeGreyPng, type GreyImage } from "@/modules/takeoff/thumbnails/png";
import { reduceGrey, renderSheet, scanBackdrop, type PageScan } from "@/modules/takeoff/thumbnails/raster";
import { inflateSync } from "node:zlib";

const PAGE = "Page 1";
/** The page, in points: 200 across, 100 up. */
const PAGE_BOX = { min: [0, 0] as [number, number], max: [200, 100] as [number, number] };
/** The scan: 400 × 200 pixels of paper, inked in columns 100 and 101 top to bottom. */
const SCAN_WIDTH = 400;
const SCAN_HEIGHT = 200;
const INKED = [100, 101];

function scanImage(): GreyImage {
  const pixels = new Uint8Array(SCAN_WIDTH * SCAN_HEIGHT).fill(255);
  for (let row = 0; row < SCAN_HEIGHT; row += 1) for (const column of INKED) pixels[row * SCAN_WIDTH + column] = 0;
  return { width: SCAN_WIDTH, height: SCAN_HEIGHT, pixels };
}

/** A scanned page with nothing drawn on it but the scan — the traced lines are not what is judged here. */
function page(): EntityGraph {
  return { layouts: [{ name: PAGE, kind: "paper", bbox: PAGE_BOX, viewports: [] }], entities: [], derived: [] } as unknown as EntityGraph;
}

function scanAt(placement: [number, number][]): PageScan {
  return { record: { space: PAGE, placement }, image: scanImage() };
}

/** The grey of every pixel of an RGB tier, row by row. */
function greyOf(png: Uint8Array): { width: number; height: number; at: (column: number, row: number) => number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  let at = 8;
  const idat: Uint8Array[] = [];
  while (at < png.length) {
    const length = view.getUint32(at);
    if (String.fromCharCode(...png.subarray(at + 4, at + 8)) === "IDAT") idat.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return { width, height, at: (column, row) => raw[row * (width * 3 + 1) + 1 + column * 3] as number };
}

/** The columns of a tier holding any ink, and the rows of one column that do. */
function inkedColumns(tier: ReturnType<typeof greyOf>): number[] {
  const columns: number[] = [];
  for (let column = 0; column < tier.width; column += 1) {
    for (let row = 0; row < tier.height; row += 1) {
      if (tier.at(column, row) < 255) {
        columns.push(column);
        break;
      }
    }
  }
  return columns;
}

function inkedRows(tier: ReturnType<typeof greyOf>, column: number): number[] {
  return Array.from({ length: tier.height }, (_, row) => row).filter((row) => tier.at(column, row) < 255);
}

describe("a scanned page's tiers are drawn from the scan (I-684)", () => {
  test("without its scan the page is blank paper; with it, the scan's column lands where the stated corners put it", () => {
    expect(inkedColumns(greyOf(renderSheet(page(), PAGE, 200).png)), "no scan, nothing drawn").toEqual([]);
    // Whole page: 400 px across 200 pt, so pixel column 100 is 50 pt in — canvas column 50 at one pixel a point.
    const whole = greyOf(renderSheet(page(), PAGE, 200, [scanAt([[0, 100], [200, 100], [200, 0], [0, 0]])]).png);
    expect([whole.width, whole.height]).toEqual([200, 100]);
    expect(inkedColumns(whole)).toEqual([50]);
    expect(inkedRows(whole, 50), "the column runs the scan's whole height").toHaveLength(100);
  });

  test("a picture pasted onto a quarter of the page is drawn in that quarter and nowhere else", () => {
    // The lower-right quarter: x 100..200, y 0..50. Pixel column 100 of 400 is a quarter across it.
    const quarter = greyOf(renderSheet(page(), PAGE, 200, [scanAt([[100, 50], [200, 50], [200, 0], [100, 0]])]).png);
    expect(inkedColumns(quarter)).toEqual([125]);
    expect(inkedRows(quarter, 125), "the lower half of the canvas, where y runs 50 down to 0").toEqual(Array.from({ length: 50 }, (_, index) => 50 + index));
  });

  test("a page turned half round is read back through its turn", () => {
    // Top-left pixel at the page's lower right: pixel column 100 now stands 50 pt in from the right.
    const turned = greyOf(renderSheet(page(), PAGE, 200, [scanAt([[200, 0], [0, 0], [0, 100], [200, 100]])]).png);
    expect(inkedColumns(turned)).toEqual([149]);
  });

  test("a scan larger than its tier is averaged down by area, so a hairline fades and never vanishes", () => {
    // At a long edge of 50 a canvas pixel covers 8 × 8 scan pixels, two of whose columns are ink.
    const small = greyOf(renderSheet(page(), PAGE, 50, [scanAt([[0, 100], [200, 100], [200, 0], [0, 0]])]).png);
    expect(inkedColumns(small)).toEqual([12]);
    expect(small.at(12, 10), "two inked columns of eight: three quarters paper").toBe(Math.round((255 * 6) / 8));
  });
});

describe("the viewer's backdrop is the scan alone, fitted to a tier's edge (I-684)", () => {
  test("an area average reads the mean of each footprint", () => {
    const reduced = reduceGrey({ width: 4, height: 2, pixels: Uint8Array.from([0, 255, 255, 255, 0, 255, 255, 255]) }, 2, 1);
    expect([...reduced.pixels]).toEqual([128, 255]);
  });

  test("a scan larger than the edge is fitted to it; one no larger is written pixel for pixel", () => {
    const fitted = decodeGreyPng(scanBackdrop(scanImage(), 100).png);
    expect([fitted.width, fitted.height]).toEqual([100, 50]);
    expect(fitted.pixels[25], "the inked columns, averaged into column 25").toBeLessThan(255);
    expect(fitted.pixels[75]).toBe(255);
    const whole = decodeGreyPng(scanBackdrop(scanImage(), 2048).png);
    expect([whole.width, whole.height]).toEqual([SCAN_WIDTH, SCAN_HEIGHT]);
    expect(Buffer.from(whole.pixels).equals(Buffer.from(scanImage().pixels))).toBe(true);
  });
});
