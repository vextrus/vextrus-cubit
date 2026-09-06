/**
 * The mechanics the sheet-understanding acceptance runs on (R-AI-001, R-AI-005, L-AI-01, L-AI-02).
 *
 * Mechanics only — nothing here judges the product. The doors this increment publishes are loaded
 * by absolute path (`productModule`), so a file the Builder has not written yet fails as an
 * assertion naming it rather than as a collection death that reads as a defect in the acceptance.
 * Every type of a not-yet-written surface is a loose local shape, so this file typechecks against
 * today's tree and grades tomorrow's.
 *
 * Nothing here reads product source: every name below is one the increment's interface list, its
 * test contract or the fixture corpus publishes.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, vi } from "vitest";
import { entityGraphSchema, type EntityGraph } from "../../../src/core/entitygraph/schema";

/** The checkout this suite drives. */
export const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/* ------------------------------------------------------------------ the homes the spec names */

/** The module door this increment publishes (increment interfaces). */
export const UNDERSTANDING_MODULE = "src/modules/ai/sheet-understanding/index.ts";

/** Where per-project AI spend is answered from (increment ownership: `src/modules/ai/spend/**`). */
export const SPEND_MODULE = "src/modules/ai/spend/index.ts";

/** The one lawful import from outside the model seam (L-AI-01) — the barrel the port is built from. */
export const MODEL_BARREL = "src/core/model/index.ts";

/** The committed corpus root this increment's calls replay from (declared fixtures, AC-2). */
export const FIXTURE_ROOT = join("fixtures", "model", "sheet-understanding");

/** The silent-title-block artifact of that corpus — the graph AC-2 drives (declared fixtures). */
export const SILENT_GRAPH = join(FIXTURE_ROOT, "artifacts", "silent-title-block.graph.json");

/** The model AS-05 pins reading and proposals to. */
export const OPUS = "claude-opus-5";

/** The transport, outcomes and refusal codes the test contract names (P-2, P-4). */
export const TRANSPORT_FIXTURE = "fixture";
export const OUTCOME_PROPOSED = "proposed";
export const OUTCOME_REFUSED = "refused";
export const FIXTURE_MISSING = "FIXTURE_MISSING";
export const SOURCE_UNRESOLVED = "SOURCE_UNRESOLVED";

/** The three dispositions AC-3 records, in the criterion's own order. */
export const ACCEPTED = "accepted";
export const EDITED = "edited";
export const REJECTED = "rejected";

/* ------------------------------------------------------------------ the shapes the doors answer in */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** An artifact, as the one mirror both runtimes read it (L-CAD-05): every graph here is validated. */
export type Graph = EntityGraph;

/** One layout of an artifact's inventory. */
export type GraphLayout = Graph["layouts"][number];

/** What one sheet's reading holds (increment interfaces: `SheetReading`). */
export type Reading = { number: string | null; title: string; discipline: string; captions: readonly string[] };

/** What `understandSheet` answers (increment interfaces: `SheetUnderstanding`). */
export type Understanding = { basis: string; reading: Reading; cited: readonly string[]; callId: string | null; model: string | null };

/** The call context the seam and this module attribute to (`ModelCallContext`). */
export type Context = { tenantId: string; projectId: string; actor: string; requestId: string };

/** What `understandSheet` is handed (increment interfaces: `SheetUnderstandingInput`). */
export type UnderstandingInput = { graph: unknown; layoutName: string; artifactDigest: string };

/** One row of the model-call ledger, as the seam hands one to a ledger (`ModelLedgerRow`). */
export type LedgerRow = {
  tenantId: string;
  projectId: string;
  modelId: string;
  requestHash: string;
  transport: string;
  outcome: string;
  refusalCode: string | null;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
};

export type Ledger = { record(row: LedgerRow): Promise<{ callId: string }> };

/** The port `understandSheet` reaches a model through (increment interfaces: `SheetUnderstandingPort`). */
export type Port = { propose: (...args: never[]) => Promise<unknown> };

