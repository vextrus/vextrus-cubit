/**
 * The seam's fault paths (B-21, ARCH-03), which no acceptance file grades: a caller whose `decode`
 * or `artifact.has` throws is a defect against the contract, never a refusal, so the call is still
 * recorded, the defect crosses the one fault seam under the entry's own route, and the caller hears
 * its own throw; a ledger that cannot take a proposed row is itself a fault under that same route;
 * and the operator's message clips each model-supplied fact while the refusal's detail keeps it
 * whole. The routes are read off the fault records, so a regression to one shared route reds here.
 *
 * The fault sink is swapped for a capturing one and put back after every test (never silenced), and
 * every fixture is minted under a mkdtemp root handed in through CUBIT_MODEL_FIXTURE_ROOT (Q-08).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setFaultSink, type FaultRecord, type FaultSink } from "../../faults/report";
import { refusalCodeOf } from "../../faults/refusal-marker";
import { MODEL_IDS, modelCallCost } from "../../model-ledger.types";
import { RESOLVED, context, member, memoryLedger, rejectionOf, silentFetch, type Context, type Fixture, type JsonValue, type Ledger, type LedgerRow, type Request, type Seam } from "./support/seam";

/** A caller's resolver as the contract sees it — the loose local shape proposal.acceptance.test.ts reads. */
type ResolverShape = { readonly artifactDigest: string; has(key: string): boolean };

type DecodeShape = { ok: true; value: unknown } | { ok: false; detail: string };

type ContractShape = { artifact: ResolverShape; decode(payload: JsonValue): DecodeShape };

type ProposalShape = { kind: symbol; payload: unknown; sources: readonly string[]; model: string; callId: string };

type ProposeSeam = Seam & { propose?: (ctx: Context, request: Request, contract: ContractShape) => Promise<ProposalShape> };

const KEY_1F = "DXF_HANDLE:1F";
const ARTIFACT_DIGEST = "sha256:artifact-1";
const INPUT_TOKENS = 12;
const OUTPUT_TOKENS = 7;
const MODEL_ID = MODEL_IDS[0];

/** The routes B-21 owes this seam: one per public entry, so a fault names the door it came through. */
const ROUTE_PROPOSE = "model/propose";
const ROUTE_CALL_MODEL = "model/callModel";

/** How much of one model-supplied fact the operator's message carries before it is clipped. */
const FACT_LIMIT = 200;

const roots: string[] = [];
const faults: FaultRecord[] = [];
let previousSink: FaultSink | undefined;

beforeEach(() => {
  faults.length = 0;
  previousSink = setFaultSink((record) => {
    faults.push(record);
  });
});

afterEach(() => {
  if (previousSink !== undefined) setFaultSink(previousSink);
});

