/**
 * The model's clause offers, stored and judged (R-TO-034, L-AI-02, L-AI-03, L-ACT-01).
 *
 * DB LANE. It opens a live database because everything it judges is about the store: what the
 * schema refuses however a row reached it, that a workspace sees only its own offers, that a
 * re-partition REWRITES an ingest's offers rather than standing two of one clause side by side, and
 * that TRANSCRIBE_SHEET_NOTES answers the call an offer came from — CONFIRMED where a person kept it
 * as it was offered, OVERRULED where they kept another figure, and nothing at all where the offer
 * was the grammar's.
 *
 * The offers are written through the product's own store rather than by running the model pass: the
 * pass is graded on its own, without a database, and what this suite is about is the row and the
 * verdict. The ledger call each offer names is a real `model_calls` row of this tenant, because an
 * outcome judges a call that was made (L-AI-01).
 */
import { afterAll, describe, expect, test } from "vitest";
import { and, eq, forTenant, modelCalls, modelOutcomeRowsOf, noteClauseProposals } from "@/core/db";
import { writeNoteClauseOffers, type NoteClauseOfferWrite } from "@/core/notes/clause-store";
import { clauseOffersOnDrawing } from "@/modules/takeoff/notes";
import { ACCEPTED, BNBC_GENERAL_NOTES, BNBC_SHEET_TEXTS, EDITED } from "./support/bnbc-notes";
import { closeStage, performAct, reading, rejection, stageNotes, transcription, type StagedNotes } from "./support/notes-stage";

afterAll(closeStage);

/** The text the staged sheet carries that the grammar reads nothing off — `B500DWR`. */
const SILENT_KEY = "DXF_HANDLE:1F47";
const SILENT_CLAUSE = "B500DWR";

/** The tension lap the GRAMMAR reads off the staged sheet, which no model was asked about. */
const LAP_KEY = "DXF_HANDLE:1F4C";

/** One ledger row of this tenant, so an outcome has a proposed call to judge (L-AI-01). */
async function mintCall(staged: StagedNotes): Promise<string> {
  const [row] = await forTenant({ tenantId: staged.tenantId }).transaction((tx) =>
    tx
      .insert(modelCalls)
      .values({
        tenantId: staged.tenantId,
        projectId: staged.projectId,
        modelId: "claude-sonnet-5",
        requestHash: `hash-${Math.random().toString(16).slice(2)}`,
        transport: "fixture",
        outcome: "proposed",
        refusalCode: null,
        inputTokens: 610,
        outputTokens: 12,
        attributedCost: "0.000183",
        question: "note-clause",
        judgment: { provider: "jev-latest", confidence: 0.86, answers: {} },
      })
      .returning({ callId: modelCalls.callId }),
  );
  expect(row?.callId, "the ledger row an offer names was written").toBeTruthy();
  return String(row?.callId);
}

/** One offer as the pass would have written it, on the staged sheet. */
function offer(callId: string, over: Partial<NoteClauseOfferWrite> = {}): NoteClauseOfferWrite {
  return {
    layoutName: "",
    sourceKey: SILENT_KEY,
    ordinal: 1,
    clause: SILENT_CLAUSE,
    kind: "FY",
    valueAsWritten: "500",
    unitAsWritten: "MPa",
    canonical: "500",
    governs: null,
    callId,
    ...over,
  };
}

/** Write offers for the staged sheet's own ingest, through the product's own store. */
async function store(staged: StagedNotes, offers: readonly NoteClauseOfferWrite[]): Promise<void> {
  await forTenant({ tenantId: staged.tenantId }).transaction((tx) =>
    writeNoteClauseOffers(
      tx,
      staged.scope,
      { drawingId: staged.sheet.drawingId, ingestId: staged.sheet.ingestId },
      offers.map((one) => ({ ...one, layoutName: staged.sheet.layoutName })),
    ),
  );
}

