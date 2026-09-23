// R-UI-021's "counts of rows affected", read for the lines an act would re-derive (I-446): the ids
// a Consequence's effects name, counted the way a quantity surveyor counts them — by class, kind and
// the level the measured objects stand on. Nothing here decides WHICH lines move; each act's own
// code path names the ids (R-TO-020), and this only says what those same ids are.
//
// A line's class and kind are its own columns; its level is the register's reading of the object it
// was measured off (L-REG-04), as `level-effects` reads it — a level, a lawful-null slot, or a
// placeholder label the drawing stated before any level stood.
import { and, eq, inArray, levels, quantityLines, registerObjects, type TenantTx } from "../db";
import { ELEMENT_TYPES } from "../catalogue/classes";
import { KINDS } from "../catalogue/kinds";
import { LEVEL_SLOTS } from "../identity/keys";
import { descriptionOf } from "../documents/kinds/boq-draft-law";
import type { ConsequenceLineGroup } from "./consequence";

/** Whose lines are read, in whose workspace. */
export type LineGroupsScope = { readonly tenantId: string; readonly projectId: string };

/** What grouping needs of one line: its class and kind, and where its object stands. */
export type GroupableLine = {
  readonly elementClass: string;
  readonly kind: string;
  readonly levelId: string | null;
  readonly levelLabel: string | null;
  readonly levelOrdinal: number | null;
  readonly levelSlot: string | null;
};

/** The slot that stands below every level, read off the roster rather than spelled beside it (B-17). */
const [FOUNDATION] = LEVEL_SLOTS;

/** Where a value stands in its closed roster; a value no roster holds sorts after every one it does. */
function rosterIndex(roster: readonly string[], value: string): number {
  const at = roster.indexOf(value);
  return at === -1 ? roster.length : at;
}

/**
 * Where a group stands in the building, lowest first: the foundation slot below every level, the
 * levels by ordinal, then what stands on no resolved level — the unresolved slot, a placeholder
 * label, or nothing at all — so a reader reads the effects up the building, as the stack reads.
 */
function heightOf(line: GroupableLine): readonly [number, number] {
  if (line.levelSlot === FOUNDATION) return [0, 0];
  if (line.levelId !== null && line.levelOrdinal !== null) return [1, line.levelOrdinal];
  if (line.levelSlot !== null) return [2, rosterIndex(LEVEL_SLOTS, line.levelSlot)];
  return [3, 0];
}

/** One group's identity: the pair the bill orders by, and the place it stands. */
function keyOf(line: GroupableLine): string {
  return JSON.stringify([line.elementClass, line.kind, line.levelId, line.levelSlot, line.levelId === null ? line.levelLabel : null]);
}

function compareCode(one: string, other: string): number {
  return one < other ? -1 : one > other ? 1 : 0;
}

/**
 * The lines, counted by (class, kind, level). Pure, and ordered so one set of lines always reads one
 * way: up the building, then the bill's own class-then-kind roster order, then the label's code
 * points. The counts sum to the lines' length — a group is a reading of the ids, never a filter.
 */
export function groupLines(lines: readonly GroupableLine[]): ConsequenceLineGroup[] {
  const held = new Map<string, { line: GroupableLine; count: number }>();
  for (const line of lines) {
    const key = keyOf(line);
    const group = held.get(key);
    if (group === undefined) held.set(key, { line, count: 1 });
    else group.count += 1;
  }
  const ordered = [...held.values()].sort((one, other) => {
    const [oneBand, oneAt] = heightOf(one.line);
    const [otherBand, otherAt] = heightOf(other.line);
    return (
      oneBand - otherBand ||
      oneAt - otherAt ||
      rosterIndex(ELEMENT_TYPES, one.line.elementClass) - rosterIndex(ELEMENT_TYPES, other.line.elementClass) ||
      rosterIndex(KINDS, one.line.kind) - rosterIndex(KINDS, other.line.kind) ||
      compareCode(one.line.levelLabel ?? "", other.line.levelLabel ?? "") ||
      compareCode(keyOf(one.line), keyOf(other.line))
    );
  });
  return ordered.map(({ line, count }) => ({
    elementClass: line.elementClass,
    kind: line.kind,
    description: descriptionOf(line.elementClass, line.kind),
    levelLabel: line.levelLabel,
    levelSlot: line.levelSlot,
    count,
  }));
}

/**
 * The groups these lines of one project fall in. A line the register no longer holds an object for
 * is still counted — under its class and kind, on no level — because a count that dropped it would
 * say fewer lines move than the ids the person is confirming (L-ACT-02).
 */
export async function lineGroupsOf(tx: TenantTx, scope: LineGroupsScope, lineIds: readonly string[]): Promise<ConsequenceLineGroup[]> {
  const wanted = [...new Set(lineIds)];
  if (wanted.length === 0) return [];
  const rows = await tx
    .select({
      elementClass: quantityLines.class,
      kind: quantityLines.kind,
      levelId: registerObjects.levelId,
      levelSlot: registerObjects.levelSlot,
      placeholder: registerObjects.levelLabel,
      label: levels.label,
      ordinal: levels.ordinal,
    })
    .from(quantityLines)
    .leftJoin(
      registerObjects,
      and(
        eq(registerObjects.tenantId, quantityLines.tenantId),
        eq(registerObjects.setRevisionId, quantityLines.setRevisionId),
        eq(registerObjects.objectKey, quantityLines.objectKey),
      ),
    )
    .leftJoin(levels, and(eq(levels.tenantId, registerObjects.tenantId), eq(levels.levelId, registerObjects.levelId)))
    .where(and(eq(quantityLines.tenantId, scope.tenantId), eq(quantityLines.projectId, scope.projectId), inArray(quantityLines.lineId, wanted)));
  return groupLines(
    rows.map((row) => ({
      elementClass: row.elementClass,
      kind: row.kind,
      levelId: row.levelId ?? null,
      levelLabel: row.label ?? row.placeholder ?? null,
      levelOrdinal: row.ordinal ?? null,
      levelSlot: row.levelSlot ?? null,
    })),
  );
}
