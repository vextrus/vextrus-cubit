/**
 * Public acceptance for AC-1 of the model seam's debt sweep (L-AI-01, B-17, ARCH-02, Q-17): the
 * seam's guards have one home each and name what they reject.
 *
 * Every expected message is DERIVED from the home that owns it — `modelCallCost` is asked what it
 * throws for the same figure, and the rejection `callModel` answers with is compared byte for byte
 * — so nothing here transcribes a sentence the Builder could re-spell (B-19). The seam under test is
 * built by `createModelSeam` over an env record, an injected fetch and a memory ledger, exactly as
 * `callmodel.acceptance.test.ts` builds it; the fetch records every body it is posted.
 *
 * `isTokenCount` is read off the module namespace rather than imported by name: a named import of
 * an export the tree lacks today would be a type error in this file, and a missing export is the
 * finding, not a defect of the acceptance.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { refusalCodeOf } from "../../faults/refusal-marker";
import * as ledgerTypes from "../../model-ledger.types";
import { MODEL_IDS, MODEL_RATES, modelCallCost } from "../../model-ledger.types";
import { RESOLVED, context, member, memoryLedger, rejectionOf, silentFetch, type Request } from "./support/seam";

const FIXTURE_MISSING = "FIXTURE_MISSING";
const NOT_FINITE = "is not a finite number";
const CONSEQUENCE_HOME = "consequence";
const DEFAULT_MAX_TOKENS = 1024;

/** The figures a token count can never be: a fraction, a negative, a string that spells a number. */
const NOT_TOKEN_COUNTS: readonly unknown[] = [1.5, -1, "7"];

/** The three non-finite doubles JSON cannot spell, so a hash over them would lie rather than complain. */
const NOT_FINITE_NUMBERS: readonly number[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

/** Anything that looks like an absolute path: a slash-led segment followed by another slash. */
const ABSOLUTE_PATH = /\/[^\s/'"]+\/[^\s'"]*/;

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cubit-model-guards-"));
  roots.push(root);
  return root;
}

function sampleRequest(): Request {
  return {
    modelId: MODEL_IDS[0],
    system: "You read a bill of quantities.",
    messages: [{ role: "user", content: "Classify the line: RCC M25 in footing." }],
    params: { temperature: 0, max_tokens: 256 },
  };
}

/** The value a synchronous call threw, or RESOLVED — no catch clause, so ARCH-03's lint has nothing to read. */
function thrownBy(call: () => unknown): Promise<unknown> {
  return rejectionOf(Promise.resolve().then(call));
}

/** The message of the failure a call threw, asserted to be a plain Error. */
async function messageOf(call: () => unknown, what: string): Promise<string> {
  const thrown = await thrownBy(call);
  expect(thrown, `${what} must throw`).not.toBe(RESOLVED);
  expect(thrown, `${what} throws an Error`).toBeInstanceOf(Error);
  return (thrown as Error).message;
}

async function fixtureSeam(root: string) {
  const createModelSeam = await member("createModelSeam");
  const fetch = silentFetch();
  const { ledger, record } = memoryLedger();
  const seam = createModelSeam({ env: { NODE_ENV: "test", CUBIT_MODEL_FIXTURE_ROOT: root }, fetch, ledger });
  return { seam, fetch, record };
}

/** A provider body as the live transport reads one: content, and a usage that counts (or fails to count) tokens. */
function providerBody(inputTokens: unknown, outputTokens: unknown): string {
  return JSON.stringify({ content: [{ type: "text", text: "Concrete." }], usage: { input_tokens: inputTokens, output_tokens: outputTokens } });
}

/** A seam over the live transport, whose fetch answers `body` and remembers every request it was posted. */
async function liveSeam(body: () => string) {
  const createModelSeam = await member("createModelSeam");
  const posted: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    posted.push(JSON.parse(String(init?.body)));
    return new Response(body(), { status: 200, headers: { "content-type": "application/json" } });
  };
  const { ledger, record } = memoryLedger();
  const seam = createModelSeam({ env: { NODE_ENV: "production", ANTHROPIC_API_KEY: "acceptance-key" }, fetch, ledger });
  expect(seam.transport, "an env with no fixture root and no test mode selects the live transport (B-23)").toBe("live");
  return { seam, posted, record };
}

/** The plain rejection `callModel` answers, checked against the message the money derivation owns. */
async function expectPlainRejection(rejection: unknown, expected: string, what: string): Promise<void> {
  expect(rejection, `${what}: callModel must reject`).not.toBe(RESOLVED);
  expect(rejection, `${what}: the rejection is an Error`).toBeInstanceOf(Error);
  expect(refusalCodeOf(rejection), `${what}: a token count that is not one is a plain failure, never a refusal`).toBeNull();
  expect((rejection as Error).message, `${what}: the message is byte-identical to modelCallCost's own`).toBe(expected);
}

