/**
 * AC-1 — `resolveSnap` and the rest of `src/modules/takeoff/viewer-snap/snap.ts`: pure math over the
 * candidates the spatial worker's `hit` answer named, computed in drawing units, resolved in a fixed
 * priority, and keyed on the register's one lattice (R-TO-012, R-UI-041, L-REG-04, I-147, I-149).
 *
 * Every expectation is derived from the geometry declared in `support/snap-support.ts` rather than
 * transcribed from a run (B-19): the priority ladder is read off the module's own `SNAP_KINDS` and
 * the case table, the grid pairing is computed by AC-1's own rule over the staged axes, and the
 * lattice strings come from the shipped `quantise`. Nothing here reads product source.
 */
import { describe, expect, test } from "vitest";
import {
  CASE_OFFSET,
  CASE_TOLERANCE,
  KINDS,
  PRIORITY,
  SNAP_AXES,
  SNAP_CASES,
  SNAP_GEOMETRY,
  SNAP_RECORDS,
  VIEW_P,
  VIEW_Q,
  caseSignature,
  expectedGridIntersections,
  inputOf,
  intersectionSignature,
  keysModule,
  lineRecord,
  resultSignature,
  snapModule,
  type GridAxisRow,
  type Point,
} from "./support/snap-support";

/** A world point far outside everything the geometry draws — nothing is in reach of it. */
const NOWHERE: Point = [5000, 5000];

describe("AC-1: the six kinds, each resolved at a cursor where a lower-priority kind is also in reach", () => {
  test("AC-1: SNAP_KINDS is the closed roster the screen and the readout are written against", async () => {
    const snap = await snapModule();
    expect([...snap.SNAP_KINDS], "the six kinds R-TO-012 names, in the order AC-1 states them").toEqual([...KINDS]);
    expect(snap.SNAP_TOLERANCE_PX, "8 px of the reader's screen (Decision §5: a code constant, so no surface transcribes it)").toBe(8);
    expect(snap.ANGLE_STEP_DEG, "15° (Decision §5)").toBe(15);
    expect([...PRIORITY].sort(), "the priority ladder is a permutation of the roster — every kind is placed and none is invented").toEqual([...snap.SNAP_KINDS].sort());
  });

  for (const one of SNAP_CASES) {
    test(`AC-1: ${one.name} answers ${one.kind}`, async () => {
      const snap = await snapModule();
      const answered = snap.resolveSnap(inputOf(one));
      expect(answered, `a cursor ${CASE_OFFSET} drawing units from the feature is within the ${CASE_TOLERANCE} asked for, so something is in reach`).not.toBeNull();
      expect(
        resultSignature(answered as { kind: string; point: Point; sourceKeys: string[] }),
        `the resolver answers the kind the fixed priority ${PRIORITY.join(" > ")} owes here, at the snapped world point, naming the source key(s) it snapped to (I-147)`,
      ).toBe(caseSignature(one));
    });
  }

  test("AC-1: nothing within tolerance answers null rather than the nearest thing anywhere", async () => {
    const snap = await snapModule();
    expect(
      snap.resolveSnap({ cursor: NOWHERE, tolerance: CASE_TOLERANCE, candidates: SNAP_RECORDS, grid: expectedGridIntersections(), firstPick: null }),
      "a cursor over bare paper snaps to nothing — a snap out of reach is a snap that changes the point a reader chose",
    ).toBeNull();
  });

  test("AC-1: tolerance is in drawing units — the same cursor snaps or does not as the number changes", async () => {
    const snap = await snapModule();
    const endpoint = SNAP_GEOMETRY.h;
    const cursor: Point = [0, CASE_OFFSET];
    const inReach = snap.resolveSnap({ cursor, tolerance: CASE_OFFSET * 2, candidates: [endpoint], grid: [], firstPick: null });
    const outOfReach = snap.resolveSnap({ cursor, tolerance: CASE_OFFSET / 2, candidates: [endpoint], grid: [], firstPick: null });
    expect(inReach?.kind, `a tolerance of ${CASE_OFFSET * 2} drawing units reaches a feature ${CASE_OFFSET} away`).toBe("endpoint");
    expect(outOfReach, `a tolerance of ${CASE_OFFSET / 2} drawing units does not — the screen derives it as SNAP_TOLERANCE_PX / camera scale, so it is a number in the drawing's own units`).toBeNull();
  });

  test("AC-1: perpendicular is offered only while a first pick stands", async () => {
    const snap = await snapModule();
    const withPick = SNAP_CASES.find((one) => one.kind === "perpendicular") as (typeof SNAP_CASES)[number];
    const withoutPick = { ...withPick, firstPick: null };
    expect(snap.resolveSnap(inputOf(withPick))?.kind, "with a pick standing, the foot of the perpendicular from it outranks the nearest point").toBe("perpendicular");
    expect(
      snap.resolveSnap(inputOf(withoutPick))?.kind,
      "with no pick standing there is no anchor to drop a perpendicular from, so the same cursor answers the next kind down the ladder (I-148)",
    ).toBe("nearest");
  });

  test("AC-1: an intersection names both records; a grid intersection names both bubbles", async () => {
    const snap = await snapModule();
    const crossing = SNAP_CASES.find((one) => one.kind === "intersection") as (typeof SNAP_CASES)[number];
    const grid = SNAP_CASES.find((one) => one.kind === "grid") as (typeof SNAP_CASES)[number];
    expect(snap.resolveSnap(inputOf(crossing))?.sourceKeys.length, "an intersection of two records is sourced by two record keys").toBe(2);
    expect(snap.resolveSnap(inputOf(grid))?.sourceKeys.length, "a grid intersection is sourced by the two bubble keys that georeferenced it").toBe(2);
    for (const single of SNAP_CASES.filter((one) => one.sourceKeys.length === 1)) {
      expect(snap.resolveSnap(inputOf(single))?.sourceKeys, `a ${single.kind} snap is sourced by the one record it snapped to`).toEqual([...single.sourceKeys]);
    }
  });
});

