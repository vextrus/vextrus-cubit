/**
 * F-ARCH's walls as the GENERATOR authors them (DECISIONS.md A-10), in the geometry of its own model —
 * never the product's reading: each wall's axis and thickness type, and the stretches of that axis its
 * brickwork runs over, clear between the faces of what owns its ends (a `face` stop is the near face of
 * the wall it abuts; a `pt` stop the point the axes meet) and clear of every column and core piece
 * standing on it. The rule is `fixtures/gen/arch/golden.py`'s path 1, restated over the model so a
 * suite grades the product's walls against what was drawn from, wall by wall.
 *
 * Mechanics only: no product source is read, and no database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Pt = readonly [number, number];

/** One wall as the model authors it. */
type AuthoredWall = {
  readonly id: string;
  readonly type: string;
  readonly t: string;
  readonly a: readonly [string, string];
  readonly b: readonly [string, string];
  readonly stops: readonly (readonly string[])[];
};

/** One opening as the model authors it: its mark and the wall it stands in. */
type AuthoredOpening = { readonly id: string; readonly mark: string; readonly host: string };

/** One authored level's walls, openings and what stands on the walls' axes. */
type AuthoredLevel = {
  readonly walls: readonly AuthoredWall[];
  readonly openings: readonly AuthoredOpening[];
  readonly columns: readonly { readonly poly: readonly (readonly [string, string])[] }[];
  readonly core: readonly { readonly poly: readonly (readonly [string, string])[] }[];
  readonly archways: readonly { readonly line: string; readonly at: string; readonly lo: string; readonly hi: string; readonly t: string }[];
};

/** An authored wall, read: its axis, its type, and the clear stretches of that axis its brickwork runs. */
export type ClearWall = {
  readonly id: string;
  readonly type: string;
  readonly a: Pt;
  readonly u: Pt;
  /** Distances along the axis from `a`, in millimetres. */
  readonly clear: readonly (readonly [number, number])[];
};

/** The model the generator minted F-ARCH from, as far as its walls go. */
export function archLevels(): Readonly<Record<string, AuthoredLevel>> {
  const model = JSON.parse(readFileSync(join(process.cwd(), "fixtures/arch/model.json"), "utf8")) as { levels: Record<string, AuthoredLevel> };
  return model.levels;
}

const pt = (p: readonly [string, string]): Pt => [Number(p[0]), Number(p[1])];
const lengthOf = (p: Pt, q: Pt): number => Math.hypot(q[0] - p[0], q[1] - p[1]);

/** Where a wall's axis meets the near face of the wall it abuts (golden.py's `_face_stop`). */
function faceStop(wall: AuthoredWall, atA: boolean, other: AuthoredWall, u: Pt): number {
  const a = pt(other.a);
  const b = pt(other.b);
  const ll = lengthOf(a, b);
  const half = Number(other.t) / 2;
  const n: Pt = [(-(b[1] - a[1]) / ll) * half, ((b[0] - a[0]) / ll) * half];
  const hits: number[] = [];
  for (const sign of [1, -1]) {
    const p = pt(wall.a);
    const fa: Pt = [a[0] + sign * n[0], a[1] + sign * n[1]];
    const s: Pt = [b[0] - a[0], b[1] - a[1]];
    const den = u[0] * s[1] - u[1] * s[0];
    if (den === 0) continue;
    hits.push(((fa[0] - p[0]) * s[1] - (fa[1] - p[1]) * s[0]) / den);
  }
  return atA ? Math.max(...hits) : Math.min(...hits);
}

/** The stretch of a wall's axis a convex obstruction stands over (Cyrus–Beck), or null. */
function covered(a: Pt, u: Pt, ll: number, poly: readonly Pt[]): readonly [number, number] | null {
  let lo = 0;
  let hi = ll;
  const area = poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length] as Pt;
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const ccw = area > 0 ? poly : [...poly].reverse();
  for (let i = 0; i < ccw.length; i += 1) {
    const p = ccw[i] as Pt;
    const q = ccw[(i + 1) % ccw.length] as Pt;
    // Inward normal of a CCW edge.
    const n: Pt = [-(q[1] - p[1]), q[0] - p[0]];
    const num = (a[0] - p[0]) * n[0] + (a[1] - p[1]) * n[1];
    const den = u[0] * n[0] + u[1] * n[1];
    if (den === 0) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
  }
  return hi - lo > 1e-6 ? [lo, hi] : null;
}

/** The intervals left once a cut is taken out of them. */
function subtract(intervals: readonly (readonly [number, number])[], cut: readonly [number, number]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of intervals) {
    if (cut[1] <= a || cut[0] >= b) {
      out.push([a, b]);
      continue;
    }
    if (cut[0] > a) out.push([a, cut[0]]);
    if (cut[1] < b) out.push([cut[1], b]);
  }
  return out.filter(([a, b]) => b - a > 1e-6);
}

/** Every authored wall of one level, with the clear stretches its brickwork runs over. */
export function clearWallsOf(level: AuthoredLevel): ClearWall[] {
  const byId = new Map(level.walls.map((wall) => [wall.id, wall]));
  const obstructions = [...level.columns, ...level.core].map((one) => one.poly.map(pt));
  return level.walls.map((wall) => {
    const a = pt(wall.a);
    const b = pt(wall.b);
    const ll = lengthOf(a, b);
    const u: Pt = [(b[0] - a[0]) / ll, (b[1] - a[1]) / ll];
    const stopAt = (end: 0 | 1): number => {
      const stop = wall.stops[end] ?? [];
      const abutted = stop[0] === "face" ? byId.get(stop[1] ?? "") : undefined;
      if (abutted === undefined) return end === 0 ? 0 : ll;
      return faceStop(wall, end === 0, abutted, u);
    };
    let clear: [number, number][] = [[stopAt(0), stopAt(1)]];
    for (const poly of obstructions) {
      const cut = covered(a, u, ll, poly);
      if (cut !== null) clear = subtract(clear, cut);
    }
    return { id: wall.id, type: wall.type, a, u, clear };
  });
}

/**
 * How much of a segment (drawn in the plan's model coordinates, carried back to the model's own by the
 * plan's offset) lies on the clear stretches of the authored walls of its type — collinear with the
 * axis to within a millimetre.
 */
export function coveredLength(from: Pt, to: Pt, type: string, walls: readonly ClearWall[]): number {
  let covered = 0;
  for (const wall of walls) {
    if (wall.type !== type) continue;
    const along = (p: Pt): number => (p[0] - wall.a[0]) * wall.u[0] + (p[1] - wall.a[1]) * wall.u[1];
    const off = (p: Pt): number => -(p[0] - wall.a[0]) * wall.u[1] + (p[1] - wall.a[1]) * wall.u[0];
    if (Math.abs(off(from)) > 1 || Math.abs(off(to)) > 1) continue;
    const lo = Math.min(along(from), along(to));
    const hi = Math.max(along(from), along(to));
    for (const [c0, c1] of wall.clear) covered += Math.max(0, Math.min(hi, c1) - Math.max(lo, c0));
  }
  return covered;
}
