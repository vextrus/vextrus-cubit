// @vitest-environment node
/**
 * The ask-route corpus (docs/design/s-ask.md I-396, I-397, I-624; L-AI-01, Q-08): the paraphrases
 * a quantity surveyor might type that the grammar cannot route, recorded live ONCE through
 * `scripts/model-corpus.ts` over the arm's own composed request, and replayed here with no network
 * and no key.
 *
 * Three things hold forever:
 *  - the recorder composes exactly what the door composes — the grammar's own `openIntentOf`, the
 *    module's own `askRouteStateOf` and `askRouteRequest` — and every paraphrase is one the machine
 *    is in fact asked (the grammar leaves its intent open and it names a keyed subject);
 *  - every request replays through the seam's fixture transport as a Proposal: no FIXTURE_MISSING,
 *    no UNSOURCED, no MALFORMED;
 *  - the measured line the Decision records — agreement, and that every routing at or above the
 *    floor is right — is read off the recordings themselves, so a re-record that moves it fails here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_QUESTIONS, createModelSeam, requestHash, sourceKeyResolver, type ModelJudgment, type ModelLedgerRow } from "../../../src/core/model";
import { ASK_REFUSAL_CODES } from "../../../src/modules/takeoff/ask/law";
import { openIntentOf } from "../../../src/modules/takeoff/ask/grammar";
import {
  ASK_ROUTE_CONFIDENCE_FLOOR,
  askRouteKeys,
  askRouteStateOf,
  proposeRoute,
  readRouteProposal,
  routeStandsAboveFloor,
  settleRoute,
  type AskRouteProposal,
} from "../../../src/modules/takeoff/ask/route-question";
import { keyOf, paraphrasesAt, projectVocabulary, subjectsOf } from "../../../scripts/model-corpus/ask-route";
import type { RecorderContext } from "../../../scripts/model-corpus/recorder";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const CORPUS_ROOT = resolve(REPO_ROOT, "fixtures", "model");

/** What the Decision records (s-ask.md §0.3): 60 paraphrases, 56 routed as written, 44 at or above the floor. */
const PARAPHRASES = 60;
const AGREED = 56;
const ABOVE_FLOOR = 44;

const corpus = paraphrasesAt();
const vocabulary = projectVocabulary(corpus.project);

function ctx(): RecorderContext {
  return { option: () => undefined, fail: (message) => { throw new Error(message); }, say: () => undefined, corpusRoot: CORPUS_ROOT };
}

/** A seam replaying the committed corpus, with a ledger that keeps every row it is handed. */
function replaying(): { seam: ReturnType<typeof createModelSeam>; rows: ModelLedgerRow[] } {
  const rows: ModelLedgerRow[] = [];
  const seam = createModelSeam({
    env: { CUBIT_MODEL_FIXTURE_ROOT: CORPUS_ROOT },
    fetch: () => Promise.reject(new Error("a replay never reaches the network")),
    ledger: { record: (row) => Promise.resolve({ callId: `call-${rows.push(row)}` }) },
  });
  return { seam, rows };
}

/** One paraphrase replayed: what the model proposed, what it judged, and what the product makes of it. */
async function replay(question: string): Promise<{ payload: AskRouteProposal; judgment: ModelJudgment | null; callId: string }> {
  const subjects = openIntentOf(question, vocabulary);
  if (subjects === null) throw new Error(`${question} is routed by the grammar`);
  const state = askRouteStateOf(question, subjects, keyOf(corpus.project));
  const { seam, rows } = replaying();
  const context = { tenantId: "t", projectId: "p", actor: "route-corpus", requestId: "r" };
  const proposal = await proposeRoute(context, state, sourceKeyResolver("replay", askRouteKeys(state)), seam);
  return { payload: proposal.payload, judgment: rows.at(-1)?.judgment ?? null, callId: proposal.callId };
}

