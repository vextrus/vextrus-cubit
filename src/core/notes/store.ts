// R-TO-034's note readings, stored and read back, and the detailing values a campaign applies off
// the ones its revision's sheets agree on (AM-03(h), L-BD-02).
//
// Written by the act seam alone (SEAM-ACT), inside the transaction that writes the act row
// (L-ACT-01), and read on the caller's transaction so a Consequence is judged against the state its
// write lands in (L-ACT-02). Append-only: a re-reading is another row, never an edit (R-TO-051).
//
// The applied values are DERIVED, never stored. A note re-versions what a campaign applies and mints
// no rule-set edition: the figures a bill is detailed with are read here, at read time, off the
// readings the revision's own sheets carry — so a later reading changes what the campaign applies
// without a single row of the rule-set ledger moving (AM-03(h)).
import { and, asc, drawingSetRevisions, eq, forTenant, isUuid, notesReadings, type TenantTx } from "../db";
import { NOTE_BASIS, NOTE_KINDS, type NoteAcceptance, type NoteKind } from "./law";
import { noteStanding, type NoteStanding } from "./standing";

/** Which project's readings are being read, in whose workspace. */
export type NotesScope = { readonly tenantId: string; readonly projectId: string };

/** Which sheet a reading was made on: (drawing, layout), as the register and the viewer key one. */
export type NotesSheet = { readonly drawingId: string; readonly layoutName: string };

/** One stored reading, whole, as the store holds it. */
export type NoteReadingRow = typeof notesReadings.$inferSelect;

/** One reading as the act asks the store to write it — the derivation travels with it (L-REG-01). */
export type NoteReadingWrite = {
  readonly drawingId: string;
  readonly layoutName: string;
  readonly readingKey: string;
  readonly kind: NoteKind;
  readonly actorId: string;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
  readonly acceptance: NoteAcceptance;
};

/**
 * Every reading ever made on one sheet, in the order they were made — which is the order a standing
 * is derived in, and `append_seq` rather than the clock because two readings of one transaction share
 * an instant and a standing may not turn on which row a heap scan met first.
 */
export async function readingsOfSheet(tx: TenantTx, scope: NotesScope, sheet: NotesSheet): Promise<NoteReadingRow[]> {
  if (!isUuid(scope.projectId) || !isUuid(sheet.drawingId)) return [];
  return tx
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
    .orderBy(asc(notesReadings.appendSeq));
}

/** The readings the act is about to append, written under the act that carried them (L-ACT-01). */
export async function writeNoteReadings(tx: TenantTx, scope: NotesScope, actId: string, readings: readonly NoteReadingWrite[]): Promise<void> {
  if (readings.length === 0) return;
  await tx.insert(notesReadings).values(
    readings.map((reading) => ({
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      drawingId: reading.drawingId,
      layoutName: reading.layoutName,
      readingKey: reading.readingKey,
      kind: reading.kind,
      actorId: reading.actorId,
      sourceKey: reading.sourceKey,
      valueAsWritten: reading.valueAsWritten,
      unitAsWritten: reading.unitAsWritten,
      canonical: reading.canonical,
      // L-QTY-01's basis, read off the law rather than spelled here: a note reading is transcribed.
      basis: NOTE_BASIS,
      acceptance: reading.acceptance,
      actId,
    })),
  );
}

/* ------------------------------------------------------- what the campaign applies, derived on read */

/** Which campaign's applied values are being asked for: the project, at the revision it is pinned to. */
export type AppliedDetailingScope = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly setRevisionId: string;
};

/** A strength as a note states one: the figure, in the unit the drawing wrote it in (L-MEA-01). */
export type AppliedFigure = { readonly value: number; readonly unit: string };

/** The 135° hook, whose two halves stand as two readings and answer as one value (R-TO-034). */
export type AppliedHook = { readonly multiplier: number | null; readonly minimumMm: number | null };

/**
 * What a campaign details its bill with, as its revision's agreed readings state it. A figure nobody
 * read is not a key of this answer at all: an absent key is an absence, and a zero or a default would
 * be a figure the machine invented (L-MEA-01, R-UI-050).
 */
export type AppliedDetailingValues = {
  readonly fy?: AppliedFigure;
  readonly fc?: AppliedFigure;
  readonly lapMultiplier?: number;
  readonly hookExtension?: AppliedHook;
  /** The text each applied figure was read from, in the law's own order of kinds (L-CAD-03). */
  readonly sourceKeys: readonly string[];
  /** The kinds whose readings disagree, which apply nothing until a later reading settles them. */
  readonly suspended: readonly string[];
};

