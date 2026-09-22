// @vitest-environment node
/**
 * The sheet-revision arm: what Jev is asked about one sheet's issue state, and how its two answers
 * are read back (R-TO-004, L-AI-01, L-AI-02).
 *
 * What is graded: that the arm recognises the request by its own key set and reads the candidates
 * CODE found out of it; that nothing is posted where there is nothing to choose from (B-14); that
 * the choice offers the no-match outcome and the score is put over the caller's own spectrum, which
 * this file never spells; and that the reading cites the chosen candidate's OWN keys and cites
 * NOTHING where Jev chose NONE — the uncited answer the seam refuses as UNSOURCED, which is this
 * question's honest abstention.
 */
import { describe, expect, it } from "vitest";
import { REVISION_EVIDENCE_ID, REVISION_EVIDENCE_NONE, REVISION_KEYS, REVISION_RECENCY_ID, sheetRevisionRecencyArm } from "./sheet-revision-recency";

/** The five levels the caller spells, as the request carries them. */
const LEVELS = ["prints nothing", "issued for approval", "strip and table disagree", "behind the set", "current with the set"];

/** The request's canonical content, as `@/modules/ai/sheet-revision` composes it. */
function content(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    layout: "S-01",
    levels: LEVELS,
    revisionMarks: [{ src: "DXF_HANDLE:100", tag: "REV", text: "B" }],
    revisionRows: [{ keys: ["DXF_HANDLE:101", "DXF_HANDLE:102"], text: "B 12-08-2026 ISSUED FOR CONSTRUCTION" }],
    setRows: [{ layout: "S-02", marks: ["REV A"], rows: ["A 05-07-2026 ISSUED FOR RAJUK APPROVAL"] }],
    ...over,
  };
}

/** The question this arm composes over that content. */
function composed(over: Record<string, unknown> = {}) {
  const task = sheetRevisionRecencyArm.recognise(content(over));
  if (task === null) throw new Error("the arm recognised no task in its own request");
  sheetRevisionRecencyArm.guard?.(task);
  return sheetRevisionRecencyArm.compose(task);
}

/** The body as the wire carries it. */
function bodyOf(over: Record<string, unknown> = {}): Record<string, never> {
  return composed(over).body as Record<string, never>;
}

describe("the sheet-revision arm's recognition", () => {
  it("is recognised by its own key set, sorted, and by nothing else", () => {
    expect([...sheetRevisionRecencyArm.keys]).toEqual([...REVISION_KEYS]);
    expect([...sheetRevisionRecencyArm.keys]).toEqual([...sheetRevisionRecencyArm.keys].sort());
    expect(sheetRevisionRecencyArm.question).toBe("sheet-revision-recency");
  });

  it("reads the marks and the rows CODE found, and recognises nothing in content that is not them", () => {
    const task = sheetRevisionRecencyArm.recognise(content());
    expect(task?.marks.map((mark) => mark.text)).toEqual(["REV B"]);
    expect(task?.rows[0]?.keys).toEqual(["DXF_HANDLE:101", "DXF_HANDLE:102"]);
    expect(sheetRevisionRecencyArm.recognise(content({ revisionRows: [{ text: "no keys" }] }))).toBe(null);
    expect(sheetRevisionRecencyArm.recognise(content({ levels: "a spectrum of one string" }))).toBe(null);
    expect(sheetRevisionRecencyArm.recognise(content({ layout: 7 }))).toBe(null);
  });

  it("posts nothing where there is nothing to choose from, or no spectrum to answer over (B-14)", () => {
    const bare = sheetRevisionRecencyArm.recognise(content({ revisionMarks: [], revisionRows: [] }));
    expect(() => sheetRevisionRecencyArm.guard?.(bare as never)).toThrow(/no question was posted/);
    const single = sheetRevisionRecencyArm.recognise(content({ levels: ["only one"] }));
    expect(() => sheetRevisionRecencyArm.guard?.(single as never)).toThrow(/between two and ten levels/);
  });
});

