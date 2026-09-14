// R-TO-034's note readings, stored and read back: what each person read off a sheet's general notes,
// under which act, on what evidence.
//
// Written by the act seam alone (SEAM-ACT), inside the transaction that writes the act row
// (L-ACT-01), and read on the caller's transaction so a Consequence is judged against the state its
// write lands in (L-ACT-02). Nothing is ever rewritten: a re-reading is another row, and which row
// is current is derived at read time (`./standing.ts`).
import { and, asc, eq, inArray, notesReadings, type TenantTx } from "../db";
import { NOTE_BASIS, type NoteAcceptance, type NoteKind } from "./law";

/** Which workspace and project a reading is scoped to. */
export type NotesScope = { readonly tenantId: string; readonly projectId: string };

/** The sheet a reading was made on — (drawing, layout), as the register and the viewer key one. */
export type SheetRef = { readonly drawingId: string; readonly layoutName: string };

/** One stored reading, whole, as a caller reads it back. */
export type NoteReadingRow = {
  readonly readingKey: string;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly kind: NoteKind;
  readonly actorId: string;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
  readonly basis: string;
  readonly acceptance: NoteAcceptance;
  readonly actId: string;
};

/** One reading as the act asks the store to write it — the verdict travels with it (R-TO-034). */
export type NoteReadingWrite = {
  readonly drawingId: string;
  readonly layoutName: string;
  readonly readingKey: string;
  readonly kind: NoteKind;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
  readonly acceptance: NoteAcceptance;
};

/** The row as the store holds it, read as the record above. */
function row(held: typeof notesReadings.$inferSelect): NoteReadingRow {
  return {
    readingKey: held.readingKey,
    drawingId: held.drawingId,
    layoutName: held.layoutName,
    kind: held.kind,
    actorId: held.actorId,
    sourceKey: held.sourceKey,
    valueAsWritten: held.valueAsWritten,
    unitAsWritten: held.unitAsWritten,
    canonical: held.canonical,
    basis: held.basis,
    acceptance: held.acceptance,
    actId: held.actId,
  };
}

/** The order a standing is derived in: oldest first, the reading id settling two of one instant. */
function oldestFirst() {
  return [asc(notesReadings.createdAt), asc(notesReadings.actId), asc(notesReadings.readingKey)] as const;
}

/** Every reading ever made on ONE sheet of one project, oldest first. */
export async function readingsOfSheet(tx: TenantTx, scope: NotesScope, sheet: SheetRef): Promise<NoteReadingRow[]> {
  const held = await tx
    .select()
    .from(notesReadings)
    .where(
      and(
        eq(notesReadings.tenantId, scope.tenantId),
        eq(notesReadings.projectId, scope.projectId),
        eq(notesReadings.drawingId, sheet.drawingId),
        eq(notesReadings.layoutName, sheet.layoutName),
      ),
    )
    .orderBy(...oldestFirst());
  return held.map(row);
}

/**
 * Every reading made on any sheet of the drawings named, oldest first — what a pinned revision
 * applies is read over exactly the drawings its manifest holds (L-REG-07). A revision naming no
 * drawing reads nothing rather than everything.
 */
export async function readingsOfDrawings(tx: TenantTx, scope: NotesScope, drawingIds: readonly string[]): Promise<NoteReadingRow[]> {
  if (drawingIds.length === 0) return [];
  const held = await tx
    .select()
    .from(notesReadings)
    .where(and(eq(notesReadings.tenantId, scope.tenantId), eq(notesReadings.projectId, scope.projectId), inArray(notesReadings.drawingId, [...drawingIds])))
    .orderBy(...oldestFirst());
  return held.map(row);
}

/** Append the readings one act carried. Nothing is ever rewritten: a correction is another row. */
export async function writeNoteReadings(tx: TenantTx, scope: NotesScope, actorId: string, actId: string, readings: readonly NoteReadingWrite[]): Promise<void> {
  if (readings.length === 0) return;
  await tx.insert(notesReadings).values(
    readings.map((reading) => ({
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      drawingId: reading.drawingId,
      layoutName: reading.layoutName,
      readingKey: reading.readingKey,
      kind: reading.kind,
      actorId,
      sourceKey: reading.sourceKey,
      valueAsWritten: reading.valueAsWritten,
      unitAsWritten: reading.unitAsWritten,
      canonical: reading.canonical,
      basis: NOTE_BASIS,
      acceptance: reading.acceptance,
      actId,
    })),
  );
}
