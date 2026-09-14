// What a campaign APPLIES off the notes that were read for it (AM-03(h), R-TO-034), and the stored
// readings the screens show.
//
// AM-03(h): a general note re-versions the values a campaign applies — it never mints a rule-set
// edition. So this is a READ: it opens no act, takes no permission beyond the caller's transaction,
// and writes nothing. It is the ONE door the rebar engine asks what fy, f'c, the lap and the hook
// stand at for a pinned revision (the goal); nothing else may assemble those four from rows.
//
// Nothing here resolves a disagreement. A kind two people read differently stands SUSPENDED, is
// absent from the values, and is NAMED — so a rail reading this door cannot mistake a contested
// figure for an unread one (L-REG-03, L-QTY-02).
import { and, drawingSetRevisions, eq, forTenant } from "@/core/db";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import { noteStanding } from "@/core/notes/standing";
import { readingsOfDrawings, readingsOfSheet, type NoteReadingRow, type NotesScope, type SheetRef } from "@/core/notes/store";

export type { NoteReadingRow, NotesScope, SheetRef } from "@/core/notes/store";
export { readingsOfSheet, writeNoteReadings } from "@/core/notes/store";

/** Which revision's applied values are being asked for, in whose workspace and project. */
export type AppliedDetailingScope = { readonly tenantId: string; readonly projectId: string; readonly setRevisionId: string };

/** A figure as a note stated it: the number, and the unit the drawing wrote it in (L-REG-01). */
export type DetailingFigure = { readonly value: number; readonly unit: string };

/**
 * What one pinned revision applies, off the notes read on the sheets it holds.
 *
 * Every value is OPTIONAL and absent rather than defaulted: a figure nobody read is unread, and a
 * default would be a number the machine invented and then billed (L-MEA-01, L-BD-02). `sourceKeys`
 * cites every text the answer was read from — including the texts of a kind that suspended, because
 * a reader asking why a figure is missing is owed the evidence of the disagreement.
 */
export type AppliedDetailingValues = {
  readonly fy?: DetailingFigure;
  readonly fc?: DetailingFigure;
  readonly lapMultiplier?: number;
  readonly hookExtension?: { readonly multiplier: number | null; readonly minimumMm: number | null };
  readonly sourceKeys: readonly string[];
  readonly suspended: readonly NoteKind[];
};

/** The drawings the pinned revision names, as the pin recorded them (L-REG-06). */
async function drawingsOfRevision(tenantId: string, setRevisionId: string): Promise<string[]> {
  const held = await forTenant({ tenantId }).transaction((tx) =>
    tx
      .select({ manifest: drawingSetRevisions.manifest })
      .from(drawingSetRevisions)
      .where(and(eq(drawingSetRevisions.tenantId, tenantId), eq(drawingSetRevisions.setRevisionId, setRevisionId)))
      .limit(1),
  );
  return (held[0]?.manifest ?? []).map((member) => member.drawingId);
}

/** How one kind stands over every reading of it the revision's sheets carry. */
type KindStanding = { readonly canonical: string | null; readonly unit: string | null; readonly suspended: boolean; readonly sourceKeys: readonly string[] };

/**
 * Each kind's standing over the readings the revision holds. Keyed by kind rather than by sheet:
 * what a CAMPAIGN applies is one figure, so two sheets stating a lap differently is the same
 * disagreement as two people stating it differently on one sheet, and it suspends the same way.
 */
function standingsOf(readings: readonly NoteReadingRow[]): Map<NoteKind, KindStanding> {
  const byKind = new Map<NoteKind, KindStanding>();
  for (const kind of NOTE_KINDS) {
    const held = readings.filter((reading) => reading.kind === kind);
    if (held.length === 0) continue;
    const standing = noteStanding(held);
    byKind.set(kind, {
      canonical: standing.canonical,
      unit: standing.unitAsWritten,
      suspended: standing.standing === "SUSPENDED",
      sourceKeys: standing.current.map((reading) => reading.sourceKey),
    });
  }
  return byKind;
}

/** The figure a kind stands at, or null where it stands at none (unread, or contested). */
function figureOf(standing: KindStanding | undefined): DetailingFigure | null {
  if (standing === undefined || standing.canonical === null) return null;
  const value = Number(standing.canonical);
  return Number.isFinite(value) ? { value, unit: standing.unit ?? "" } : null;
}

/** The multiplier a kind stands at, as a bare number — a lap and a hook are multiples of a diameter. */
function multiplierOf(standing: KindStanding | undefined): number | null {
  const figure = figureOf(standing);
  return figure === null ? null : figure.value;
}

/**
 * What this revision applies today (test contract: `appliedDetailingValuesOf`). A read, and nothing
 * more: it opens no act and mints no rule-set edition (AM-03(h)).
 */
export async function appliedDetailingValuesOf(scope: AppliedDetailingScope): Promise<AppliedDetailingValues> {
  const drawingIds = await drawingsOfRevision(scope.tenantId, scope.setRevisionId);
  const notes: NotesScope = { tenantId: scope.tenantId, projectId: scope.projectId };
  const readings = await forTenant({ tenantId: scope.tenantId }).transaction((tx) => readingsOfDrawings(tx, notes, drawingIds));
  const standings = standingsOf(readings);

  const fy = figureOf(standings.get("FY"));
  const fc = figureOf(standings.get("FC"));
  const lap = multiplierOf(standings.get("LAP"));
  const hook = multiplierOf(standings.get("HOOK"));
  const hookMin = multiplierOf(standings.get("HOOK_MIN"));

  return {
    ...(fy === null ? {} : { fy }),
    ...(fc === null ? {} : { fc }),
    ...(lap === null ? {} : { lapMultiplier: lap }),
    // The two halves of a hook are two readings and answer as one value: the half nobody read is
    // null inside it, rather than the whole hook going missing because one half was never stated.
    ...(hook === null && hookMin === null ? {} : { hookExtension: { multiplier: hook, minimumMm: hookMin } }),
    sourceKeys: NOTE_KINDS.flatMap((kind) => [...(standings.get(kind)?.sourceKeys ?? [])]),
    suspended: NOTE_KINDS.filter((kind) => standings.get(kind)?.suspended === true),
  };
}

/** Every reading made on ONE sheet, oldest first — what the schedules screen renders (R-TO-034). */
export async function readingsOnSheet(scope: NotesScope, sheet: SheetRef): Promise<NoteReadingRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => readingsOfSheet(tx, scope, sheet));
}
