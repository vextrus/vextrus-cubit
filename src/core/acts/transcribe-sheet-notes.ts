// TRANSCRIBE_SHEET_NOTES (R-TO-034: notes readings "committed per sheet, recording accepted-as-
// proposed vs edited"), rendered as L-ACT-02's pair.
//
// What a person keeps is kept as they wrote it, beside the figure two readings are compared on
// (L-REG-01). Nothing is overwritten: a reading stands under the key (sheet, kind, actor, source),
// and a later reading under that same key supersedes the earlier one — which is the only thing that
// clears a contest between two readers (R-TO-051, L-REG-03).
//
// A reading carries the SCOPE it is kept under — the element class the note states the figure for,
// or none (I-652). What the drawing scopes is read by code, off the sheet's own words; a caller that
// states no scope keeps the drawing's, and one that states a scope (or `null`, every class) disposes
// of it, which the verdict then judges like the figure.
//
// THE SEAM JUDGES THE VERDICT, NOT THE CALLER. The commit re-reads the sheet's own texts, runs the
// grammar over them again and compares what was kept against what was offered: a client that claims
// its edited figure was accepted as proposed is simply not asked. A flag the caller sends would make
// the record a statement about the client rather than about the drawing (L-QTY-01, B-19).
import { recordModelOutcome, type TenantTx } from "../db";
import type { ElementType } from "../catalogue/classes";
import { inWords } from "../documents/kinds/boq-draft-law";
import { noteClauseOffersOfSheet, type ScopedNoteClauseOffer } from "../notes/clause-store";
import { canonicalFigure, proposeNotes, type NoteProposal } from "../notes/grammar";
import type { NoteAcceptance, NoteKind } from "../notes/law";
import { noteSourceNotOnSheet } from "../notes/refusals";
import { noteReadingKey, noteStanding } from "../notes/standing";
import { readingsOfSheet, writeNoteReadings, type NoteReadingRow, type NoteReadingWrite, type NotesScope, type SheetRef } from "../notes/store";
import { sheetTextsOn } from "../notes/texts";
import { appStorage } from "../storage/app";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const TRANSCRIBE_SHEET_NOTES = "TRANSCRIBE_SHEET_NOTES" as const;

/** The two verdicts the seam judges a kept reading under (R-TO-034). */
const ACCEPTED: NoteAcceptance = "ACCEPTED";
const EDITED: NoteAcceptance = "EDITED";

/** One figure a person kept, as they wrote it and off the text they read it from. */
export type ProposedNoteReading = {
  readonly kind: NoteKind;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  /**
   * The class the person keeps the figure for: a class, `null` for every class no scoped reading
   * speaks for, or absent to keep the scope the sheet's own words state (I-652).
   */
  readonly scopeClass?: ElementType | null;
};

/** The act's input: whose sheet, and every figure the person kept off it. */
export type TranscribeSheetNotesInput = {
  readonly type: typeof TRANSCRIBE_SHEET_NOTES;
  readonly projectId: string;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly readings: readonly ProposedNoteReading[];
};

/** One reading the act would write: the key it stands under, what it says, and the verdict on it. */
type Judged = {
  readonly readingKey: string;
  readonly kind: NoteKind;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
  readonly scopeClass: ElementType | null;
  readonly acceptance: NoteAcceptance;
  /** What this key said before — empty where nobody has read it under that key (L-ACT-02). */
  readonly before: readonly string[];
  /**
   * The model call this reading's OFFER came from, or null where the grammar offered it. The
   * grammar is not a model and has no call to judge; a model's call is judged by what the person
   * then did with what it proposed (L-AI-02).
   */
  readonly offeredCallId: string | null;
};

/** What the act would do, judged against the state this transaction read. */
type Derived = {
  readonly sheet: SheetRef;
  readonly scope: NotesScope;
  /** Only the readings that MOVE the record: one that repeats what already stands moves nothing. */
  readonly moving: readonly Judged[];
};

/** How a proposal is found again for one (kind, source) pair — the grammar's answer, keyed. */
function offeredKey(kind: string, sourceKey: string): string {
  return `${kind}\u0000${sourceKey}`;
}

/** One offer, whichever read it: what it says, and the model call behind it where a model made it. */
type Offer = { readonly canonical: string; readonly unitAsWritten: string; readonly scopeClass: ElementType | null; readonly callId: string | null };

