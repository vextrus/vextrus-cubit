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
import { createHash } from "node:crypto";
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

/** A suite split at each `test(` boundary: its prologue, then one segment per test. */
export function testBlocksOf(source: string): string[] {
  return source.split(/(?=\n\s*test\()/);
}

/**
 * One test's own text: the `test(` line through the line that closes that call at the same
 * indentation. Bounding a block by its own closer rather than by the next test's start is what
 * keeps a test's identity stable when a LATER test is inserted after it.
 */
function testBodyOf(block: string): string | null {
  const lines = block.split("\n");
  const open = lines.findIndex((line) => /^\s*test\(/.test(line));
  if (open < 0) return null;
  const closer = `${/^\s*/.exec(lines[open] as string)?.[0] ?? ""}});`;
  for (let at = open + 1; at < lines.length; at += 1) {
    if (lines[at] === closer) return lines.slice(open, at + 1).join("\n");
  }
  return null;
}

/** The title a test declares — the identity a recorded block is matched by, never its position. */
function titleOf(body: string): string | null {
  const match = /^\s*test\(\s*(["'`])((?:[^\\]|\\.)*?)\1/.exec(body);
  return match === null ? null : (match[2] as string);
}

/** Every test a suite holds, as title → the test's own text. */
export function testBodiesOf(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const block of testBlocksOf(source)) {
    const body = testBodyOf(block);
    if (body === null) continue;
    const title = titleOf(body);
    if (title === null) continue;
    found.set(title, body);
  }
  return found;
}

/** A test's recorded identity: content-addressed, so the fixture states it without copying it. */
export const digestOf = (text: string): string => createHash("sha256").update(text).digest("hex");

/**
 * A suite this increment re-baselines under B-20, as its text stood BEFORE the fix — an immutable
 * in-tree fixture, so the audit measures the tree against a recorded state rather than against a
 * branch ref that moves under it (Q-17: fixture identities are single-sourced; V-VERIFY: the exit
 * code is a fact about the product, never about a date).
 */
export interface RebaselinedSuite {
  /** The title the pre-fix suite gave the test whose law changed — the audit's handle. */
  readonly title: string;
  /** Text that test carries before AND after, so it is found again when its title itself moved. */
  readonly anchor?: string;
  /** What the re-baselined assertion must now state — the exported names it derives from (B-19). */
  readonly states: readonly string[];
  /** The superseded expectation, which the suite must no longer hold anywhere. */
  readonly superseded: readonly string[];
  /** Every test the pre-fix suite held, as `[title, digest of its own text]`. */
  readonly blocks: readonly (readonly [title: string, digest: string])[];
}

/**
 * The recorded pre-fix text of the two suites the spec owns under B-20 (`tests/server/*`), taken
 * from the increment's base commit c827e7a. Digests, not copies: a test's identity is its title and
 * the hash of its own body, so this fixture states what stood without re-spelling any assertion.
 */
export const REBASELINED_SUITES: Readonly<Record<string, RebaselinedSuite>> = {
  "tests/server/seam-hardening.test.ts": {
    title: "a long id is still the caller's id and is echoed verbatim (AC-2)",
    anchor: '"x".repeat(100_000)',
    states: ["REQUEST_ID_MAX_LENGTH"],
    superseded: [").requestId).toBe(long);"],
    blocks: [
      ["a refusal marker on a TRPCError that also carries a cause is still a refusal (ARCH-03)", "467b53f445fa02445c38f24842bdecc34f33763c85b49d0f88fe532f965456bb"],
      ["a marker two hops below a directly-thrown TRPCError is an outage, not a refusal (ARCH-03)", "26776f52b32aa12403b8c5579e7c8338e030363d693c1da47381cedff10f0e92"],
      ["the same error object thrown by two requests records both, each under its own request id", "e071ce42330c99edd1ce4c53da9a34f379e3705df4d5082e727bb44132291e17"],
      ["a re-thrown TRPCError constant is a new outage on every request, never a replay of the first", "d32b673016ef7abab36de3c288725fd195b9a308e52e18ebfcd4e7a4e2861e26"],
      ["two procedures in ONE batch that throw the same error object leave two records, one per route", "54cd5796846d907de791aa8fc912d681987b60c0f022e409a2d299f19c7d37fc"],
      ["a primitive thrown value handed to the seam twice is still one failure, one record", "2f9138867bc3ea6cd11253fdeeb586522aefb9d6eda086e080119772c8fb9236"],
      ["a failure only ONE reader ever saw cannot suppress the next outage's record (B-21)", "714e7cf91c445680edcae1eee6576be28064554934da380c77475f4530b74ebc"],
      ["a large batch's first failure is still one record when the last one is decided (B-21)", "7724f01b9f668164014e8ca3264d2203bebe428ecf76d685cbd79228519356f6"],
      ["a second instance of the transport shares the one memo — one failure, still one record (ARCH-02)", "af230e3f8131b4cd3f277f389480cf7fee1317f9faf0b7bf91964008b6a854fd"],
      ["a second instance of the fault seam shares the one sink — a swapped sink is never half-applied (ARCH-02)", "b80b3d589fff11006d1c03cdf461e92eef37e570ba68b593c38851b3417d8bf2"],
      ["one failing request still leaves exactly one record", "7f0a2150de119996b5991ee92bfcec9a18f597b274d34a7a25f29669ed23f9fc"],
      ["an ordinary supplied id is echoed verbatim", "9bc377ba846c70147c1b198fb30405408e1a8437e32544a51edc933dd20f8f37"],
      ["a printable non-ASCII id is still an id and is honoured verbatim (AC-2)", "0afe3a093c961795ee23748dd36a70c1c394fb920eec15264a6318d057470f0d"],
      ["a long id is still the caller's id and is echoed verbatim (AC-2)", "4a0fc5e742eab9657013994247d5647b65f957294349760f570335a51c6db8b8"],
      ["a control character in the id neither mints over it nor breaks the sink's framing", "d36ce644c1c343ba580fd3c090ff0e09172c85b72d2c4ae97a1fb651188f6632"],
    ],
  },
  "tests/server/spine-router.test.ts": {
    title: "AC-2: each lane is defined in its own file under src/server/routers/ and mounted from there",
    states: ["lanes", "procedures"],
    superseded: ["appRouter._def?.record?.[lane]"],
    blocks: [
      ["AC-2: appRouter composes exactly the five module lanes and no other top-level key", "eab7c66fb8216753369bf46f2f877b9fcbe87ad1f327e68513837a401a0f0344"],
      ["AC-2: each lane is defined in its own file under src/server/routers/ and mounted from there", "e61bcbb413617bb9cdeca1075845aa499a760494297e3d88f9d00e2453b95f91"],
      ["AC-2: the composed procedure roster carries spine.health", "83004c133535fd29c1981cd4c2d9f64c39888e6038fcbda13c1b99d6a1c656c2"],
      ["AC-2: createContext echoes an x-request-id header and mints the anonymous actor", "225a6199ce1d46a43a95afda385fd79e16bf95715f8bd204b9faafbe0171fc53"],
      ["AC-2: createContext mints a fresh UUID request id when no header is supplied", "80e834b3b896d0e35613dc9e490e9a9b2124f538b096270803cbd90742467162"],
      ["AC-2: GET /api/trpc/spine.health answers { ok: true, requestId } echoing the supplied x-request-id", "9e796f26f86829542a710a54fcbdfd4279a6bf01dadaff6141c96ca64a7037cb"],
    ],
  },
};

/**
 * B-20: a re-baseline moves exactly the assertion whose law changed and nothing else. The reading
 * is a property of the checkout measured against the recorded pre-fix state above:
 *
 *  - every OTHER test the pre-fix suite held still stands byte for byte (a subset check — a later
 *    increment may add tests here; none may quietly rewrite one this increment did not own);
 *  - while the named test still stands exactly as recorded, the audit is disarmed and green — the
 *    tree simply has not moved that assertion yet, which is a state, not a defect;
 *  - once it has moved, the assertion that replaced it states the post-fix law by the name it
 *    derives from (never a transcribed value), and the superseded expectation is gone from the
 *    suite altogether.
 *
 * No git is consulted: the audit reads only the checkout and this fixture, so it answers the same
 * before the increment lands, after it merges, and in a shallow clone with no `main` ref.
 */
export function assertOnlyOneTestRebaselined(relative: string, title: string): void {
  const recorded = REBASELINED_SUITES[relative];
  expect(recorded, `no pre-fix baseline is recorded for ${relative} — the B-20 audit has nothing to measure against`).toBeTruthy();
  const suite = recorded as RebaselinedSuite;
  expect(suite.title, `the recorded baseline for ${relative} names a different re-baselined test — the audit is pointed at the wrong assertion`).toBe(title);

  const bodies = testBodiesOf(productSource(relative));
  for (const [held, digest] of suite.blocks) {
    if (held === title) continue;
    const standing = bodies.get(held);
    expect(
      standing === undefined ? "<the suite no longer holds this test>" : digestOf(standing),
      `${relative}: ${JSON.stringify(held)} is not the test that stood before — a re-baseline moves only ${JSON.stringify(title)} (B-20)`,
    ).toBe(digest);
  }

  const before = suite.blocks.find(([held]) => held === title)?.[1];
  expect(before, `the recorded baseline for ${relative} holds no digest for ${JSON.stringify(title)}`).toBeTypeOf("string");
  const named = bodies.get(title);
  if (named !== undefined && digestOf(named) === before) return;

  const anchor = suite.anchor ?? title;
  const anchored = [...bodies.values()].filter((body) => body.includes(anchor));
  expect(anchored.length, `${relative}: exactly one test may carry the re-baselined assertion (${JSON.stringify(anchor)}) — ${anchored.length} do`).toBe(1);
  const body = anchored[0] ?? "";
  for (const stated of suite.states) {
    expect(body.includes(stated), `${relative}: the re-baselined assertion must state its law through ${JSON.stringify(stated)} rather than transcribe a value (B-19)`).toBe(true);
  }
  const source = productSource(relative);
  for (const gone of suite.superseded) {
    expect(source.includes(gone), `${relative}: the superseded expectation ${JSON.stringify(gone)} still stands — a re-baseline replaces the law it moved (B-20)`).toBe(false);
  }
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
