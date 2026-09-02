/**
 * Shared mechanics for the model seam's public acceptance (L-AI-01, AS-05): the barrel is loaded by
 * absolute path so a module the Builder has not written yet fails as an assertion naming the file
 * (the idiom `src/core/db/__tests__/seam-binding-and-pools.acceptance.test.ts` uses), and every
 * type here is a loose local shape so this file typechecks against today's tree and grades
 * tomorrow's.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, vi } from "vitest";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

/** The one lawful import from outside the seam (L-AI-01). */
export const BARREL = "src/core/model/index.ts";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type Message = { role: "user" | "assistant"; content: string };

export type Request = {
  modelId: string;
  system: string;
  messages: readonly Message[];
  params?: Readonly<Record<string, JsonValue>>;
};

export type Context = { tenantId: string; projectId: string; actor: string; requestId: string };

export type Answer = {
  callId: string;
  modelId: string;
  requestHash: string;
  transport: string;
  outcome: string;
  payload: JsonValue;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
};

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

export type Seam = { transport: string; callModel(ctx: Context, request: Request): Promise<Answer> };

export type Fixture = { requestHash: string; modelId: string; payload: JsonValue; inputTokens: number; outputTokens: number };

/** The barrel's surface as this acceptance reads it — every member optional, so absence is a finding. */
export type Barrel = {
  MODEL_IDS?: readonly string[];
  canonicalJson?: (value: JsonValue) => string;
  requestHash?: (request: Request) => string;
  selectTransport?: (env: Readonly<Record<string, string | undefined>>) => { transport: string; fixtureRoot?: string };
  createModelSeam?: (options: { env: Readonly<Record<string, string | undefined>>; fetch: typeof globalThis.fetch; ledger: Ledger }) => Seam;
  callModel?: (ctx: Context, request: Request) => Promise<Answer>;
  dbModelLedger?: (db: unknown) => Ledger;
};

/** Load the barrel, failing as an assertion that names it when the product does not provide it yet. */
export async function barrel(): Promise<Barrel> {
  const abs = join(REPO_ROOT, BARREL);
  expect(existsSync(abs), `${BARREL} is missing — the model seam's barrel is the one lawful path to a model (L-AI-01)`).toBe(true);
  return (await import(abs)) as Barrel;
}

/**
 * Every barrel member's declared shape: MODEL_IDS is the closed const of L-AI-01 (a readonly array),
 * everything else is callable. A Record over keyof Barrel is exhaustive, so a member cannot be added
 * to the surface without declaring its shape here.
 */
const SHAPE: Record<keyof Barrel, "array" | "function"> = {
  MODEL_IDS: "array",
  canonicalJson: "function",
  requestHash: "function",
  selectTransport: "function",
  createModelSeam: "function",
  callModel: "function",
  dbModelLedger: "function",
};

/** A member of the barrel, asserted present and of its declared shape before it is used. */
export async function member<K extends keyof Barrel>(name: K): Promise<NonNullable<Barrel[K]>> {
  const loaded = await barrel();
  const value = loaded[name];
  expect(value, `${BARREL} does not export ${String(name)}`).toBeDefined();
  if (SHAPE[name] === "array") {
    expect(Array.isArray(value), `${BARREL} exports ${String(name)} but it is not an array (the closed const of L-AI-01)`).toBe(true);
  } else {
    expect(typeof value, `${BARREL} exports ${String(name)} but it is not a function`).toBe("function");
  }
  return value as NonNullable<Barrel[K]>;
}

/** A ledger that answers a fresh call id per row and remembers every row it was handed. */
export function memoryLedger(): { ledger: Ledger; record: ReturnType<typeof vi.fn<(row: LedgerRow) => Promise<{ callId: string }>>> } {
  const record = vi.fn<(row: LedgerRow) => Promise<{ callId: string }>>(async () => ({ callId: randomUUID() }));
  return { ledger: { record }, record };
}

/** A fetch that must never be reached: it answers nothing and records that it was asked. */
export function silentFetch(): ReturnType<typeof vi.fn<typeof globalThis.fetch>> {
  return vi.fn<typeof globalThis.fetch>(async () => new Response("unreachable", { status: 599 }));
}

/** A call context with fresh identities every time. */
export function context(): Context {
  return { tenantId: randomUUID(), projectId: randomUUID(), actor: `user:${randomUUID()}`, requestId: randomUUID() };
}

/** The sentinel a promise that resolved is reported as, so a test can say "expected a rejection". */
export const RESOLVED: unique symbol = Symbol("resolved");

/** The value a promise rejected with, or RESOLVED — no catch clause, so ARCH-03's lint has nothing to read. */
export function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => RESOLVED,
    (reason: unknown) => reason,
  );
}

/** The seam's product directory, relative to the repo root. */
export const SEAM_DIR = "src/core/model";

/** The one lawful spelling of the process environment inside the seam: handed in whole as the env record. */
export const INJECTED_ENV = /\benv\s*:\s*process\.env\b(?!\s*[.[])/g;

/** Any spelling of the process environment at all. */
const PROCESS_ENV = /\bprocess\.env\b/g;

/** One place the process environment is spelled in product source. */
export type ProcessEnvRead = { file: string; line: number; text: string; injected: boolean };

/** Every `*.ts` under `dir` (recursively), skipping test directories and declaration files. */
function productSources(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      if (name !== "__tests__" && name !== "node_modules") found.push(...productSources(abs));
    } else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !/\.(test|spec)\.tsx?$/.test(name)) {
      found.push(abs);
    }
  }
  return found;
}

/** Source with every comment and string literal blanked (line structure kept), so prose and copy cannot spell a read. */
function bareCode(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, (match) => match.replace(/[^\n]/g, " "));
}

/**
 * Every spelling of `process.env` in the seam's product source (comments and strings blanked), each
 * marked as the injected form (`env: process.env`, the record handed whole to createModelSeam) or a
 * direct read (anything else — a property, an index, a destructuring, an alias).
 */
export function processEnvReads(root: string = REPO_ROOT): ProcessEnvRead[] {
  const reads: ProcessEnvRead[] = [];
  for (const abs of productSources(join(root, SEAM_DIR))) {
    const lines = bareCode(readFileSync(abs, "utf8")).split("\n");
    lines.forEach((text, index) => {
      const all = text.match(PROCESS_ENV)?.length ?? 0;
      if (all === 0) return;
      const injected = text.match(INJECTED_ENV)?.length ?? 0;
      reads.push({ file: relative(root, abs), line: index + 1, text: text.trim(), injected: injected === all });
    });
  }
  return reads;
}

/** The call ids a ledger mock answered with, in order. */
export async function answeredCallIds(record: ReturnType<typeof memoryLedger>["record"]): Promise<string[]> {
  return await Promise.all(record.mock.results.map(async (result) => ((await result.value) as { callId: string }).callId));
}
