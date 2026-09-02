/**
 * Acceptance support for inc-002 (the server spine and the fault seam).
 *
 * Everything here observes the product through the names the increment declares — no product
 * source is read and no mount is hand-built beyond the one thing the criteria themselves name:
 * "probe procedures composed from the exported `router`/`publicProcedure` share the shipped error
 * formatter" (AC-3). The shipped route handler is exercised as a module: it is a fetch handler,
 * so a `Request` in and a `Response` out is its whole contract.
 *
 * NOTE FOR THE BUILDER: product modules are loaded here by absolute path, so the `@/*` tsconfig
 * alias is never resolved for the specifiers *inside* them either — this tree's vitest configs
 * install no path-alias plugin. Keep imports between src/ files relative, as src/core/db.ts does.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

/** The checkout these tests run against. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The declared homes (increment interfaces / test contract). */
export const FAULTS_MODULE = "src/core/faults/report.ts";
export const REFUSAL_MODULE = "src/core/faults/refusal-marker.ts";
export const TRPC_MODULE = "src/server/trpc.ts";
export const CONTEXT_MODULE = "src/server/context.ts";
export const ROOT_MODULE = "src/server/root.ts";
export const ROUTE_MODULE = "src/app/api/trpc/[trpc]/route.ts";
export const STRINGS_MODULE = "src/ui/strings/index.ts";
export const ERROR_BOUNDARY_MODULE = "src/app/error.tsx";
export const ROUTERS_DIR = "src/server/routers";

/** The tRPC endpoint the route handler is mounted at (test contract: /api/trpc/[trpc]). */
export const TRPC_ENDPOINT = "/api/trpc";

