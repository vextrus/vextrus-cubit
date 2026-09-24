// What a campaign APPLIES off the notes that were read for it (AM-03(h), R-TO-034), and the stored
// readings the screens show.
//
// AM-03(h): a general note re-versions the values a campaign applies — it never mints a rule-set
// edition. So this is a READ: it opens no act, takes no permission beyond the caller's transaction,
// and writes nothing. It is the ONE door the rebar engine asks what fy, f'c, the lap and the hook
// stand at for a pinned revision (the goal); nothing else may assemble those four from rows.
//
// A note may scope a figure to one element class — `f'c = 3000 psi (BORED PILES)` — and then it
// governs that class and no other, while the unscoped figures govern every class no scoped one speaks
// for (I-652). So the door answers the campaign's values once for every unscoped class, and once
// more for each class a note scoped a figure to (`byClass`).
//
// Nothing here resolves a disagreement. A kind two people read differently stands SUSPENDED, is
// absent from the values, and is NAMED — so a rail reading this door cannot mistake a contested
// figure for an unread one (L-REG-03, L-QTY-02).
import { and, drawingSetRevisions, eq, forTenant } from "@/core/db";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import type { ElementType } from "@/core/catalogue/classes";
import { noteStandingsByScope } from "@/core/notes/standing";
import { noteClauseOffersOfDrawing, type NoteClauseOfferWrite } from "@/core/notes/clause-store";
import { readingsOfDrawings, readingsOfSheet, type NoteReadingRow, type NotesScope, type SheetRef } from "@/core/notes/store";

export type { NoteReadingRow, NotesScope, SheetRef } from "@/core/notes/store";
export type { NoteClauseOffer, NoteClauseOfferWrite } from "@/core/notes/clause-store";
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
export type AppliedValues = {
  readonly fy?: DetailingFigure;
  readonly fc?: DetailingFigure;
  readonly lapMultiplier?: number;
  readonly hookExtension?: { readonly multiplier: number | null; readonly minimumMm: number | null };
  readonly sourceKeys: readonly string[];
  readonly suspended: readonly NoteKind[];
};

/**
 * What a revision applies: the values every class takes that no scoped note speaks for, and — for
 * each class a note scoped a figure to — that class's own values whole, its scoped kinds standing
 * over its scoped readings and every other kind at the unscoped answer (I-652). A class no note
 * scoped is absent from `byClass` and takes the unscoped values.
 */
export type AppliedDetailingValues = AppliedValues & {
  readonly byClass: Readonly<Partial<Record<ElementType, AppliedValues>>>;
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
 * Each kind's standing over the readings the revision holds, in each scope (I-652). Keyed by kind
 * and scope rather than by sheet: what a CAMPAIGN applies to one class is one figure, so two sheets
 * stating a lap differently is the same disagreement as two people stating it differently on one
 * sheet, and it suspends the same way — while the piles' strength beside everyone else's is two
 * figures for two scopes, never a disagreement.
 */
function standingsOf(readings: readonly NoteReadingRow[]): Map<ElementType | null, Map<NoteKind, KindStanding>> {
  const byScope = new Map<ElementType | null, Map<NoteKind, KindStanding>>();
  for (const kind of NOTE_KINDS) {
    const held = readings.filter((reading) => reading.kind === kind);
    for (const [scope, standing] of noteStandingsByScope(held)) {
      const scopeClass = scope as ElementType | null;
      const byKind = byScope.get(scopeClass) ?? new Map<NoteKind, KindStanding>();
      byKind.set(kind, {
        canonical: standing.canonical,
        unit: standing.unitAsWritten,
        suspended: standing.standing === "SUSPENDED",
        sourceKeys: standing.current.map((reading) => reading.sourceKey),
      });
      byScope.set(scopeClass, byKind);
    }
  }
  return byScope;
}

/** The values one set of kind standings applies — a figure where a kind stands at one, else absent. */
function valuesOf(standings: ReadonlyMap<NoteKind, KindStanding>): AppliedValues {
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
  const unscoped = standings.get(null) ?? new Map<NoteKind, KindStanding>();

  // A scoped class's kinds stand over its own readings; every kind its notes do not scope stands at
  // the unscoped answer, so the piles take their own f'c and everyone's lap (I-652).
  const byClass: Partial<Record<ElementType, AppliedValues>> = {};
  for (const [scope, scoped] of standings) {
    if (scope === null) continue;
    byClass[scope] = valuesOf(new Map(NOTE_KINDS.flatMap((kind) => {
      const stands = scoped.get(kind) ?? unscoped.get(kind);
      return stands === undefined ? [] : [[kind, stands] as const];
    })));
  }
  return { ...valuesOf(unscoped), byClass };
}

/** Every reading made on ONE sheet, oldest first — what the schedules screen renders (R-TO-034). */
export async function readingsOnSheet(scope: NotesScope, sheet: SheetRef): Promise<NoteReadingRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => readingsOfSheet(tx, scope, sheet));
}

/**
 * Every reading made on any sheet of the drawings named, oldest first. A screen showing a revision's
 * sheets side by side asks for all of them at once rather than once per sheet: the readings of one
 * project are one table, and a read per sheet prices the page in the drawing's layouts.
 */
export async function readingsOnDrawings(scope: NotesScope, drawingIds: readonly string[]): Promise<NoteReadingRow[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => readingsOfDrawings(tx, scope, drawingIds));
}

/**
 * What a MODEL offered about the clauses of one drawing's sheets, as its current partition stored
 * them (R-TO-034, L-AI-02). An offer and not a reading: it stands beside what the grammar offers and
 * is judged by the same one act, and a drawing nobody has put a clause of to a model answers none.
 */
export async function clauseOffersOnDrawing(scope: NotesScope, drawingId: string): Promise<NoteClauseOfferWrite[]> {
  return forTenant({ tenantId: scope.tenantId }).transaction((tx) => noteClauseOffersOfDrawing(tx, scope, drawingId));
}