describe("AC-1: gridIntersectionsOf pairs within a view and never across one", () => {
  test("AC-1: every x row meets every y row of its own view, sourced by the two bubble keys in [x, y] order", async () => {
    const snap = await snapModule();
    const answered = snap.gridIntersectionsOf(SNAP_AXES);
    expect(
      answered.map(intersectionSignature).sort(),
      "the pairing AC-1 states, computed over the staged axes rather than transcribed — a fixture that moves a bubble moves both sides at once (B-19)",
    ).toEqual(expectedGridIntersections(SNAP_AXES).map(intersectionSignature).sort());

    const views = new Set(answered.map((entry) => entry.viewKey));
    expect([...views].sort(), "both staged views georeference a grid, so both are answered for").toEqual([VIEW_P, VIEW_Q].sort());
    for (const entry of answered) {
      const named = SNAP_AXES.filter((row) => entry.sourceKeys.includes(row.bubbleKey));
      expect(named.length, `${entry.sourceKeys.join(" + ")} names two stored rows`).toBe(2);
      expect(new Set(named.map((row) => row.viewKey)).size, "and both stand in one view — a grid never pairs across views (I-149)").toBe(1);
      expect(
        named.map((row) => row.axis),
        "the first key is the x row and the second the y row, so a reader of `sourceKeys` knows which bubble is which",
      ).toEqual(["x", "y"]);
      expect([entry.point[0], entry.point[1]], "and the point is where those two rows stand").toEqual([
        (named.find((row) => row.axis === "x") as GridAxisRow).position,
        (named.find((row) => row.axis === "y") as GridAxisRow).position,
      ]);
    }
  });

  test("AC-1: a view with rows on one axis alone offers no intersection at all", async () => {
    const snap = await snapModule();
    const oneAxis = SNAP_AXES.filter((row) => row.axis === "x");
    expect(snap.gridIntersectionsOf(oneAxis), "an axis crosses nothing on its own — an absence, not a fault (I-149)").toEqual([]);
    expect(snap.gridIntersectionsOf([]), "and a sheet nothing has partitioned offers no grid candidates").toEqual([]);
  });
});

