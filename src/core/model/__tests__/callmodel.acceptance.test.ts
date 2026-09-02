/**
 * Public acceptance for AC-1, AC-2 and AC-3 of the model seam (L-AI-01, AS-05, Q-07): the pinned
 * ids and the canonical hash, deterministic fixture replay through an injected seam, and the
 * FIXTURE_MISSING refusal a missing fixture answers with — never a network call.
 *
 * Every fixture is minted under a mkdtemp root handed in through CUBIT_MODEL_FIXTURE_ROOT, so
 * nothing here commits corpus under fixtures/model (Q-08). The seam under test is built by
 * `createModelSeam` over an env record, an injected fetch and an injected ledger (I-E): the fetch
 * is asserted never reached, the ledger is asserted reached exactly as the criteria say.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { refusalOf, type RefusalCode, type RefusalEntry } from "../../errors";
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
  processEnvReads,
  rejectionOf,
  silentFetch,
  type Fixture,
  type JsonValue,
  type LedgerRow,
  type Request,
} from "./support/seam";

const FIXTURE_MISSING = "FIXTURE_MISSING";
const TRANSPORT_FIXTURE = "fixture";
const OUTCOME_PROPOSED = "proposed";
const OUTCOME_REFUSED = "refused";

/** The refusal-register deferrals, loaded by path so the boundary rules read no tests/ specifier from src/. */
const DEFERRALS = "tests/refusal-register/deferrals.ts";

const SHA256_HEX = /^[0-9a-f]{64}$/;

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A private fixture root for one seam. */
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cubit-model-fixtures-"));
  roots.push(root);
  return root;
}

/** One fixture written where the seam looks for it. */
function writeFixture(root: string, fixture: Fixture): string {
  const file = join(root, `${fixture.requestHash}.json`);
  writeFileSync(file, JSON.stringify(fixture));
  return file;
}

/** A request pinned to the first closed id, with params in one deliberate key order. */
function sampleRequest(): Request {
  return {
    modelId: MODEL_IDS[0],
    system: "You read a bill of quantities.",
    messages: [
      { role: "user", content: "Classify the line: RCC M25 in footing." },
      { role: "assistant", content: "Concrete." },
      { role: "user", content: "And its unit?" },
    ],
    params: { temperature: 0, max_tokens: 256, nested: { b: 2, a: [1, { z: true, y: null }] } },
  };
}

/** A seam under the fixture transport over `root`, with a silent fetch and a memory ledger. */
async function fixtureSeam(root: string) {
  const createModelSeam = await member("createModelSeam");
  const fetch = silentFetch();
  const { ledger, record } = memoryLedger();
  const seam = createModelSeam({ env: { NODE_ENV: "test", CUBIT_MODEL_FIXTURE_ROOT: root }, fetch, ledger });
  return { seam, fetch, record };
}