/** What a disposition is recorded from (AC-3). */
export type DispositionInput = { callId: string; sheetId: string; disposition: string; proposed: Reading; resolved?: Reading };

/** One recorded disposition, as `dispositionsOf` answers one (AC-3). */
export type DispositionRow = { callId: string; sheetId: string; disposition: string; proposed: Reading; resolved: Reading | null; actorUserId: string } & Record<string, unknown>;

/** What one project spent and how its proposals were dispositioned (AC-4). */
export type AiSpend = {
  calls: number;
  proposed: number;
  refused: number;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
  accepted: number;
  edited: number;
  rejected: number;
} & Record<string, unknown>;

/** The sheet-understanding door, as this acceptance reads it — every member optional, so absence is a finding. */
export type UnderstandingDoor = {
  understandSheet?: (ctx: Context, input: UnderstandingInput, port?: Port) => Promise<Understanding>;
  sheetUnderstandingRequest?: (graph: unknown, layoutName: string) => { modelId: string; system: string; messages: readonly { role: string; content: string }[]; params?: Record<string, JsonValue> };
  recordDisposition?: (ctx: Context, input: DispositionInput) => Promise<{ dispositionId: string }>;
  dispositionsOf?: (scope: { tenantId: string; projectId: string }) => Promise<DispositionRow[]>;
};

/** The spend door (R-AI-005, AC-4). */
export type SpendDoor = { projectAiSpendOf?: (scope: { tenantId: string; projectId: string }) => Promise<AiSpend> };

/** The recorded-answer file format (`fixtures/model/README.md`). */
export type Fixture = { requestHash: string; modelId: string; payload: JsonValue; inputTokens: number; outputTokens: number };

/* ------------------------------------------------------------------ loading the doors */

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return (await import(abs)) as T;
}

/** The sheet-understanding door, with the member the caller is about to use asserted present. */
export async function understandingDoor(): Promise<UnderstandingDoor> {
  return productModule<UnderstandingDoor>(UNDERSTANDING_MODULE);
}

/** One member of the sheet-understanding door, asserted callable before it is used. */
export async function understandingMember<K extends keyof UnderstandingDoor>(name: K): Promise<NonNullable<UnderstandingDoor[K]>> {
  const door = await understandingDoor();
  const value = door[name];
  expect(typeof value, `${UNDERSTANDING_MODULE} does not export ${String(name)} as a function`).toBe("function");
  return value as NonNullable<UnderstandingDoor[K]>;
}

/**
 * `projectAiSpendOf`, from the home the ownership list names — or, where the module chose to publish
 * it through the sheet-understanding barrel instead, from there. Either home is inside this
 * increment's own ground; a build that publishes it from neither has not shipped R-AI-005's read.
 */
export async function projectAiSpend(): Promise<NonNullable<SpendDoor["projectAiSpendOf"]>> {
  const spendHome = join(REPO_ROOT, SPEND_MODULE);
  const door: SpendDoor = existsSync(spendHome) ? await productModule<SpendDoor>(SPEND_MODULE) : ((await understandingDoor()) as SpendDoor);
  expect(typeof door.projectAiSpendOf, `neither ${SPEND_MODULE} nor ${UNDERSTANDING_MODULE} exports projectAiSpendOf (R-AI-005)`).toBe("function");
  return door.projectAiSpendOf as NonNullable<SpendDoor["projectAiSpendOf"]>;
}

/* ------------------------------------------------------------------ the port every criterion hands in */

/** A ledger that answers a fresh call id per row and remembers every row it was handed (P-2). */
export function memoryLedger(): { ledger: Ledger; record: ReturnType<typeof vi.fn<(row: LedgerRow) => Promise<{ callId: string }>>> } {
  const record = vi.fn<(row: LedgerRow) => Promise<{ callId: string }>>(async () => ({ callId: randomUUID() }));
  return { ledger: { record }, record };
}

