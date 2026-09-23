// The order a quantity surveyor reads a register in (s-takeoff I-350), spelled once for the reading
// that states the lines and for the tree that lists the objects beside them (B-17).
//
// A register is read storey by storey, member by member: the foundation first, then the stack from
// its lowest level up, each level's classes together, each class's marks in the order a reader counts
// them (`P1, P2 … P10`), and one member's lines — its count, its concrete, its boring — side by side.
// The order the lines were PUBLISHED in is none of these: one campaign publishes at one instant, so
// the store's `published_at, line_id` order is the order of the line ids, which is no order at all.
//
// Pure, and asks no locale: a digit run orders by its value and every other run by its code points
// (the platform's collator is SEAM-FORMAT's alone, L-FMT-01), so the order is the same everywhere.
import { compareCanonical } from "@/core/identity";

/**
 * Marks in the order a quantity surveyor reads them — `P2` before `P10`, `C1` before `C1A` (R-UI-083).
 * A run of digits orders by its value and every other run by its code points.
 */
const RUNS = /\d+|\D+/gu;
export function markOrder(left: string, right: string): number {
  const a = left.match(RUNS) ?? [];
  const b = right.match(RUNS) ?? [];
  for (let at = 0; at < Math.min(a.length, b.length); at += 1) {
    const x = a[at] as string;
    const y = b[at] as string;
    if (x === y) continue;
    const digits = /^\d/u.test(x) && /^\d/u.test(y);
    if (digits) {
      const bare = (run: string): string => run.replace(/^0+(?=\d)/u, "");
      const [p, q] = [bare(x), bare(y)];
      if (p.length !== q.length) return p.length - q.length;
      if (p !== q) return p < q ? -1 : 1;
      continue;
    }
    return x < y ? -1 : 1;
  }
  return a.length - b.length || compareCanonical(left, right);
}

/** The lawful-null slot a foundation is filed under: it stands below every storey of the stack. */
const BELOW_THE_STACK = "FOUNDATION";

/**
 * Where one line's level stands in reading order: the foundation slot below the whole stack, a stack
 * level at its own ordinal, and anything the stack does not place — the UNRESOLVED slot, a label no
 * level registers — after it, where a reader looks for what is still to be settled.
 */
export function levelRank(level: { readonly levelId: string | null; readonly levelSlot: string | null } | undefined, ordinals: ReadonlyMap<string, number>): number {
  if (level === undefined) return Number.POSITIVE_INFINITY;
  if (level.levelSlot === BELOW_THE_STACK) return Number.NEGATIVE_INFINITY;
  if (level.levelId !== null) return ordinals.get(level.levelId) ?? Number.POSITIVE_INFINITY;
  return Number.POSITIVE_INFINITY;
}

/** What one line is placed by: its level's rank and label, its class, its member's mark, its kind. */
export type LineRank = {
  readonly rank: number;
  readonly level: string;
  readonly class: string;
  readonly mark: string;
  readonly kind: string;
  readonly lineId: string;
};

/**
 * The register's reading order: level (rank, then label — two unplaced levels still read apart),
 * class, mark in natural order, kind, and the line id last, so the order is total and the same on
 * every read.
 */
export function readingOrder(left: LineRank, right: LineRank): number {
  if (left.rank !== right.rank) return left.rank < right.rank ? -1 : 1;
  return (
    compareCanonical(left.level, right.level) ||
    compareCanonical(left.class, right.class) ||
    markOrder(left.mark, right.mark) ||
    compareCanonical(left.kind, right.kind) ||
    compareCanonical(left.lineId, right.lineId)
  );
}
