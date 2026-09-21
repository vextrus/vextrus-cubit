// @vitest-environment node
/**
 * The TypeSafe Jev System One half of the live transport, at the wire (L-AI-01, L-AI-02).
 *
 * Every exchange here is with a fetch the test hands in: verify is network-free, and no key is
 * spelled anywhere in the tree. What is judged is what the adapter posts (the closed questions, with
 * criteria drawn from the product's own vocabularies and candidates drawn from the sheet), how it
 * reads what Jev chose into the wire the seam resolves, and what it does NOT do: supply a title Jev
 * did not choose, a source that is not a chosen candidate's key, or a question for a request it has
 * none for. How that wire becomes a sheet reading, or a refusal, is judged end to end by
 * tests/ai/typesafe-jev.acceptance.test.ts through the seam's one public path.
 */
import { describe, expect, test } from "vitest";
import { VIEW_TYPE_SPELLINGS } from "../../errors/transport-vocabulary";
import { DISCIPLINES } from "../../sheets";
import { readViewTypeProposal, viewCaptionRequest } from "../../view-captions";
import { canonicalJson } from "../canonical";
import { liveTransport } from "../live";
import { resolveProposal } from "../proposal";
import { sourceKeyResolver } from "../sources";
import { CANDIDATE_CAP, TYPESAFE_ENDPOINT, TYPESAFE_MODEL, structuredTaskOf } from "../typesafe";
import type { JsonValue, ModelCallContext, ModelRequest } from "../types";

const CTX: ModelCallContext = {
  tenantId: "d3e00000-0000-4000-8000-000000000001",
  projectId: "d3e00000-0000-4000-8000-000000000002",
  actor: "user:test",
  requestId: "req-test-typesafe-1",
};

/** The evidence a silent sheet is asked about, spelled as `sheetUnderstandingRequest` spells it. */
const SHEET_EVIDENCE = {
  layout: { name: "S-02", kind: "paper" },
  entities: [
    { key: "DXF_HANDLE:101", type: "TEXT", layer: "S-TITLE", text: "TYPICAL FLOOR BEAM & COLUMN LAYOUT PLAN", height: 10 },
    { key: "DXF_HANDLE:102", type: "TEXT", layer: "S-TITLE", text: "S-02", height: 5 },
    { key: "DXF_HANDLE:103", type: "TEXT", layer: "NOTES", text: "   ", height: 3.5 },
  ],
  derived: [{ key: "DXF_HANDLE:104", type: "TEXT", layer: "NOTES", text: "ALL CONCRETE C25/30", height: 3.5 }],
  blockAttributes: [{ src: "DXF_HANDLE:90", tag: "TITLE", text: "EDISON LAVINIA", height: 4 }],
  census: { TEXT: 3, LINE: 120 },
};

function sheetRequest(evidence: JsonValue = SHEET_EVIDENCE as unknown as JsonValue): ModelRequest {
  return { modelId: "claude-opus-5", system: "You read one sheet.", messages: [{ role: "user", content: canonicalJson(evidence) }] };
}

type Posted = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
type Questions = Record<string, { type: string; criteria: Record<string, string> }>;

/** A transport over a fetch that records what was posted and answers what the test says. */
function jev(answerWith: unknown, status = 200): { port: ReturnType<typeof liveTransport>; posted: Posted[] } {
  const posted: Posted[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    posted.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(JSON.stringify(answerWith), { status, headers: { "content-type": "application/json" } });
  };
  return { port: liveTransport({ TYPESAFE_API_KEY: "test-key" }, fetch), posted };
}

const answers = (choices: Record<string, string>, usage: unknown = { input_tokens: 320, output_tokens: 45 }): unknown => ({
  model: TYPESAFE_MODEL,
  answers: Object.fromEntries(Object.entries(choices).map(([question, choice]) => [question, { choice }])),
  usage,
});

/** The wire a transport answered, as the seam would read it. */
async function wireOf(port: ReturnType<typeof liveTransport>, request: ModelRequest): Promise<{ payload: JsonValue; sources: string[]; tokens: [number, number] }> {
  const answer = await port.answer(CTX, request, "hash");
  if (answer.kind !== "answered") throw new Error(`refused: ${answer.code}`);
  const wire = answer.payload as { payload: JsonValue; sources: string[] };
  return { payload: wire.payload, sources: wire.sources, tokens: [answer.inputTokens, answer.outputTokens] };
}

