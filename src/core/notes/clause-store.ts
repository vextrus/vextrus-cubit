// R-TO-034's model-proposed clause readings, stored and read back: what a model was asked about the
// clauses of a sheet's general notes, what it answered, and the ledger call that answered it.
//
// It stands beside `./store.ts` and never in it. That store holds READINGS — what a person kept,
// under an act, append-only. This one holds OFFERS: derived from an artifact, rebuilt whole per
// ingest, and never evidence of anything anybody did (L-AI-02 — a classification held until
// confirmed). The act reads it to judge what was kept against what was offered, and the screen reads
// it to render an offer with the origin it came from.
//
// The figure is the GRAMMAR's (L-AI-03). What the model contributed is a class and a probability;
// `readFigure` is what put a value in the row, off the clause's own words, and a class whose reader
// read nothing carries no figure at all.
import { and, asc, desc, drawings, eq, ingests, isUuid, noteClauseProposals, type TenantTx } from "../db";
import type { ElementType } from "../catalogue/classes";
import { readFigure } from "./grammar";
import type { NoteKind } from "./law";
import type { NotesScope, SheetRef } from "./store";

/** One offer as a caller reads it back: the clause, the class, the grammar's figure and the call. */
export type NoteClauseOffer = {
  readonly sourceKey: string;
  readonly ordinal: number;
  readonly clause: string;
  readonly kind: NoteKind | null;
  readonly valueAsWritten: string | null;
  readonly unitAsWritten: string | null;
  readonly canonical: string | null;
  /** The Noul's probability exactly as it was stated, or null where the model stated none. */
  readonly governs: string | null;
  readonly callId: string;
};

/**
 * An offer as a reader is handed one: the stored offer, and the class its clause scopes the figure to
 * (I-652). The scope is not stored and not the model's: it is read by CODE off the clause's own
 * words each time the offer is read, by the reader that read its figure (`readFigure`), so a model
 * that classified `f'c = 3000 psi (BORED PILES)` offers the piles' strength and cannot offer
 * anything else (L-AI-03).
 */
export type ScopedNoteClauseOffer = NoteClauseOffer & { readonly scopeClass: ElementType | null };

/** The scope of one offer's figure, off its clause — null where it carries no figure or names no class. */
export function scopeOfOffer(offer: Pick<NoteClauseOffer, "kind" | "clause" | "canonical">): ElementType | null {
  if (offer.kind === null || offer.canonical === null) return null;
  return readFigure(offer.kind, offer.clause)?.scopeClass ?? null;
}

/** One offer as the pass asks the store to write it, on the sheet it was read off. */
export type NoteClauseOfferWrite = NoteClauseOffer & { readonly layoutName: string };

/** Which ingest's offers are being written: the artifact they were read off (L-CAD-05). */
export type IngestRef = { readonly drawingId: string; readonly ingestId: string };

/** The row as the store holds it, read as the record above. */
function offerOf(held: typeof noteClauseProposals.$inferSelect): NoteClauseOffer {
  return {
    sourceKey: held.sourceKey,
    ordinal: held.ordinal,
    clause: held.clause,
    kind: held.kind,
    valueAsWritten: held.valueAsWritten,
    unitAsWritten: held.unitAsWritten,
    canonical: held.canonical,
    governs: held.governs,
    callId: held.callId,
  };
}

/**
 * The drawing's current ingest — the newest of it — or null where this project holds no such
 * drawing or nothing has ever read it. The order is TOTAL for the reason `./texts.ts` states:
 * `created_at` alone leaves two rows written in one transaction in whichever order the planner
 * reached them, and the record id settles it.
 */
export async function currentIngestOf(tx: TenantTx, scope: NotesScope, drawingId: string): Promise<string | null> {
  if (!isUuid(drawingId)) return null;
  const held = await tx
    .select({ ingestId: ingests.ingestId })
    .from(ingests)
    .innerJoin(drawings, and(eq(drawings.tenantId, ingests.tenantId), eq(drawings.drawingId, ingests.drawingId)))
    .where(and(eq(ingests.tenantId, scope.tenantId), eq(ingests.drawingId, drawingId), eq(drawings.projectId, scope.projectId)))
    .orderBy(desc(ingests.createdAt), desc(ingests.ingestId))
    .limit(1);
  return held[0]?.ingestId ?? null;
}