/** A UUID as `crypto.randomUUID` mints one: 8-4-4-4-12 hex. The version digit is not pinned. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ISO-8601 instant: date, `T`, time, optional fraction, and a zone. */
export const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Import a product module by repo-relative path, asserting it exists first so a module the Builder
 * has not written yet fails as an assertion naming the file, never as an unreadable resolution
 * error. (Same contract as the held-out frame's `productModule`, so both sets read alike.)
 */
export async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

export interface FaultRecord {
  faultId: string;
  requestId: string;
  actor: string;
  route: string;
  cause: string;
  at: string;
}

export type FaultSink = (record: FaultRecord) => void;

export interface FaultsModule {
  reportFault(input: { requestId: string; actor: string; route: string; cause: unknown }): { faultId: string; requestId: string };
  setFaultSink(sink: FaultSink): FaultSink;
}

export interface RefusalModule {
  isRefusalMarked(e: unknown): boolean;
  /** The registered code a value (or its direct cause) carries, or null when the failure is plain. */
  refusalCodeOf(e: unknown): string | null;
}

/** The closed refusal taxonomy, read from its one home so no test re-spells a code (ARCH-02). */
export interface ErrorsModule {
  REFUSALS: Readonly<Record<string, { code: string }>>;
}

/** A tRPC procedure builder — only the surface these tests compose with. */
export interface ProcedureBuilder {
  query(resolver: (opts: { ctx: { requestId: string; actor: string } }) => unknown): unknown;
}

/** A tRPC router, seen through the reflection surface the criteria need. */
export interface RouterLike {
  _def?: {
    record?: Record<string, unknown>;
    procedures?: Record<string, unknown>;
  };
}

export interface TrpcModule {
  router: (record: Record<string, unknown>) => RouterLike;
  publicProcedure: ProcedureBuilder;
  /** The seam both callbacks answer through; exported, so its contract holds off the transport too. */
  answerFor: (request: { error: unknown; path?: string; ctx?: { requestId?: string; actor?: string } }) => {
    kind: string;
    faultId?: string;
    requestId?: string;
    refusalCode?: string;
  };
  /** The most unconsumed answers one request's memo holds before the oldest is evicted. */
  ANSWER_MEMO_CAP?: number;
}

export interface AppContext {
  requestId: string;
  actor: string;
  /** The address the request was dialled at, as the seam derived it (optional: read where asserted). */
  requestOrigin?: string;
  /** Whether a cookie set on this answer must carry `Secure` — read as `unknown` so its type is asserted. */
  secureCookies?: unknown;
}

/**
 * The three facts R-SPINE-006's origin rule is decided on, plus whether a cookie set on the answer
 * must carry `Secure` — the seam's own declared shape (`RequestOriginFacts`).
 */
export interface OriginFacts {
  statedOrigin: string | null;
  requestOrigin: string;
  configuredOrigin: string;
  secureCookies?: unknown;
}

export interface ContextModule {
  createContext(opts: { req: Request }): AppContext | Promise<AppContext>;
  deploymentIsSecure?: (req: Request) => boolean;
  originFactsFromHeaders?: (sent: Headers) => OriginFacts;
  REQUEST_ID_MAX_LENGTH?: number;
}

export interface RootModule {
  appRouter: RouterLike;
  trpcOnError: (opts: unknown) => void;
  /** The lanes' public home — the closed lane table (ARCH-02). */
  lanes?: Readonly<Record<string, RouterLike>>;
}

export type RouteHandler = (req: Request, ctx?: unknown) => Response | Promise<Response>;

export interface RouteModule {
  GET?: RouteHandler;
  POST?: RouteHandler;
}

export interface StringsModule {
  strings: Record<string, string>;
}

export const ERRORS_MODULE = "src/core/errors.ts";
export const TENANCY_ROUTER_MODULE = "src/server/routers/tenancy.ts";
export const AUTH_SESSION_MODULE = "src/server/auth/session.ts";
export const SHELL_SESSION_MODULE = "src/server/shell/session.ts";

/**
 * A product file as text, for the criteria that are stated about the source itself (a keyed lookup
 * rather than a scan; one home for a fact rather than two spellings of it). Read through the same
 * existence assertion the module loaders use, so a missing file names itself.
 */
export function productSource(relative: string): string {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return readFileSync(abs, "utf8");
}

/**
 * The same source with every comment removed and every string literal kept, so a phrase counted in
 * code is never a phrase written in prose. Line structure is preserved: a stripped comment leaves
 * its newlines behind, so line numbers still line up with the file.
 */
export function stripComments(source: string): string {
  let out = "";
  let mode: "code" | "line" | "block" | "single" | "double" | "template" = "code";
  let i = 0;
  while (i < source.length) {
    const c = source[i] as string;
    const next = source[i + 1];
    if (mode === "code") {
      if (c === "/" && next === "/") {
        mode = "line";
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        mode = "block";
        i += 2;
        continue;
      }
      if (c === "'") mode = "single";
      else if (c === '"') mode = "double";
      else if (c === "`") mode = "template";
      out += c;
      i += 1;
      continue;
    }
    if (mode === "line") {
      if (c === "\n") {
        mode = "code";
        out += c;
      }
      i += 1;
      continue;
    }
    if (mode === "block") {
      if (c === "*" && next === "/") {
        mode = "code";
        i += 2;
        continue;
      }
      if (c === "\n") out += c;
      i += 1;
      continue;
    }
    if (c === "\\") {
      out += c + (next ?? "");
      i += 2;
      continue;
    }
    if ((mode === "single" && c === "'") || (mode === "double" && c === '"') || (mode === "template" && c === "`")) mode = "code";
    out += c;
    i += 1;
  }
  return out;
}

/** Every `/** … *\/` doc comment in a file, as text — what a criterion about a comment's citation reads. */
export function docComments(source: string): string[] {
  return [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)].map((match) => match[0]);
}

/**
 * Which function each occurrence of `needle` sits inside, by the nearest declaration above it — the
 * reading behind "read in exactly one function". Comments are stripped first, so a mention in prose
 * is not an occurrence.
 */
