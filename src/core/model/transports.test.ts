// The two transports at their edges (L-AI-01, B-17, B-21): a missing fixture refuses through the
// marker's one home naming the request and never the root; a token figure that is not a count fails
// through the derivation's one sentence on both transports; the live transport posts the caller's
// `max_tokens` only when it is a positive integer and the default otherwise.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { refusalCodeOf } from "../faults/refusal-marker";
import { tokenCount } from "../model-ledger.types";
import { requestHash } from "./canonical";
import { fixtureTransport } from "./fixture";
import { liveTransport } from "./live";
import type { ModelCallContext, ModelRequest } from "./types";

const DEFAULT_MAX_TOKENS = 1024;

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const fixtureRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "cubit-transports-"));
  roots.push(root);
  return root;
};

const ctx: ModelCallContext = { tenantId: "tenant", projectId: "project", actor: "test", requestId: "req" };

const request = (params?: ModelRequest["params"]): ModelRequest => ({
  modelId: "claude-sonnet-5",
  system: "You read a bill of quantities.",
  messages: [{ role: "user", content: "Classify the line." }],
  ...(params === undefined ? {} : { params }),
});

/** The value a call rejected with, or undefined when it resolved — no catch clause of the test's own. */
const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );

/** The sentence the derivation's judgement raises for a figure, read off the one home. */
const countFailure = async (figure: unknown): Promise<string> => ((await rejectionOf(Promise.resolve().then(() => tokenCount(figure)))) as Error).message;

describe("the fixture transport", () => {
  it("refuses a missing fixture through the marker home, naming the hash and the file, never the root", async () => {
    const root = fixtureRoot();
    const asked = request({ temperature: 0 });
    const hash = requestHash(asked);
    const answer = await fixtureTransport(root).answer(ctx, asked, hash);
    expect(answer.kind).toBe("refused");
    if (answer.kind !== "refused") return;
    expect(answer.code).toBe("FIXTURE_MISSING");
    expect(refusalCodeOf(answer.refusal)).toBe("FIXTURE_MISSING");
    expect(answer.refusal.message).toContain(hash);
    expect(answer.refusal.message).toContain(`${hash}.json`);
    expect(answer.refusal.message).not.toContain(root);
    expect(answer.refusal.message).not.toContain(tmpdir());
    expect((answer.refusal as Error & { requestHash?: unknown }).requestHash).toBe(hash);
  });

  it("fails a fixture whose token figure is not a count exactly as the derivation does", async () => {
    for (const figure of [1.5, -1, "7"]) {
      const root = fixtureRoot();
      const asked = request({ temperature: 0 });
      const hash = requestHash(asked);
      writeFileSync(join(root, `${hash}.json`), JSON.stringify({ requestHash: hash, modelId: asked.modelId, payload: {}, inputTokens: figure, outputTokens: 0 }));
      const rejection = (await rejectionOf(fixtureTransport(root).answer(ctx, asked, hash))) as Error;
      expect(rejection, String(figure)).toBeInstanceOf(Error);
      expect(refusalCodeOf(rejection)).toBeNull();
      expect(rejection.message).toBe(await countFailure(figure));
    }
  });
});

describe("the live transport", () => {
  const body = (inputTokens: unknown, outputTokens: unknown): string => JSON.stringify({ content: [{ type: "text", text: "Concrete." }], usage: { input_tokens: inputTokens, output_tokens: outputTokens } });

  const transport = (answerWith: string) => {
    const posted: { max_tokens?: unknown }[] = [];
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      posted.push(JSON.parse(String(init?.body)) as { max_tokens?: unknown });
      return new Response(answerWith, { status: 200, headers: { "content-type": "application/json" } });
    };
    return { port: liveTransport({ ANTHROPIC_API_KEY: "key" }, fetch), posted };
  };

  it("posts max_tokens as given when it is a positive integer and 1024 otherwise", async () => {
    const { port, posted } = transport(body(3, 4));
    const variants: { params: ModelRequest["params"] | undefined; expected: number }[] = [
      { params: undefined, expected: DEFAULT_MAX_TOKENS },
      { params: { temperature: 0 }, expected: DEFAULT_MAX_TOKENS },
      { params: { temperature: 0, max_tokens: null }, expected: DEFAULT_MAX_TOKENS },
      { params: { temperature: 0, max_tokens: 0 }, expected: DEFAULT_MAX_TOKENS },
      { params: { temperature: 0, max_tokens: 2.5 }, expected: DEFAULT_MAX_TOKENS },
      { params: { temperature: 0, max_tokens: 77 }, expected: 77 },
    ];
    for (const [index, variant] of variants.entries()) {
      const asked = request(variant.params);
      const answer = await port.answer(ctx, asked, requestHash(asked));
      expect(answer.kind).toBe("answered");
      expect(posted[index]?.max_tokens, JSON.stringify(variant.params)).toBe(variant.expected);
    }
  });

  it("fails a usage that does not count tokens exactly as the derivation does, with no fault id", async () => {
    for (const figure of [1.5, -1, "7"]) {
      const { port } = transport(body(figure, 0));
      const asked = request();
      const rejection = (await rejectionOf(port.answer(ctx, asked, requestHash(asked)))) as Error;
      expect(rejection, String(figure)).toBeInstanceOf(Error);
      expect(refusalCodeOf(rejection)).toBeNull();
      expect(rejection.message).toBe(await countFailure(figure));
    }
  });
});
