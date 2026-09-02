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
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test, vi } from "vitest";
import { REFUSALS, type RefusalEntry } from "../../errors";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { MODEL_IDS, modelCallCost } from "../../model-ledger.types";
import {
  BARREL,
  REPO_ROOT,
  RESOLVED,
  SEAM_DIR,
  answeredCallIds,
  barrel,
  context,
  member,
  memoryLedger,
  rejectionOf,
  silentFetch,
  type Context,
  type Fixture,
  type JsonValue,
  type Ledger,
  type LedgerRow,
  type Request,
  type Seam,
} from "./support/seam";

/* ------------------------------------------------------------------ *
 * The barrel's proposal surface, read as loose local shapes so this file typechecks against
 * today's tree and grades tomorrow's. `Barrel` in ./support/seam.ts is inc-113b's and is not owned
 * here: the proposal members are read off the same loaded barrel through the wider shape below.
 * ------------------------------------------------------------------ */

/** A caller's resolver as the contract sees it: an artifact digest and a membership question. */
type ResolverShape = { readonly artifactDigest: string; has(key: string): boolean };

/** What the caller's typed decoder answers — a value, or a detail; never a throw (ARCH-03). */
type DecodeShape = { ok: true; value: unknown } | { ok: false; detail: string };

/** The contract handed to propose: where the sources are resolved, and how the payload is read. */
type ContractShape = { artifact: ResolverShape; decode(payload: JsonValue): DecodeShape };

/** A Proposal as this acceptance reads it — every member loose, so the shape itself is what is graded. */
type ProposalShape = { kind: symbol; payload: unknown; sources: readonly string[]; model: string; callId: string };

type Propose = (ctx: Context, request: Request, contract: ContractShape) => Promise<ProposalShape>;

/** inc-113b's seam, plus the member this increment owes it. */
type ProposalSeam = Seam & { propose?: Propose };

/** The barrel's proposal surface — every member optional, so absence is a finding. */
type ProposalBarrel = {
  propose?: Propose;
  PROPOSAL_KIND?: symbol;
  resolveProposal?: (payload: JsonValue, contract: ContractShape) => unknown;
  SOURCE_SCHEMES?: readonly string[];
  parseSourceKey?: (text: string) => string | null;
  sourceKeyResolver?: (artifactDigest: string, keys: Iterable<string>) => ResolverShape;
};

/** The barrel, read through the proposal surface. */
async function proposalBarrel(): Promise<ProposalBarrel> {
  return (await barrel()) as unknown as ProposalBarrel;
}

/** A member of the proposal surface, asserted present before it is used. */
async function proposalMember<K extends keyof ProposalBarrel>(name: K): Promise<NonNullable<ProposalBarrel[K]>> {
  const loaded = await proposalBarrel();
  const value = loaded[name];
  expect(value, `${BARREL} does not export ${name} (L-AI-02)`).toBeDefined();
  return value as NonNullable<ProposalBarrel[K]>;
}

/* ------------------------------------------------------------------ *
 * The WIRE scenario's literals, as the test contract spells them.
 * ------------------------------------------------------------------ */

const KEY_1F = "DXF_HANDLE:1F";
const KEY_2A = "DXF_HANDLE:2A";
const ARTIFACT_DIGEST = "sha256:artifact-1";
const INPUT_TOKENS = 12;
const OUTPUT_TOKENS = 7;
/** The pinned id every scenario here requests — the first of the closed const (AS-05). */
const PROPOSAL_MODEL_ID = MODEL_IDS[0];
const TRANSPORT_FIXTURE = "fixture";
const OUTCOME_PROPOSED = "proposed";
const OUTCOME_REFUSED = "refused";

/** The WIRE scenario's inner payload, fresh each time so no test can alias another's. */
function wirePayload(): JsonValue {
  return { sheet: "A-101" };
}

/** The wire shape the spec fixes — `{ payload, sources }` — for scenarios that vary only the members. */
function wire(sources: JsonValue[], payload: JsonValue = wirePayload()): JsonValue {
  return { payload, sources };
}

/* ------------------------------------------------------------------ *
 * Staging: one fixture, one seam, one scenario.
 * ------------------------------------------------------------------ */

const roots: string[] = [];

/** A private fixture root for one seam. */
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cubit-proposal-fixtures-"));
  roots.push(root);
  return root;
}