/**
 * Every offer standing on ONE sheet of a drawing's current reading, in the clause's own order.
 *
 * A drawing nothing has ingested, and one whose notes nobody has put to a model, both answer an
 * empty list: an offer nobody made is silence, and the surfaces above render silence as silence
 * (R-UI-050, L-MEA-01).
 */
export async function noteClauseOffersOfSheet(tx: TenantTx, scope: NotesScope, sheet: SheetRef): Promise<ScopedNoteClauseOffer[]> {
  const ingestId = await currentIngestOf(tx, scope, sheet.drawingId);
  if (ingestId === null) return [];
  const held = await tx
    .select()
    .from(noteClauseProposals)
    .where(
      and(
        eq(noteClauseProposals.tenantId, scope.tenantId),
        eq(noteClauseProposals.projectId, scope.projectId),
        eq(noteClauseProposals.ingestId, ingestId),
        eq(noteClauseProposals.drawingId, sheet.drawingId),
        eq(noteClauseProposals.layoutName, sheet.layoutName),
      ),
    )
    .orderBy(asc(noteClauseProposals.sourceKey), asc(noteClauseProposals.ordinal));
  return held.map((row) => {
    const offer = offerOf(row);
    return { ...offer, scopeClass: scopeOfOffer(offer) };
  });
}

/**
 * Every offer standing on one DRAWING's current reading, sheet by sheet — the read the schedules
 * screen makes, which asks about every sheet of a drawing at once. One read rather than one per
 * sheet: the current ingest is resolved once, and a drawing nothing has ingested answers none.
 */
export async function noteClauseOffersOfDrawing(tx: TenantTx, scope: NotesScope, drawingId: string): Promise<NoteClauseOfferWrite[]> {
  const ingestId = await currentIngestOf(tx, scope, drawingId);
  if (ingestId === null) return [];
  const held = await tx
    .select()
    .from(noteClauseProposals)
    .where(
      and(
        eq(noteClauseProposals.tenantId, scope.tenantId),
        eq(noteClauseProposals.projectId, scope.projectId),
        eq(noteClauseProposals.ingestId, ingestId),
        eq(noteClauseProposals.drawingId, drawingId),
      ),
    )
    .orderBy(asc(noteClauseProposals.layoutName), asc(noteClauseProposals.sourceKey), asc(noteClauseProposals.ordinal));
  return held.map((row) => ({ ...offerOf(row), layoutName: row.layoutName }));
}

/**
 * Rewrite everything one ingest offers. A partition is REBUILT rather than appended to, so the
 * ingest's rows are taken away and written again in the caller's own transaction: a pass that
 * half-wrote would leave a sheet offering two readings of one clause (L-REG-04).
 *
 * An ingest that offers nothing still clears what it offered before — a clause the grammar has since
 * learnt to read is a clause nobody should still be asked about.
 */
export async function writeNoteClauseOffers(tx: TenantTx, scope: NotesScope, ingest: IngestRef, offers: readonly NoteClauseOfferWrite[]): Promise<void> {
  await tx.delete(noteClauseProposals).where(and(eq(noteClauseProposals.tenantId, scope.tenantId), eq(noteClauseProposals.ingestId, ingest.ingestId)));
  if (offers.length === 0) return;
  await tx.insert(noteClauseProposals).values(
    offers.map((offer) => ({
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      drawingId: ingest.drawingId,
      ingestId: ingest.ingestId,
      layoutName: offer.layoutName,
      sourceKey: offer.sourceKey,
      ordinal: offer.ordinal,
      clause: offer.clause,
      kind: offer.kind,
      valueAsWritten: offer.valueAsWritten,
      unitAsWritten: offer.unitAsWritten,
      canonical: offer.canonical,
      governs: offer.governs,
      callId: offer.callId,
    })),
  );
}
