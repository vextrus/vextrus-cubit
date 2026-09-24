/**
 * Every answer the committed corpus recorded for a silent view caption reads, under the rebuild's
 * own contract, as a proposal — a class, or the question's "none of these" as a proposal of no class
 * — and none of them is refused MALFORMED (R-TO-030, L-AI-01, L-AI-02, I-408).
 *
 * Session 7's demo ledger showed 3 of 10 view-caption calls refused MALFORMED, and session 8's map
 * found why: the arm tells Jev to choose the untyped member where a caption names no class, the
 * rebuild does not offer that member as a class, and the decoder refused it. The db lane proves the
 * rebuild on F-RCC6-BNBC itself (`view-caption-corpus.test.ts`); this suite is the network-free,
 * database-free half — the recorded PROVIDER BODIES in `fixtures/model`, read again by today's arm
 * through the shipped seam, with the ledger in memory.
 *
 * A recorded answer does not keep the caption it was asked about (the request is its hash), so each
 * one is refiled, under a scratch root, beneath a request this suite can build: the same anchor key
 * the answer cites, a caption naming the recording. The arm reads the provider's body again and the
 * body says what the model chose; the caption text is not part of that reading. Nothing here is
 * committed (Q-08) and the committed corpus is only read.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { JEV_MODEL, MODEL_QUESTIONS, createModelSeam, requestHash, sourceKeyResolver, type ModelLedger, type ModelLedgerRow } from "@/core/model";
import { proposeViewType, viewCaptionRequest } from "@/core/view-captions";
import { CAPTION_CLASSES } from "@/modules/takeoff/partition/rebuild";

/** The committed corpus every lane replays from (L-AI-01). */
const CORPUS_ROOT = join(process.cwd(), "fixtures", "model");

/** One recorded answer, as much of it as this suite reads. */
type Recorded = { file: string; requestHash: string; anchorKey: string; fixture: Record<string, unknown> };

/**
 * The corpus's view-caption answers: the Jev recordings whose filed wire answers exactly the one
 * field a caption classification names. Enumerated, never listed, so an answer recorded tomorrow is
 * governed with no edit (B-19).
 */
function recordedCaptionAnswers(): Recorded[] {
  // Another closed question answers in the same `{type}` shape (the room type, viewer.md I-688):
  // the roster files each recording under the question it answers, so those are not captions.
  const roster = JSON.parse(readFileSync(join(CORPUS_ROOT, "corpus.json"), "utf8")) as { fixtures: { requestHash: string; question: string }[] };
  const otherQuestion = new Set(roster.fixtures.filter((line) => line.question === MODEL_QUESTIONS.roomType).map((line) => `${line.requestHash}.json`));
  return readdirSync(CORPUS_ROOT)
    .filter((name) => name.endsWith(".json") && !otherQuestion.has(name))
    .sort()
    .flatMap((name) => {
      const fixture = JSON.parse(readFileSync(join(CORPUS_ROOT, name), "utf8")) as Record<string, unknown>;
      const wire = fixture["payload"] as { payload?: unknown; sources?: unknown } | null | undefined;
      const payload = wire?.payload;
      const isCaption = fixture["modelId"] === JEV_MODEL && payload !== null && typeof payload === "object" && !Array.isArray(payload) && Object.keys(payload).join() === "type";
      const sources = Array.isArray(wire?.sources) ? (wire.sources as unknown[]) : [];
      if (!isCaption || typeof sources[0] !== "string") return [];
      return [{ file: name, requestHash: String(fixture["requestHash"]), anchorKey: sources[0], fixture }];
    });
}

type Replayed = { file: string; outcome: string; refusalCode: string | null; type: string | null | undefined };

const scratch: string[] = [];
let replayed: Replayed[];

beforeAll(async () => {
  const root = mkdtempSync(join(tmpdir(), "cubit-caption-answers-"));
  scratch.push(root);
  const rows: ModelLedgerRow[] = [];
  const ledger: ModelLedger = {
    async record(row) {
      rows.push(row);
      return { callId: `call-${rows.length}` };
    },
  };
  const seam = createModelSeam({ env: { CUBIT_MODEL_FIXTURE_ROOT: root }, fetch: globalThis.fetch, ledger });

  replayed = [];
  for (const recorded of recordedCaptionAnswers()) {
    const caption = `the caption recorded as ${recorded.requestHash}`;
    const request = viewCaptionRequest(caption, recorded.anchorKey);
    const hash = requestHash(request);
    writeFileSync(join(root, `${hash}.json`), JSON.stringify({ ...recorded.fixture, requestHash: hash }));

    const before = rows.length;
    let type: string | null | undefined;
    try {
      const proposal = await proposeViewType(
        { tenantId: "t-caption-answers", projectId: "p-caption-answers", actor: "user:test", requestId: `req-${recorded.requestHash}` },
        { caption, anchorKey: recorded.anchorKey, ...CAPTION_CLASSES, artifact: sourceKeyResolver("digest", [recorded.anchorKey]) },
        { propose: seam.propose },
      );
      type = proposal.payload.type;
    } catch {
      // The refusal itself is read off the ledger row the seam wrote before throwing — that row is
      // what the audit shows, and it is what this suite grades.
      type = undefined;
    }
    const row = rows[before];
    replayed.push({ file: recorded.file, outcome: row?.outcome ?? "no row", refusalCode: row?.refusalCode ?? null, type });
  }
});

