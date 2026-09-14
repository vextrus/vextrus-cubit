// S-Schedules' reading (R-TO-034, L-CAD-08): the pinned revision's sheets, what each sheet's
// schedules reconstructed into, the member types they named, and how its general notes stand.
//
// It composes rather than computes. What a drawing's schedules and member types ARE is the
// partition's (`@/modules/takeoff/partition`); what a sheet's words are, what they propose and how a
// reading stands are the notes lane's (`@/modules/takeoff/notes`). This file asks each of them once
// and lays the answers side by side (B-17, ARCH-02).
//
// Nothing here counts anything. A table answers the rows the store holds for it, a family answers the
// mark the schedule wrote, and no field below is a number of members (L-CAD-08, I-250, I-251).
import { and, desc, drawingSetRevisions, eq, forTenant } from "@/core/db";
import { proposeNotes, type SheetText } from "@/core/notes/grammar";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import { noteStanding } from "@/core/notes/standing";
import type { NoteReadingRow } from "@/core/notes/store";
import { readingsOnDrawings, sheetLayoutsOf } from "@/modules/takeoff/notes";
import { memberTypesOf, schedulesOf, type MemberFamily, type ScheduleCell, type StoredSchedule, type ViewsScope } from "@/modules/takeoff/partition";
import type { FamilyView, NotesView, ReadingView, ScheduleTableView, SchedulesView, SheetView, StandingView } from "./view";

/** Which project's sheets are being read, in which workspace. */
export type SchedulesViewScope = { readonly tenantId: string; readonly projectId: string };

/** The space a drawing's views are cut out of — schedules and their deferrals stand there (L-CAD-06). */
const MODEL_SPACE = "model";

/** The revision a project's takeoff stands on today, and the drawings it named (L-REG-06, L-REG-07). */
type PinnedRevision = { readonly setRevisionId: string; readonly drawingIds: readonly string[] };

/**
 * The whole reading of one project's schedules and notes (test contract: `schedulesViewOf`). A
 * project with nothing pinned answers a revision of none and no sheet at all — which is the screen's
 * empty cell rather than a refusal, because a project nobody has read a drawing on is not an error
 * anyone can act on (R-UI-050).
 */
export async function schedulesViewOf(scope: SchedulesViewScope): Promise<SchedulesView> {
  const pinned = await pinnedRevisionOf(scope);
  if (pinned === null) return { projectId: scope.projectId, setRevisionId: null, sheets: [] };

  const readings = await readingsOnDrawings(scope, pinned.drawingIds);
  const byDrawing = new Map<string, NoteReadingRow[]>();
  for (const reading of readings) {
    const held = byDrawing.get(reading.drawingId);
    if (held === undefined) byDrawing.set(reading.drawingId, [reading]);
    else held.push(reading);
  }

  const perDrawing = await Promise.all(pinned.drawingIds.map(async (drawingId) => sheetsOfDrawing(scope, drawingId, byDrawing.get(drawingId) ?? [])));
  return { projectId: scope.projectId, setRevisionId: pinned.setRevisionId, sheets: perDrawing.flat() };
}

/**
 * The revision the project's takeoff stands on: the newest pin. The order is TOTAL — `created_at`
 * alone leaves two revisions written in one instant in whichever order the planner reached them, and
 * "the current pin" would change between two reads of the same rows.
 */
async function pinnedRevisionOf(scope: SchedulesViewScope): Promise<PinnedRevision | null> {
  const held = await forTenant({ tenantId: scope.tenantId }).transaction((tx) =>
    tx
      .select({ setRevisionId: drawingSetRevisions.setRevisionId, manifest: drawingSetRevisions.manifest })
      .from(drawingSetRevisions)
      .where(and(eq(drawingSetRevisions.tenantId, scope.tenantId), eq(drawingSetRevisions.projectId, scope.projectId)))
      .orderBy(desc(drawingSetRevisions.createdAt), desc(drawingSetRevisions.setRevisionId))
      .limit(1),
  );
  const revision = held[0];
  return revision === undefined ? null : { setRevisionId: revision.setRevisionId, drawingIds: revision.manifest.map((member) => member.drawingId) };
}

/**
 * The sheets of one drawing this screen has something to say about: a sheet holding a reconstructed
 * schedule, a schedule view that deferred, or a word that could be read as a figure (I-248). A sheet
 * holding none of those is not a row in the rail — there is nothing on it for this screen to render.
 *
 * Schedules, their deferrals and the member types they named all stand on the drawing's MODEL space,
 * because that is the only space L-CAD-06 cuts views out of. A paper sheet carries its own words and
 * nothing else.
 */