/** A fetch that must never be reached: it answers nothing and records that it was asked (P-2). */
export function silentFetch(): ReturnType<typeof vi.fn<typeof globalThis.fetch>> {
  return vi.fn<typeof globalThis.fetch>(async () => new Response("unreachable", { status: 599 }));
}

/** The rows a memory ledger was handed, in the order it was handed them. */
export function rowsOf(record: ReturnType<typeof memoryLedger>["record"]): LedgerRow[] {
  return record.mock.calls.map(([row]) => row);
}

/** The call ids a memory ledger answered with, in order. */
export async function answeredCallIds(record: ReturnType<typeof memoryLedger>["record"]): Promise<string[]> {
  return Promise.all(record.mock.results.map(async (result) => ((await result.value) as { callId: string }).callId));
}

/**
 * A port over a seam built by the barrel's `createModelSeam` (P-2): the fixture root is handed in
 * through the env record, the fetch is a spy asserted never reached, and `propose` is wrapped so a
 * criterion can say whether the model was asked at all.
 */
export async function seamPort(fixtureRoot: string, ledger: Ledger): Promise<{ port: Port; propose: ReturnType<typeof vi.fn>; fetch: ReturnType<typeof silentFetch> }> {
  const barrel = await productModule<{ createModelSeam?: (options: { env: Record<string, string | undefined>; fetch: typeof globalThis.fetch; ledger: Ledger }) => { propose: (...args: never[]) => Promise<unknown> } }>(MODEL_BARREL);
  expect(typeof barrel.createModelSeam, `${MODEL_BARREL} does not export createModelSeam (L-AI-01)`).toBe("function");
  const fetchSpy = silentFetch();
  const seam = (barrel.createModelSeam as NonNullable<typeof barrel.createModelSeam>)({ env: { CUBIT_MODEL_FIXTURE_ROOT: fixtureRoot }, fetch: fetchSpy, ledger });
  const propose = vi.fn(seam.propose);
  return { port: { propose } as Port, propose, fetch: fetchSpy };
}

/** The barrel's `requestHash` — the identity a recorded answer is filed under (P-3). */
export async function requestHash(): Promise<(request: unknown) => string> {
  const barrel = await productModule<{ requestHash?: (request: unknown) => string }>(MODEL_BARREL);
  expect(typeof barrel.requestHash, `${MODEL_BARREL} does not export requestHash (L-AI-01)`).toBe("function");
  return barrel.requestHash as (request: unknown) => string;
}

/* ------------------------------------------------------------------ minting a corpus of one */

/** A fresh, empty fixture root under $TMPDIR — nothing this acceptance mints is committed (Q-08). */
export function tempFixtureRoot(label: string): string {
  return mkdtempSync(join(tmpdir(), `cubit-${label}-`));
}

/**
 * One recorded answer, filed under the request it answers (P-3, `fixtures/model/README.md`). The
 * wire `payload` holds exactly `payload` and `sources`, which is the shape L-AI-02 reads a proposal
 * out of.
 */
export function mintFixture(root: string, hash: string, wire: { payload: JsonValue; sources: string[] }, tokens: { inputTokens: number; outputTokens: number }): Fixture {
  const fixture: Fixture = { requestHash: hash, modelId: OPUS, payload: { payload: wire.payload, sources: wire.sources }, inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens };
  writeFileSync(join(root, `${hash}.json`), JSON.stringify(fixture));
  return fixture;
}

/* ------------------------------------------------------------------ artifacts, read and built */

