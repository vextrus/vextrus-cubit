/**
 * A silent sheet read by TypeSafe Jev System One, end to end through the seam's one public path
 * (L-AI-01, L-AI-02, L-AI-03): `createModelSeam` over an environment holding a TypeSafe key and a
 * fetch the test hands in, `understandSheet` over an artifact built here, and a memory ledger.
 *
 * What is graded: that Jev's choices become a MODEL understanding citing exactly the candidates it
 * chose; that a title Jev did not choose, a discipline outside the closed list and an answer citing
 * nothing are REFUSALS by name (MALFORMED, MALFORMED, UNSOURCED) and never a supplied reading; that
 * every call, proposed or refused, is a ledger row attributed to the tenant over the live transport;
 * and that no network is reached without a key. AI proposes, code resolves, a human disposes.
 */
import { describe, expect, test, vi } from "vitest";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { JEV_MODEL, createModelSeam } from "@/core/model";
import { understandSheet } from "@/modules/ai/sheet-understanding";
import { contextFor, layoutsOfKind, memoryLedger, rejectionOf, rowsOf, silentCorpusGraph } from "./support/understanding-stage";

const TENANT = "d3e00000-0000-4000-8000-000000000001";
const PROJECT = "d3e00000-0000-4000-8000-000000000002";

/**
 * The committed silent sheet (F-MODEL): its only TEXT is blank and its words — SHEET_NO `C-402`,
 * SHEET_TITLE `SITE GRADING PLAN`, SCALE `1:100` — are attributes of one title block, which the
 * grammar does not read. So a model is asked, and every candidate Jev can choose cites that block.
 */
function silentSheet(): { graph: ReturnType<typeof silentCorpusGraph>; layoutName: string; block: string } {
  const graph = silentCorpusGraph();
  const layoutName = layoutsOfKind(graph, "paper")[0]?.name ?? "";
  const block = graph.block_attributes[0]?.src ?? "";
  return { graph, layoutName, block };
}

type Choice = { choice: string };
type JevAnswer = { model: string; answers: Record<string, Choice>; usage: { input_tokens: number; output_tokens: number } };

/** Jev, as a fetch: records what it was asked and answers the choices the test names. */
function jevAnswering(choices: Record<string, string>) {
  const asked: Record<string, unknown>[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
    asked.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const body: JevAnswer = {
      model: "jev-latest",
      answers: Object.fromEntries(Object.entries(choices).map(([question, choice]) => [question, { choice }])),
      usage: { input_tokens: 310, output_tokens: 40 },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { fetch, asked };
}

function seamOver(fetch: typeof globalThis.fetch) {
  const { ledger, record } = memoryLedger();
  const seam = createModelSeam({ env: { TYPESAFE_API_KEY: "test-key", NODE_ENV: "production" }, fetch, ledger });
  return { seam, record };
}

describe("a silent sheet read by Jev, through the seam", () => {
  const ctx = contextFor(TENANT, PROJECT, "user:qs");

  test("Jev's choices become a MODEL understanding citing exactly the candidates it chose, over the live transport", async () => {
    const { graph, layoutName, block } = silentSheet();
    const { fetch, asked } = jevAnswering({ discipline: "CIVIL", title_candidate: "cand_2", number_candidate: "cand_1" });
    const { seam, record } = seamOver(fetch);

    const understanding = await understandSheet(ctx, { graph, layoutName, artifactDigest: "digest-7" }, { propose: seam.propose });

    expect(understanding.basis).toBe("MODEL");
    expect(understanding.reading).toEqual({ number: "C-402", title: "SITE GRADING PLAN", discipline: "CIVIL", captions: [] });
    expect(understanding.cited, "two attributes of one block cite the block once").toEqual([block]);
    expect(understanding.model, "the ledger's pinned id is the one the request carried — Jev's (D-002)").toBe(JEV_MODEL);

    expect(asked, "one question was posted, and it was Jev's closed one").toHaveLength(1);
    const questions = asked[0]?.["questions"] as Record<string, { criteria: Record<string, string> }>;
    expect(Object.keys(questions).sort()).toEqual(["discipline", "number_candidate", "title_candidate"]);
    const candidates = Object.values(questions["title_candidate"]!.criteria);
    expect(candidates.slice(0, 3), "the block's attributes lead the candidates, in the artifact's order").toEqual(["C-402", "SITE GRADING PLAN", "1:100"]);
    expect(candidates.every((text) => text.trim() !== ""), "the blank TEXT is no candidate").toBe(true);

    const rows = rowsOf(record);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tenantId: TENANT, projectId: PROJECT, transport: "live", outcome: "proposed", inputTokens: 310, outputTokens: 40 });
    expect(understanding.callId).toBeTruthy();
  });

  test("a title Jev did not choose is a MALFORMED refusal, never a supplied reading — and the refusal is a ledger row", async () => {
    const { graph, layoutName } = silentSheet();
    const { fetch } = jevAnswering({ discipline: "CIVIL", title_candidate: "cand_9", number_candidate: "cand_1" });
    const { seam, record } = seamOver(fetch);

    const rejection = await rejectionOf(understandSheet(ctx, { graph, layoutName, artifactDigest: "digest-7" }, { propose: seam.propose }));
    expect(refusalCodeOf(rejection)).toBe("MALFORMED");
    expect(rowsOf(record)[0]).toMatchObject({ transport: "live", outcome: "refused", refusalCode: "MALFORMED" });
  });

  test("a discipline outside R-TO-004's closed list is MALFORMED, never defaulted", async () => {
    const { graph, layoutName } = silentSheet();
    const { fetch } = jevAnswering({ discipline: "LANDSCAPE", title_candidate: "cand_2", number_candidate: "NONE" });
    const { seam } = seamOver(fetch);
    const rejection = await rejectionOf(understandSheet(ctx, { graph, layoutName, artifactDigest: "digest-7" }, { propose: seam.propose }));
    expect(refusalCodeOf(rejection)).toBe("MALFORMED");
  });

  test("an answer that chose no candidate is UNSOURCED — no key is invented to carry it", async () => {
    const { graph, layoutName } = silentSheet();
    const { fetch } = jevAnswering({ discipline: "CIVIL" });
    const { seam, record } = seamOver(fetch);
    const rejection = await rejectionOf(understandSheet(ctx, { graph, layoutName, artifactDigest: "digest-7" }, { propose: seam.propose }));
    expect(refusalCodeOf(rejection)).toBe("UNSOURCED");
    expect(rowsOf(record)[0]).toMatchObject({ outcome: "refused", refusalCode: "UNSOURCED" });
  });

  test("without a key the seam runs live and reaches nothing: a fault, no row, no network", async () => {
    const { graph, layoutName } = silentSheet();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response("unreachable", { status: 599 }));
    const { ledger, record } = memoryLedger();
    const seam = createModelSeam({ env: { NODE_ENV: "production" }, fetch, ledger });
    const rejection = await rejectionOf(understandSheet(ctx, { graph, layoutName, artifactDigest: "digest-7" }, { propose: seam.propose }));
    expect(refusalCodeOf(rejection)).toBeNull();
    expect(String((rejection as Error).message)).toContain("was not answered");
    expect(fetch).not.toHaveBeenCalled();
    expect(rowsOf(record)).toEqual([]);
  });
});
