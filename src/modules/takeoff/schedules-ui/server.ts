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
import { proposeNotes, type NoteProposal, type SheetText } from "@/core/notes/grammar";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import type { ElementType } from "@/core/catalogue/classes";
import { scopeOfOffer } from "@/core/notes/clause-store";
import { noteStanding, noteStandingsByScope } from "@/core/notes/standing";
import type { NoteReadingRow } from "@/core/notes/store";
import { clauseOffersOnDrawing, readingsOnDrawings, sheetLayoutsOf, type NoteClauseOfferWrite } from "@/modules/takeoff/notes";
import { artifactAt } from "@/core/entitygraph/artifact";
import { framesOfGraph, sheetsOfGraph, spacesOfGraph } from "@/core/sheets/frames";
import { appStorage } from "@/core/storage/app";
import { ingestRecords } from "@/modules/takeoff/ingest";
import { memberTypesOf, schedulesOf, viewsOf, type ViewsScope } from "@/modules/takeoff/partition";
import { sheetsOfReading, type RecordSheets } from "./attach";
import type { NotesView, ProposalView, ReadingView, SchedulesView, SheetView, StandingView } from "./view";

/** Which project's sheets are being read, in which workspace. */
export type SchedulesViewScope = { readonly tenantId: string; readonly projectId: string };

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
export async function pinnedRevisionOf(scope: SchedulesViewScope): Promise<PinnedRevision | null> {
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
 * The sheets of one drawing this screen has something to say about, each holding what stands on it
 * (I-248, I-550). The schedules, their deferrals and the member types they named are cut out of the
 * drawing's MODEL space (L-CAD-06), but each is shown on the sheet whose window or title shows it —
 * which sheet that is, is core's one reading of the record the schedules were read on
 * (`sheetsOfReading`, `./attach`). A paper sheet's notes are its own words.
 */
async function sheetsOfDrawing(scope: SchedulesViewScope, drawingId: string, readings: readonly NoteReadingRow[]): Promise<SheetView[]> {
  const viewsScope: ViewsScope = { tenantId: scope.tenantId, projectId: scope.projectId, drawingId };
  const [layouts, stored, types, offers, views] = await Promise.all([
    sheetLayoutsOf(viewsScope),
    schedulesOf(viewsScope),
    memberTypesOf(viewsScope),
    clauseOffersOnDrawing({ tenantId: scope.tenantId, projectId: scope.projectId }, drawingId),
    viewsOf(viewsScope),
  ]);
  return sheetsOfReading({
    drawingId,
    layouts,
    stored,
    families: types?.families ?? [],
    anchors: new Map(views.map((view) => [view.viewKey, view.anchorKey])),
    record: await recordSheetsOf(scope, drawingId, stored?.ingestId ?? types?.ingestId ?? null),
    notesOf: (layout) =>
      notesOf(
        layout.texts,
        readings.filter((reading) => reading.layoutName === layout.layoutName),
        offers.filter((offer) => offer.layoutName === layout.layoutName),
      ),
  });
}

/**
 * Where the keys of the record a drawing's schedules were read on stand: its sheets, where each entity
 * was drawn and the windows its paper sheets open onto model space (L-CAD-05). The artifact is read
 * through the one door, which answers once per content hash. Null where no schedule was read, or the
 * record is no longer the drawing's — everything then stands where it was drawn.
 */
async function recordSheetsOf(scope: SchedulesViewScope, drawingId: string, ingestId: string | null): Promise<RecordSheets | null> {
  if (ingestId === null) return null;
  const record = (await ingestRecords({ tenantId: scope.tenantId, drawingId })).find((held) => held.ingestId === ingestId);
  if (record === undefined) return null;
  const graph = await artifactAt(scope.tenantId, record.artifactSha256, appStorage(), `ingest ${record.ingestId}`);
  return { sheets: sheetsOfGraph(graph), spaces: spacesOfGraph(graph), frames: framesOfGraph(graph) };
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
function notesOf(texts: readonly SheetText[], readings: readonly NoteReadingRow[], offers: readonly NoteClauseOfferWrite[]): NotesView {
  const superseded = new Set(noteStanding(readings).superseded.map((reading) => reading.readingKey));
  const spoken = new Set<NoteKind>(readings.map((reading) => reading.kind));
  const proposals = proposalsOf(proposeNotes(texts), offers);
  for (const proposal of proposals) spoken.add(proposal.kind);

  return {
    proposals,
    // The store's own order, oldest first, with the superseded ones marked where they stand.
    readings: readings.map(
      (reading, at): ReadingView => ({ ...reading, superseded: superseded.has(reading.readingKey) && readings.slice(at + 1).some((later) => later.readingKey === reading.readingKey) }),
    ),
    standings: NOTE_KINDS.filter((kind) => spoken.has(kind)).flatMap((kind) => standingsOf(kind, readings, proposals)),
  };
}

/**
 * Every figure this sheet offers, with who offered it (I-296). The GRAMMAR's readings come first —
 * L-AI-03's order, as `rebuild.ts` keeps it for captions — and a model's offers stand after them, in
 * the store's own order.
 *
 * A model offer carrying NO figure is no offer at all: its class's own reader read nothing in the
 * clause, so there is nothing for a person to keep and nothing an act could judge. It stays in the
 * store, where the ledger's line still counts the call that made it (I-296).
 *
 * The lap's Noul is attached to the offer standing on the same text: what a model said about whether
 * that clause's lap governs over the sheet's table is a proposition about THAT clause, and it is
 * shown beside it whether the grammar or the model read the figure (AM-03(e)).
 */
function proposalsOf(proposals: readonly NoteProposal[], offers: readonly NoteClauseOfferWrite[]): ProposalView[] {
  const governsOn = new Map<string, string>();
  for (const offer of offers) {
    if (offer.governs !== null && !governsOn.has(offer.sourceKey)) governsOn.set(offer.sourceKey, offer.governs);
  }
  const fromGrammar = proposals.map((proposal): ProposalView => ({ ...proposal, proposedBy: "grammar", callId: null, governs: governsOn.get(proposal.sourceKey) ?? null }));
  const fromModel = offers.flatMap((offer): ProposalView[] =>
    offer.kind === null || offer.canonical === null || offer.valueAsWritten === null || offer.unitAsWritten === null
      ? []
      : [
          {
            kind: offer.kind,
            sourceKey: offer.sourceKey,
            text: offer.clause,
            valueAsWritten: offer.valueAsWritten,
            unitAsWritten: offer.unitAsWritten,
            canonical: offer.canonical,
            // The scope is code's, read off the clause the model classified (I-652, L-AI-03).
            scopeClass: scopeOfOffer(offer),
            proposedBy: "model",
            callId: offer.callId,
            governs: offer.governs,
          },
        ],
  );
  return [...fromGrammar, ...fromModel];
}

/**
 * How one kind stands over the readings made of it here (L-REG-03), once per SCOPE (I-652): the
 * figure every unscoped class takes first, then one row per element class a reading or an offer
 * scopes the kind to — `f'c · Agreed 3500 psi` and `f'c · Pile · Agreed 3000 psi` are two answers,
 * not a contest. A SUSPENDED scope carries no figure at all and names the code its absence is refused
 * under; a scope nobody has read stands at none, which is a different answer from a scope two people
 * read differently (I-253).
 */
function standingsOf(kind: NoteKind, readings: readonly NoteReadingRow[], proposals: readonly ProposalView[]): StandingView[] {
  const byScope = noteStandingsByScope(readings.filter((reading) => reading.kind === kind));
  const scopes: (ElementType | null)[] = [null];
  const add = (scope: ElementType | null): void => {
    if (!scopes.includes(scope)) scopes.push(scope);
  };
  for (const scope of byScope.keys()) add(scope as ElementType | null);
  for (const proposal of proposals) if (proposal.kind === kind) add(proposal.scopeClass);
  // The unscoped row stands only where something speaks for it: a sheet whose only figure of a kind
  // is the piles' says nothing of every other class, and a "Not read" row would say it had.
  const unscopedSpoken = byScope.has(null) || proposals.some((proposal) => proposal.kind === kind && proposal.scopeClass === null);
  return scopes
    .filter((scope) => scope !== null || unscopedSpoken)
    .map((scopeClass) => {
      const stood = byScope.get(scopeClass);
      return stood === undefined
        ? { kind, scopeClass, standing: "NONE", canonical: null, unitAsWritten: null, code: null }
        : { kind, scopeClass, standing: stood.standing, canonical: stood.canonical, unitAsWritten: stood.unitAsWritten, code: stood.code };
    });
}
