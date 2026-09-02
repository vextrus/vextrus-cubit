/**
 * Shared mechanics for the proposal contract's acceptance (L-AI-02, L-AI-01): the barrel's proposal
 * surface read as loose local shapes (so this file typechecks against today's tree and grades
 * tomorrow's), a fixture-backed seam whose `propose` is asserted present before it is used, and the
 * WIRE scenario's public literals. The held-out set loads this file out of the checkout too, so
 * both lanes stage a scenario the same way.
 *
 * `Barrel` in ./support/seam.ts is inc-113b's and is not owned here: the proposal members are read
 * off the same loaded barrel through the wider shape below (as the increment's spec admits).
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { MODEL_IDS, modelCallCost } from "../../model-ledger.types";
import {
  BARREL,
  barrel,
  context,
  member,
  memoryLedger,
  silentFetch,
  type Context,
  type Fixture,
  type JsonValue,
  type Ledger,
  type LedgerRow,
  type Request,
  type Seam,
} from "./support/seam";

/** A caller's resolver as the contract sees it: an artifact digest and a membership question. */
export type ResolverShape = { readonly artifactDigest: string; has(key: string): boolean };

/** What the caller's typed decoder answers — a value, or a detail; never a throw (ARCH-03). */
export type DecodeShape = { ok: true; value: unknown } | { ok: false; detail: string };

/** The contract handed to propose: where the sources are resolved, and how the payload is read. */
export type ContractShape = { artifact: ResolverShape; decode(payload: JsonValue): DecodeShape };

/** A Proposal as this acceptance reads it — every member loose, so the shape itself is what is graded. */
export type ProposalShape = { kind: symbol; payload: unknown; sources: readonly string[]; model: string; callId: string };

export type Propose = (ctx: Context, request: Request, contract: ContractShape) => Promise<ProposalShape>;

/** inc-113b's seam, plus the member this increment owes it. */
export type ProposalSeam = Seam & { propose?: Propose };

/** The barrel's proposal surface — every member optional, so absence is a finding. */
export type ProposalBarrel = {
  propose?: Propose;
  PROPOSAL_KIND?: symbol;
  resolveProposal?: (payload: JsonValue, contract: ContractShape) => unknown;
  SOURCE_SCHEMES?: readonly string[];
  parseSourceKey?: (text: string) => string | null;
  sourceKeyResolver?: (artifactDigest: string, keys: Iterable<string>) => ResolverShape;
};

/* ------------------------------------------------------------------ *
 * The WIRE scenario's literals, as the test contract spells them.
 * ------------------------------------------------------------------ */

export const KEY_1F = "DXF_HANDLE:1F";
export const KEY_2A = "DXF_HANDLE:2A";
export const ARTIFACT_DIGEST = "sha256:artifact-1";
export const INPUT_TOKENS = 12;
export const OUTPUT_TOKENS = 7;
/** The pinned id every scenario here requests — the first of the closed const (AS-05). */
export const PROPOSAL_MODEL_ID = MODEL_IDS[0];
export const TRANSPORT_FIXTURE = "fixture";
export const OUTCOME_PROPOSED = "proposed";
export const OUTCOME_REFUSED = "refused";

/** The WIRE scenario's inner payload, fresh each time so no test can alias another's. */
export function wirePayload(): JsonValue {
  return { sheet: "A-101" };
}

/** The wire shape the spec fixes — `{ payload, sources }` — for scenarios that vary only the members. */
export function wire(sources: JsonValue[], payload: JsonValue = wirePayload()): JsonValue {
  return { payload, sources };
}

/* ------------------------------------------------------------------ *
 * The barrel's proposal surface.
 * ------------------------------------------------------------------ */

/** The barrel, read through the proposal surface. */
export async function proposalBarrel(): Promise<ProposalBarrel> {
  return (await barrel()) as unknown as ProposalBarrel;
}