describe("the committed paraphrases", () => {
  it("are sixty questions the machine is in fact asked, each over a keyed subject, each a distinct request", () => {
    const asked = subjectsOf(ctx());
    expect(asked.length).toBe(PARAPHRASES);
    for (const { request } of asked) expect(request.question, "filed under the routing question's own name").toBe(MODEL_QUESTIONS.askRoute);
    expect(new Set(asked.map(({ request }) => requestHash(request))).size, "no paraphrase is asked twice").toBe(PARAPHRASES);
    const intents = new Set(corpus.paraphrases.map((one) => one.intent));
    for (const intent of ["COUNT", "MARKS", "QUANTITY", "WHY_NOT_MEASURED", "MEMBER_TYPE", null]) {
      expect(intents.has(intent), `the corpus asks ${String(intent)} in other words`).toBe(true);
    }
  });

  it("carry no UUID, no project id and no figure: the request is the words, the subjects and the roster", () => {
    for (const { request } of subjectsOf(ctx())) {
      const content = JSON.parse(request.messages[0]?.content ?? "{}") as Record<string, unknown>;
      expect(Object.keys(content).sort(), "the key set no other arm uses").toEqual(["candidates", "question", "roster"]);
      expect(request.messages[0]?.content ?? "", "no UUID").not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u);
    }
  });
});

describe("the machine is asked only where the grammar cannot tell the intent (I-396)", () => {
  it("never where the grammar answers, clarifies or refuses by another name", () => {
    expect(openIntentOf("How many C3 columns are on GF?", vocabulary), "an answer").toBeNull();
    expect(openIntentOf("How many C3 columns are on level 1?", vocabulary), "a level counted two ways is the person's").toBeNull();
    expect(openIntentOf("What will the C3 concrete cost?", vocabulary), "a cost is refused by name").toBeNull();
    expect(openIntentOf("tally the C9 columns", vocabulary), "a mark the register does not hold").toBeNull();
    expect(openIntentOf("and on GF?", vocabulary, { intent: "COUNT", class: "column", kind: null, mark: "C3", level: null, by: null, noteKind: null, discipline: null, unitAsked: null }), "a follow-up").toBeNull();
  });

  it("where it is, with every subject the words name, in slot order", () => {
    expect(openIntentOf("tally C3, not C4, on GF", vocabulary)).toEqual([
      { slot: "mark", label: "C3" },
      { slot: "mark", label: "C4" },
      { slot: "level", label: "GF" },
    ]);
  });
});

describe("every ask-route recording stays rebuildable from a committed paraphrase (the ratchet)", () => {
  it("names a paraphrase whose request hashes to its roster line, under the subject the recorder prints", () => {
    const roster = JSON.parse(readFileSync(resolve(CORPUS_ROOT, "corpus.json"), "utf8")) as { fixtures: { requestHash: string; question: string; subject: string }[] };
    const lines = roster.fixtures.filter((line) => line.question === MODEL_QUESTIONS.askRoute);
    const byHash = new Map(subjectsOf(ctx()).map((asked) => [requestHash(asked.request), asked.subject]));
    expect(lines.length, "one recording per paraphrase, and none nobody asks").toBe(PARAPHRASES);
    for (const line of lines) expect(byHash.get(line.requestHash), `${line.requestHash} (${line.subject}) is still asked by a committed paraphrase`).toBe(line.subject);
  });
});

