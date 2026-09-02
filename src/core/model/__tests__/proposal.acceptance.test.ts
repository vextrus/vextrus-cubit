/**
 * Public acceptance for AC-1, AC-2 and AC-3 of the proposal contract (L-AI-02, L-AI-01, R-SPINE-062,
 * Q-07): the three resolution refusals registered with the Decision's copy and read from the
 * register, `propose` over the fixture transport answering exactly a Proposal and one proposed row,
 * the barrel's proposal surface beside an untouched `callModel`, and an unsourced answer refused
 * UNSOURCED after — not before — its refused row keeps the tokens the transport spent.
 *
 * Every fixture is minted under a mkdtemp root handed in through CUBIT_MODEL_FIXTURE_ROOT (Q-08).
 * The seam under test is built by `createModelSeam` over an env record, a silent fetch and a memory
 * ledger, exactly as callmodel.acceptance.test.ts builds it; the register is read through a loose
 * record so this file typechecks before the codes exist and grades them once they do.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test, vi } from "vitest";
import { REFUSALS, type RefusalEntry } from "../../errors";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { modelCallCost } from "../../model-ledger.types";
import {
  ARTIFACT_DIGEST,
  INPUT_TOKENS,
  KEY_1F,
  KEY_2A,
  OUTCOME_PROPOSED,
  OUTCOME_REFUSED,
  OUTPUT_TOKENS,
  PROPOSAL_MODEL_ID,
  acceptingDecoder,
  dropFixtureRoots,
  gatedLedger,
  proposalBarrel,
  proposalMember,
  proposedRow,
  refusedRow,
  spiedResolver,
  stageWire,
  wire,
  wirePayload,
  type DecodeShape,
} from "./proposal.support";
import { REPO_ROOT, RESOLVED, SEAM_DIR, answeredCallIds, member, rejectionOf } from "./support/seam";

/** The three codes L-AI-02 names, with the copy this increment fixes (refusal-state § 3). */
const RESOLUTION_REFUSALS: ReadonlyArray<{ code: string; message: string; remedy: string }> = [
  {
    code: "UNSOURCED",
    message: "The model's answer names no source entity in the drawing, so it was not accepted as a proposal.",
    remedy: "Request the answer again with the entities it rests on cited — nothing uncited is carried forward.",
  },
  {
    code: "SOURCE_UNRESOLVED",
    message: "The model's answer cites a source entity the drawing does not contain, so it was not accepted as a proposal.",
    remedy: "Request the answer again against the drawing as ingested — a citation must name an entity that exists in it.",
  },
  {
    code: "MALFORMED",
    message: "The model's answer is not in the shape a proposal takes, so it was not accepted.",
    remedy: "Request the answer again — an answer that cannot be read as a proposal is never guessed at.",
  },
];

const UNSOURCED = "UNSOURCED";

/** The register, read as a record so a code the tree lacks today is a finding rather than a type error. */
const register: Readonly<Record<string, RefusalEntry | undefined>> = REFUSALS;

/** The modules this increment's interfaces name, and the one that must read the register. */
const PROPOSAL_MODULE = "src/core/model/proposal.ts";
const SOURCES_MODULE = "src/core/model/sources.ts";

/** L-CAD-02's closed scheme set, verbatim — the thing that defines it, so the total is its to pin. */
const SOURCE_SCHEMES = ["DXF_HANDLE", "PDF_OBJECT", "RASTER_TRACE"];

/** The Q-07 scan, loaded by path so the boundary rules read no tests/ specifier from src/. */
const SCAN = "tests/refusal-register/scan.ts";

type Scan = {
  scanRefusals(root: string): Promise<{ orphans: { code: string; file: string }[]; unwired: { code: string; file: string }[] }>;
  isExecutedTest(file: string): boolean;
};

/** The keys inc-113b's ModelAnswer carries — untouched by this increment (AC-2). */
const MODEL_ANSWER_KEYS = ["attributedCost", "callId", "inputTokens", "modelId", "outcome", "outputTokens", "payload", "requestHash", "transport"];

/** The keys a Proposal carries, and nothing else (L-AI-02). */
const PROPOSAL_KEYS = ["callId", "kind", "model", "payload", "sources"];

const shown = (findings: ReadonlyArray<{ code: string; file: string }>): string => (findings.length === 0 ? "none" : findings.map((f) => `${f.code} in ${f.file}`).join(", "));

afterAll(() => {
  dropFixtureRoots();
});

