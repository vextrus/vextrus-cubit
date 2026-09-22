// @vitest-environment node
/**
 * The note-clause arm of the TypeSafe Jev adapter, at the wire (R-TO-034, L-AI-01, L-AI-02, L-AI-03).
 *
 * Every exchange is with a fetch this suite hands in: verify is network-free and no key is spelled
 * anywhere in the tree. What is judged is what the adapter POSTS for one general-note clause — one
 * choice over the law's own five kinds with a no-match outcome, and one Noul over the same state —
 * and how it reads what Jev answered into the wire the seam resolves: a class, a probability, and
 * the clause's own entity key as the source. The figure is never asked for and never read back
 * (L-AI-03); what a class is worth is the grammar's own reading of the clause, judged beside this
 * suite in tests/takeoff/notes/clauses.test.ts.
 */
import { describe, expect, test } from "vitest";
import { NOTE_KINDS } from "../../notes/law";
import { NO_NOTE_KIND, noteClauseRequest, readNoteClauseProposal } from "../../notes/model";
import { liveTransport } from "../live";
import { MODEL_QUESTIONS } from "../questions";
import { resolveProposal } from "../proposal";
import { sourceKeyResolver } from "../sources";
import { TYPESAFE_ENDPOINT, TYPESAFE_MODEL, structuredTaskOf } from "../typesafe";
import type { JsonValue, ModelCallContext, ModelRequest } from "../types";

const CTX: ModelCallContext = {
  tenantId: "d3e00000-0000-4000-8000-000000000001",
  projectId: "d3e00000-0000-4000-8000-000000000002",
  actor: "user:test",
  requestId: "req-test-note-clause-1",
};

/** F-RCC6-BNBC's own contested clause: the lap the sheet's note states beside the sheet's ld table. */
const LAP_CLAUSE = "LAP 50d TENSION / 40d COMPRESSION U.N.O.";
const LAP_KEY = "DXF_HANDLE:1F76";
const LD_TABLE = ["DEVELOPMENT LENGTH ld - fy 500 MPa, f'c 3500 psi", "ld BOTTOM (mm)", "LAP TENSION (mm)"];

function clauseRequest(clause = LAP_CLAUSE, key = LAP_KEY, lapTable: readonly string[] = LD_TABLE): ModelRequest {
  return noteClauseRequest({ clause, key, layout: "S-02", figures: ["50", "40"], lapTable });
}

type Posted = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
type Question = { type: string; instructions: string; criteria?: Record<string, string> };

/** A transport over a fetch that records what was posted and answers what the test says. */
function jev(answerWith: unknown, status = 200): { port: ReturnType<typeof liveTransport>; posted: Posted[] } {
  const posted: Posted[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    posted.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(JSON.stringify(answerWith), { status, headers: { "content-type": "application/json" } });
  };
  return { port: liveTransport({ TYPESAFE_API_KEY: "test-key" }, fetch), posted };
}

/** A body as the API spells one: a choice with its distribution, and a Noul with its probability. */
const answered = (choice: string | null, noul: number | null): unknown => ({
  model: TYPESAFE_MODEL,
  answers: {
    ...(choice === null ? {} : { clause_class: { type: "choice", choice, confidence: 0.86, probabilities: { [choice]: 0.86 } } }),
    ...(noul === null ? {} : { lap_governs: { type: "noul", noul } }),
  },
  usage: { input_tokens: 610, output_tokens: 12 },
});

/** The wire a transport answered, as the seam would read it. */
async function wireOf(port: ReturnType<typeof liveTransport>, request: ModelRequest): Promise<{ payload: JsonValue; sources: string[] }> {
  const answer = await port.answer(CTX, request, "hash");
  if (answer.kind !== "answered") throw new Error(`refused: ${answer.code}`);
  return answer.payload as { payload: JsonValue; sources: string[] };
}

/** The classes a clause may be OFFERED as: the law's roster, which is what the caller will store. */
const CLASSIFIABLE = [...NOTE_KINDS];

