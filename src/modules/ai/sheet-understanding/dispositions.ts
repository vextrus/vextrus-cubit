// R-AI-001's last sentence: "every proposal accepted/edited/rejected is recorded". The one writer and
// the one reader of `sheet_understanding_dispositions` (ARCH-02).
//
// A disposition is a record, not an act (L-ACT-01: model calls have their own ledger, and this
// changes nothing the machine would derive) — so nothing here writes an act row, a register row or a
// confirmed discipline. Accepting a discipline proposal INTO the register is CONFIRM_DISCIPLINE, an
// act the screen composes; this file records what a person did with a reading and stops.
//
// The caller-defect cases below — a call id nobody made, an edit that settled on nothing — are
// faults, not refusals (ARCH-03): no person can act differently in response to them, so there is no
// remedy to show and no registry code to carry.
import { DISPOSITIONS, and, desc, eq, forTenant, isUuid, modelCalls, sheetUnderstandingDispositions, type Disposition } from "@/core/db";
import type { ModelCallContext, ModelLedgerRow } from "@/core/model";
import { readingOf, type SheetReading } from "./law";

/** How the ledger spells a call that answered, in the seam's own vocabulary rather than a second one. */
const PROPOSED: ModelLedgerRow["outcome"] = "proposed";

/** Which project's dispositions are being asked for, in whose workspace. */
export type DispositionScope = { tenantId: string; projectId: string };

/** What one disposition is recorded from: the call it answers, the sheet it is about, and the reading. */
export type DispositionInput = {
  readonly callId: string;
  readonly sheetId: string;
  readonly disposition: Disposition;
  readonly proposed: SheetReading;
  /** What the person settled on. An edit says; taking a reading or turning it down settles nothing. */
  readonly resolved?: SheetReading;
};

/** One recorded disposition, as the store holds it. */
export type RecordedDisposition = {
  readonly dispositionId: string;
  readonly callId: string;
  readonly sheetId: string;
  readonly disposition: Disposition;
  readonly proposed: SheetReading;
  readonly resolved: SheetReading | null;
  readonly actorUserId: string;
  readonly recordedAt: Date;
};

/** How a project's proposals were answered, one count per member of the closed roster. */
export type DispositionCounts = Readonly<Record<Disposition, number>>;

/**
 * Record what a person did with a proposed reading (R-AI-001). The row is keyed by the ledger's own
 * `callId`, and the call is looked up on the writing transaction: a disposition of a call this
 * tenant and project never made would be a record pointing at nothing, and the store's foreign key
 * alone would answer it as a constraint error rather than as the caller defect it is.
 */
export async function recordDisposition(ctx: ModelCallContext, input: DispositionInput): Promise<{ dispositionId: string }> {
  const disposition = pinned(input.disposition);
  const resolved = settled(disposition, input.resolved);
  if (!isUuid(input.callId)) throw new Error(`${JSON.stringify(input.callId)} is no model call id — a disposition is keyed by the ledger's own callId (L-AI-01)`);
  if (!isUuid(ctx.actor)) throw new Error(`a disposition records who made it, and ${JSON.stringify(ctx.actor)} is no account id (R-AI-001)`);
  if (input.sheetId.trim() === "") throw new Error("a disposition names the sheet it was made about, and this one names none (R-AI-001)");

  return forTenant({ tenantId: ctx.tenantId }).transaction(async (tx) => {
    const [call] = await tx
      .select({ outcome: modelCalls.outcome })
      .from(modelCalls)
      .where(and(eq(modelCalls.tenantId, ctx.tenantId), eq(modelCalls.projectId, ctx.projectId), eq(modelCalls.callId, input.callId)));
    if (call === undefined) {
      throw new Error(`the model-call ledger holds no call ${input.callId} for project ${ctx.projectId} — a disposition answers a proposal that was made (L-AI-01)`);
    }
    // R-AI-001 records the disposition of a PROPOSAL. A refused call handed its caller no reading —
    // a refusal marker carries the call id too — so there is nothing about it to accept or edit.
    if (call.outcome !== PROPOSED) {
      throw new Error(`call ${input.callId} was ${call.outcome} and proposed no reading — a disposition answers a proposal (L-AI-02)`);
    }

    const [written] = await tx
      .insert(sheetUnderstandingDispositions)
      .values({
        tenantId: ctx.tenantId,
        projectId: ctx.projectId,
        callId: input.callId,
        sheetId: input.sheetId,
        disposition,
        proposed: readingOf(input.proposed),
        resolved,
        actorUserId: ctx.actor,
      })
      .returning({ dispositionId: sheetUnderstandingDispositions.dispositionId });
    if (written === undefined) throw new Error(`the ${disposition} disposition of call ${input.callId} was written and answered no disposition id`);
    return { dispositionId: written.dispositionId };
  });
}

