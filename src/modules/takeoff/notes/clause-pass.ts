// R-TO-034's model pass over a sheet's general notes: every clause the deterministic grammar read
// nothing in, put to a model once, and what came back stored beside the sheet as an OFFER
// (L-AI-02, L-AI-03).
//
// It runs where the caption pass runs — in the partition job, over an ingest, never at render time:
// a question asked when a page is looked at would make a ledger row and a tenant's money out of a
// page view (L-AI-01). What it writes is the offer and nothing else; no reading, no standing and no
// act is touched here (L-AI-03).
//
// The seam is HANDED IN (B-23): the default is `@/core/notes/model`'s `proposeNoteClause`, which is
// the one path to a model — live in production and replayed from the recorded corpus in every lane.
// A refusal is a step and not a failure: an unrecorded clause answers FIXTURE_MISSING, the pass says
// so and goes on, and the ingest still succeeds, exactly as the caption pass does. Nothing here ever
// reaches a network of its own.
import { sourceKeyResolver, type ModelCallContext } from "@/core/model";
import { askedClausesOf, lapTableHeadingsOn } from "@/core/notes/clauses";
import { writeNoteClauseOffers, type IngestRef, type NoteClauseOfferWrite } from "@/core/notes/clause-store";
import { readFigure, type SheetText } from "@/core/notes/grammar";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import { proposeNoteClause } from "@/core/notes/model";
import type { NotesScope } from "@/core/notes/store";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import type { TenantTx } from "@/core/db";

/** The way to a model, as the job hands one in (B-23) — a `proposeNoteClause`, never a transport. */
export type NoteClauseSeam = { proposeNoteClause: typeof proposeNoteClause };

/** The seam every pass uses unless its caller names another. */
const PRODUCTION: NoteClauseSeam = { proposeNoteClause };

/** The classes a clause may be OFFERED as: R-TO-034's closed roster, and nothing outside it. */
const CLASSIFIABLE: readonly NoteKind[] = NOTE_KINDS;

/** One sheet of the artifact this pass walks: its layout name and the words standing on it. */
export type PassSheet = { readonly layoutName: string; readonly texts: readonly SheetText[] };

/** What the pass is handed: the artifact it reads, the sheets of it, and the seam it asks through. */
export type NoteClausePass = {
  readonly ctx: ModelCallContext;
  readonly ingest: IngestRef;
  /** The digest a citation is resolved against — the artifact these clauses were read off (L-AI-02). */
  readonly artifactSha256: string;
  readonly sheets: readonly PassSheet[];
  readonly clauses?: NoteClauseSeam;
  /** Where a refusal is said, so a run that asked and was refused is answerable (L-AI-01). */
  readonly refused?: (detail: { readonly refusal: string; readonly sourceKey: string; readonly ordinal: number }) => Promise<void> | void;
};

/**
 * Ask a model about every silent clause of these sheets, and answer the offers to store.
 *
 * Pure of the store: what it answers is what `writeNoteClauseOffers` would write, so a caller can
 * judge the pass without a database and the transaction stays the caller's (L-ACT-01).
 *
 * THE FIGURE IS THE GRAMMAR'S. A class comes back and `readFigure` reads that class's own figure off
 * the clause's own words; a class whose reader reads nothing is stored with no figure at all, which
 * is an offer nobody can bill and a call the calibration line still counts (L-AI-03, I-296).
 *
 * A clause the grammar already read a kind off is asked only for the Noul (AM-03(e)) and its class
 * is never taken: `classifiable` is the asked set's own answer, and a class read where the grammar
 * had spoken would be the model overruling the deterministic reading.
 */
export async function noteClauseOffersOf(pass: NoteClausePass): Promise<NoteClauseOfferWrite[]> {
  const seam = pass.clauses ?? PRODUCTION;
  const offers: NoteClauseOfferWrite[] = [];
  for (const sheet of pass.sheets) {
    const citable = sheet.texts.map((text) => text.sourceKey);
    const lapTable = lapTableHeadingsOn(sheet.texts);
    for (const asked of askedClausesOf(sheet.texts)) {
      try {
        const proposal = await seam.proposeNoteClause(pass.ctx, {
          clause: asked.clause,
          key: asked.sourceKey,
          layout: sheet.layoutName,
          figures: asked.figures,
          lapTable,
          classifiable: CLASSIFIABLE,
          artifact: sourceKeyResolver(pass.artifactSha256, citable),
        });
        // The question offered the classifiable set and the seam answers out of it, so what comes
        // back is a member of the roster already — this path never sees one to re-judge (L-AI-02).
        const kind = asked.classifiable ? proposal.payload.kind : null;
        const figure = kind === null ? null : readFigure(kind, asked.clause);
        offers.push({
          layoutName: sheet.layoutName,
          sourceKey: asked.sourceKey,
          ordinal: asked.ordinal,
          clause: asked.clause,
          kind,
          valueAsWritten: figure?.valueAsWritten ?? null,
          unitAsWritten: figure?.unitAsWritten ?? null,
          canonical: figure?.canonical ?? null,
          governs: proposal.payload.governs === null ? null : String(proposal.payload.governs),
          callId: proposal.callId,
        });
      } catch (failure) {
        const code = refusalCodeOf(failure);
        // A model that would not answer is an answer about the model, not about the drawing:
        // anything that is not a refusal is a fault and travels on untouched (ARCH-03, B-21).
        if (code === null) throw failure;
        await pass.refused?.({ refusal: code, sourceKey: asked.sourceKey, ordinal: asked.ordinal });
      }
    }
  }
  return offers;
}

/**
 * Run the pass and store what it offered, in the caller's own transaction — the whole of one
 * ingest's offers, rewritten (`writeNoteClauseOffers`): a re-partition of the same drawing replaces
 * what it offered before rather than standing two offers of one clause side by side.
 */
export async function runNoteClausePass(tx: TenantTx, scope: NotesScope, pass: NoteClausePass): Promise<NoteClauseOfferWrite[]> {
  const offers = await noteClauseOffersOf(pass);
  await writeNoteClauseOffers(tx, scope, pass.ingest, offers);
  return offers;
}
