/**
 * AC-5(a) of the src/core debt sweep: the sentence a refusal with no detail carries is a value of
 * its own code, in one home (B-17, ARCH-02, L-AI-02, R-SPINE-062).
 *
 * Beside the seam because L-AI-01 makes src/core/model/ the one place the seam's interior may be
 * named. The behaviour runs first, over the fixture transport and a memory ledger — the idiom
 * src/core/model/__tests__/proposal.acceptance.test.ts uses — so a staging failure is never mistaken
 * for the missing export this criterion is about. The rest of AC-5 lives in
 * src/core/explicit-seams.test.ts.
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { REFUSALS } from "../errors";
import { refusalCodeOf } from "../faults/refusal-marker";
import { MODEL_IDS } from "../model-ledger.types";

const SEAM_MODULE = "src/core/model/seam.ts";

/** The three ways a model's answer fails to be a proposal — a closed set of the taxonomy (R-SPINE-062). */
const RESOLUTION_CODES = ["MALFORMED", "SOURCE_UNRESOLVED", "UNSOURCED"];

/** L-AI-02's sentence for an answer that cited nothing at all. */
const UNSOURCED_SENTENCE = "no source was cited";

/** The value a promise rejected with, or undefined — no catch clause of the test's own (ARCH-03). */
const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );

let scratchRoot = "";

beforeAll(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), "cubit-empty-detail-"));
});

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

describe("AC-5(a): the sentence a detail-less refusal carries", () => {
  test("AC-5(a): EMPTY_DETAIL_SENTENCES is total over the resolution codes, and the seam's message reads its own", async () => {
    // An answer that cites nothing resolves UNSOURCED with an empty detail — the one refusal whose
    // message has no fact of its own to state, and so falls back to a sentence.
    const barrel = (await import("./index")) as {
      createModelSeam: (options: unknown) => { propose: (ctx: unknown, request: unknown, contract: unknown) => Promise<unknown> };
      requestHash: (request: unknown) => string;
    };
    const fixtureRoot = mkdtempSync(join(scratchRoot, "fixtures-"));
    const request = { modelId: MODEL_IDS[0], system: "AC-5(a)", messages: [{ role: "user", content: `cite nothing ${randomUUID()}` }] };
    const hash = barrel.requestHash(request);
    writeFileSync(join(fixtureRoot, `${hash}.json`), JSON.stringify({ requestHash: hash, modelId: request.modelId, payload: { payload: {}, sources: [] }, inputTokens: 1, outputTokens: 1 }));

    const seamUnderTest = barrel.createModelSeam({
      env: { NODE_ENV: "test", CUBIT_MODEL_FIXTURE_ROOT: fixtureRoot },
      fetch: vi.fn(),
      ledger: { record: async (): Promise<{ callId: string }> => ({ callId: randomUUID() }) },
    });
    const ctx = { tenantId: randomUUID(), projectId: randomUUID(), actor: "human", requestId: randomUUID() };
    const contract = { artifact: { artifactDigest: "a".repeat(64), has: (): boolean => true }, decode: (): { ok: true; value: null } => ({ ok: true, value: null }) };

    const refused = await rejectionOf(seamUnderTest.propose(ctx, request, contract));
    expect(refusalCodeOf(refused), "an answer citing nothing is refused UNSOURCED").toBe("UNSOURCED");

    const seam = (await import("./seam")) as Record<string, unknown>;
    const sentences = seam["EMPTY_DETAIL_SENTENCES"] as Record<string, string> | undefined;
    expect(sentences, `${SEAM_MODULE} exports EMPTY_DETAIL_SENTENCES — the sentence belongs to the code, not to a branch inside describe() (B-17)`).toBeDefined();
    const held = sentences ?? {};

    expect(Object.keys(held).sort(), "the map is total over the three ways an answer fails to be a proposal (L-AI-02)").toEqual(RESOLUTION_CODES);
    for (const [code, sentence] of Object.entries(held)) {
      expect((REFUSALS as Record<string, unknown>)[code], `${code} is read off the closed taxonomy rather than agreed with by chance (R-SPINE-062, Q-07)`).toBeDefined();
      expect(typeof sentence === "string" && sentence.trim() !== "", `${code}'s sentence says something`).toBe(true);
    }
    expect(held["UNSOURCED"], "an answer that cited nothing says so in L-AI-02's own words").toBe(UNSOURCED_SENTENCE);
    expect((refused as Error).message, "…and the refusal whose detail is empty carries the sentence of its own code, read from that map").toContain(held["UNSOURCED"]);
  });
});