describe("AC-1: pinned ids and the canonical hash", () => {
  test("AC-1: the barrel re-exports MODEL_IDS as the identical closed const, with canonicalJson and requestHash", async () => {
    const loaded = await barrel();
    expect(loaded.MODEL_IDS, `${BARREL} must re-export the very MODEL_IDS object src/core/model-ledger.types.ts exports (AS-05)`).toBe(MODEL_IDS);
    expect(typeof loaded.canonicalJson, `${BARREL} exports no canonicalJson`).toBe("function");
    expect(typeof loaded.requestHash, `${BARREL} exports no requestHash`).toBe("function");
  });

  test("AC-1: canonicalJson sorts keys by code unit recursively, drops whitespace and undefined, keeps array order", async () => {
    const canonicalJson = await member("canonicalJson");
    expect(canonicalJson({ b: 1, a: [2, { z: 1, y: 2 }, [3, 1]] }), "keys sort recursively; arrays keep their order").toBe('{"a":[2,{"y":2,"z":1},[3,1]],"b":1}');
    expect(canonicalJson({ a: 3, B: 1, _: 2 }), 'keys sort by code unit: "B" (66) before "_" (95) before "a" (97)').toBe('{"B":1,"_":2,"a":3}');
    expect(canonicalJson({ b: 1, a: undefined as unknown as JsonValue }), "an undefined-valued key is omitted").toBe('{"b":1}');
    expect(canonicalJson(["x", null, true, 1.5, "a b"]), "scalars and strings are JSON, with no insignificant whitespace").toBe('["x",null,true,1.5,"a b"]');
  });

  test("AC-1: requestHash is sha256 hex over canonicalJson of (modelId, system, messages, params ?? {})", async () => {
    const canonicalJson = await member("canonicalJson");
    const requestHash = await member("requestHash");
    const request = sampleRequest();
    const hash = requestHash(request);
    expect(hash, "64 lowercase hex characters").toMatch(SHA256_HEX);
    const canonical = canonicalJson({
      modelId: request.modelId,
      system: request.system,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      params: (request.params ?? {}) as JsonValue,
    });
    expect(hash, "the hash is createHash('sha256') over the canonical JSON").toBe(createHash("sha256").update(canonical).digest("hex"));

    const { params: _dropped, ...withoutParams } = request;
    void _dropped;
    const withEmptyParams = { ...withoutParams, params: {} };
    expect(requestHash(withoutParams), "absent params hash as {} (I-C)").toBe(requestHash(withEmptyParams));
  });

  test("AC-1: key order does not change the hash; any one field does", async () => {
    const requestHash = await member("requestHash");
    const base = sampleRequest();
    const reordered: Request = {
      ...base,
      params: { nested: { a: [1, { y: null, z: true }], b: 2 }, max_tokens: 256, temperature: 0 },
    };
    expect(requestHash(reordered), "params that differ only in key order (outer and inner) hash equal").toBe(requestHash(base));

    const [first, second, third] = base.messages as [Request["messages"][number], Request["messages"][number], Request["messages"][number]];
    const variants: Record<string, Request> = {
      modelId: { ...base, modelId: MODEL_IDS[1] },
      system: { ...base, system: `${base.system} ` },
      "message role": { ...base, messages: [first, { ...second, role: "user" }, third] },
      "message content": { ...base, messages: [first, second, { ...third, content: "And its unit? " }] },
      "message order": { ...base, messages: [second, first, third] },
      "param value": { ...base, params: { ...base.params, temperature: 1 } },
    };
    const seen = new Set<string>([requestHash(base)]);
    for (const [field, variant] of Object.entries(variants)) {
      const hash = requestHash(variant);
      expect(hash, `a change to ${field} must change the hash`).toMatch(SHA256_HEX);
      expect(seen.has(hash), `a change to ${field} hashed equal to an earlier request`).toBe(false);
      seen.add(hash);
    }
  });

  test("AC-1: a model id outside MODEL_IDS rejects plainly — no fetch, no ledger row", async () => {
    const { seam, fetch, record } = await fixtureSeam(fixtureRoot());
    const unpinned: Request = { ...sampleRequest(), modelId: "claude-unpinned-0" };
    const rejection = await rejectionOf(seam.callModel(context(), unpinned));
    expect(rejection, "callModel with an unpinned model id must reject").not.toBe(RESOLVED);
    expect(rejection, "the rejection is a plain Error (I-D)").toBeInstanceOf(Error);
    expect(refusalCodeOf(rejection), "an unpinned id is a programming defect, never a refusal").toBeNull();
    expect(fetch.mock.calls.length, "the injected fetch must not be reached").toBe(0);
    expect(record.mock.calls.length, "no ledger row for a call that was never made").toBe(0);
  });
});

