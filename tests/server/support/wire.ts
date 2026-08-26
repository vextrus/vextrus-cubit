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
import { existsSync, statSync } from "node:fs";
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
    refusalCode?: string;
  };
}

export interface AppContext {
  requestId: string;
  actor: string;
}

export interface ContextModule {
  createContext(opts: { req: Request }): AppContext | Promise<AppContext>;
}

export interface RootModule {
  appRouter: RouterLike;
  trpcOnError: (opts: unknown) => void;
}

export type RouteHandler = (req: Request, ctx?: unknown) => Response | Promise<Response>;

export interface RouteModule {
  GET?: RouteHandler;
  POST?: RouteHandler;
}

export interface StringsModule {
  strings: Record<string, string>;
}

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
