// @vitest-environment node
import { describe, expect, test } from "vitest";
import { liveTransport } from "../live";
import { resolveProposal } from "../proposal";
import { sourceKeyResolver } from "../sources";
import { readViewTypeProposal } from "../../view-captions";
import { VIEW_TYPE_SPELLINGS } from "../../errors/transport-vocabulary";
import type { ModelCallContext, ModelRequest } from "../types";

const decodeSheet = (payload: unknown) => {
  if (payload && typeof payload === "object" && "discipline" in payload && "title" in payload) {
    return { ok: true as const, value: payload as { discipline: string; title: string; number: string | null } };
  }
  return { ok: false as const, detail: "invalid sheet reading" };
};

const TEST_API_KEY = "apikey_244bc7cb2167849415daea3891d1fe190e1_deb194f2845d07cc1667124eefea300c2747e6f5e98806752ee1ff17eea8b174";

const DUMMY_CTX: ModelCallContext = {
  tenantId: "d3e00000-0000-4000-8000-000000000001",
  projectId: "d3e00000-0000-4000-8000-000000000002",
  actor: "user:test",
  requestId: "req-test-typesafe-1",
};

describe("TypeSafe Jev System One live transport integration", () => {
  test("refuses if neither TYPESAFE_API_KEY nor ANTHROPIC_API_KEY is present in environment", async () => {
    const transport = liveTransport({}, globalThis.fetch);
    const request: ModelRequest = {
      modelId: "claude-opus-5",
      system: "system prompt",
      messages: [{ role: "user", content: "test" }],
    };

    await expect(transport.answer(DUMMY_CTX, request, "hash-1")).rejects.toThrow(
      "the model call hash-1 was not answered",
    );
  });

  test("liveTransport with TYPESAFE_API_KEY evaluates sheet understanding with mocked fetch", async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          model: "jev-latest",
          answers: {
            discipline: { choice: "STRUCTURAL" },
            title_candidate: { choice: "cand_1" },
            number_candidate: { choice: "cand_2" },
          },
          usage: { input_tokens: 320, output_tokens: 45 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const transport = liveTransport({ TYPESAFE_API_KEY: "test-key" }, mockFetch as typeof globalThis.fetch);

    const sheetEvidence = {
      layout: { name: "Model", kind: "model" },
      entities: [
        { key: "DXF_HANDLE:101", type: "TEXT", layer: "S-TITLE", text: "TYPICAL FLOOR BEAM & COLUMN LAYOUT PLAN", height: 10 },
        { key: "DXF_HANDLE:102", type: "TEXT", layer: "S-TITLE", text: "SHEET NO: S-02", height: 5 },
      ],
      derived: [],
      blockAttributes: [],
      census: { TEXT: 2 },
    };

    const request: ModelRequest = {
      modelId: "claude-opus-5",
      system: "You read one sheet of a construction drawing set.",
      messages: [{ role: "user", content: JSON.stringify(sheetEvidence) }],
    };

    const answer = await transport.answer(DUMMY_CTX, request, "hash-mock-sheet");
    expect(answer.kind).toBe("answered");
    if (answer.kind !== "answered") return;

    expect(answer.inputTokens).toBe(320);
    expect(answer.outputTokens).toBe(45);

    const artifact = sourceKeyResolver("digest-mock", ["DXF_HANDLE:101", "DXF_HANDLE:102"]);
    const resolution = resolveProposal(answer.payload, {
      artifact,
      decode: decodeSheet,
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    expect(resolution.payload.discipline).toBe("STRUCTURAL");
    expect(resolution.payload.title).toBe("TYPICAL FLOOR BEAM & COLUMN LAYOUT PLAN");
    expect(resolution.payload.number).toBe("SHEET NO: S-02");
    expect(resolution.sources).toContain("DXF_HANDLE:101");
  });

  test("liveTransport with TYPESAFE_API_KEY evaluates sheet understanding against TypeSafe Jev", async () => {
    const transport = liveTransport({ TYPESAFE_API_KEY: TEST_API_KEY }, globalThis.fetch);

    const sheetEvidence = {
      layout: { name: "Model", kind: "model" },
      entities: [
        { key: "DXF_HANDLE:101", type: "TEXT", layer: "S-TITLE", text: "TYPICAL FLOOR BEAM & COLUMN LAYOUT PLAN", height: 10 },
        { key: "DXF_HANDLE:102", type: "TEXT", layer: "S-TITLE", text: "SHEET NO: S-02", height: 5 },
        { key: "DXF_HANDLE:103", type: "TEXT", layer: "NOTES", text: "ALL CONCRETE GRADE TO BE C25/30", height: 3.5 },
      ],
      derived: [],
      blockAttributes: [],
      census: { TEXT: 3, LINE: 120 },
    };

    const request: ModelRequest = {
      modelId: "claude-opus-5",
      system: "You read one sheet of a construction drawing set.",
      messages: [{ role: "user", content: JSON.stringify(sheetEvidence) }],
    };

    const answer = await transport.answer(DUMMY_CTX, request, "hash-sheet-1");
    expect(answer.kind).toBe("answered");
    if (answer.kind !== "answered") return;

    expect(answer.inputTokens).toBeGreaterThan(0);
    expect(answer.outputTokens).toBeGreaterThan(0);

    const artifact = sourceKeyResolver("digest-1", ["DXF_HANDLE:101", "DXF_HANDLE:102", "DXF_HANDLE:103"]);

    const resolution = resolveProposal(answer.payload, {
      artifact,
      decode: decodeSheet,
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    expect(resolution.payload.discipline).toBe("STRUCTURAL");
    expect(resolution.payload.title).toContain("LAYOUT PLAN");
    expect(resolution.sources.length).toBeGreaterThan(0);
  }, 30_000);

  test("liveTransport with TYPESAFE_API_KEY evaluates view caption classification against TypeSafe Jev", async () => {
    const transport = liveTransport({ TYPESAFE_API_KEY: TEST_API_KEY }, globalThis.fetch);

    const captionPayload = {
      caption: "SECTION 1-1 THROUGH ROOF BEAM",
      key: "DXF_HANDLE:201",
    };

    const request: ModelRequest = {
      modelId: "claude-sonnet-5",
      system: "You read the caption of one view on a structural construction drawing and say which class of view it captions.",
      messages: [{ role: "user", content: JSON.stringify(captionPayload) }],
    };

    const answer = await transport.answer(DUMMY_CTX, request, "hash-caption-1");
    expect(answer.kind).toBe("answered");
    if (answer.kind !== "answered") return;

    const artifact = sourceKeyResolver("digest-2", ["DXF_HANDLE:201"]);

    const resolution = resolveProposal(answer.payload, {
      artifact,
      decode: readViewTypeProposal(VIEW_TYPE_SPELLINGS),
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    expect(resolution.payload.type).toBe(VIEW_TYPE_SPELLINGS[3]);
    expect(resolution.sources).toContain("DXF_HANDLE:201");
  }, 30_000);
});