/** The unit a stated minimum has to be written in to be a minimum in millimetres (§8's IOU). */
const MILLIMETRES = "mm";

/**
 * The detailing values this campaign applies (AC-4): one standing per kind, taken over every reading
 * made on the sheets the pinned revision's manifest names, and nothing else.
 *
 * It is a read. It opens no act, writes no row and mints no rule-set edition — a note re-versions
 * what the campaign APPLIES, and the edition says what the rules ARE (AM-03(h)).
 *
 * A reading made on a sheet this revision does not hold is another campaign's evidence: the manifest
 * is what a revision cites, and a figure read outside it was never pinned here (L-REG-07).
 */
export async function appliedDetailingValuesOf(scope: AppliedDetailingScope): Promise<AppliedDetailingValues> {
  const empty: AppliedDetailingValues = { sourceKeys: [], suspended: [] };
  if (!isUuid(scope.projectId) || !isUuid(scope.setRevisionId)) return empty;

  const store = forTenant({ tenantId: scope.tenantId });
  const pinned = await store
    .select({ manifest: drawingSetRevisions.manifest })
    .from(drawingSetRevisions)
    .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.setRevisionId, scope.setRevisionId)))
    .limit(1);
  const held = new Set((pinned[0]?.manifest ?? []).map((member) => member.drawingId));
  if (held.size === 0) return empty;

  const made = await store
    .select()
    .from(notesReadings)
    .where(and(eq(notesReadings.tenantId, scope.tenantId), eq(notesReadings.projectId, scope.projectId)))
    .orderBy(asc(notesReadings.appendSeq));
  const applicable = made.filter((row) => held.has(row.drawingId));
  if (applicable.length === 0) return empty;

  const standings = new Map<NoteKind, NoteStanding<NoteReadingRow>>(
    NOTE_KINDS.map((kind) => [kind, noteStanding(applicable.filter((row) => row.kind === kind))]),
  );
  return assemble(standings);
}

/**
 * The answer, assembled in the law's own order of kinds so the keys a revision cites read in that
 * order too. Only an AGREED standing applies: a suspension prints no number, and states which kind
 * is suspended instead — nothing is resolved by taking one side of a disagreement (L-REG-03).
 */
function assemble(standings: ReadonlyMap<NoteKind, NoteStanding<NoteReadingRow>>): AppliedDetailingValues {
  const sourceKeys: string[] = [];
  const suspended: string[] = [];
  const agreed = new Map<NoteKind, NoteStanding<NoteReadingRow>>();

  for (const kind of NOTE_KINDS) {
    const standing = standings.get(kind);
    if (standing === undefined) continue;
    if (standing.standing === "SUSPENDED") suspended.push(kind);
    if (standing.standing !== "AGREED") continue;
    agreed.set(kind, standing);
    for (const reading of standing.current) sourceKeys.push(reading.sourceKey);
  }

  const fy = agreed.get("FY");
  const fc = agreed.get("FC");
  const lap = agreed.get("LAP");
  const hook = agreed.get("HOOK");
  const hookMin = agreed.get("HOOK_MIN");

  return {
    ...(fy === undefined ? {} : { fy: figureOf(fy) }),
    ...(fc === undefined ? {} : { fc: figureOf(fc) }),
    ...(lap === undefined ? {} : { lapMultiplier: Number(lap.canonical) }),
    ...(hook === undefined && hookMin === undefined
      ? {}
      : {
          hookExtension: {
            multiplier: hook === undefined ? null : Number(hook.canonical),
            // The stated minimum applies in millimetres or not at all: a minimum written in another
            // unit was read as the drawing wrote it, and converting it is inc-309's (§8's IOU) —
            // nothing is assumed where the note did not say it (L-MEA-01).
            minimumMm: hookMin === undefined || hookMin.unitAsWritten !== MILLIMETRES ? null : Number(hookMin.canonical),
          },
        }),
    sourceKeys,
    suspended,
  };
}

/** One agreed strength, as the campaign applies it: the figure, in the unit it was written in. */
function figureOf(standing: NoteStanding<NoteReadingRow>): AppliedFigure {
  return { value: Number(standing.canonical), unit: standing.unitAsWritten ?? "" };
}