describe("what is asked of Jev", () => {
  test("a silent sheet is three closed choices over the sheet's own texts and the closed discipline list", async () => {
    const { port, posted } = jev(answers({ discipline: "STRUCTURAL", title_candidate: "cand_2", number_candidate: "cand_3" }));
    await port.answer(CTX, sheetRequest(), "hash-sheet");
    expect(posted).toHaveLength(1);
    const [call] = posted as [Posted];
    expect(call.url).toBe(TYPESAFE_ENDPOINT);
    expect(call.headers["Authorization"]).toBe("Bearer test-key");
    expect(call.body["model"]).toBe(TYPESAFE_MODEL);
    const questions = call.body["questions"] as Questions;
    expect(Object.keys(questions).sort()).toEqual(["discipline", "number_candidate", "title_candidate"]);
    expect(Object.keys(questions["discipline"]!.criteria)).toEqual([...DISCIPLINES]);
    // The candidates are the sheet's non-blank texts, block attributes first, in the request's order.
    expect(questions["title_candidate"]!.criteria).toEqual({
      cand_1: "EDISON LAVINIA",
      cand_2: "TYPICAL FLOOR BEAM & COLUMN LAYOUT PLAN",
      cand_3: "S-02",
      cand_4: "ALL CONCRETE C25/30",
    });
    expect(Object.keys(questions["number_candidate"]!.criteria)).toEqual(["cand_1", "cand_2", "cand_3", "cand_4", "NONE"]);
    for (const question of Object.values(questions)) expect(question.type).toBe("choice");
  });

  test("a caption is one closed choice over the view vocabulary, on the request core itself spells", async () => {
    const { port, posted } = jev(answers({ view_type: "MEMBER_SECTION" }));
    await port.answer(CTX, viewCaptionRequest("SECTION 1-1 THROUGH ROOF BEAM", "DXF_HANDLE:201"), "hash-caption");
    const questions = (posted[0] as Posted).body["questions"] as Questions;
    expect(Object.keys(questions)).toEqual(["view_type"]);
    expect(Object.keys(questions["view_type"]!.criteria)).toEqual([...VIEW_TYPE_SPELLINGS]);
  });

  test("the candidates are capped at the sheet's first forty texts", async () => {
    const many = {
      ...SHEET_EVIDENCE,
      blockAttributes: [],
      derived: [],
      entities: Array.from({ length: 60 }, (_, index) => ({ key: `DXF_HANDLE:${index + 1}`, type: "TEXT", layer: "N", text: `T${index}`, height: 1 })),
    } as unknown as JsonValue;
    const task = structuredTaskOf(sheetRequest(many));
    expect(task?.kind === "sheet" && task.candidates.length).toBe(60);
    const { port, posted } = jev(answers({ discipline: "OTHER", title_candidate: "cand_1", number_candidate: "NONE" }));
    await port.answer(CTX, sheetRequest(many), "hash-many");
    const criteria = ((posted[0] as Posted).body["questions"] as Questions)["title_candidate"]!.criteria;
    expect(Object.keys(criteria)).toHaveLength(CANDIDATE_CAP);
  });
});