/**
 * What the sheet offers today, by the kind and the text each offer was read off.
 *
 * THE GRAMMAR FIRST (L-AI-03). A model is asked only about a clause the grammar read nothing in, so
 * the two cannot offer one (kind, source) between them — and where they could, the grammar's stands
 * and the model's is stored but not offered. Two clauses of ONE entity classed the same collide on
 * this key too: the first in the artifact's own order stands, which is the order the store reads
 * them back in, and the second offers nothing rather than overwriting the first (L-REG-04).
 *
 * A model offer whose class carried no figure — the grammar's reader read nothing under it — is no
 * offer at all: there is nothing for a person to keep and nothing to judge a kept figure against.
 */
function offeredBy(proposals: readonly NoteProposal[], offers: readonly ScopedNoteClauseOffer[]): Map<string, Offer> {
  const offered = new Map<string, Offer>();
  for (const proposal of proposals) {
    offered.set(offeredKey(proposal.kind, proposal.sourceKey), { canonical: proposal.canonical, unitAsWritten: proposal.unitAsWritten, scopeClass: proposal.scopeClass, callId: null });
  }
  for (const offer of offers) {
    if (offer.kind === null || offer.canonical === null || offer.unitAsWritten === null) continue;
    const key = offeredKey(offer.kind, offer.sourceKey);
    if (offered.has(key)) continue;
    offered.set(key, { canonical: offer.canonical, unitAsWritten: offer.unitAsWritten, scopeClass: offer.scopeClass, callId: offer.callId });
  }
  return offered;
}

/**
 * The reading standing under one key today, or undefined. Derived rather than looked up in a column:
 * `noteStanding` is the one home of "which reading under a key is the current one" (B-17).
 */
function standingUnder(stored: readonly NoteReadingRow[], readingKey: string): NoteReadingRow | undefined {
  return noteStanding(stored).current.find((reading) => reading.readingKey === readingKey);
}

/**
 * What the act would do, computed from the state this transaction read.
 *
 * A reading citing a text that is not on the sheet is refused here, before anything is written: a
 * reading is kept only where its evidence is, and a Consequence naming a subject nobody could check
 * would be a promise the record cannot keep (L-CAD-03).
 *
 * A reading that repeats, to the figure and the unit, what already stands under its own key is
 * dropped: it moves nothing the machine would derive, so it is no subject — and an input of only
 * such readings leaves the Consequence empty, which the seam refuses by name (L-ACT-01).
 */
async function derive(ctx: ActorCtx, input: TranscribeSheetNotesInput, tx: TenantTx): Promise<Derived> {
  const scope: NotesScope = { tenantId: ctx.tenantId, projectId: input.projectId };
  const sheet: SheetRef = { drawingId: input.drawingId, layoutName: input.layoutName };

  const texts = await sheetTextsOn(tx, { ...scope, drawingId: input.drawingId }, input.layoutName, { storage: appStorage() });
  const onSheet = new Set(texts.map((text) => text.sourceKey));
  for (const reading of input.readings) {
    if (onSheet.has(reading.sourceKey)) continue;
    throw noteSourceNotOnSheet(`the sheet ${input.layoutName} carries no text entity ${reading.sourceKey}, so a reading of it cites nothing that can be read again`, {
      drawingId: input.drawingId,
      layoutName: input.layoutName,
      sourceKey: reading.sourceKey,
    });
  }

  // What was offered is BOTH readings of the sheet: the grammar's, re-made here off the sheet's own
  // words, and the classes a model proposed for the clauses the grammar read nothing in, as they
  // were stored when they were proposed. Asking the model again at commit time would spend a
  // tenant's money to be told what the store already holds, and would make the verdict depend on
  // when the act ran (L-AI-01, R-TO-034).
  const offered = offeredBy(proposeNotes(texts), await noteClauseOffersOfSheet(tx, scope, sheet));
  const stored = await readingsOfSheet(tx, scope, sheet);

  // Two readings of one (kind, source) in one statement are one reading made twice; the later is
  // what the person meant, and the key they share can carry one row per act (L-REG-04).
  const byKey = new Map<string, Judged>();
  for (const reading of input.readings) {
    const readingKey = noteReadingKey({ drawingId: sheet.drawingId, layoutName: sheet.layoutName, kind: reading.kind, actorId: ctx.userId, sourceKey: reading.sourceKey });
    const canonical = canonicalFigure(reading.valueAsWritten);
    const proposal = offered.get(offeredKey(reading.kind, reading.sourceKey));
    const held = standingUnder(stored, readingKey);
    // No scope stated keeps the one the sheet's words state; a figure nothing offered states none.
    const scopeClass = reading.scopeClass === undefined ? (proposal?.scopeClass ?? null) : reading.scopeClass;
    byKey.set(readingKey, {
      readingKey,
      kind: reading.kind,
      sourceKey: reading.sourceKey,
      valueAsWritten: reading.valueAsWritten,
      unitAsWritten: reading.unitAsWritten,
      canonical,
      scopeClass,
      // The verdict is the seam's: what the drawing offers today — the figure, its unit and the class
      // it is stated for — against what the person kept.
      acceptance:
        proposal !== undefined && proposal.canonical === canonical && proposal.unitAsWritten === reading.unitAsWritten && proposal.scopeClass === scopeClass ? ACCEPTED : EDITED,
      before: held === undefined ? [] : [said(held)],
      offeredCallId: proposal?.callId ?? null,
    });
  }

  const moving = [...byKey.values()].filter((judged) => {
    const held = standingUnder(stored, judged.readingKey);
    return held === undefined || held.canonical !== judged.canonical || held.unitAsWritten !== judged.unitAsWritten || held.scopeClass !== judged.scopeClass;
  });
  return { sheet, scope, moving };
}