/** A member of the proposal surface, asserted present before it is used. */
export async function proposalMember<K extends keyof ProposalBarrel>(name: K): Promise<NonNullable<ProposalBarrel[K]>> {
  const loaded = await proposalBarrel();
  const value = loaded[name];
  expect(value, `${BARREL} does not export ${name} (L-AI-02)`).toBeDefined();
  return value as NonNullable<ProposalBarrel[K]>;
}

/* ------------------------------------------------------------------ *
 * Staging: one fixture, one seam, one scenario.
 * ------------------------------------------------------------------ */

const roots: string[] = [];

/** A private fixture root for one seam. */
export function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cubit-proposal-fixtures-"));
  roots.push(root);
  return root;
}

/** Every root minted so far, removed; call from afterAll. */
export function dropFixtureRoots(): void {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** A request pinned to the first closed id; `salt` keeps two scenarios' hashes apart. */
export function proposalRequest(salt: string): Request {
  return {
    modelId: PROPOSAL_MODEL_ID,
    system: `You read a drawing sheet and answer as a proposal. (${salt})`,
    messages: [{ role: "user", content: "Which sheet does this title block name?" }],
    params: { temperature: 0 },
  };
}

/** A ledger mock and the memory ledger over it — memoryLedger's own shape, so a gated one fits too. */
export type LedgerMock = { ledger: Ledger; record: ReturnType<typeof memoryLedger>["record"] };

/**
 * A ledger that takes every row and answers a fresh call id — but only once `open()` is called, so
 * a test can see whether the seam waits for its row before answering the caller.
 */
export function gatedLedger(): LedgerMock & { open(): void } {
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
export type Staged = {
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
export async function stageWire(wireAnswer: JsonValue, salt: string, ledger: LedgerMock = memoryLedger()): Promise<Staged> {
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
export async function spiedResolver(artifactDigest: string, keys: readonly string[]): Promise<{ resolver: ResolverShape; has: ReturnType<typeof vi.fn<(key: string) => boolean>> }> {
  const sourceKeyResolver = await proposalMember("sourceKeyResolver");
  const inner = sourceKeyResolver(artifactDigest, keys);
  const has = vi.fn<(key: string) => boolean>((key) => inner.has(key));
  return { resolver: { artifactDigest: inner.artifactDigest, has }, has };
}

/** The test contract's decoder: `(p) => ({ ok: true, value: p })`, spied. */
export function acceptingDecoder(): ReturnType<typeof vi.fn<(payload: JsonValue) => DecodeShape>> {
  return vi.fn<(payload: JsonValue) => DecodeShape>((payload) => ({ ok: true, value: payload }));
}

/** A decoder that reads nothing as its type, answering `detail` — never throwing. */
export function refusingDecoder(detail: string): ReturnType<typeof vi.fn<(payload: JsonValue) => DecodeShape>> {
  return vi.fn<(payload: JsonValue) => DecodeShape>(() => ({ ok: false, detail }));
}

/* ------------------------------------------------------------------ *
 * The rows the seam owes.
 * ------------------------------------------------------------------ */

function attribution(staged: Staged): Pick<LedgerRow, "tenantId" | "projectId" | "modelId" | "requestHash" | "transport"> {
  return { tenantId: staged.ctx.tenantId, projectId: staged.ctx.projectId, modelId: staged.request.modelId, requestHash: staged.hash, transport: TRANSPORT_FIXTURE };
}

/** The proposed row: the fixture's tokens and the cost derived for them. */
export function proposedRow(staged: Staged): LedgerRow {
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
export function refusedRow(staged: Staged, refusalCode: string): LedgerRow {
  return {
    ...attribution(staged),
    outcome: OUTCOME_REFUSED,
    refusalCode,
    inputTokens: INPUT_TOKENS,
    outputTokens: OUTPUT_TOKENS,
    attributedCost: modelCallCost(PROPOSAL_MODEL_ID, INPUT_TOKENS, OUTPUT_TOKENS),
  };
}