describe("AC-1: the three resolution refusals are registered and read from the register", () => {
  test("AC-1: REFUSALS holds UNSOURCED, SOURCE_UNRESOLVED and MALFORMED — error, inline, with the fixed copy", () => {
    for (const { code, message, remedy } of RESOLUTION_REFUSALS) {
      const entry = register[code];
      expect(entry, `src/core/errors.ts registers no ${code} (L-AI-02, R-SPINE-062)`).toBeDefined();
      expect(entry?.code, `${code}'s entry names its own key`).toBe(code);
      expect(entry?.severity, `${code} is refused and needs correction`).toBe("error");
      expect(entry?.surface, `${code} renders inline`).toBe("inline");
      expect(entry?.message, `${code}'s message is the copy this increment fixes, byte for byte`).toBe(message);
      expect(entry?.remedy, `${code}'s remedy is the copy this increment fixes, byte for byte`).toBe(remedy);
      expect(entry?.message.includes(code), "the code never appears inside the message (refusal-state § 3)").toBe(false);
      expect(entry?.remedy.includes(code), "the code never appears inside the remedy (refusal-state § 3)").toBe(false);
    }
  });

  test("AC-1: proposal.ts and sources.ts exist, the seam's directory spells no registered code unwired and no orphan, and this executed lane names the codes (Q-07)", async () => {
    for (const module of [PROPOSAL_MODULE, SOURCES_MODULE]) {
      expect(existsSync(join(REPO_ROOT, module)), `${module} is missing — the increment's interfaces name it`).toBe(true);
    }
    const scan = (await import(join(REPO_ROOT, SCAN))) as Scan;
    expect(scan.isExecutedTest(fileURLToPath(import.meta.url)), "vitest.config.ts collects this file — a name in a lane nothing runs exercises nothing").toBe(true);
    expect(RESOLUTION_REFUSALS.map((entry) => entry.code), "the three codes are named here as string literals").toEqual(["UNSOURCED", "SOURCE_UNRESOLVED", "MALFORMED"]);
    const { unwired, orphans } = await scan.scanRefusals(join(REPO_ROOT, SEAM_DIR));
    expect(
      unwired,
      `a registered code is spelled as a bare literal by a seam file that does not read src/core/errors: ${shown(unwired)} — read it as REFUSALS.<CODE>.code (Q-07 "spelled but not wired")`,
    ).toEqual([]);
    expect(
      orphans,
      `a refusal-shaped name the register lacks and no vocabulary declares is spelled in the seam: ${shown(orphans)} — declare it once in src/core/errors/transport-vocabulary.ts if it is a source-key scheme (L-CAD-02, Q-07)`,
    ).toEqual([]);
  });
});