describe("how Jev's choices are spelled on the wire", () => {
  test("a chosen title and number become the reading's fields, citing exactly the candidates chosen", async () => {
    const { port } = jev(answers({ discipline: "STRUCTURAL", title_candidate: "cand_2", number_candidate: "cand_3" }));
    const wire = await wireOf(port, sheetRequest());
    expect(wire.payload).toEqual({ number: "S-02", title: "TYPICAL FLOOR BEAM & COLUMN LAYOUT PLAN", discipline: "STRUCTURAL", captions: [] });
    expect(wire.sources).toEqual(["DXF_HANDLE:101", "DXF_HANDLE:102"]);
    expect(wire.tokens).toEqual([320, 45]);
  });

  test("a title chosen from a block attribute cites the block, once, however many attributes it has", async () => {
    const { port } = jev(answers({ discipline: "STRUCTURAL", title_candidate: "cand_1", number_candidate: "NONE" }));
    const wire = await wireOf(port, sheetRequest());
    expect(wire.sources).toEqual(["DXF_HANDLE:90"]);
    expect((wire.payload as { number: unknown }).number).toBeNull();
  });

  test("a title Jev did not choose is spelled null, never supplied", async () => {
    const { port } = jev(answers({ discipline: "STRUCTURAL", title_candidate: "cand_9", number_candidate: "cand_3" }));
    const wire = await wireOf(port, sheetRequest());
    expect((wire.payload as { title: unknown }).title).toBeNull();
    expect(wire.sources).toEqual(["DXF_HANDLE:102"]);
  });

  test("a discipline is carried as Jev spelled it, for the reading's own decoder to refuse", async () => {
    const { port } = jev(answers({ discipline: "LANDSCAPE", title_candidate: "cand_2", number_candidate: "NONE" }));
    const wire = await wireOf(port, sheetRequest());
    expect((wire.payload as { discipline: unknown }).discipline).toBe("LANDSCAPE");
  });

  test("an answer that chose no candidate cites nothing — no key is ever invented", async () => {
    const { port } = jev({ model: TYPESAFE_MODEL, answers: { discipline: { choice: "STRUCTURAL" } }, usage: { input_tokens: 1, output_tokens: 1 } });
    const wire = await wireOf(port, sheetRequest());
    expect(wire.sources).toEqual([]);
    expect(wire.payload).toEqual({ number: null, title: null, discipline: "STRUCTURAL", captions: [] });
  });

  test("a caption's class is proposed citing the caption's own entity, and a class outside the caller's set is refused", async () => {
    const request = viewCaptionRequest("SECTION 1-1 THROUGH ROOF BEAM", "DXF_HANDLE:201");
    const artifact = sourceKeyResolver("digest-2", ["DXF_HANDLE:201"]);
    const decode = readViewTypeProposal(["LAYOUT_PLAN", "MEMBER_SECTION", "DETAIL"] as const);

    const good = await wireOf(jev(answers({ view_type: "MEMBER_SECTION" })).port, request);
    const resolution = resolveProposal({ payload: good.payload, sources: good.sources }, { artifact, decode });
    expect(resolution.ok && resolution.payload).toEqual({ type: "MEMBER_SECTION" });
    expect(resolution.ok && resolution.sources).toEqual(["DXF_HANDLE:201"]);

    const outside = await wireOf(jev(answers({ view_type: "TITLE" })).port, request);
    const refused = resolveProposal({ payload: outside.payload, sources: outside.sources }, { artifact, decode });
    expect(!refused.ok && refused.code).toBe("MALFORMED");
  });

  test("a usage that is not a count fails as the ledger's derivation fails", async () => {
    const { port } = jev(answers({ view_type: "DETAIL" }, { input_tokens: "many", output_tokens: 2 }));
    await expect(port.answer(CTX, viewCaptionRequest("DETAIL A", "DXF_HANDLE:1"), "hash")).rejects.toThrow();
  });
});

describe("what Jev is never asked", () => {
  test("a request that is neither closed question is a fault, and nothing is posted", async () => {
    const { port, posted } = jev(answers({}));
    const free: ModelRequest = { modelId: "claude-opus-5", system: "system", messages: [{ role: "user", content: "Summarise this bid." }] };
    await expect(port.answer(CTX, free, "hash-free")).rejects.toThrow("the model call hash-free was not answered");
    expect(posted).toEqual([]);
    expect(structuredTaskOf(free)).toBeNull();
  });

  test("a sheet with no text to cite is a fault, and nothing is posted", async () => {
    const { port, posted } = jev(answers({}));
    const bare = sheetRequest({ ...SHEET_EVIDENCE, entities: [], derived: [], blockAttributes: [] } as unknown as JsonValue);
    await expect(port.answer(CTX, bare, "hash-bare")).rejects.toThrow("was not answered");
    expect(posted).toEqual([]);
  });

  test("a non-2xx answer is a fault naming the status", async () => {
    const { port } = jev({ error: "rate limited" }, 429);
    await expect(port.answer(CTX, viewCaptionRequest("PLAN", "DXF_HANDLE:1"), "hash-429")).rejects.toThrow("was not answered");
  });

  test("with no key at all the live transport is unreachable", async () => {
    const port = liveTransport({}, globalThis.fetch);
    await expect(port.answer(CTX, viewCaptionRequest("PLAN", "DXF_HANDLE:1"), "hash-1")).rejects.toThrow("the model call hash-1 was not answered");
  });
});
