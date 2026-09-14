// TRANSCRIBE_SHEET_NOTES (R-TO-034: what a sheet's general notes STATE about reinforcement, read by
// a person off the drawing's own text), rendered as L-ACT-02's pair.
//
// The SEAM judges the verdict, never the caller. A commit carries what a person wrote; this file
// re-runs the grammar over the very sheet the reading cites and decides whether what they wrote is
// the figure the grammar proposed (ACCEPTED) or another one they read instead (EDITED) — so a client
// cannot label its own edit an acceptance, and the store's column is a fact about the reading rather
// than a claim about it (R-TO-034, L-ACT-01).
//
// Nothing is overwritten. A reading stands under the key (sheet, kind, actor, source text), and a
// later reading under that same key supersedes the earlier one — which is the only thing that settles
// a disagreement, since precedence never clears one (R-TO-051, L-REG-03).
import type { TenantTx } from "../db";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { canonicalFigureOf, isNoteKind, noteReadingKey, noteStanding, proposeNotes, sheetTextsOf, type NoteKind, type NoteProposal } from "../notes";
import { readingsOfSheet, writeNoteReadings, type NoteReadingWrite } from "../notes/store";
import type { Consequence } from "./consequence";
import type { ActRendering, ActorCtx, WrittenAct } from "./rendering";

/** The act this file renders, spelled once. */
const TRANSCRIBE_SHEET_NOTES = "TRANSCRIBE_SHEET_NOTES" as const;

/** L-CAD-03: a reading is kept only where its evidence is, and this is what says it is not there. */
const NOTE_SOURCE_NOT_ON_SHEET: RefusalCode = "NOTE_SOURCE_NOT_ON_SHEET";

/** One figure a person read, as they hand it to the door: never a verdict — the seam decides that. */
export type OfferedNoteReading = {
  readonly kind: string;
  /** The text entity the figure was read from — a transcription cites the sentence it came out of. */
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
};

/** The act's input: whose sheet, and which figures were read off it. */
export type TranscribeSheetNotesInput = {
  readonly type: typeof TRANSCRIBE_SHEET_NOTES;
  readonly projectId: string;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly readings: readonly OfferedNoteReading[];
};

/** One reading judged: what it would be written as, and what the key it stands under said before. */
type Judged = {
  readonly write: NoteReadingWrite;
  readonly before: readonly string[];
};

/**
 * Every reading of this statement, judged against the sheet it cites and the readings already made on
 * it — or a refusal where a reading cites something that is not a text of that sheet.
 *
 * The sheet's texts are read through the one read the grammar itself is run over, so the evidence the
 * act checks and the evidence a person was shown are the same entities (B-17). An entity of this very
 * sheet that states no words is refused the same way as one from another sheet: a transcription is a
 * reading OF TEXT, and a line nobody wrote a figure on is not what a figure was read from (L-QTY-01).
 */
async function judge(ctx: ActorCtx, input: TranscribeSheetNotesInput, tx: TenantTx): Promise<Judged[]> {
  const scope = { tenantId: ctx.tenantId, projectId: input.projectId };
  const texts = await sheetTextsOf({ ...scope, drawingId: input.drawingId }, input.layoutName);
  const written = new Set(texts.map((one) => one.sourceKey));
  const proposed = proposeNotes(texts);
  const standing = noteStanding(await readingsOfSheet(tx, scope, { drawingId: input.drawingId, layoutName: input.layoutName }));

  return input.readings.map((offered) => {
    const kind = declaredKind(offered.kind);
    if (!written.has(offered.sourceKey)) {
      throw refusal(NOTE_SOURCE_NOT_ON_SHEET, `${offered.sourceKey} is not a text of sheet ${input.layoutName} of drawing ${input.drawingId}`, {
        drawingId: input.drawingId,
        layoutName: input.layoutName,
        sourceKey: offered.sourceKey,
      });
    }

    const readingKey = noteReadingKey({ drawingId: input.drawingId, layoutName: input.layoutName, kind, actorId: ctx.userId, sourceKey: offered.sourceKey });
    const canonical = canonicalFigureOf(offered.valueAsWritten);
    const held = standing.current.find((reading) => reading.readingKey === readingKey);
    return {
      write: {
        drawingId: input.drawingId,
        layoutName: input.layoutName,
        readingKey,
        kind,
        actorId: ctx.userId,
        sourceKey: offered.sourceKey,
        valueAsWritten: offered.valueAsWritten,
        unitAsWritten: offered.unitAsWritten,
        canonical,
        acceptance: asProposed(proposed, kind, offered, canonical) ? "ACCEPTED" : "EDITED",
      },
      before: held === undefined ? [] : [held.canonical],
    };
  });
}

/**
 * Is this the figure the grammar read off that very sentence? Judged on the canonical figure and the
 * unit the reading was written in, which is how two readings of one note are compared everywhere
 * (`noteStanding`) — a person who kept the figure and changed the unit has read another figure.
 */
function asProposed(proposed: readonly NoteProposal[], kind: NoteKind, offered: OfferedNoteReading, canonical: string): boolean {
  const proposal = proposed.find((one) => one.kind === kind && one.sourceKey === offered.sourceKey);
  return proposal !== undefined && proposal.canonical === canonical && proposal.unitAsWritten === offered.unitAsWritten;
}

/**
 * The kind, as a member of the law's closed roster. A statement naming something else has named no
 * figure the product reads, which is a mistake in the caller rather than an answer it gives anyone
 * (ARCH-03) — the transport's own schema refuses it as malformed long before it reaches here.
 */
function declaredKind(kind: string): NoteKind {
  if (!isNoteKind(kind)) throw new Error(`"${kind}" is not a figure a general note states — R-TO-034's roster of kinds is closed`);
  return kind;
}

export const transcribeSheetNotes: ActRendering<TranscribeSheetNotesInput> = {
  async preview(ctx: ActorCtx, input: TranscribeSheetNotesInput, tx: TenantTx): Promise<Consequence> {
    const judged = await judge(ctx, input, tx);
    return {
      actType: TRANSCRIBE_SHEET_NOTES,
      tenantId: ctx.tenantId,
      projectId: input.projectId,
      rendering: "SUBJECTS",
      subjects: judged.map((one) => ({
        subjectId: one.write.readingKey,
        subjectLabel: one.write.kind,
        before: one.before,
        after: [one.write.canonical],
      })),
      // A note re-versions what the campaign APPLIES, and the lines detailed with those figures
      // re-derive through the gate rather than changing here (R-TO-020). No rebar rail stands yet,
      // so this act names none today (docs/design/s-schedules.md § 8).
      effects: { linesRederiving: [], signaturesVoiding: [] },
    };
  },

  async commit(ctx: ActorCtx, input: TranscribeSheetNotesInput, act: WrittenAct, tx: TenantTx): Promise<void> {
    const judged = await judge(ctx, input, tx);
    await writeNoteReadings(
      tx,
      { tenantId: ctx.tenantId, projectId: input.projectId },
      act.actId,
      judged.map((one) => one.write),
    );
  },
};