export function enclosingFunctionsOf(source: string, needle: string): string[] {
  const lines = stripComments(source).split("\n");
  const declaration = /^\s*(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z0-9_$]+)|(?:const|let)\s+([A-Za-z0-9_$]+)\s*(?::[^=]*)?=\s*(?:async\s*)?\()/;
  const found: string[] = [];
  for (const [at, line] of lines.entries()) {
    if (!line.includes(needle)) continue;
    let name = "<file scope>";
    for (let back = at; back >= 0; back -= 1) {
      const match = declaration.exec(lines[back] as string);
      if (match !== null) {
        name = match[1] ?? match[2] ?? name;
        break;
      }
    }
    found.push(name);
  }
  return found;
}

/** A file as `main` holds it — the baseline a B-20 re-baseline is measured against. */
export function mainVersionOf(relative: string): string {
  return execFileSync("git", ["show", `main:${relative}`], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
}

/** A suite split at each `test(` boundary: its prologue, then one segment per test. */
export function testBlocksOf(source: string): string[] {
  return source.split(/(?=\n\s*test\()/);
}

/**
 * B-20: a re-baseline moves exactly the assertions whose law changed and nothing else. This reads
 * both versions of a suite as test blocks and asserts that the only one that differs is the block
 * that names `title` in main's version — the roster's length is unchanged, so no test was added,
 * dropped or reordered either.
 */
export function assertOnlyOneTestRebaselined(relative: string, title: string): void {
  const before = testBlocksOf(mainVersionOf(relative));
  const after = testBlocksOf(productSource(relative));
  const named = before.findIndex((block) => block.includes(title));
  expect(named, `main's ${relative} holds no test named ${JSON.stringify(title)} — the audit is pointed at the wrong assertion`).toBeGreaterThanOrEqual(0);
  expect(after.length, `${relative} gained or lost a test: a re-baseline changes one assertion, never the roster (B-20)`).toBe(before.length);
  const changed = before.flatMap((block, at) => (block === after[at] ? [] : [at]));
  expect(changed, `${relative}: only the test naming ${JSON.stringify(title)} may change (B-20) — blocks ${changed.join(", ")} differ from main`).toEqual([named]);
}

export const loadErrors = (): Promise<ErrorsModule> => productModule<ErrorsModule>(ERRORS_MODULE);
export const loadFaults = (): Promise<FaultsModule> => productModule<FaultsModule>(FAULTS_MODULE);
export const loadRefusalMarker = (): Promise<RefusalModule> => productModule<RefusalModule>(REFUSAL_MODULE);
export const loadTrpc = (): Promise<TrpcModule> => productModule<TrpcModule>(TRPC_MODULE);
export const loadContext = (): Promise<ContextModule> => productModule<ContextModule>(CONTEXT_MODULE);
export const loadRoot = (): Promise<RootModule> => productModule<RootModule>(ROOT_MODULE);
export const loadRouteModule = (): Promise<RouteModule> => productModule<RouteModule>(ROUTE_MODULE);
export const loadStrings = (): Promise<StringsModule> => productModule<StringsModule>(STRINGS_MODULE);

/** The shipped route handler's GET, asserted to exist (the contract's route answers a query). */
export async function shippedHandler(): Promise<RouteHandler> {
  const route = await loadRouteModule();
  expect(typeof route.GET, `${ROUTE_MODULE} must export a GET route handler — the test contract routes GET /api/trpc/spine.health through it`).toBe("function");
  return route.GET as RouteHandler;
}

/** The shipped route handler's POST — the transport a mutation travels on, and the one that answers cookies. */
export async function shippedMutationHandler(): Promise<RouteHandler> {
  const route = await loadRouteModule();
  expect(typeof route.POST, `${ROUTE_MODULE} must export a POST route handler — a mutation is a POST`).toBe("function");
  return route.POST as RouteHandler;
}

export interface CallInit {
  requestId?: string;
  /** The `Host` the request states, which is the address it was reached at (src/server/context.ts). */
  host?: string;
  cookie?: string;
}

export interface WireMutation extends WireAnswer {
  /** Every `Set-Cookie` the answer carried, as the wire spells them. */
  setCookie: string[];
}

/** Call a fetch route handler for one tRPC mutation, as a browser's client posts it. */
export async function callMutation(handler: RouteHandler, path: string, init: CallInit = {}): Promise<WireMutation> {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.requestId !== undefined) headers.set("x-request-id", init.requestId);
  if (init.host !== undefined) headers.set("host", init.host);
  if (init.cookie !== undefined) headers.set("cookie", init.cookie);
  const req = new Request(`http://${init.host ?? "cubit.test"}${TRPC_ENDPOINT}/${path}`, { method: "POST", headers, body: "{}" });
  const res = await handler(req, { params: Promise.resolve({ trpc: [path] }) });
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = undefined;
  }
  return { status: res.status, raw, body: Array.isArray(body) ? body[0] : body, setCookie: res.headers.getSetCookie() };
}