describe("what the store refuses, and who can see an offer", () => {
  test("a class outside R-TO-034's roster cannot be written however it reached the insert", async () => {
    const staged = await stageNotes("clause-closed", BNBC_SHEET_TEXTS);
    const callId = await mintCall(staged);
    const failure = await rejection(store(staged, [offer(callId, { kind: "COVER" as never })]));
    expect(failure, "the CHECK is the store's own statement of the closed roster (Q-07, B-19)").not.toBeNull();
  });

  test("a figure is whole or absent, and a figure with no class behind it is refused", async () => {
    const staged = await stageNotes("clause-whole", BNBC_SHEET_TEXTS);
    const callId = await mintCall(staged);
    expect(await rejection(store(staged, [offer(callId, { canonical: null })])), "two of three columns is no figure (L-REG-01)").not.toBeNull();
    expect(await rejection(store(staged, [offer(callId, { kind: null })])), "a figure with no class is a number this product invented (L-MEA-01)").not.toBeNull();
  });

  test("a probability that is not one is refused, and a blank clause is evidence of nothing", async () => {
    const staged = await stageNotes("clause-probability", BNBC_SHEET_TEXTS);
    const callId = await mintCall(staged);
    expect(await rejection(store(staged, [offer(callId, { governs: "1.4" })]))).not.toBeNull();
    expect(await rejection(store(staged, [offer(callId, { clause: "   " })]))).not.toBeNull();
  });

  test("a class with no figure at all is lawful: it is an offer nobody can bill, and the call still counts", async () => {
    const staged = await stageNotes("clause-classless", BNBC_SHEET_TEXTS);
    const callId = await mintCall(staged);
    await store(staged, [offer(callId, { valueAsWritten: null, unitAsWritten: null, canonical: null, governs: "0.02" })]);
    const held = await clauseOffersOnDrawing(staged.scope, staged.sheet.drawingId);
    expect(held.map((one) => [one.kind, one.canonical, one.governs])).toEqual([["FY", null, "0.02"]]);
  });

  test("a re-partition of one ingest REWRITES its offers rather than standing two of one clause", async () => {
    const staged = await stageNotes("clause-rebuild", BNBC_SHEET_TEXTS);
    const first = await mintCall(staged);
    const second = await mintCall(staged);
    await store(staged, [offer(first)]);
    await store(staged, [offer(second, { canonical: "420", valueAsWritten: "420" })]);
    const held = await clauseOffersOnDrawing(staged.scope, staged.sheet.drawingId);
    expect(held, "one clause of one ingest offers once (L-REG-04)").toHaveLength(1);
    expect(held[0]?.callId, "and what it offers is the newest pass's, not the first's").toBe(second);
  });

  test("a second workspace sees none of it (SEAM-TENANT)", async () => {
    const mine = await stageNotes("clause-mine", BNBC_SHEET_TEXTS);
    const theirs = await stageNotes("clause-theirs", BNBC_SHEET_TEXTS);
    await store(mine, [offer(await mintCall(mine))]);
    const held = await forTenant({ tenantId: theirs.tenantId }).transaction((tx) =>
      tx.select().from(noteClauseProposals).where(and(eq(noteClauseProposals.tenantId, mine.tenantId), eq(noteClauseProposals.drawingId, mine.sheet.drawingId))),
    );
    expect(held, "row-level security is FORCED, so another workspace's offers are not there to read").toEqual([]);
  });
});

describe("TRANSCRIBE_SHEET_NOTES answers the call an offer came from (L-AI-02, L-ACT-01)", () => {
  test("a reading kept exactly as a model offered it is ACCEPTED, and its call is CONFIRMED", async () => {
    const staged = await stageNotes("clause-confirmed", BNBC_SHEET_TEXTS);
    const callId = await mintCall(staged);
    await store(staged, [offer(callId)]);

    const performed = await performAct(staged.measurer.actor, transcription(staged, [reading("FY", SILENT_KEY, "500", "MPa")]));
    const outcomes = await modelOutcomeRowsOf(forTenant({ tenantId: staged.tenantId }), staged.scope, [callId]);
    expect(outcomes.map((row) => [row.outcome, row.question, row.actId])).toEqual([["CONFIRMED", "note-clause", performed.actId]]);
  });

  test("a reading kept at another figure is EDITED, and its call is OVERRULED", async () => {
    const staged = await stageNotes("clause-overruled", BNBC_SHEET_TEXTS);
    const callId = await mintCall(staged);
    await store(staged, [offer(callId)]);

    await performAct(staged.measurer.actor, transcription(staged, [reading("FY", SILENT_KEY, "420", "MPa")]));
    const outcomes = await modelOutcomeRowsOf(forTenant({ tenantId: staged.tenantId }), staged.scope, [callId]);
    expect(outcomes.map((row) => row.outcome)).toEqual(["OVERRULED"]);
  });

  test("a reading off the GRAMMAR's offer judges no call at all — the grammar is not a model", async () => {
    const staged = await stageNotes("clause-grammar", BNBC_SHEET_TEXTS);
    const callId = await mintCall(staged);
    await store(staged, [offer(callId)]);

    const lap = BNBC_GENERAL_NOTES.find((text) => text.sourceKey === LAP_KEY);
    expect(lap, "the staged sheet carries the fixture's own lap note").toBeTruthy();
    await performAct(staged.measurer.actor, transcription(staged, [reading("LAP", LAP_KEY, "50d", "d")]));
    const outcomes = await modelOutcomeRowsOf(forTenant({ tenantId: staged.tenantId }), staged.scope, [callId]);
    expect(outcomes, "nothing a model proposed was judged, so no outcome was recorded").toEqual([]);
  });

  test("the verdict is still the seam's: the act writes the acceptance it judged, beside the outcome", async () => {
    const staged = await stageNotes("clause-verdict", BNBC_SHEET_TEXTS);
    const callId = await mintCall(staged);
    await store(staged, [offer(callId)]);

    const performed = await performAct(staged.measurer.actor, transcription(staged, [reading("FY", SILENT_KEY, "500", "MPa"), reading("LAP", LAP_KEY, "50d", "d")]));
    expect(performed.consequence.subjects?.length, "both readings move the record").toBe(2);
    const outcomes = await modelOutcomeRowsOf(forTenant({ tenantId: staged.tenantId }), staged.scope, [callId]);
    expect(outcomes.map((row) => row.outcome), "one model offer was kept, so one call was answered").toEqual(["CONFIRMED"]);
    expect([ACCEPTED, EDITED], "the two verdicts the seam judges under are the law's own").toEqual(["ACCEPTED", "EDITED"]);
  });
});
