// The two transports at their edges (L-AI-01, B-17, B-21): a missing fixture refuses through the
// marker's one home naming the request and never the root; a token figure that is not a count fails
// through the derivation's one sentence on both transports; the live transport posts the caller's
// `max_tokens` only when it is a positive integer and the default otherwise.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import { refusalCodeOf } from "../faults/refusal-marker";
import { JEV_MODEL, tokenCount } from "../model-ledger.types";
import { viewCaptionRequest } from "../view-captions";
import { canonicalJson, requestHash } from "./canonical";
import { fixtureTransport } from "./fixture";
import { liveTransport } from "./live";
import { recordFixture } from "./mint";
import { readTypeSafeBody } from "./typesafe";
import { OUTLINE_KEYS } from "./typesafe-arms/outline-corroboration";
import { viewCaptionArm } from "./typesafe-arms/view-caption";
import type { JsonValue, ModelCallContext, ModelRequest } from "./types";

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

  it("replays the judgment a fixture recorded, and answers null for a corpus that recorded none", async () => {
    const root = fixtureRoot();
    const asked = request();
    const hash = requestHash(asked);
    const judgment = { provider: "jev-1.13.0", confidence: 0.64, answers: { view_type: { type: "choice", value: "CLASS_A", confidence: 0.64, probabilities: { CLASS_A: 0.64, CLASS_B: 0.36 } } } };
    writeFileSync(join(root, `${hash}.json`), JSON.stringify({ requestHash: hash, modelId: asked.modelId, payload: {}, inputTokens: 10, outputTokens: 2, judgment }));
    const answer = await fixtureTransport(root).answer(ctx, asked, hash);
    expect(answer.kind === "answered" && answer.judgment).toEqual(judgment);

    const silent = request({ temperature: 0 });
    const silentHash = requestHash(silent);
    writeFileSync(join(root, `${silentHash}.json`), JSON.stringify({ requestHash: silentHash, modelId: silent.modelId, payload: {}, inputTokens: 10, outputTokens: 2 }));
    const older = await fixtureTransport(root).answer(ctx, silent, silentHash);
    expect(older.kind === "answered" && older.judgment, "a fixture minted before judgments were recorded replays with none").toBeNull();
  });

  it("fails a fixture whose judgment is not the record's shape as the corpus defect it is, not a refusal", async () => {
    const root = fixtureRoot();
    const asked = request();
    const hash = requestHash(asked);
    writeFileSync(join(root, `${hash}.json`), JSON.stringify({ requestHash: hash, modelId: asked.modelId, payload: {}, inputTokens: 10, outputTokens: 2, judgment: "sure" }));
    const rejection = (await rejectionOf(fixtureTransport(root).answer(ctx, asked, hash))) as Error;
    expect(rejection).toBeInstanceOf(Error);
    expect(refusalCodeOf(rejection)).toBeNull();
    expect(rejection.message).toContain("judgment");
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

describe("a fixture that kept the provider's body", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Four classes of the view vocabulary, read off its one home — which four is immaterial here. */
  const [CHOSEN = "", RUNNER_UP = "", THIRD = "", STALE = ""] = VIEW_TYPE_SPELLINGS;

  /** A silent caption, asked as the product asks it, and the body Jev answered it with. */
  const CAPTION_KEY = "DXF_HANDLE:2266";
  const captionRequest = (): ModelRequest => viewCaptionRequest("SEPTIC TANK  SCALE 1:50", CAPTION_KEY);
  const distribution = (): Record<string, number> => ({ [CHOSEN]: 0.7, [RUNNER_UP]: 0.2, [THIRD]: 0.1 });
  const captionBody = (): JsonValue => ({
    model: "jev-1.13.0",
    answers: { view_type: { type: "choice", choice: CHOSEN, probabilities: distribution(), confidence: 0.55 } },
    usage: { input_tokens: 412, output_tokens: 0 },
  });

  /** One outline and its mark, asked as one Noul — the request's content is the arm's own key set. */
  const outlineRequest = (): ModelRequest => {
    const content: Record<string, JsonValue> = {};
    for (const key of OUTLINE_KEYS) content[key] = 1;
    Object.assign(content, { class: "COLUMN", mark: "C1", markKey: "DXF_HANDLE:M1", outlineKey: "DXF_HANDLE:O1" });
    return { modelId: JEV_MODEL, system: "(unread by the arm)", messages: [{ role: "user", content: canonicalJson(content) }] };
  };

  /** Files a fixture as `./mint` does, with the record-day reading the caller names. */
  const filed = (root: string, asked: ModelRequest, fixture: Record<string, unknown>): string => {
    const hash = requestHash(asked);
    writeFileSync(join(root, `${hash}.json`), JSON.stringify({ requestHash: hash, modelId: asked.modelId, ...fixture }));
    return hash;
  };

  it("replays what the CURRENT seam derives from the body, not the reading the file was minted with", async () => {
    const root = fixtureRoot();
    const asked = captionRequest();
    const body = captionBody();
    // The record-day reading is deliberately not what the body says: the replay must not read it.
    const stale = { payload: { payload: { type: STALE }, sources: [CAPTION_KEY] }, judgment: { provider: "jev-1.13.0", confidence: 0.99, answers: {} } };
    const hash = filed(root, asked, { ...stale, inputTokens: 412, outputTokens: 0, body });
    const answer = await fixtureTransport(root).answer(ctx, asked, hash);
    expect(answer.kind).toBe("answered");
    if (answer.kind !== "answered") return;
    const derived = readTypeSafeBody(asked, body);
    expect(answer.payload, "the payload is today's reading of the kept body").toEqual(derived.content);
    expect(answer.payload).toEqual({ payload: { type: CHOSEN }, sources: [CAPTION_KEY] });
    expect(answer.judgment, "and so is the judgment").toEqual(derived.judgment);
    expect(answer.judgment).toEqual({
      provider: "jev-1.13.0",
      confidence: 0.55,
      answers: { view_type: { type: "choice", value: CHOSEN, confidence: 0.55, probabilities: distribution() } },
    });
    expect(answer.body, "the body travels with the answer").toEqual(body);
    expect([answer.inputTokens, answer.outputTokens]).toEqual([412, 0]);
  });

  it("replays a legacy fixture — one with no body — byte for byte as it was filed", async () => {
    const root = fixtureRoot();
    const asked = outlineRequest();
    // Session 6's reading of a Noul, frozen in a file minted before it moved: its probability filed as a confidence.
    const payload = { payload: { corroborates: 0.12 }, sources: ["DXF_HANDLE:O1", "DXF_HANDLE:M1"] };
    const judgment = { provider: "jev-1.13.0", confidence: 0.12, answers: { outline_corroborates: { type: "noul", value: 0.12, confidence: 0.12, probabilities: null } } };
    const hash = filed(root, asked, { payload, inputTokens: 300, outputTokens: 0, judgment });
    const answer = await fixtureTransport(root).answer(ctx, asked, hash);
    expect(answer.kind === "answered" && answer.payload).toEqual(payload);
    expect(answer.kind === "answered" && answer.judgment, "nothing can derive a legacy judgment again, so it is served as filed").toEqual(judgment);
    expect(answer.kind === "answered" && answer.body).toBeNull();
  });

  it("moves a body fixture's replay when the seam's reading moves, and leaves a legacy one where it stood", async () => {
    const root = fixtureRoot();
    // The Noul rule as it stands (7689a117): a Noul states a probability and NO confidence. The body
    // fixture was minted under the rule before it; its replay follows the rule the seam holds now.
    const noulBody: JsonValue = { model: "jev-1.13.0", answers: { outline_corroborates: { type: "noul", noul: 0.12 } }, usage: { input_tokens: 300, output_tokens: 0 } };
    const outline = outlineRequest();
    const outlineHash = filed(root, outline, {
      payload: { payload: { corroborates: 0.12 }, sources: ["DXF_HANDLE:O1", "DXF_HANDLE:M1"] },
      inputTokens: 300,
      outputTokens: 0,
      judgment: { provider: "jev-1.13.0", confidence: 0.12, answers: { outline_corroborates: { type: "noul", value: 0.12, confidence: 0.12, probabilities: null } } },
      body: noulBody,
    });
    const replayed = await fixtureTransport(root).answer(ctx, outline, outlineHash);
    expect(replayed.kind === "answered" && replayed.judgment, "the kept body replays under today's Noul rule, whatever the file says").toEqual({
      provider: "jev-1.13.0",
      confidence: null,
      answers: { outline_corroborates: { type: "noul", value: 0.12, confidence: null, probabilities: null } },
    });

    // And a change to an arm's reading moves the replay with it: the caption arm, made to read the
    // runner-up instead of the choice, answers the runner-up from the very same file.
    const caption = captionRequest();
    const captionHash = filed(root, caption, { payload: { payload: { type: CHOSEN }, sources: [CAPTION_KEY] }, inputTokens: 412, outputTokens: 0, body: captionBody() });
    const before = await fixtureTransport(root).answer(ctx, caption, captionHash);
    const compose = viewCaptionArm.compose.bind(viewCaptionArm);
    vi.spyOn(viewCaptionArm, "compose").mockImplementation((task) => ({ ...compose(task), read: () => ({ payload: { type: RUNNER_UP }, sources: [task.key] }) }));
    const after = await fixtureTransport(root).answer(ctx, caption, captionHash);
    expect(before.kind === "answered" && before.payload).toEqual({ payload: { type: CHOSEN }, sources: [CAPTION_KEY] });
    expect(after.kind === "answered" && after.payload, "the seam's reading moved, so the replay moved").toEqual({ payload: { type: RUNNER_UP }, sources: [CAPTION_KEY] });

    const legacyHash = filed(root, viewCaptionRequest("TYPICAL FLOOR BEAM DETAILS", "DXF_HANDLE:218E"), {
      payload: { payload: { type: CHOSEN }, sources: ["DXF_HANDLE:218E"] },
      inputTokens: 400,
      outputTokens: 0,
    });
    const legacy = await fixtureTransport(root).answer(ctx, viewCaptionRequest("TYPICAL FLOOR BEAM DETAILS", "DXF_HANDLE:218E"), legacyHash);
    expect(legacy.kind === "answered" && legacy.payload, "a legacy fixture has no body to read again, and stands where it was filed").toEqual({ payload: { type: CHOSEN }, sources: ["DXF_HANDLE:218E"] });
  });

  it("fails a kept body the seam cannot read, or whose usage the file does not count, as the corpus defect it is", async () => {
    const root = fixtureRoot();
    const asked = captionRequest();
    const hash = filed(root, asked, { payload: {}, inputTokens: 999, outputTokens: 0, body: captionBody() });
    const miscounted = (await rejectionOf(fixtureTransport(root).answer(ctx, asked, hash))) as Error;
    expect(miscounted).toBeInstanceOf(Error);
    expect(refusalCodeOf(miscounted)).toBeNull();
    expect(miscounted.message).toContain("other usage");

    const unread = request();
    const unreadHash = filed(root, unread, { payload: {}, inputTokens: 1, outputTokens: 0, body: { model: "jev-1.13.0", answers: {}, usage: { input_tokens: 1, output_tokens: 0 } } });
    const rejection = (await rejectionOf(fixtureTransport(root).answer(ctx, unread, unreadHash))) as Error;
    expect(rejection).toBeInstanceOf(Error);
    expect(refusalCodeOf(rejection)).toBeNull();
    expect(rejection.message).toContain("cannot read");
  });

  it("is what the recorder files: the provider's body beside the reading derived from it", async () => {
    const asked = captionRequest();
    const fetch: typeof globalThis.fetch = async () => new Response(JSON.stringify(captionBody()), { status: 200, headers: { "content-type": "application/json" } });
    const recording = await recordFixture({ TYPESAFE_API_KEY: "key" }, fetch, ctx, asked);
    expect(recording.fixture?.body, "the body is filed exactly as it arrived").toEqual(captionBody());
    expect(recording.fixture?.payload).toEqual(readTypeSafeBody(asked, captionBody()).content);
    expect(recording.fixture?.judgment).toEqual(readTypeSafeBody(asked, captionBody()).judgment);
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