/**
 * One project's dispositions, newest first (R-AI-001, R-AI-005). Newest-first because a later
 * disposition of the same proposal is a newer record and never an edit of the one before it — the
 * table is append-only, so the order IS the history.
 */
export async function dispositionsOf(scope: DispositionScope): Promise<RecordedDisposition[]> {
  if (!isUuid(scope.projectId)) return [];
  const rows = await forTenant({ tenantId: scope.tenantId })
    .select()
    .from(sheetUnderstandingDispositions)
    .where(and(eq(sheetUnderstandingDispositions.tenantId, scope.tenantId), eq(sheetUnderstandingDispositions.projectId, scope.projectId)))
    // The instant first, then the order the store accepted them in: a clock has a resolution, so two
    // dispositions recorded inside one of its ticks would otherwise come back in no order at all.
    .orderBy(desc(sheetUnderstandingDispositions.createdAt), desc(sheetUnderstandingDispositions.recordedSeq));

  return rows.map((row) => ({
    dispositionId: row.dispositionId,
    callId: row.callId,
    sheetId: row.sheetId,
    disposition: row.disposition,
    proposed: readingOf(row.proposed),
    resolved: row.resolved === null ? null : readingOf(row.resolved),
    actorUserId: row.actorUserId,
    recordedAt: row.createdAt,
  }));
}

/**
 * How many of each disposition one project holds, every member of the roster named — a project whose
 * proposals nobody has answered counts zeros rather than answering an empty map, because a surface
 * showing nothing could not tell "none yet" from "not asked".
 *
 * Counted over the one read above rather than by a second query (B-17): the read is the module's
 * answer about its own table, and a tally that came from somewhere else could disagree with it.
 */
export async function dispositionCountsOf(scope: DispositionScope): Promise<DispositionCounts> {
  const rows = await dispositionsOf(scope);
  const counts = Object.fromEntries(DISPOSITIONS.map((name) => [name, 0])) as Record<Disposition, number>;
  for (const row of rows) counts[row.disposition] += 1;
  return Object.freeze(counts);
}

/** The disposition as one of the closed roster's, checked at runtime too (the column is closed too). */
function pinned(disposition: string): Disposition {
  if (!(DISPOSITIONS as readonly string[]).includes(disposition)) {
    throw new Error(`${JSON.stringify(disposition)} is no disposition — a proposal is ${DISPOSITIONS.join(", ")} (R-AI-001)`);
  }
  return disposition as Disposition;
}

/**
 * What the row settles on: an edit's own reading, and nothing for the other two. The rule is stated
 * both ways round — an edit that settled on nothing records no edit, and a reading settled on a
 * proposal nobody edited would be a second answer about what the sheet is.
 */
function settled(disposition: Disposition, resolved: SheetReading | undefined): SheetReading | null {
  if (disposition === "edited") {
    if (resolved === undefined) throw new Error("an edited disposition records the reading the person settled on, and this one hands none (R-AI-001)");
    return readingOf(resolved);
  }
  if (resolved !== undefined) throw new Error(`a ${disposition} disposition settles on no reading of its own, and this one hands one (R-AI-001)`);
  return null;
}