/** Duck-type: anything the tRPC router factory produced carries a `_def` with a record or procedures. */
export function isRouterLike(value: unknown): value is RouterLike {
  if (typeof value !== "object" || value === null) return false;
  const def = (value as RouterLike)._def;
  if (typeof def !== "object" || def === null) return false;
  return typeof def.record === "object" || typeof def.procedures === "object";
}

/**
 * The router's top-level namespaces, derived by reflection rather than declared: the record keys
 * when the factory keeps them, plus the first segment of every flattened procedure path. A lane
 * that is still empty shows up in the first source, a lane that is nested shows up in the second.
 */
export function topLevelKeys(router: RouterLike): string[] {
  const keys = new Set<string>();
  for (const key of Object.keys(router._def?.record ?? {})) keys.add(key);
  for (const path of Object.keys(router._def?.procedures ?? {})) {
    const [head] = path.split(".");
    if (head !== undefined && head !== "") keys.add(head);
  }
  return [...keys].sort();
}

export interface WireAnswer {
  status: number;
  /** The response body exactly as it went over the wire — what "appears nowhere in the body" reads. */
  raw: string;
  body: unknown;
}

/** The single-call tRPC envelope. No transformer is installed (none is a declared dependency). */
export interface WireEnvelope {
  result?: { data?: unknown };
  error?: { message?: unknown; code?: unknown; data?: Record<string, unknown> };
}

/** Call a fetch route handler for one tRPC path, as a browser would. */
export async function callWire(handler: RouteHandler, path: string, init: { requestId?: string } = {}): Promise<WireAnswer> {
  const headers = new Headers();
  if (init.requestId !== undefined) headers.set("x-request-id", init.requestId);
  const req = new Request(`http://cubit.test${TRPC_ENDPOINT}/${path}`, { method: "GET", headers });
  const res = await handler(req, { params: Promise.resolve({ trpc: [path] }) });
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = undefined;
  }
  return { status: res.status, raw, body: Array.isArray(body) ? body[0] : body };
}

/** One batched GET, as a browser's tRPC client sends it: paths joined by comma under `?batch=1`. */
export interface WireBatch {
  /** The envelope's own status. tRPC answers 207 when the elements' statuses differ. */
  status: number;
  raw: string;
  elements: WireEnvelope[];
}

export async function callBatch(handler: RouteHandler, paths: string[], init: { requestId?: string } = {}): Promise<WireBatch> {
  const headers = new Headers();
  if (init.requestId !== undefined) headers.set("x-request-id", init.requestId);
  const req = new Request(`http://cubit.test${TRPC_ENDPOINT}/${paths.join(",")}?batch=1&input=%7B%7D`, { method: "GET", headers });
  const res = await handler(req, { params: Promise.resolve({ trpc: paths }) });
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = undefined;
  }
  expect(Array.isArray(body), `a batched call did not answer a JSON array of envelopes: ${raw.slice(0, 400)}`).toBe(true);
  const elements = body as WireEnvelope[];
  expect(elements.length, `a batch of ${paths.length} answered ${elements.length} elements`).toBe(paths.length);
  return { status: res.status, raw, elements };
}