describe("AC-1: the two constraints, the distance and the metres", () => {
  test("AC-1: constrainOrtho keeps the longer axis and zeroes the other", async () => {
    const snap = await snapModule();
    const anchor: Point = [10, 20];
    for (const [dx, dy] of [
      [30, 4],
      [-30, 4],
      [4, 30],
      [4, -30],
      [-4, -30],
    ] as [number, number][]) {
      const constrained = snap.constrainOrtho(anchor, [anchor[0] + dx, anchor[1] + dy]);
      const offX = constrained[0] - anchor[0];
      const offY = constrained[1] - anchor[1];
      expect(offX === 0 || offY === 0, `ortho leaves a segment on one world axis: (${dx}, ${dy}) became (${offX}, ${offY})`).toBe(true);
      expect(
        Math.abs(offX) + Math.abs(offY),
        "and it keeps the axis the hand travelled furthest along, at the length it travelled — a constraint that changed both would move the point a reader aimed at",
      ).toBeCloseTo(Math.max(Math.abs(dx), Math.abs(dy)), 9);
    }
  });

  test("AC-1: constrainAngle leaves the direction on a multiple of the step and the reach unchanged", async () => {
    const snap = await snapModule();
    const anchor: Point = [-5, 7];
    const reach = 40;
    for (const degrees of [1, 7, 22, 38, 44, 91, 173, -14, -83, 200]) {
      const radians = (degrees * Math.PI) / 180;
      const asked: Point = [anchor[0] + reach * Math.cos(radians), anchor[1] + reach * Math.sin(radians)];
      const constrained = snap.constrainAngle(anchor, asked, snap.ANGLE_STEP_DEG);
      const offX = constrained[0] - anchor[0];
      const offY = constrained[1] - anchor[1];
      const turned = (Math.atan2(offY, offX) * 180) / Math.PI;
      const steps = turned / snap.ANGLE_STEP_DEG;
      expect(Math.abs(steps - Math.round(steps)), `${degrees}° locked to ${turned}°, which is a whole number of ${snap.ANGLE_STEP_DEG}° steps`).toBeLessThan(1e-6);
      // The turn either way round the circle, so a lock that lands at 195° is read as 5° from 200°
      // rather than as the 365° that one spelling of the same direction would suggest.
      const apart = Math.abs((((turned - degrees) % 360) + 540) % 360) - 180;
      expect(Math.abs(apart), "and it lands on the step nearest the direction the hand was pointing").toBeLessThanOrEqual(snap.ANGLE_STEP_DEG / 2 + 1e-9);
      expect(Math.hypot(offX, offY), "the lock turns the segment; it does not lengthen or shorten it").toBeCloseTo(reach, 9);
    }
  });

  test("AC-1: distanceBetween is the plain distance in drawing units", async () => {
    const snap = await snapModule();
    for (const [a, b] of [
      [
        [0, 0],
        [3, 4],
      ],
      [
        [-12.5, 6],
        [7.5, -14],
      ],
      [
        [100, 100],
        [100, 100],
      ],
    ] as [Point, Point][]) {
      expect(snap.distanceBetween(a, b), `the distance between (${a.join(", ")}) and (${b.join(", ")})`).toBeCloseTo(Math.hypot(b[0] - a[0], b[1] - a[1]), 9);
      expect(snap.distanceBetween(b, a), "and it is the same distance measured the other way round").toBeCloseTo(snap.distanceBetween(a, b), 9);
    }
  });

  test("AC-1: metresBetween carries each axis by its own factor, to three decimals", async () => {
    const snap = await snapModule();
    const a: Point = [10, 20];
    const b: Point = [310, 420];
    const factors = { factorX: "0.001000000000", factorY: "0.002000000000" };
    const owed = Math.hypot((b[0] - a[0]) * Number(factors.factorX), (b[1] - a[1]) * Number(factors.factorY)).toFixed(3);
    expect(
      snap.metresBetween(a, b, factors),
      "√((Δx·factorX)² + (Δy·factorY)²) over the stored 12-place strings, rendered to three decimals (I-146, L-MEA-05)",
    ).toBe(owed);
    expect(snap.metresBetween(b, a, factors), "and the same distance measured the other way round").toBe(owed);
  });
});

describe("AC-1: the snapped point is keyed on the register's one lattice", () => {
  test("AC-1: keyPoint is [quantise(x), quantise(y)] for every answer the resolver gives", async () => {
    const snap = await snapModule();
    const { quantise } = await keysModule();
    for (const one of SNAP_CASES) {
      const answered = snap.resolveSnap(inputOf(one));
      expect(answered, `${one.name} answers a snap`).not.toBeNull();
      const held = answered as { point: Point; keyPoint: [string, string] };
      expect(
        held.keyPoint,
        `a snapped point is carried into a key through the ONE lattice \`quantise\` (L-REG-04) — never a second rounding of its own (B-17)`,
      ).toEqual([quantise(held.point[0]), quantise(held.point[1])]);
    }
  });

  test("AC-1: a candidate that is no point of the drawing yields no snap, and does not poison its neighbours", async () => {
    const snap = await snapModule();
    const broken = lineRecord("DXF_HANDLE:BROKEN", [Number.NaN, 0], [Number.POSITIVE_INFINITY, 5]);
    const cursor: Point = [0, CASE_OFFSET];
    expect(
      snap.resolveSnap({ cursor, tolerance: CASE_TOLERANCE, candidates: [broken], grid: [], firstPick: null }),
      "a record whose points are not finite quantises to nothing, so it offers no snap rather than throwing where it is drawn",
    ).toBeNull();
    expect(
      snap.resolveSnap({ cursor, tolerance: CASE_TOLERANCE, candidates: [broken, SNAP_GEOMETRY.h], grid: [], firstPick: null })?.sourceKeys,
      "and the sound record beside it is still snapped to",
    ).toEqual([SNAP_GEOMETRY.h.key]);
  });
});