describe("the two questions the arm composes", () => {
  it("puts one state and two questions over it — the choice that cites, and the score that places", () => {
    const body = bodyOf() as unknown as { state: Record<string, unknown>; questions: Record<string, { type: string; criteria: unknown }> };
    expect(Object.keys(body.state).sort()).toEqual(["layout", "revisionMarks", "revisionRows", "setRows"]);
    expect(body.questions[REVISION_EVIDENCE_ID]?.type).toBe("choice");
    expect(body.questions[REVISION_RECENCY_ID]?.type).toBe("score");
  });

  it("offers every candidate by an id the state names it under, plus the no-match outcome", () => {
    const body = bodyOf() as unknown as { state: { revisionMarks: Record<string, string>; revisionRows: Record<string, string> }; questions: Record<string, { criteria: Record<string, string> }> };
    const criteria = body.questions[REVISION_EVIDENCE_ID]?.criteria ?? {};
    expect(Object.keys(criteria)).toEqual(["cand_1", "cand_2", REVISION_EVIDENCE_NONE]);
    expect(body.state.revisionMarks).toEqual({ cand_1: "REV B" });
    expect(body.state.revisionRows).toEqual({ cand_2: "B 12-08-2026 ISSUED FOR CONSTRUCTION" });
  });

  it("puts the score over the caller's own spectrum, in the caller's own order, and spells none of it itself", () => {
    const body = bodyOf() as unknown as { questions: Record<string, { criteria: unknown; instructions: string }> };
    expect(body.questions[REVISION_RECENCY_ID]?.criteria).toEqual(LEVELS);
    for (const level of LEVELS) expect(body.questions[REVISION_RECENCY_ID]?.instructions).not.toContain(level);
  });

  it("names the state it reads by its own field paths, as the contract asks", () => {
    const body = bodyOf() as unknown as { questions: Record<string, { instructions: string }> };
    for (const path of ["`revisionMarks`", "`revisionRows`", "`layout`"]) expect(body.questions[REVISION_EVIDENCE_ID]?.instructions).toContain(path);
    expect(body.questions[REVISION_RECENCY_ID]?.instructions).toContain("`setRows`");
  });
});

describe("the reading of Jev's two answers", () => {
  it("cites the chosen candidate's own keys and answers the words it states", () => {
    const wire = composed().read({
      [REVISION_EVIDENCE_ID]: { choice: "cand_2" },
      [REVISION_RECENCY_ID]: { score: 3.8, probabilities: { "3": 0.2, "4": 0.8 } },
    }) as { payload: { evidence: string; level: number; score: number }; sources: string[] };
    expect(wire.payload).toEqual({ evidence: "B 12-08-2026 ISSUED FOR CONSTRUCTION", level: 4, score: 3.8 });
    expect(wire.sources).toEqual(["DXF_HANDLE:101", "DXF_HANDLE:102"]);
  });

  it("cites the block a chosen mark belongs to, which is the key a block attribute is cited by", () => {
    const wire = composed().read({ [REVISION_EVIDENCE_ID]: { choice: "cand_1" }, [REVISION_RECENCY_ID]: { score: 2 } }) as { sources: string[] };
    expect(wire.sources).toEqual(["DXF_HANDLE:100"]);
  });

  it("cites nothing where Jev chose the no-match outcome — the uncited answer the seam refuses", () => {
    const wire = composed().read({ [REVISION_EVIDENCE_ID]: { choice: REVISION_EVIDENCE_NONE }, [REVISION_RECENCY_ID]: { score: 0 } }) as {
      payload: { evidence: string | null };
      sources: string[];
    };
    expect(wire.sources).toEqual([]);
    expect(wire.payload.evidence).toBe(null);
  });

  it("cites nothing where Jev named a candidate this question never offered", () => {
    const wire = composed().read({ [REVISION_EVIDENCE_ID]: { choice: "cand_99" }, [REVISION_RECENCY_ID]: { score: 1 } }) as { sources: string[] };
    expect(wire.sources).toEqual([]);
  });

  it("reads the level Jev concentrated on, ties going to the lower level", () => {
    const wire = composed().read({
      [REVISION_EVIDENCE_ID]: { choice: "cand_2" },
      [REVISION_RECENCY_ID]: { score: 2.5, probabilities: { "1": 0.1, "2": 0.45, "3": 0.45 } },
    }) as { payload: { level: number } };
    expect(wire.payload.level).toBe(2);
  });

  it("falls back to the level nearest the score where Jev stated no distribution at all", () => {
    const wire = composed().read({ [REVISION_EVIDENCE_ID]: { choice: "cand_2" }, [REVISION_RECENCY_ID]: { score: 2.6 } }) as { payload: { level: number } };
    expect(wire.payload.level).toBe(3);
  });

  it("supplies nothing where Jev supplied nothing: no score is no level, and the decoder refuses it", () => {
    const wire = composed().read({ [REVISION_EVIDENCE_ID]: { choice: "cand_2" }, [REVISION_RECENCY_ID]: { type: "score" } }) as {
      payload: { level: number | null; score: number | null };
    };
    expect(wire.payload).toMatchObject({ level: null, score: null });
  });
});
