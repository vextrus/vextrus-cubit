// What a person did with a proposed cell reading (L-AI-02, R-AI-005). The one writer of this
// question's outcome, and the shape `src/modules/ai/sheet-understanding/dispositions.ts` already
// ships for the sheet reading — the same three words and the same closed map onto the ledger's own
// outcome column.
//
// The caller-defect checks are NOT spelled a second time here: `recordModelOutcome` looks the call
// up on the writing handle and refuses a call this tenant and project never made, and a call that
// was refused and proposed nothing, in those words (B-17). The sheet's writer makes them itself
// because it inserts its own row first; this one writes the outcome and nothing else.
//
// It is a RECORD and not an act (L-ACT-01): judging a reading changes nothing the machine would
// derive. The stored table still renders exactly as it was stored (I-250) and the member-type
// registry is still rebuilt by `registerMemberTypes` over the reconstruction and over nothing else
// (L-AI-03). Moving the registry off a confirmed reading WOULD be a human write that changes what
// the machine derives, and that is an act a later increment mints — never smuggled in here.
//
// NO schedule act exists to carry the outcome, so `actId` is null, which is exactly what
// `recordModelOutcome` takes for a record rather than an act.
//
// WHAT THIS INCREMENT DOES NOT RECORD: which candidate a reader settled on when they EDITED the
// reading. That needs a table of its own (`schedule_cell_dispositions`, with `proposed` and
// `resolved` beside the call) and therefore a migration; until it lands, this door takes the verdict
// and not the edit, rather than accepting a reading it would silently drop.
import { forTenant, isUuid, recordModelOutcome, DISPOSITIONS, type Disposition, type ModelOutcome } from "@/core/db";

/**
 * What a disposition is as the ledger's outcome column spells it (L-AI-02): taking a reading
 * confirms the proposal, taking a different candidate overrules it, saying the cell states no
 * attribute of the member repudiates it. One table per vocabulary — the disposition keeps R-AI-001's
 * word and the outcome keeps the ledger's — so neither list has to learn the other's spelling.
 */
const OUTCOME_OF: Readonly<Record<Disposition, ModelOutcome>> = Object.freeze({ accepted: "CONFIRMED", edited: "OVERRULED", rejected: "REPUDIATED" });

/** Who is judging, in which workspace and on which project. */
export type CellReadingActor = { readonly tenantId: string; readonly projectId: string; readonly actor: string };

/** What one judgment is recorded from: the call that proposed the reading, and what was made of it. */
export type CellReadingJudgment = { readonly callId: string; readonly disposition: Disposition };

/**
 * Record what a person did with a proposed cell reading. The call is looked up on the WRITING
 * transaction, inside `recordModelOutcome`: a judgment of a call this tenant and project never made,
 * and a judgment of a call that was refused and proposed nothing, are caller defects and faults
 * rather than refusals (ARCH-03) — no person can act differently in response to either, so there is
 * no remedy to show and no registry code to carry. What IS judged here is what a caller states: a
 * call id that is no id, an actor that is no account, and a word that is no disposition.
 *
 * The transaction holds one write today and is still a transaction: when the disposition's own row
 * lands beside it, neither will stand without the other.
 */
export async function recordCellReadingDisposition(actor: CellReadingActor, judgment: CellReadingJudgment): Promise<{ outcomeId: string; outcome: ModelOutcome }> {
  const disposition = pinned(judgment.disposition);
  if (!isUuid(judgment.callId)) throw new Error(`${JSON.stringify(judgment.callId)} is no model call id — a judgment is keyed by the ledger's own callId (L-AI-01)`);
  if (!isUuid(actor.actor)) throw new Error(`a judgment records who made it, and ${JSON.stringify(actor.actor)} is no account id (R-AI-005)`);

  return forTenant({ tenantId: actor.tenantId }).transaction(async (tx) => {
    const outcome = OUTCOME_OF[disposition];
    const written = await recordModelOutcome(tx, {
      tenantId: actor.tenantId,
      projectId: actor.projectId,
      callId: judgment.callId,
      outcome,
      actId: null,
      actorUserId: actor.actor,
    });
    return { outcomeId: written.outcomeId, outcome };
  });
}

/** The disposition as one of the closed roster's, checked at runtime too (the column is closed too). */
function pinned(disposition: string): Disposition {
  if (!(DISPOSITIONS as readonly string[]).includes(disposition)) {
    throw new Error(`${JSON.stringify(disposition)} is no disposition — a proposal is ${DISPOSITIONS.join(", ")} (R-AI-001)`);
  }
  return disposition as Disposition;
}