describe("AC-2: fixture replay is deterministic", () => {
  test("AC-2: a seam over NODE_ENV=test and CUBIT_MODEL_FIXTURE_ROOT reports the fixture transport", async () => {
    const { seam } = await fixtureSeam(fixtureRoot());
    expect(seam.transport, "createModelSeam probes the env it is handed (B-23)").toBe(TRANSPORT_FIXTURE);
  });

  test("AC-2: the seam reads process.env once, at the composition root, and never as a test flag (TEST_ENV_BRANCH, as arbitrated)", async () => {
    // The arbitrated reading of TEST_ENV_BRANCH for this seam (settled ruling "B-23 (selectTransport)",
    // L-AI-01): comparing the INJECTED env record's NODE_ENV or CUBIT_MODEL_FIXTURE_ROOT is the
    // dependency-injected probe the approved interface spells, and is no finding. What the rule
    // forbids is product code reading the PROCESS's own flags — `process.env.NODE_ENV`, any
    // `process.env.*`, a destructuring or an alias — anywhere in the seam: that would be a hidden
    // test mode verify's green could not vouch for. The exemption is a property, not a file waiver:
    // it holds only while nothing under the seam reads process.env directly, so a later edit that
    // reaches for it re-arms the finding. The one admitted spelling is the composition root's
    // `env: process.env`, handed whole to createModelSeam by the production callModel.
    const reads = processEnvReads(REPO_ROOT);
    const direct = reads.filter((read) => !read.injected);
    expect(
      direct.map((read) => `${read.file}:${read.line} ${read.text}`),
      [
        `TEST_ENV_BRANCH: ${SEAM_DIR} reads the process's own environment directly.`,
        `Per the settled ruling "B-23 (selectTransport)" and L-AI-01, the seam selects its transport by comparing the env record handed to createModelSeam;`,
        `only the composition root may spell process.env, and only as \`env: process.env\`. Route the read through the composition root.`,
      ].join(" "),
    ).toEqual([]);

    const injected = reads.map((read) => `${read.file}:${read.line}`);
    expect(injected, `the production callModel is createModelSeam over process.env — the process environment is handed in exactly once under ${SEAM_DIR}, at the composition root (I-E); found: ${injected.join(", ") || "none"}`).toHaveLength(1);
  });

  test("AC-2: callModel answers the fixture's payload and tokens, records one proposed row, reaches no fetch", async () => {
    const requestHash = await member("requestHash");
    const root = fixtureRoot();
    const request = sampleRequest();
    const hash = requestHash(request);
    const fixture: Fixture = {
      requestHash: hash,
      modelId: request.modelId,
      payload: [{ type: "text", text: "Cubic metre." }, { type: "text", text: "(m3)" }],
      inputTokens: 123,
      outputTokens: 45,
    };
    writeFixture(root, fixture);
    const { seam, fetch, record } = await fixtureSeam(root);
    const ctx = context();

    const answer = await seam.callModel(ctx, request);
    const cost = modelCallCost(MODEL_IDS[0], fixture.inputTokens, fixture.outputTokens);
    expect(answer, "the ModelAnswer replays the fixture").toMatchObject({
      modelId: request.modelId,
      requestHash: hash,
      transport: TRANSPORT_FIXTURE,
      outcome: OUTCOME_PROPOSED,
      inputTokens: fixture.inputTokens,
      outputTokens: fixture.outputTokens,
      attributedCost: cost,
    });
    expect(answer.payload, "payload is deep-equal to the fixture's payload").toEqual(fixture.payload);

    expect(fetch.mock.calls.length, "the injected fetch was called zero times").toBe(0);
    expect(record.mock.calls.length, "the ledger recorded exactly one row").toBe(1);
    const row = record.mock.calls[0]?.[0];
    const expectedRow: LedgerRow = {
      tenantId: ctx.tenantId,
      projectId: ctx.projectId,
      modelId: request.modelId,
      requestHash: hash,
      transport: TRANSPORT_FIXTURE,
      outcome: OUTCOME_PROPOSED,
      refusalCode: null,
      inputTokens: fixture.inputTokens,
      outputTokens: fixture.outputTokens,
      attributedCost: cost,
    };
    expect(row, "the ledger row carries the ctx, the request, the transport, the outcome, the tokens and the cost").toEqual(expectedRow);
    const [callId] = await answeredCallIds(record);
    expect(answer.callId, "the answer's callId is what the ledger answered").toBe(callId);
  });

  test("AC-2: the same request replays to a deep-equal answer and a deep-equal ledger row", async () => {
    const requestHash = await member("requestHash");
    const root = fixtureRoot();
    const request = sampleRequest();
    const hash = requestHash(request);
    writeFixture(root, { requestHash: hash, modelId: request.modelId, payload: { verdict: "Concrete", confidence: 0.9 }, inputTokens: 7, outputTokens: 3 });
    const { seam, fetch, record } = await fixtureSeam(root);
    const ctx = context();

    const first = await seam.callModel(ctx, request);
    const second = await seam.callModel(ctx, request);
    const { callId: firstId, ...firstRest } = first;
    const { callId: secondId, ...secondRest } = second;
    expect(secondRest, "two answers deep-equal apart from callId").toEqual(firstRest);
    const ids = await answeredCallIds(record);
    expect([firstId, secondId], "each answer carries the callId its own ledger record answered").toEqual(ids);

    expect(record.mock.calls.length, "one row per call").toBe(2);
    expect(record.mock.calls[1]?.[0], "two rows deep-equal in every field").toEqual(record.mock.calls[0]?.[0]);
    expect(fetch.mock.calls.length, "still no network").toBe(0);
  });
});