afterAll(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function request(salt: string): Request {
  return { modelId: MODEL_ID, system: `You read a drawing sheet and answer as a proposal. (${salt})`, messages: [{ role: "user", content: "Which sheet?" }], params: { temperature: 0 } };
}

/** The wire shape the spec fixes, answering one well-formed, resolvable citation. */
function wire(): JsonValue {
  return { payload: { sheet: "A-101" }, sources: [KEY_1F] };
}

/** A resolver over exactly the key the wire cites. */
function resolver(has: (key: string) => boolean = (key) => key === KEY_1F): ResolverShape {
  return { artifactDigest: ARTIFACT_DIGEST, has };
}

type Staged = { seam: ProposeSeam; ctx: Context; request: Request; hash: string; record: ReturnType<typeof memoryLedger>["record"] };

/** A fixture answering `wire()` for one fresh request, and a seam over that root — the ledger handed in. */
async function stage(salt: string, ledger: { ledger: Ledger; record: ReturnType<typeof memoryLedger>["record"] } = memoryLedger()): Promise<Staged> {
  const requestHash = await member("requestHash");
  const createModelSeam = await member("createModelSeam");
  const root = mkdtempSync(join(tmpdir(), "cubit-proposal-faults-"));
  roots.push(root);
  const asked = request(salt);
  const hash = requestHash(asked);
  const fixture: Fixture = { requestHash: hash, modelId: asked.modelId, payload: wire(), inputTokens: INPUT_TOKENS, outputTokens: OUTPUT_TOKENS };
  writeFileSync(join(root, `${hash}.json`), JSON.stringify(fixture));
  const seam = createModelSeam({ env: { NODE_ENV: "test", CUBIT_MODEL_FIXTURE_ROOT: root }, fetch: silentFetch(), ledger: ledger.ledger }) as ProposeSeam;
  return { seam, ctx: context(), request: asked, hash, record: ledger.record };
}

/** The seam's propose, asserted present before anything is asked of it. */
function proposeOf(staged: Staged): NonNullable<ProposeSeam["propose"]> {
  expect(typeof staged.seam.propose, "the seam has no propose(ctx, request, contract) — L-AI-02's contract is not on the seam").toBe("function");
  return staged.seam.propose as NonNullable<ProposeSeam["propose"]>;
}

/** The one fault the sink was handed, asserted single and attributed to the call that caused it. */
function soleFault(staged: Staged, route: string, what: string): FaultRecord {
  expect(faults.length, `${what}: exactly one fault crossed the seam (ARCH-03)`).toBe(1);
  const fault = faults[0] as FaultRecord;
  expect(fault.route, `${what}: the fault names the entry the caller used, not another entry's route (B-21)`).toBe(route);
  expect(fault.requestId, `${what}: the fault carries the request it happened under`).toBe(staged.ctx.requestId);
  expect(fault.actor, `${what}: the fault carries the actor`).toBe(staged.ctx.actor);
  return fault;
}

/** The row a call whose reading threw still owes: the model proposed, and the tokens it spent are attributed. */
function proposedRow(staged: Staged): LedgerRow {
  return {
    tenantId: staged.ctx.tenantId,
    projectId: staged.ctx.projectId,
    modelId: MODEL_ID,
    requestHash: staged.hash,
    transport: "fixture",
    outcome: "proposed",
    refusalCode: null,
    inputTokens: INPUT_TOKENS,
    outputTokens: OUTPUT_TOKENS,
    attributedCost: modelCallCost(MODEL_ID, INPUT_TOKENS, OUTPUT_TOKENS),
  };
}

describe("a caller's contract that throws is a fault, not a refusal", () => {
  const throwers: ReadonlyArray<{ what: string; contract(thrown: Error): ContractShape }> = [
    { what: "a decoder that throws", contract: (thrown) => ({ artifact: resolver(), decode: () => { throw thrown; } }) },
    {
      what: "a resolver whose has() throws",
      contract: (thrown) => ({
        artifact: resolver(() => {
          throw thrown;
        }),
        decode: (payload) => ({ ok: true, value: payload }),
      }),
    },
  ];

  for (const { what, contract } of throwers) {
    test(`${what} reaches the caller unchanged, having crossed the fault seam under model/propose with its call recorded`, async () => {
      const staged = await stage(what);
      const thrown = new Error(`${what} — a defect against the contract`);

      const reason = await rejectionOf(proposeOf(staged)(staged.ctx, staged.request, contract(thrown)));

      expect(reason, `${what}: propose must reject`).not.toBe(RESOLVED);
      expect(reason, `${what}: the caller hears its own throw, not a wrapping`).toBe(thrown);
      expect(refusalCodeOf(reason), `${what}: a caller-side defect is never a refusal (ARCH-03)`).toBeNull();

      const fault = soleFault(staged, ROUTE_PROPOSE, what);
      expect(fault.cause, `${what}: the operator reads the cause that was thrown`).toContain(thrown.message);

      expect(staged.record.mock.calls.length, `${what}: the transport answered and charged, so the call is recorded exactly once (L-AI-01)`).toBe(1);
      expect(staged.record.mock.calls[0]?.[0], `${what}: the row is what happened at the model — proposed, no refusal code, the tokens it spent`).toEqual(proposedRow(staged));
    });
  }
});

describe("a ledger that cannot take the row is a fault of its own", () => {
  /** A ledger that refuses every write, and the failure it refuses with. */
  function brokenLedger(): { ledger: Ledger; record: ReturnType<typeof memoryLedger>["record"]; failure: Error } {
    const failure = new Error("the model-call ledger is unreachable");
    const record = vi.fn<(row: LedgerRow) => Promise<{ callId: string }>>(async () => {
      throw failure;
    });
    return { ledger: { record }, record, failure };
  }

  test("a proposed row that cannot be written crosses the fault seam under model/propose and reaches the caller", async () => {
    const broken = brokenLedger();
    const staged = await stage("ledger-propose", broken);

    const reason = await rejectionOf(proposeOf(staged)(staged.ctx, staged.request, { artifact: resolver(), decode: (payload) => ({ ok: true, value: payload }) }));

    expect(reason, "a proposal whose row was never written is no recorded call, so it is not answered as one").toBe(broken.failure);
    expect(refusalCodeOf(reason), "a ledger outage is a fault, never a refusal").toBeNull();
    soleFault(staged, ROUTE_PROPOSE, "a failed proposed write");
    expect(broken.record.mock.calls[0]?.[0], "the row the seam tried to write is the proposed one").toEqual(proposedRow(staged));
  });

  test("the same failure under callModel is recorded under model/callModel — each entry has its own route", async () => {
    const broken = brokenLedger();
    const staged = await stage("ledger-callmodel", broken);

    const reason = await rejectionOf(staged.seam.callModel(staged.ctx, staged.request));

    expect(reason, "callModel must reject when its row cannot be written").toBe(broken.failure);
    soleFault(staged, ROUTE_CALL_MODEL, "a failed callModel write");
  });
});

describe("the operator's message clips a model-supplied fact; the refusal keeps it whole", () => {
  test("a decoder detail longer than the limit is clipped in the message and carried whole on the detail", async () => {
    const staged = await stage("clipped");
    const long = "z".repeat(500);
    const quoted = JSON.stringify(long);
    const shortDetail = "not a sheet reading";

    const clipped = await rejectionOf(proposeOf(staged)(staged.ctx, staged.request, { artifact: resolver(), decode: () => ({ ok: false, detail: long }) }));
    const whole = await rejectionOf(proposeOf(staged)(staged.ctx, staged.request, { artifact: resolver(), decode: () => ({ ok: false, detail: shortDetail }) }));

    expect(refusalCodeOf(clipped), "a decoder that will not read the payload is MALFORMED").toBe("MALFORMED");
    const message = (clipped as Error).message;
    expect(message, `the fact is carried to ${FACT_LIMIT} characters and then says how much more there is`).toContain(`reason=${quoted.slice(0, FACT_LIMIT)}… (${quoted.length - FACT_LIMIT} more characters)`);
    expect(message, "the message never amplifies the whole of what a model answered").not.toContain(long);
    expect((clipped as { reason?: unknown }).reason, "the whole of it lives on the refusal's detail").toBe(long);

    expect((whole as Error).message, "a fact inside the limit is carried whole, unclipped").toContain(`reason=${JSON.stringify(shortDetail)}`);
    expect((whole as Error).message, "and says nothing about more characters").not.toContain("more characters)");
    expect(faults.length, "a refused reading is a refusal, so nothing crossed the fault seam").toBe(0);
  });
});