afterAll(() => {
  for (const root of scratch) rmSync(root, { recursive: true, force: true });
});

describe("the recorded view-caption answers, read under the rebuild's contract", () => {
  test("the corpus holds caption answers, and some of them are the question's own 'none of these' — the case this is about", () => {
    expect(replayed.length, "the committed corpus holds recorded view-caption answers — a proof over none proves nothing").toBeGreaterThan(0);
    expect(
      replayed.filter((one) => one.type === null).length,
      "at least one recorded answer is Jev's 'none of these' (session 7's three) — so the no-class path is exercised on real bodies",
    ).toBeGreaterThan(0);
  });

  test("every one is a proposed call in the ledger — none refused MALFORMED, none refused at all", () => {
    expect(
      replayed.filter((one) => one.outcome !== "proposed").map((one) => `${one.file}: ${one.outcome} ${one.refusalCode ?? ""}`),
      "a recorded answer the question itself offered is never booked as a malformed answer (I-408)",
    ).toEqual([]);
  });

  test("each reads as a class the rebuild offers, or as no class — nothing else reaches the rebuild", () => {
    const offered = new Set<string>(CAPTION_CLASSES.classifiable);
    expect(replayed.filter((one) => !(one.type === null || (typeof one.type === "string" && offered.has(one.type)))).map((one) => `${one.file}: ${String(one.type)}`)).toEqual([]);
  });
});

/** The one question a view-caption call posts to Jev, as the seam's live transport composes it. */
type PostedQuestion = { instructions: string; criteria: Record<string, string> };

/**
 * What the product POSTS to Jev for one silent caption — read off the seam's own live transport over
 * a fetch that records the body and answers a canned choice, so nothing leaves the process and
 * nothing reaches inside the seam (L-AI-01: the barrel is the one lawful door).
 */
async function postedCaptionQuestion(): Promise<PostedQuestion> {
  const posted: Record<string, unknown>[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    posted.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const answer = { answers: { view_type: { choice: CAPTION_CLASSES.noClass } }, usage: { input_tokens: 1, output_tokens: 1 } };
    return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
  };
  const ledger: ModelLedger = { record: async () => ({ callId: "call-posted" }) };
  const seam = createModelSeam({ env: { TYPESAFE_API_KEY: "test-key" }, fetch, ledger });
  const anchorKey = "DXF_HANDLE:1";
  await proposeViewType(
    { tenantId: "t-caption-posted", projectId: "p-caption-posted", actor: "user:test", requestId: "req-caption-posted" },
    { caption: "XQZ 77", anchorKey, ...CAPTION_CLASSES, artifact: sourceKeyResolver("digest", [anchorKey]) },
    { propose: seam.propose },
  );
  expect(posted, "one view-caption call posts one question").toHaveLength(1);
  return ((posted[0] as { questions: Record<string, PostedQuestion> }).questions["view_type"] as PostedQuestion);
}

describe("the rebuild's 'none of these' is the question's own", () => {
  let question: PostedQuestion;
  beforeAll(async () => {
    question = await postedCaptionQuestion();
  });

  test("the member the rebuild reads as no class is the one Jev is told to choose where a caption names none", () => {
    expect(question.instructions, "the posted no-match instruction names the rebuild's no-class member").toContain(`Choose ${CAPTION_CLASSES.noClass} if the caption names no class`);
    expect(Object.keys(question.criteria), "and it is one of the choices Jev is offered").toContain(CAPTION_CLASSES.noClass);
  });

  test("the no-class member is not a class the rebuild offers, and every class it offers is a choice Jev is given", () => {
    expect(CAPTION_CLASSES.classifiable, "a member cannot be both a class and 'none of these'").not.toContain(CAPTION_CLASSES.noClass);
    const choices = new Set(Object.keys(question.criteria));
    expect(CAPTION_CLASSES.classifiable.filter((type) => !choices.has(type))).toEqual([]);
  });
});