/** An artifact as the one mirror reads it — the reading every criterion here derives from (L-CAD-05). */
function validated(draft: unknown, named: string): Graph {
  const parsed = entityGraphSchema.safeParse(draft);
  expect(parsed.success, `${named} is an EntityGraph v2 this tree reads: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
  return (parsed as { data: Graph }).data;
}

/** The committed silent-title-block artifact of the corpus root, parsed and validated. */
export function silentCorpusGraph(): Graph {
  const abs = join(REPO_ROOT, SILENT_GRAPH);
  expect(existsSync(abs), `${SILENT_GRAPH} is missing — AC-2's committed corpus artifact`).toBe(true);
  return validated(JSON.parse(readFileSync(abs, "utf8")), SILENT_GRAPH);
}

/** Every layout of an artifact standing in the given kind, in inventory order. */
export function layoutsOfKind(graph: Graph, kind: string): GraphLayout[] {
  return (graph.layouts ?? []).filter((layout) => layout.kind === kind);
}

/** Every entity key the artifact puts on one layout — what a citation of that sheet has to be one of. */
export function entityKeysOn(graph: Graph, space: string): string[] {
  return (graph.entities ?? []).filter((entity) => entity.space === space).map((entity) => entity.key);
}

/** A colour every built entity carries: channels, never a spelled colour (the artifact's own shape). */
const CHANNELS = { rgb: [0, 0, 0] as [number, number, number], source: "bylayer" };

/** The handle half of a source key, from an ordinal — uppercase hex, as L-CAD-02 mints them. */
export function handle(ordinal: number): string {
  return `DXF_HANDLE:${ordinal.toString(16).toUpperCase()}`;
}

/** One text an artifact carries on a layout. */
export type TextSpec = { text: string; height: number; layer?: string };

/**
 * A hand-built EntityGraph v2, valid under `entityGraphSchema` (AC-1 admits one): model space plus
 * one paper layout, the paper layout carrying the given texts and one drawn line, model space
 * carrying one drawn line of its own. Every key is minted once and every handle is unique to the
 * `salt`, so two graphs built here are two different requests.
 */
export function builtGraph(options: { paperLayout: string; modelLayout?: string; texts?: readonly TextSpec[]; salt?: number }): Graph {
  const modelLayout = options.modelLayout ?? "Model";
  const base = (options.salt ?? 1) * 0x1000;
  const texts = options.texts ?? [];
  const entities: Record<string, unknown>[] = texts.map((spec, index) => ({
    key: handle(base + index + 1),
    type: "TEXT",
    space: options.paperLayout,
    layer: spec.layer ?? "0",
    colour: CHANNELS,
    text: spec.text,
    height: spec.height,
  }));
  entities.push({ key: handle(base + texts.length + 1), type: "LINE", space: options.paperLayout, layer: "0", colour: CHANNELS, points: [[0, 0], [1, 1]] });
  entities.push({ key: handle(base + texts.length + 2), type: "LINE", space: modelLayout, layer: "0", colour: CHANNELS, points: [[0, 0], [2, 2]] });
  return validated(
    {
      entitygraph_version: 2,
      ingest: { scheme: "DXF_HANDLE", tool: "cubit-acceptance", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
      insunits: { code: 4, unit: "mm", unmapped: false },
      layouts: [
        { name: modelLayout, kind: "model", bbox: { min: [0, 0], max: [2, 2] }, strays_rejected: 0 },
        { name: options.paperLayout, kind: "paper", bbox: { min: [0, 0], max: [1, 1] }, strays_rejected: 0 },
      ],
      dropped_layouts: [],
      entities,
      derived: [],
      block_attributes: [],
      counters: [],
    },
    `the artifact built for ${options.paperLayout}`,
  );
}

/* ------------------------------------------------------------------ small mechanics */

/** The sentinel a promise that resolved is reported as, so a test can say "expected a rejection". */
export const RESOLVED: unique symbol = Symbol("resolved");

/** The value a promise rejected with, or RESOLVED — no catch clause, so ARCH-03's lint has nothing to read. */
export function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => RESOLVED,
    (reason: unknown) => reason,
  );
}

/** A call context with fresh identities every time, for a given tenant, project and actor. */
export function contextFor(tenantId: string, projectId: string, actor: string): Context {
  return { tenantId, projectId, actor, requestId: randomUUID() };
}