describe("the recordings replay (L-AI-01)", () => {
  it("every paraphrase replays as a Proposal citing the keys it was offered — no FIXTURE_MISSING, UNSOURCED or MALFORMED", async () => {
    for (const { question } of corpus.paraphrases) {
      const replayed = await replay(question);
      expect(replayed.judgment?.confidence, `${question}: the recording carries Jev's judgment`).toBeTypeOf("number");
    }
  });

  it("measures the line the Decision records: 56 of 60 routed as written, and every routing at or above the floor right", async () => {
    let agreed = 0;
    let above = 0;
    for (const paraphrase of corpus.paraphrases) {
      const { payload, judgment } = await replay(paraphrase.question);
      const right = payload.intent === paraphrase.intent && Object.entries(paraphrase.slots ?? {}).every(([slot, label]) => payload.slots[slot as "mark"] === label);
      if (right) agreed += 1;
      if (routeStandsAboveFloor(judgment?.confidence ?? null)) {
        above += 1;
        expect(right, `"${paraphrase.question}" was routed at ${String(judgment?.confidence)} — at or above the floor ${ASK_ROUTE_CONFIDENCE_FLOOR} — and is not the reading it was written for`).toBe(true);
      }
    }
    expect(agreed, "the agreement the Decision records").toBe(AGREED);
    expect(above, "the routings answered on the machine's word").toBe(ABOVE_FLOOR);
  });
});

describe("what the product makes of a routing", () => {
  it("answers a confident routing as the grammar reads it under that intent, routed by the machine", async () => {
    const question = "tally up the C3 columns on GF";
    const replayed = await replay(question);
    const settled = settleRoute(question, vocabulary, replayed, replayed.judgment);
    expect(settled.outcome).toBe("READ");
    if (settled.outcome !== "READ") return;
    expect(settled.reading).toMatchObject({ intent: "COUNT", class: "column", mark: "C3", level: "GF" });
    expect(settled.callId, "the ledger row the answer names on data-call").toBe(replayed.callId);
  });

  it("offers two readings — never an answer — where the machine is below the floor", async () => {
    const question = "enumerate the C1 columns standing on GF";
    const replayed = await replay(question);
    expect(replayed.judgment?.confidence ?? 1).toBeLessThan(ASK_ROUTE_CONFIDENCE_FLOOR);
    const settled = settleRoute(question, vocabulary, replayed, replayed.judgment);
    expect(settled.outcome).toBe("CLARIFY");
    if (settled.outcome !== "CLARIFY") return;
    expect(settled.lead).toBe("MACHINE");
    expect(settled.offered.length, "two buttons, beside None of these").toBe(2);
    expect(settled.offered.map((offered) => offered.reading.intent), "the reading it was written for is one of them").toContain("COUNT");
  });

  it("stands the grammar's refusal where the machine is sure the words ask none of the intents", async () => {
    const question = "when was C4 revised";
    const replayed = await replay(question);
    expect(replayed.payload.intent).toBeNull();
    expect(settleRoute(question, vocabulary, replayed, replayed.judgment)).toEqual({ outcome: "REFUSED", code: ASK_REFUSAL_CODES.notUnderstood, reading: null, held: null });
  });

  it("reads the one subject the words single out of two, and still clarifies below the floor", async () => {
    const question = "forget C1, tell me the C2 tally on GF";
    const replayed = await replay(question);
    const settled = settleRoute(question, vocabulary, replayed, replayed.judgment);
    expect(settled.outcome === "READ" ? settled.reading.mark : null, "C2, the one asked about — never C1, never a compound").toBe("C2");
  });

  it("refuses by name an answer outside what was offered, rather than reading it", () => {
    const state = askRouteStateOf("tally C3, not C4, on GF", openIntentOf("tally C3, not C4, on GF", vocabulary) ?? [], keyOf(corpus.project));
    const decode = readRouteProposal(state);
    expect(decode({ intent: "PRICE", slots: {} }).ok, "an intent off the roster").toBe(false);
    expect(decode({ intent: "COUNT", slots: { mark: "C9" } }).ok, "a mark the question did not name").toBe(false);
    expect(decode({ intent: "COUNT", slots: { level: "GF" } }).ok, "a slot the question did not name two of").toBe(false);
    expect(decode({ intent: "NONE_OF_THESE", slots: { mark: "NOT_STATED" } })).toEqual({ ok: true, value: { intent: null, slots: {} } });
  });
});
