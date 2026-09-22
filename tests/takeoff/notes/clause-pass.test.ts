/**
 * The clause pass: what it asks, what it stores, and the one thing it never takes from a model
 * (R-TO-034, L-AI-01, L-AI-02, L-AI-03).
 *
 * UNIT LANE. The pass's store half is judged beside it in `./clause-offers.test.ts`, which opens a
 * database; what is judged here is `noteClauseOffersOf`, which is pure of the store: it is handed a
 * seam and answers the offers a caller would write.
 *
 * THE FIGURE IS NEVER THE MODEL'S. Whatever class comes back, the value stored is the GRAMMAR's own
 * reading of that clause under that class, and a class whose reader reads nothing is stored with no
 * figure at all. A change that let a model's digits through fails here.
 */
import { describe, expect, test } from "vitest";
import { PROPOSAL_KIND, type ModelCallContext, type Proposal } from "@/core/model";
import { refusal } from "@/core/faults/refusal-marker";
import { noteClauseOffersOf, type NoteClauseSeam, type PassSheet } from "@/modules/takeoff/notes";
import type { SheetText } from "@/core/notes/grammar";

const CTX: ModelCallContext = {
  tenantId: "d3e00000-0000-4000-8000-000000000001",
  projectId: "d3e00000-0000-4000-8000-000000000002",
  actor: "job:partition",
  requestId: "req-test-clause-pass",
};

const ARTIFACT = "sha256:artifact";

/** F-RCC6-BNBC's own S-02: the detailing block the grammar reads nothing in, the lap, its table. */
const S02: readonly SheetText[] = Object.freeze([
  Object.freeze({
    sourceKey: "DXF_HANDLE:1F75",
    text: "11. LAPS SHALL BE STAGGERED; NOT MORE THAN 50% OF BARS MAY BE LAPPED AT ONE SECTION.\\P13. STIRRUP ZONES: 2D FROM EACH SUPPORT FACE AT THE CLOSE SPACING.",
  }),
  Object.freeze({ sourceKey: "DXF_HANDLE:1F76", text: "LAP 50d TENSION / 40d COMPRESSION U.N.O." }),
  Object.freeze({ sourceKey: "DXF_HANDLE:1F8A", text: "LAP TENSION (mm)" }),
]);

const SHEET: PassSheet = { layoutName: "S-02", texts: S02 };

/** A seam that answers the same class and probability to everything, and counts what it was asked. */
function answering(kind: string | null, governs: number | null): { clauses: NoteClauseSeam; asked: { clause: string; key: string }[] } {
  const asked: { clause: string; key: string }[] = [];
  let callId = 0;
  const clauses: NoteClauseSeam = {
    proposeNoteClause: (async (_ctx, question) => {
      asked.push({ clause: question.clause, key: question.key });
      callId += 1;
      return {
        kind: PROPOSAL_KIND,
        payload: { kind, governs },
        sources: [`${question.key}`],
        model: "claude-sonnet-5",
        callId: `call-${callId}`,
      } as unknown as Proposal<{ kind: string | null; governs: number | null }>;
    }) as NoteClauseSeam["proposeNoteClause"],
  };
  return { clauses, asked };
}

/** A seam that refuses everything by name — the unrecorded corpus, as every lane meets it. */
const REFUSING: NoteClauseSeam = {
  proposeNoteClause: (async () => {
    throw refusal("FIXTURE_MISSING", "no recorded answer stands for this request", {});
  }) as NoteClauseSeam["proposeNoteClause"],
};

describe("what the pass asks, and what it stores", () => {
  test("every silent clause of the sheet is asked once, and the lap the sheet's table contests with it", async () => {
    const { clauses, asked } = answering("LAP", 0.94);
    await noteClauseOffersOf({ ctx: CTX, ingest: { drawingId: "d", ingestId: "i" }, artifactSha256: ARTIFACT, sheets: [SHEET], clauses });
    expect(asked.map((one) => one.key)).toEqual(["DXF_HANDLE:1F75", "DXF_HANDLE:1F75", "DXF_HANDLE:1F76"]);
    expect(asked[2]?.clause, "the clause standing beside the sheet's own ld table (AM-03(e))").toBe("LAP 50d TENSION / 40d COMPRESSION U.N.O.");
  });

  test("a class the model named for a clause the GRAMMAR had already read is never taken (L-AI-03)", async () => {
    const { clauses } = answering("LAP", 0.94);
    const offers = await noteClauseOffersOf({ ctx: CTX, ingest: { drawingId: "d", ingestId: "i" }, artifactSha256: ARTIFACT, sheets: [SHEET], clauses });
    const lap = offers.find((offer) => offer.sourceKey === "DXF_HANDLE:1F76");
    expect(lap?.kind, "the grammar read this one, so the model's class is recorded as no class at all").toBeNull();
    expect(lap?.governs, "what it WAS asked about is the standing of that lap over the sheet's table").toBe("0.94");
  });

  test("the figure stored is the grammar's reading of the clause, and a class with no figure carries none", async () => {
    const { clauses } = answering("LAP", null);
    const offers = await noteClauseOffersOf({ ctx: CTX, ingest: { drawingId: "d", ingestId: "i" }, artifactSha256: ARTIFACT, sheets: [SHEET], clauses });
    for (const offer of offers) {
      if (offer.canonical === null) {
        expect(offer.valueAsWritten, "a figure is whole or absent (L-REG-01)").toBeNull();
        continue;
      }
      // Whatever is stored was read by the grammar off the clause's own words, never lifted from
      // what the model said (L-AI-03).
      expect(offer.clause).toContain(offer.canonical);
    }
    const stirrups = offers.find((offer) => offer.clause.startsWith("13."));
    expect(stirrups?.canonical, "'2D FROM EACH SUPPORT FACE' states no lap, so a model answering LAP offers nothing").toBeNull();
  });

  test("the no-match outcome is stored as no class, and it is not a refusal", async () => {
    const { clauses } = answering(null, 0.01);
    const offers = await noteClauseOffersOf({ ctx: CTX, ingest: { drawingId: "d", ingestId: "i" }, artifactSha256: ARTIFACT, sheets: [SHEET], clauses });
    expect(offers.length, "every clause asked answered something").toBe(3);
    expect(offers.every((offer) => offer.kind === null && offer.canonical === null)).toBe(true);
    expect(offers.every((offer) => offer.callId !== "")).toBe(true);
  });

  test("an unrecorded clause is a REFUSAL said and gone past, never a failed ingest (L-AI-01)", async () => {
    const said: string[] = [];
    const offers = await noteClauseOffersOf({
      ctx: CTX,
      ingest: { drawingId: "d", ingestId: "i" },
      artifactSha256: ARTIFACT,
      sheets: [SHEET],
      clauses: REFUSING,
      refused: (detail) => {
        said.push(detail.refusal);
      },
    });
    expect(offers, "a pass that was refused everything offers nothing").toEqual([]);
    expect(said, "and says so once per clause, by the registered code").toEqual(["FIXTURE_MISSING", "FIXTURE_MISSING", "FIXTURE_MISSING"]);
  });
});