async function sheetsOfDrawing(scope: SchedulesViewScope, drawingId: string, readings: readonly NoteReadingRow[]): Promise<SheetView[]> {
  const viewsScope: ViewsScope = { tenantId: scope.tenantId, projectId: scope.projectId, drawingId };
  const [layouts, stored, types] = await Promise.all([sheetLayoutsOf(viewsScope), schedulesOf(viewsScope), memberTypesOf(viewsScope)]);
  const modelSpace = layouts.find((layout) => layout.kind === MODEL_SPACE)?.layoutName ?? null;

  const sheets: SheetView[] = [];
  for (const layout of layouts) {
    const onModel = layout.layoutName === modelSpace;
    const schedules = onModel ? (stored?.schedules ?? []).map(tableOf) : [];
    const deferrals = onModel ? (stored?.deferrals ?? []).map((deferral) => ({ viewKey: deferral.viewKey, reason: deferral.reason })) : [];
    const families = onModel ? (types?.families ?? []).map(familyOf) : [];
    if (schedules.length === 0 && deferrals.length === 0 && layout.texts.length === 0) continue;
    sheets.push({
      drawingId,
      layoutName: layout.layoutName,
      schedules,
      deferrals,
      families,
      notes: notesOf(layout.texts, readings.filter((reading) => reading.layoutName === layout.layoutName)),
    });
  }
  return sheets;
}

/**
 * One stored schedule as a table of bands (I-250). The rows are the store's own row indices in
 * ascending order and the cells the store's own column indices — the screen re-reconstructs nothing,
 * and a band the store holds no cell for is a band that was never read.
 */
function tableOf(stored: StoredSchedule): ScheduleTableView {
  const bands = new Map<number, ScheduleCell[]>();
  for (const cell of stored.cells) {
    const held = bands.get(cell.rowIndex);
    if (held === undefined) bands.set(cell.rowIndex, [cell]);
    else held.push(cell);
  }
  return {
    scheduleKey: stored.scheduleKey,
    viewKey: stored.viewKey,
    title: stored.title,
    rows: [...bands.entries()]
      .sort(([left], [right]) => left - right)
      .map(([rowIndex, cells]) => ({
        rowIndex,
        cells: [...cells].sort((left, right) => left.columnIndex - right.columnIndex).map((cell) => ({ columnIndex: cell.columnIndex, text: cell.text, sourceKeys: cell.sourceKeys })),
      })),
  };
}

/** One stored mark family, verbatim — its mark as the schedule wrote it, and never a count (I-251). */
function familyOf(family: MemberFamily): FamilyView {
  return {
    family: family.family,
    markText: family.markText,
    sourceKeys: family.sourceKeys,
    variants: family.variants.map((variant) => ({
      variantKey: variant.variantKey,
      bandText: variant.bandText,
      sectionText: variant.sectionText,
      sourceKeys: variant.sourceKeys,
      zones: variant.zones.map((zone) => ({ zone: zone.zone, text: zone.text, sourceKeys: zone.sourceKeys })),
    })),
  };
}

/**
 * What one sheet's general notes hold: what the grammar reads off its words today, every reading
 * anybody committed against them, and how each kind therefore stands (I-253).
 *
 * `superseded` is a property of the KEY rather than of a row — a later reading by the same person
 * under the same source replaces their earlier one, which is exactly what the core answers
 * (`noteStanding`, R-TO-051, B-17). A second person's disagreeing reading supersedes nothing: it
 * suspends the kind, and precedence never clears a disagreement (L-REG-03).
 */
function notesOf(texts: readonly SheetText[], readings: readonly NoteReadingRow[]): NotesView {
  const superseded = new Set(noteStanding(readings).superseded.map((reading) => reading.readingKey));
  const spoken = new Set<NoteKind>(readings.map((reading) => reading.kind));
  const proposals = proposeNotes(texts);
  for (const proposal of proposals) spoken.add(proposal.kind);

  return {
    proposals,
    // The store's own order, oldest first, with the superseded ones marked where they stand.
    readings: readings.map(
      (reading, at): ReadingView => ({ ...reading, superseded: superseded.has(reading.readingKey) && readings.slice(at + 1).some((later) => later.readingKey === reading.readingKey) }),
    ),
    standings: NOTE_KINDS.filter((kind) => spoken.has(kind)).map((kind) => standingOf(kind, readings)),
  };
}

/**
 * How one kind stands over the readings made of it here (L-REG-03). A SUSPENDED kind carries no
 * figure at all and names the code its absence is refused under; a kind nobody has read stands at
 * none, which is a different answer from a kind two people read differently (I-253).
 */
function standingOf(kind: NoteKind, readings: readonly NoteReadingRow[]): StandingView {
  const stood = noteStanding(readings.filter((reading) => reading.kind === kind));
  return { kind, standing: stood.standing, canonical: stood.canonical, unitAsWritten: stood.unitAsWritten, code: stood.code };
}