describe("AC-1: the token-count judgement has one home", () => {
  test("AC-1: isTokenCount is exported from model-ledger.types and answers true only for a safe non-negative integer", () => {
    const isTokenCount = (ledgerTypes as Record<string, unknown>)["isTokenCount"];
    expect(typeof isTokenCount, "src/core/model-ledger.types.ts must export isTokenCount (B-17: one judgement, one home)").toBe("function");
    const judge = isTokenCount as (value: unknown) => boolean;
    for (const count of [0, 1, 123, Number.MAX_SAFE_INTEGER]) expect(judge(count), `${count} is a token count`).toBe(true);
    for (const figure of [...NOT_TOKEN_COUNTS, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined, 0.5]) {
      expect(judge(figure), `${String(figure)} is not a token count`).toBe(false);
    }
  });

  test("AC-1: a fixture whose token figure is not a count makes callModel fail exactly as modelCallCost does — no fetch, no row", async () => {
    const requestHash = await member("requestHash");
    for (const figure of NOT_TOKEN_COUNTS) {
      const root = fixtureRoot();
      const request = sampleRequest();
      const hash = requestHash(request);
      writeFileSync(join(root, `${hash}.json`), JSON.stringify({ requestHash: hash, modelId: request.modelId, payload: { verdict: "Concrete" }, inputTokens: figure, outputTokens: 0 }));
      const { seam, fetch, record } = await fixtureSeam(root);
      const what = `fixture inputTokens ${JSON.stringify(figure)}`;

      const expected = await messageOf(() => modelCallCost(MODEL_IDS[0], figure as number, 0), `modelCallCost over ${what}`);
      const rejection = await rejectionOf(seam.callModel(context(), request));
      await expectPlainRejection(rejection, expected, what);
      expect(fetch.mock.calls.length, `${what}: the fixture transport reaches no fetch`).toBe(0);
      expect(record.mock.calls.length, `${what}: no ledger row is recorded for a call whose spend cannot be counted`).toBe(0);
    }
  });

  test("AC-1: a live body whose usage is not a count fails as modelCallCost does, and max_tokens is posted as given or as the 1024 default", async () => {
    for (const figure of NOT_TOKEN_COUNTS) {
      const { seam, record } = await liveSeam(() => providerBody(figure, 0));
      const what = `live input_tokens ${JSON.stringify(figure)}`;
      const expected = await messageOf(() => modelCallCost(MODEL_IDS[0], figure as number, 0), `modelCallCost over ${what}`);
      const rejection = await rejectionOf(seam.callModel(context(), sampleRequest()));
      await expectPlainRejection(rejection, expected, what);
      expect(record.mock.calls.length, `${what}: no ledger row for a call whose spend cannot be counted`).toBe(0);
    }

    const { seam, posted } = await liveSeam(() => providerBody(3, 4));
    const base = sampleRequest();
    const { params: _dropped, ...withoutParams } = base;
    void _dropped;
    const variants: { what: string; request: Request; expected: number }[] = [
      { what: "params absent", request: withoutParams, expected: DEFAULT_MAX_TOKENS },
      { what: "params without max_tokens", request: { ...withoutParams, params: { temperature: 0 } }, expected: DEFAULT_MAX_TOKENS },
      { what: "max_tokens: null", request: { ...withoutParams, params: { temperature: 0, max_tokens: null } }, expected: DEFAULT_MAX_TOKENS },
      { what: "max_tokens: 77", request: { ...withoutParams, params: { temperature: 0, max_tokens: 77 } }, expected: 77 },
    ];
    for (const [index, variant] of variants.entries()) {
      const answer = await seam.callModel(context(), variant.request);
      expect(answer.outcome, `${variant.what}: a counted body is answered`).toBe("proposed");
      const body = posted[index] as { max_tokens?: unknown };
      expect(body.max_tokens, `${variant.what}: the posted max_tokens`).toBe(variant.expected);
    }
  });
});