/** Every root minted so far, removed; call from afterAll. */
function dropFixtureRoots(): void {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** A request pinned to the first closed id; `salt` keeps two scenarios' hashes apart. */
function proposalRequest(salt: string): Request {
  return {
    modelId: PROPOSAL_MODEL_ID,
    system: `You read a drawing sheet and answer as a proposal. (${salt})`,
    messages: [{ role: "user", content: "Which sheet does this title block name?" }],
    params: { temperature: 0 },
  };
}

/** A ledger mock and the memory ledger over it — memoryLedger's own shape, so a gated one fits too. */
type LedgerMock = { ledger: Ledger; record: ReturnType<typeof memoryLedger>["record"] };

/**
 * A ledger that takes every row and answers a fresh call id — but only once `open()` is called, so
 * a test can see whether the seam waits for its row before answering the caller.
 */
function gatedLedger(): LedgerMock & { open(): void } {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const record = vi.fn<(row: LedgerRow) => Promise<{ callId: string }>>(async () => {
    await gate;
    return { callId: randomUUID() };
  });
  return { ledger: { record }, record, open: () => release?.() };
}

/** One staged scenario: the seam, its propose, what it was built over, and the request it will be asked. */
type Staged = {
  seam: ProposalSeam;
  propose: Propose;
  fetch: ReturnType<typeof silentFetch>;
  record: LedgerMock["record"];
  ctx: Context;
  request: Request;
  hash: string;
  fixture: Fixture;
};

/**
 * A fixture answering `wireAnswer` for one fresh request, written where the fixture transport looks
 * for it, and a seam over that root — silent fetch, memory ledger (or the one handed in) — whose
 * `propose` is asserted present before anything is asked of it.
 */
async function stageWire(wireAnswer: JsonValue, salt: string, ledger: LedgerMock = memoryLedger()): Promise<Staged> {
  const requestHash = await member("requestHash");
  const createModelSeam = await member("createModelSeam");
  const root = fixtureRoot();
  const request = proposalRequest(salt);
  const hash = requestHash(request);
  const fixture: Fixture = { requestHash: hash, modelId: request.modelId, payload: wireAnswer, inputTokens: INPUT_TOKENS, outputTokens: OUTPUT_TOKENS };
  writeFileSync(join(root, `${hash}.json`), JSON.stringify(fixture));
  const fetch = silentFetch();
  const seam = createModelSeam({ env: { NODE_ENV: "test", CUBIT_MODEL_FIXTURE_ROOT: root }, fetch, ledger: ledger.ledger }) as ProposalSeam;
  expect(typeof seam.propose, "the seam createModelSeam answers has no propose(ctx, request, contract) — L-AI-02's contract is not on the seam").toBe("function");
  const propose = seam.propose as Propose;
  return { seam, propose, fetch, record: ledger.record, ctx: context(), request, hash, fixture };
}

/**
 * A resolver over the product's own `sourceKeyResolver`, with `has` spied so a test can say whether
 * membership was asked at all — the shape the contract names is a digest and a question, so a plain
 * object over the product's answers is the contract's own resolver.
 */
async function spiedResolver(artifactDigest: string, keys: readonly string[]): Promise<{ resolver: ResolverShape; has: ReturnType<typeof vi.fn<(key: string) => boolean>> }> {
  const sourceKeyResolver = await proposalMember("sourceKeyResolver");
  const inner = sourceKeyResolver(artifactDigest, keys);
  const has = vi.fn<(key: string) => boolean>((key) => inner.has(key));
  return { resolver: { artifactDigest: inner.artifactDigest, has }, has };
}

/** The test contract's decoder: `(p) => ({ ok: true, value: p })`, spied. */
function acceptingDecoder(): ReturnType<typeof vi.fn<(payload: JsonValue) => DecodeShape>> {
  return vi.fn<(payload: JsonValue) => DecodeShape>((payload) => ({ ok: true, value: payload }));
}

/* ------------------------------------------------------------------ *
 * The rows the seam owes.
 * ------------------------------------------------------------------ */

function attribution(staged: Staged): Pick<LedgerRow, "tenantId" | "projectId" | "modelId" | "requestHash" | "transport"> {
  return { tenantId: staged.ctx.tenantId, projectId: staged.ctx.projectId, modelId: staged.request.modelId, requestHash: staged.hash, transport: TRANSPORT_FIXTURE };
}

/** The proposed row: the fixture's tokens and the cost derived for them. */
function proposedRow(staged: Staged): LedgerRow {
  return {
    ...attribution(staged),
    outcome: OUTCOME_PROPOSED,
    refusalCode: null,
    inputTokens: INPUT_TOKENS,
    outputTokens: OUTPUT_TOKENS,
    attributedCost: modelCallCost(PROPOSAL_MODEL_ID, INPUT_TOKENS, OUTPUT_TOKENS),
  };
}

/**
 * The row a resolution refusal owes: the model answered, so the tokens the transport reported and
 * the cost derived for them stay on the row — unlike a transport refusal, where nothing was spent.
 */
function refusedRow(staged: Staged, refusalCode: string): LedgerRow {
  return {
    ...attribution(staged),
    outcome: OUTCOME_REFUSED,
    refusalCode,
    inputTokens: INPUT_TOKENS,
    outputTokens: OUTPUT_TOKENS,
    attributedCost: modelCallCost(PROPOSAL_MODEL_ID, INPUT_TOKENS, OUTPUT_TOKENS),
  };
}

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
