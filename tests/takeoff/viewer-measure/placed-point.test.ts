/**
 * The point a click places (s-measure I-385, I-387, I-499): the drawn point, at the drawing's own
 * coordinate, where the live point is exactly what the snap met — MEASURED on vector geometry,
 * INTERPRETED on a traced raster; anywhere else a free, ENTERED point on the 0.1 lattice, except the
 * coordinate a constraint copied from the last point, which keeps that point's exact spelling.
 */
import { describe, expect, test } from "vitest";
import { quantise } from "@/core/identity/keys";
import { placedPoint } from "@/modules/takeoff/viewer-measure/use-measure";
import type { SnapResult } from "@/modules/takeoff/viewer-snap/types";
import { S08_SOG } from "./support/s08";

const chamfer = S08_SOG[3] as readonly [number, number];
const met = (point: readonly [number, number], key: string): SnapResult => ({ kind: "endpoint", point, sourceKeys: [key], keyPoint: [quantise(point[0]), quantise(point[1])] });

describe("I-387: a snapped point keeps the drawing's own coordinate and cites what it met", () => {
  test("81D's chamfer vertex, met exactly, is MEASURED at its fifteen decimal places", () => {
    expect(placedPoint({ point: chamfer, met: met(chamfer, "DXF_HANDLE:81D") }, null)).toEqual({ at: chamfer, basis: "MEASURED", sourceKeys: ["DXF_HANDLE:81D"] });
  });

  test("a point met on a traced raster primitive is INTERPRETED, never MEASURED (L-QTY-01)", () => {
    expect(placedPoint({ point: chamfer, met: met(chamfer, "RASTER_TRACE:p3/12") }, null).basis).toBe("INTERPRETED");
  });

  test("a live point a constraint moved off the snap is not the drawn point: it is placed by hand", () => {
    const moved: readonly [number, number] = [chamfer[0] + 0.37, chamfer[1]];
    expect(placedPoint({ point: moved, met: met(chamfer, "DXF_HANDLE:81D") }, null).basis).toBe("ENTERED");
  });
});

describe("I-385, I-499: a free point stands on the lattice, less the axis a constraint copied", () => {
  test("free: both coordinates carried onto the 0.1 lattice", () => {
    expect(placedPoint({ point: [1000.04, -2000.06], met: null }, null)).toEqual({ at: [1000, -2000.1], basis: "ENTERED", sourceKeys: [] });
  });

  test("an ortho segment from the chamfer vertex keeps the vertex's y exactly, and only x goes onto the lattice", () => {
    const along: readonly [number, number] = [chamfer[0] + 5000.04, chamfer[1]];
    expect(placedPoint({ point: along, met: null }, chamfer).at).toEqual([Number(quantise(along[0])), chamfer[1]]);
  });
});