describe("AC-1: the rates cannot be reassigned", () => {
  test("AC-1: MODEL_RATES and every rate in it are frozen, and a strict-mode assignment throws a TypeError", async () => {
    expect(Object.isFrozen(MODEL_RATES), "MODEL_RATES is frozen").toBe(true);
    for (const modelId of MODEL_IDS) {
      expect(Object.isFrozen(MODEL_RATES[modelId]), `the rate for ${modelId} is frozen`).toBe(true);
    }
    const rates = MODEL_RATES as unknown as Record<string, Record<string, string>>;
    const first = MODEL_IDS[0];
    const reassigned = await thrownBy(() => {
      rates[first] = { inputPerMillionTokens: "0", outputPerMillionTokens: "0" };
    });
    expect(reassigned, "assigning a rate throws").toBeInstanceOf(TypeError);
    const edited = await thrownBy(() => {
      rates[first]!["inputPerMillionTokens"] = "0";
    });
    expect(edited, "assigning a field of a rate throws").toBeInstanceOf(TypeError);
    expect(modelCallCost(first, 1_000_000, 0), "the rate still reads as pinned after the refused writes").toBe(MODEL_RATES[first].inputPerMillionTokens);
  });
});

describe("AC-1: a non-finite figure is refused by name before it is hashed", () => {
  test("AC-1: canonicalJson and requestHash throw `is not a finite number` for NaN and the infinities at any depth", async () => {
    const canonicalJson = await member("canonicalJson");
    const requestHash = await member("requestHash");
    for (const figure of NOT_FINITE_NUMBERS) {
      const label = String(figure);
      const shallow = await messageOf(() => canonicalJson({ a: figure }), `canonicalJson over { a: ${label} }`);
      expect(shallow, `canonicalJson names the figure (${label})`).toContain(NOT_FINITE);
      expect(shallow, `the failure is canonical.ts's own, not the consequence digest's (${label})`).not.toContain(CONSEQUENCE_HOME);

      const deep = await messageOf(() => canonicalJson({ a: [1, { b: [{ c: figure }] }] }), `canonicalJson over a nested ${label}`);
      expect(deep, `a nested figure is named too (${label})`).toContain(NOT_FINITE);

      const hashed = await messageOf(() => requestHash({ ...sampleRequest(), params: { temperature: 0, nested: { deep: [figure] } } }), `requestHash over params holding ${label}`);
      expect(hashed, `requestHash names the figure (${label})`).toContain(NOT_FINITE);
      expect(hashed, `requestHash's failure is not the consequence digest's (${label})`).not.toContain(CONSEQUENCE_HOME);
    }
  });

  test("AC-1: callModel over such a request rejects the same way — no transport reached, no row recorded", async () => {
    for (const figure of NOT_FINITE_NUMBERS) {
      const label = String(figure);
      const { seam, fetch, record } = await fixtureSeam(fixtureRoot());
      const request: Request = { ...sampleRequest(), params: { temperature: 0, nested: { deep: [figure] } } };
      const rejection = await rejectionOf(seam.callModel(context(), request));
      expect(rejection, `callModel over params holding ${label} must reject`).not.toBe(RESOLVED);
      expect(rejection, `the rejection is an Error (${label})`).toBeInstanceOf(Error);
      expect(refusalCodeOf(rejection), `a non-finite figure is a plain failure, never a refusal (${label})`).toBeNull();
      expect((rejection as Error).message, `the message names the figure (${label})`).toContain(NOT_FINITE);
      expect(fetch.mock.calls.length, `no transport is reached (${label})`).toBe(0);
      expect(record.mock.calls.length, `no row is recorded (${label})`).toBe(0);
    }
  });
});

describe("AC-1: FIXTURE_MISSING names the hash, never the root", () => {
  test("AC-1: the FIXTURE_MISSING rejection carries the marker, names the request hash, and spells no fixture root or absolute path", async () => {
    const requestHash = await member("requestHash");
    const root = fixtureRoot();
    const request = sampleRequest();
    const hash = requestHash(request);
    const { seam, fetch, record } = await fixtureSeam(root);

    const rejection = await rejectionOf(seam.callModel(context(), request));
    expect(rejection, "callModel without a fixture must reject").not.toBe(RESOLVED);
    expect(refusalCodeOf(rejection), "the rejection carries the FIXTURE_MISSING marker").toBe(FIXTURE_MISSING);
    const message = (rejection as Error).message;
    expect(message, "the message names the request hash").toContain(hash);
    expect(message, "the message never spells the fixture root").not.toContain(root);
    expect(message, "the message never spells the temp directory the root lives under").not.toContain(tmpdir());
    expect(message, "the message holds no absolute path at all").not.toMatch(ABSOLUTE_PATH);

    expect(fetch.mock.calls.length, "a missing fixture is never a network call").toBe(0);
    expect(record.mock.calls.length, "the refusal is recorded exactly once").toBe(1);
    expect(record.mock.calls[0]?.[0], "the refused row is unchanged: the code, zero tokens, cost 0").toMatchObject({
      requestHash: hash,
      outcome: "refused",
      refusalCode: FIXTURE_MISSING,
      inputTokens: 0,
      outputTokens: 0,
      attributedCost: modelCallCost(MODEL_IDS[0], 0, 0),
    });
  });
});
