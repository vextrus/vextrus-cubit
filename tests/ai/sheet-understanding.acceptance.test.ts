// @vitest-environment node
/**
 * Public acceptance for AC-1 and AC-2 of the sheet-understanding leg (R-AI-001, L-AI-01, L-AI-02,
 * L-AI-03): the deterministic title-block grammar answers first and no model is asked, and only a
 * layout the grammar is silent on reaches `claude-opus-5` — replayed from the committed corpus,
 * with citations that resolve against that very sheet.
 *
 * Neither criterion touches a database: the port is built by the barrel's `createModelSeam` over an
 * injected env, an injected fetch and a memory ledger (P-2), so what is graded here is the module's
 * own judgement and nothing of the store's. Every expectation is derived — from `readTitleBlock`
 * for AC-1, and from the committed artifact's own layouts and entity keys for AC-2 (B-19).
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { DISCIPLINES, readTitleBlock } from "../../src/core/sheets";
import {
  FIXTURE_ROOT,
  OPUS,
  OUTCOME_PROPOSED,
  REPO_ROOT,
  SILENT_GRAPH,
  TRANSPORT_FIXTURE,
  UNDERSTANDING_MODULE,
  answeredCallIds,
  builtGraph,
  contextFor,
  entityKeysOn,
  layoutsOfKind,
  memoryLedger,
  rowsOf,
  seamPort,
  silentCorpusGraph,
  understandingMember,
  type Graph,
} from "./support/understanding-stage";

/** The digest a call is made under; the reading's identity, not the request's (P-3 hashes the graph). */
function digestOf(graph: Graph): string {
  return createHash("sha256").update(JSON.stringify(graph)).digest("hex");
}

const SHEET = "S-101";

describe("AC-1: grammar first, no call", () => {
  test("AC-1: a layout the grammar reads is answered at basis GRAMMAR, with no model call and no ledger row", async () => {
    const understandSheet = await understandingMember("understandSheet");

    const graph = builtGraph({
      paperLayout: SHEET,
      texts: [
        { text: "FOUNDATION PLAN", height: 12, layer: "S-TITL" },
        { text: "S-101", height: 4, layer: "S-TITL" },
        { text: "SHEET 1 OF 6", height: 3, layer: "S-TITL" },
      ],
    });

    // Armed by the input, not by a transcription: the criterion is about a layout the grammar reads.
    const grammar = readTitleBlock(graph, SHEET);
    expect(grammar.basis, `the built artifact's ${SHEET} carries readable TEXT, so the grammar reads it`).toBe("GRAMMAR");

    const { ledger, record } = memoryLedger();
    const { port, propose, fetch } = await seamPort(join(REPO_ROOT, FIXTURE_ROOT), ledger);
    const ctx = contextFor("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "user:acceptance");

    const understanding = await understandSheet(ctx, { graph, layoutName: SHEET, artifactDigest: digestOf(graph) }, port);

    expect(understanding.basis, "a sheet the grammar read is understood on the grammar's basis").toBe("GRAMMAR");
    expect(understanding.callId, "a GRAMMAR understanding names no call: none was made").toBeNull();
    expect(understanding.model, "a GRAMMAR understanding names no model: none was asked").toBeNull();
    expect(understanding.reading.number, "the number is the grammar's").toBe(grammar.number);
    expect(understanding.reading.title, "the title is the grammar's").toBe(grammar.title);
    expect(understanding.reading.discipline, "the discipline is the grammar's").toBe(grammar.discipline);
    expect(understanding.reading.captions, "the grammar reads no view captions, and none are invented").toEqual([]);
    expect(understanding.cited, "the citations are the entities the grammar read").toEqual(grammar.cited);

    expect(propose, `${UNDERSTANDING_MODULE} asked the model about a sheet the grammar had already read`).not.toHaveBeenCalled();
    expect(rowsOf(record), "no call was made, so the ledger holds no row").toEqual([]);
    expect(fetch, "no network call, ever (L-AI-01)").not.toHaveBeenCalled();
  });
});

describe("AC-2: silent → model, fixture-replayed from the committed corpus", () => {
  test("AC-2: a silent layout is proposed by claude-opus-5 from the committed corpus, cited against that sheet, and recorded once", async () => {
    const understandSheet = await understandingMember("understandSheet");

    const graph = silentCorpusGraph();
    const paper = layoutsOfKind(graph, "paper");
    expect(paper.length, `${SILENT_GRAPH} carries a single paper layout — the silent sheet AC-2 drives`).toBe(1);
    const layoutName = paper[0]?.name ?? "";

    // Armed by the artifact itself: the model leg is only reached where the grammar read nothing.
    expect(readTitleBlock(graph, layoutName).basis, `${SILENT_GRAPH}'s ${layoutName} holds no readable TEXT/MTEXT, so the grammar is silent on it`).toBe("NONE");

    const onSheet = entityKeysOn(graph, layoutName);
    expect(onSheet.length, `${SILENT_GRAPH}'s ${layoutName} carries entities a proposal can cite`).toBeGreaterThan(0);

    const { ledger, record } = memoryLedger();
    const { port, propose, fetch } = await seamPort(join(REPO_ROOT, FIXTURE_ROOT), ledger);
    const ctx = contextFor("33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444", "user:acceptance");

    const understanding = await understandSheet(ctx, { graph, layoutName, artifactDigest: digestOf(graph) }, port);

    expect(understanding.basis, "a sheet the grammar is silent on is understood on the model's basis").toBe("MODEL");
    expect(understanding.model, "AS-05 pins reading and proposals to claude-opus-5").toBe(OPUS);
    expect(DISCIPLINES as readonly string[], `the proposed discipline ${JSON.stringify(understanding.reading.discipline)} is one of R-TO-004's closed roster`).toContain(understanding.reading.discipline);
    expect(understanding.reading.title.trim(), "a reading proposes a title, not an empty heading").not.toBe("");
    expect(Array.isArray(understanding.cited) && understanding.cited.length > 0, "L-AI-02: a proposal cites at least one source").toBe(true);
    for (const key of understanding.cited) {
      expect(onSheet, `the citation ${JSON.stringify(key)} names an entity of ${layoutName}, not of the rest of the artifact`).toContain(key);
    }

    const rows = rowsOf(record);
    expect(rows.length, "L-AI-01 records every call, and one sheet is one call").toBe(1);
    expect(rows[0], "the row is the fixture-replayed, proposed opus call for this context's project").toMatchObject({
      transport: TRANSPORT_FIXTURE,
      outcome: OUTCOME_PROPOSED,
      modelId: OPUS,
      projectId: ctx.projectId,
      tenantId: ctx.tenantId,
    });

    const [callId] = await answeredCallIds(record);
    expect(understanding.callId, "the understanding names the ledger row that made it").toBe(callId);
    expect(propose, "the model was asked, through the injected port").toHaveBeenCalledTimes(1);
    expect(fetch, "verify is network-free: the answer came from the committed corpus (L-AI-01, AS-05)").not.toHaveBeenCalled();
  });
});