describe("AC-3: a missing fixture is FIXTURE_MISSING, never a network call", () => {
  test("AC-3: callModel refuses FIXTURE_MISSING naming the hash, records one refused row, reaches no fetch", async () => {
    const requestHash = await member("requestHash");
    const root = fixtureRoot();
    const request = sampleRequest();
    const hash = requestHash(request);
    expect(existsSync(join(root, `${hash}.json`)), "the fixture root holds no fixture for this request").toBe(false);
    const { seam, fetch, record } = await fixtureSeam(root);
    const ctx = context();

    const rejection = await rejectionOf(seam.callModel(ctx, request));
    expect(rejection, "callModel without a fixture must reject").not.toBe(RESOLVED);
    expect(refusalCodeOf(rejection), "the rejection carries the FIXTURE_MISSING marker").toBe(FIXTURE_MISSING);
    expect((rejection as { message?: unknown }).message, "the message names the request hash").toContain(hash);

    expect(fetch.mock.calls.length, "a missing fixture is never a network call (L-AI-01)").toBe(0);
    expect(record.mock.calls.length, "the refusal is recorded exactly once").toBe(1);
    const expectedRow: LedgerRow = {
      tenantId: ctx.tenantId,
      projectId: ctx.projectId,
      modelId: request.modelId,
      requestHash: hash,
      transport: TRANSPORT_FIXTURE,
      outcome: OUTCOME_REFUSED,
      refusalCode: FIXTURE_MISSING,
      inputTokens: 0,
      outputTokens: 0,
      attributedCost: "0",
    };
    expect(record.mock.calls[0]?.[0], "the refused row: zero tokens, cost 0, the ctx's tenant and project").toEqual(expectedRow);
  });

  test("AC-3: refusalOf('FIXTURE_MISSING') is registered with the Decision's copy, and not deferred", async () => {
    const entry: RefusalEntry = refusalOf(FIXTURE_MISSING as RefusalCode);
    expect(entry.code).toBe(FIXTURE_MISSING);
    expect(entry.severity).toBe("error");
    expect(entry.surface).toBe("inline");
    expect(entry.message).toBe("No recorded model answer exists for this request, so it was not carried out.");
    expect(entry.remedy).toBe("Record the model's answer for this request, then try it again.");
    expect(entry.message.includes(FIXTURE_MISSING), "the code never appears inside the message (refusal-state § 3)").toBe(false);
    expect(entry.remedy.includes(FIXTURE_MISSING), "the code never appears inside the remedy (refusal-state § 3)").toBe(false);

    const deferralsFile = join(REPO_ROOT, DEFERRALS);
    expect(existsSync(deferralsFile), `${DEFERRALS} is the register's deferral list`).toBe(true);
    const { DEFERRED_CODES } = (await import(deferralsFile)) as { DEFERRED_CODES: Record<string, string> };
    expect(Object.hasOwn(DEFERRED_CODES, FIXTURE_MISSING), "the code is exercised by name in this executed lane, so it is not deferred (Q-07)").toBe(false);
  });
});