describe("what is asked of Jev about one general-note clause", () => {
  test("the request core spells is recognised as a clause task, by its key set alone", () => {
    const task = structuredTaskOf(clauseRequest());
    expect(task, "the key set the request builder spells is the arm's own").toEqual({
      kind: "clause",
      clause: LAP_CLAUSE,
      key: LAP_KEY,
      layout: "S-02",
      figures: ["50", "40"],
      lapTable: LD_TABLE,
    });
    expect(clauseRequest().question, "and the request names the closed question the ledger files it under").toBe(MODEL_QUESTIONS.noteClause);
  });

  test("a clause is one closed choice over the law's five kinds plus a no-match outcome, and one Noul, over one state", async () => {
    const { port, posted } = jev(answered("LAP", 0.94));
    await port.answer(CTX, clauseRequest(), "hash-clause");
    expect(posted).toHaveLength(1);
    const [call] = posted as [Posted];
    expect(call.url).toBe(TYPESAFE_ENDPOINT);
    expect(call.body["model"]).toBe(TYPESAFE_MODEL);

    const questions = call.body["questions"] as Record<string, Question>;
    expect(Object.keys(questions).sort()).toEqual(["clause_class", "lap_governs"]);

    // The criteria ARE the law's roster, read from its one home: a kind the law gains is offered by
    // this question or this test fails (B-19, ARCH-02).
    expect(Object.keys(questions["clause_class"]!.criteria ?? {})).toEqual([...NOTE_KINDS, NO_NOTE_KIND]);
    for (const [id, said] of Object.entries(questions["clause_class"]!.criteria ?? {})) {
      expect(said.length, `${id} is described to the model in words`).toBeGreaterThan(0);
    }
    expect(questions["clause_class"]!.type).toBe("choice");
    expect(questions["clause_class"]!.instructions, "the instruction names the state by its own field path").toContain("`clause`");
    expect(questions["clause_class"]!.instructions).toContain("`figures`");

    // The Noul carries its boundary in true/false and offers no options: it is a probability, not a
    // choice (docs.typesafe.ai/primitives/noul).
    expect(questions["lap_governs"]!.type).toBe("noul");
    expect(Object.keys(questions["lap_governs"]!.criteria ?? {}).sort()).toEqual(["false", "true"]);
    expect(questions["lap_governs"]!.instructions).toContain("`lap_table`");

    // The state is what a reader of the clause could use, and the entity key is NOT in it.
    expect(call.body["state"]).toEqual({ clause: LAP_CLAUSE, layout: "S-02", figures: ["50", "40"], lap_table: LD_TABLE });
  });

  test("the clause's class and the lap's probability come back citing the clause's own entity, and no figure at all", async () => {
    const { port } = jev(answered("LAP", 0.94));
    const wire = await wireOf(port, clauseRequest());
    expect(wire.payload).toEqual({ kind: "LAP", governs: 0.94 });
    expect(wire.sources).toEqual([LAP_KEY]);
  });

  test("the no-match outcome is a class of null and not a refusal, and it is what the caller decides on", async () => {
    const { port } = jev(answered(NO_NOTE_KIND, 0.02));
    const wire = await wireOf(port, clauseRequest('2" clear cover (pile caps)', "DXF_HANDLE:1F46", []));
    expect(wire.payload, "the roster carries no COVER kind, so abstention is the only honest answer").toEqual({ kind: null, governs: 0.02 });

    const resolved = resolveProposal(wire as unknown as JsonValue, {
      artifact: sourceKeyResolver("sha256:artifact", [LAP_KEY, "DXF_HANDLE:1F46"]),
      decode: readNoteClauseProposal(CLASSIFIABLE),
    });
    expect(resolved.ok, "and it resolves as a proposal — the caller offers nothing for it (L-AI-02)").toBe(true);
  });

  test("a Noul Jev did not answer is carried as unjudged, never as a zero", async () => {
    const { port } = jev(answered("FY", null));
    const wire = await wireOf(port, clauseRequest("fy = 500 MPa", "DXF_HANDLE:1F43", []));
    expect(wire.payload).toEqual({ kind: "FY", governs: null });
  });
});

describe("what a clause proposal is refused for", () => {
  const artifact = sourceKeyResolver("sha256:artifact", [LAP_KEY, "DXF_HANDLE:1F46"]);
  const contract = { artifact, decode: readNoteClauseProposal(CLASSIFIABLE) };

  test("a class outside the caller's set is MALFORMED", () => {
    const resolved = resolveProposal({ payload: { kind: "COVER", governs: null }, sources: [LAP_KEY] } as unknown as JsonValue, contract);
    expect(resolved.ok).toBe(false);
    expect(resolved.ok ? null : resolved.code).toBe("MALFORMED");
  });

  test("a probability that is not one is MALFORMED", () => {
    for (const governs of [1.5, -0.1, "0.9"]) {
      const resolved = resolveProposal({ payload: { kind: "LAP", governs }, sources: [LAP_KEY] } as unknown as JsonValue, contract);
      expect(resolved.ok, `${JSON.stringify(governs)} is no probability`).toBe(false);
      expect(resolved.ok ? null : resolved.code).toBe("MALFORMED");
    }
  });

  test("an answer naming a field this question does not answer is MALFORMED", () => {
    const resolved = resolveProposal({ payload: { kind: "LAP", governs: 0.9, value: "50d" }, sources: [LAP_KEY] } as unknown as JsonValue, contract);
    expect(resolved.ok, "the figure is never the model's to answer (L-AI-03)").toBe(false);
    expect(resolved.ok ? null : resolved.code).toBe("MALFORMED");
  });

  test("an uncited answer is UNSOURCED and a key the artifact does not hold is SOURCE_UNRESOLVED", () => {
    const uncited = resolveProposal({ payload: { kind: "LAP", governs: null }, sources: [] } as unknown as JsonValue, contract);
    expect(uncited.ok ? null : uncited.code).toBe("UNSOURCED");
    const unresolved = resolveProposal({ payload: { kind: "LAP", governs: null }, sources: ["DXF_HANDLE:9999"] } as unknown as JsonValue, contract);
    expect(unresolved.ok ? null : unresolved.code).toBe("SOURCE_UNRESOLVED");
  });

  test("a clause that says nothing is never posted at all (B-14)", async () => {
    const { port, posted } = jev(answered("LAP", 0.5));
    // The guard's throw is infrastructure's fault and never a product decision: it reaches the
    // caller as a recorded fault, and nothing is posted.
    await expect(port.answer(CTX, clauseRequest("   ", LAP_KEY, []), "hash-blank")).rejects.toThrow(/was not answered/);
    expect(posted, "the guard throws before anything reaches the wire").toHaveLength(0);
  });
});