describe("AC-2: propose answers exactly a Proposal over the fixture transport", () => {
  test("AC-2: the WIRE scenario resolves to { kind, payload, sources, model, callId } and one proposed row, reaching no fetch", async () => {
    const PROPOSAL_KIND = await proposalMember("PROPOSAL_KIND");
    expect(typeof PROPOSAL_KIND, "PROPOSAL_KIND is a symbol value, so a Proposal is nothing JSON can carry").toBe("symbol");
    const { resolver } = await spiedResolver(ARTIFACT_DIGEST, [KEY_1F]);
    const decode = acceptingDecoder();
    const staged = await stageWire(wire([KEY_1F]), "wire");

    const proposal = await staged.propose(staged.ctx, staged.request, { artifact: resolver, decode });

    expect(Object.keys(proposal).sort(), "a Proposal's own enumerable keys are exactly kind, payload, sources, model, callId").toEqual(PROPOSAL_KEYS);
    expect(proposal.kind, "kind is the barrel's PROPOSAL_KIND").toBe(PROPOSAL_KIND);
    expect(decode.mock.calls.length, "the caller's decoder read the payload once").toBe(1);
    const answered = decode.mock.results[0]?.value as DecodeShape;
    expect(answered.ok, "the decoder accepted the payload").toBe(true);
    expect(proposal.payload, "payload is what the decoder answered").toEqual(answered.ok ? answered.value : undefined);
    expect(proposal.payload, "which for the WIRE scenario is the wire's inner payload").toEqual(wirePayload());
    expect(proposal.sources, "sources are the wire's keys, resolved").toEqual([KEY_1F]);
    expect(proposal.model, "model is the request's pinned id").toBe(staged.request.modelId);

    expect(staged.record.mock.calls.length, "the ledger recorded exactly one row").toBe(1);
    expect(staged.record.mock.calls[0]?.[0], "the row: proposed, no refusal code, the fixture's tokens and their cost").toEqual(proposedRow(staged));
    const [callId] = await answeredCallIds(staged.record);
    expect(proposal.callId, "callId is the id the ledger answered").toBe(callId);
    expect(staged.fetch.mock.calls.length, "the injected fetch was never reached").toBe(0);
  });

  test("AC-2: the barrel exports the proposal surface; callModel keeps two parameters and ModelAnswer its shape", async () => {
    const loaded = await proposalBarrel();
    expect(typeof loaded.propose, "src/core/model/index.ts exports propose").toBe("function");
    expect(loaded.propose?.length, "propose(ctx, request, contract) takes three parameters").toBe(3);
    expect(typeof loaded.PROPOSAL_KIND, "src/core/model/index.ts exports PROPOSAL_KIND").toBe("symbol");
    expect(typeof loaded.resolveProposal, "src/core/model/index.ts exports resolveProposal").toBe("function");
    expect(typeof loaded.parseSourceKey, "src/core/model/index.ts exports parseSourceKey").toBe("function");
    expect(typeof loaded.sourceKeyResolver, "src/core/model/index.ts exports sourceKeyResolver").toBe("function");
    expect(loaded.SOURCE_SCHEMES, "SOURCE_SCHEMES is L-CAD-02's closed scheme set, in its order").toEqual(SOURCE_SCHEMES);

    const sourceKeyResolver = await proposalMember("sourceKeyResolver");
    const resolver = sourceKeyResolver(ARTIFACT_DIGEST, [KEY_1F]);
    expect(resolver.artifactDigest, "the resolver carries the digest it was built for").toBe(ARTIFACT_DIGEST);
    expect(resolver.has(KEY_1F), "membership is by exact string").toBe(true);
    expect(resolver.has(KEY_2A), "a key it was not given is not a member").toBe(false);

    const callModel = await member("callModel");
    expect(callModel.length, "callModel(ctx, request) is untouched (inc-113b)").toBe(2);
    const staged = await stageWire(wire([KEY_1F]), "answer");
    expect(staged.seam.callModel.length, "the seam's callModel is untouched too").toBe(2);
    const answer = await staged.seam.callModel(staged.ctx, staged.request);
    expect(Object.keys(answer).sort(), "ModelAnswer's shape is inc-113b's").toEqual(MODEL_ANSWER_KEYS);
    expect(answer.payload, "callModel still hands the transport's payload through as it was carried").toEqual(wire([KEY_1F]));
    expect(answer.outcome).toBe(OUTCOME_PROPOSED);
  });
});

describe("AC-3: an answer that cites nothing is refused UNSOURCED, after its row", () => {
  test("AC-3: wire sources [] rejects UNSOURCED with callId and requestHash; one refused row keeps the tokens and is written before the caller hears", async () => {
    const gated = gatedLedger();
    const { resolver } = await spiedResolver(ARTIFACT_DIGEST, [KEY_1F]);
    const decode = acceptingDecoder();
    const staged = await stageWire(wire([]), "unsourced", gated);

    const pending = rejectionOf(staged.propose(staged.ctx, staged.request, { artifact: resolver, decode }));
    await vi.waitFor(() => expect(gated.record.mock.calls.length, "the refused row reaches the ledger").toBe(1));
    const STILL_PENDING = Symbol("still pending");
    expect(await Promise.race([pending, Promise.resolve(STILL_PENDING)]), "the refusal has not reached the caller while the ledger still holds its row — record, then answer").toBe(STILL_PENDING);
    gated.open();

    const reason = await pending;
    expect(reason, "propose over an unsourced answer must reject").not.toBe(RESOLVED);
    expect(refusalCodeOf(reason), "the rejection carries the UNSOURCED marker").toBe(UNSOURCED);
    const detail = reason as { callId?: unknown; requestHash?: unknown };
    expect(detail.requestHash, "the detail names the request hash").toBe(staged.hash);
    const [callId] = await answeredCallIds(gated.record);
    expect(detail.callId, "the detail names the call id the ledger answered").toBe(callId);

    expect(gated.record.mock.calls.length, "exactly one row").toBe(1);
    const row = gated.record.mock.calls[0]?.[0];
    expect(row, "the row: refused, UNSOURCED, the tokens the transport reported and the cost for them").toEqual(refusedRow(staged, UNSOURCED));
    expect(row?.outcome).toBe(OUTCOME_REFUSED);
    expect(row?.attributedCost, "the model answered, so the cost is attributed — not zero").toBe(modelCallCost(PROPOSAL_MODEL_ID, INPUT_TOKENS, OUTPUT_TOKENS));
    expect(row?.attributedCost).not.toBe("0");
    expect(staged.fetch.mock.calls.length, "no network").toBe(0);
  });
});