/**
 * What a reading says, as a Consequence names it: the figure, and the class it is scoped to where it
 * is scoped — so re-reading `3000` for the piles (`3000 · Pile`) where `3000` stood for every class is a
 * change the dialog shows rather than a before and an after that read the same (L-ACT-02).
 */
function said(reading: { readonly canonical: string; readonly scopeClass: ElementType | null }): string {
  return reading.scopeClass === null ? reading.canonical : `${reading.canonical} · ${inWords(reading.scopeClass)}`;
}

/** One reading, as the store is asked to append it. */
function written(judged: Judged, sheet: SheetRef): NoteReadingWrite {
  return {
    drawingId: sheet.drawingId,
    layoutName: sheet.layoutName,
    readingKey: judged.readingKey,
    kind: judged.kind,
    sourceKey: judged.sourceKey,
    valueAsWritten: judged.valueAsWritten,
    unitAsWritten: judged.unitAsWritten,
    canonical: judged.canonical,
    acceptance: judged.acceptance,
    scopeClass: judged.scopeClass,
  };
}

export const transcribeSheetNotes: ActRendering<TranscribeSheetNotesInput> = {
  async preview(ctx: ActorCtx, input: TranscribeSheetNotesInput, tx: TenantTx): Promise<Consequence> {
    const derived = await derive(ctx, input, tx);
    return {
      actType: TRANSCRIBE_SHEET_NOTES,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: derived.moving.map((judged) => ({
        subjectId: judged.readingKey,
        subjectLabel: judged.kind,
        before: judged.before,
        after: [said(judged)],
      })),
      // AM-03(h): a note re-versions what the CAMPAIGN applies, never a rule-set edition — and the
      // lines a lap re-presents are re-derived by the rail that reads the applied values, which does
      // not stand yet. An empty slot is a stated nothing rather than an absent field (L-ACT-02).
      effects: { linesRederiving: [], signaturesVoiding: [] },
    };
  },

  async commit(ctx: ActorCtx, input: TranscribeSheetNotesInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const derived = await derive(ctx, input, tx);
    if (derived.moving.length === 0) {
      throw new Error(`${TRANSCRIBE_SHEET_NOTES} reached its write with no reading that moves anything, which the seam refuses before it gets here (L-ACT-01)`);
    }
    await writeNoteReadings(
      tx,
      derived.scope,
      ctx.userId,
      act.actId,
      derived.moving.map((judged) => written(judged, derived.sheet)),
    );

    // A reading kept off a MODEL's offer answers the call that made it: kept at the figure it was
    // offered at, the call is CONFIRMED; kept at another figure, OVERRULED. A reading off the
    // grammar's offer answers no call — the grammar is not a model — and writes no outcome at all.
    //
    // A reader who reads the clause under a DIFFERENT class judges no call either, and the offer
    // stays AWAITING: a reading cites the entity and not the clause (`noteReadingKey`), and one
    // entity may carry several offers, so "which call did they overrule" has no answer a record
    // could stand on. Declared rather than guessed at (L-AI-02, I-296).
    //
    // The row lands in this transaction, with the act row, or neither (L-ACT-01, the
    // CONFIRM_VIEW_TYPE precedent).
    for (const judged of derived.moving) {
      if (judged.offeredCallId === null) continue;
      await recordModelOutcome(tx, {
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        callId: judged.offeredCallId,
        outcome: judged.acceptance === ACCEPTED ? "CONFIRMED" : "OVERRULED",
        actId: act.actId,
        actorUserId: ctx.userId,
      });
    }
  },
};