/** `error.data` off one element of a batched answer — the same reading `errorData` does per call. */
export function errorDataOf(element: WireEnvelope, where: string): Record<string, unknown> {
  expect(element.error, `expected an error answer for ${where}, got: ${JSON.stringify(element).slice(0, 400)}`).toBeTruthy();
  const data = element.error?.data;
  expect(data, `the error answer for ${where} carries no data envelope`).toBeTypeOf("object");
  return data as Record<string, unknown>;
}

export function envelope(answer: WireAnswer): WireEnvelope {
  expect(answer.body, `the answer was not a JSON envelope: ${answer.raw.slice(0, 400)}`).toBeTypeOf("object");
  return answer.body as WireEnvelope;
}

/** `error.data` from the envelope — the shape the wire distinguishes a fault from a refusal by. */
export function errorData(answer: WireAnswer): Record<string, unknown> {
  const env = envelope(answer);
  expect(env.error, `expected an error answer, got: ${answer.raw.slice(0, 400)}`).toBeTruthy();
  const data = env.error?.data;
  expect(data, `the error answer carries no data envelope: ${answer.raw.slice(0, 400)}`).toBeTypeOf("object");
  return data as Record<string, unknown>;
}

export function resultData(answer: WireAnswer): Record<string, unknown> {
  const env = envelope(answer);
  expect(env.error, `expected a successful answer, got: ${answer.raw.slice(0, 400)}`).toBeUndefined();
  const data = env.result?.data;
  expect(data, `the successful answer carries no result data: ${answer.raw.slice(0, 400)}`).toBeTypeOf("object");
  return data as Record<string, unknown>;
}

/**
 * Compose probe procedures with the SHIPPED `router`/`publicProcedure` and mount them behind the
 * SHIPPED `trpcOnError` and `createContext` (AC-3's own words). The error formatter under test is
 * the one baked into `router` by src/server/trpc.ts, so the probes answer exactly as a real
 * procedure would.
 */
export async function probeHandler(procedures: Record<string, (ctx: AppContext) => unknown>): Promise<RouteHandler> {
  const [{ router, publicProcedure }, { createContext }, { trpcOnError }] = await Promise.all([loadTrpc(), loadContext(), loadRoot()]);
  expect(typeof router, `${TRPC_MODULE} must export a \`router\` factory`).toBe("function");
  expect(typeof trpcOnError, `${ROOT_MODULE} must export \`trpcOnError\``).toBe("function");
  const adapter = await import("@trpc/server/adapters/fetch").catch((cause: unknown) => {
    expect.fail(`@trpc/server (a declared dependency of this increment) does not resolve in the checkout: ${String(cause)}`);
  });
  const record: Record<string, unknown> = {};
  for (const [name, resolve_] of Object.entries(procedures)) {
    record[name] = publicProcedure.query(({ ctx }) => resolve_(ctx));
  }
  const probeRouter = router(record);
  return (req: Request) =>
    adapter.fetchRequestHandler({
      endpoint: TRPC_ENDPOINT,
      req,
      router: probeRouter as never,
      // `router` is erased above, so the adapter infers its context type as `never`; the mount is
      // the product's own `createContext` either way, so only the static type is bridged here.
      createContext: ((opts: { req: Request }) => createContext({ req: opts.req })) as never,
      onError: trpcOnError,
    });
}

/** An error that carries the refusal marker on itself. */
export function markedError(message: string, refusalCode: string): Error {
  return Object.assign(new Error(message), { refusalCode });
}

/** An error whose `cause` carries the refusal marker — the other half of `isRefusalMarked`. */
export function causeMarkedError(message: string, refusalCode: string): Error {
  return new Error(message, { cause: { refusalCode } });
}

/**
 * Run `body` with a capturing fault sink installed, then put the previous sink back — so one
 * test's records can never be another's, and the default sink is never left swapped out.
 */
export async function withFaultSink<T>(faults: FaultsModule, body: (records: FaultRecord[]) => Promise<T>): Promise<T> {
  const records: FaultRecord[] = [];
  const previous = faults.setFaultSink((record) => {
    records.push(record);
  });
  try {
    return await body(records);
  } finally {
    faults.setFaultSink(previous);
  }
}
