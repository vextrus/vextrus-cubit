/**
 * The live stage the upload seam's acceptance is driven on (R-SPINE-020, inc-102's test contract).
 *
 * Mechanics only — nothing here judges the product. It provides what AC-1/2/3 name: a private
 * database built by the tree's own migration lane, a scratch `STORAGE_ROOT`, real accounts made
 * through the shipped sign-up door, a project of a workspace they hold, and a `fetch` bound
 * in-process to the shipped route handlers so `uploadFiles` can speak the protocol without a
 * server. Product modules are loaded by absolute path so a file the Builder has not written yet
 * fails as an assertion naming it rather than as a collection death.
 *
 * Two orderings matter and are honoured below:
 *   - `db/__tests__/support/fixtures.ts` reads `DATABASE_URL` when it loads, so the harness is
 *     imported at the top of this file and the scratch url is published to `process.env` only once
 *     the database exists;
 *   - `STORAGE_ROOT` and `DATABASE_URL` are both published BEFORE any product module that reads
 *     them is imported.
 *
 * Raw SQL is spoken through psql, never a driver import (SEAM-TENANT), and every statement carries
 * the system reason it is made under.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, TENANT_COLUMN } from "../../../../db/__tests__/support/fixtures";
import { ident, lit, run, scalar, withSession } from "../../../../db/__tests__/support/live-sql";

/** The checkout this suite drives — the lane runs at the root of it. */
export const REPO_ROOT: string = process.cwd();

/** The declared homes this acceptance addresses (increment interfaces / test contract). */
export const UPLOADS_MODULE = "src/modules/spine/uploads/index.ts";
export const UPLOADS_STORAGE_MODULE = "src/modules/spine/uploads/storage.ts";
export const UPLOAD_ROUTE = "src/app/api/upload/route.ts";
export const UPLOAD_ID_ROUTE = "src/app/api/upload/[uploadId]/route.ts";
export const DROPZONE_BARREL = "src/ui/patterns/dropzone/index.ts";
export const ERRORS_MODULE = "src/core/errors.ts";
export const STORAGE_SEAM = "src/core/storage/index.ts";

/** The three routes of the test contract. */
export const ROUTES = Object.freeze({
  create: "/api/upload",
  one: (uploadId: string) => `/api/upload/${uploadId}`,
});

/** The env names the acceptance reads (test contract). */
export const STORAGE_ROOT_VAR = "STORAGE_ROOT";

/** The reason every statement this stage makes is recorded under — attributable, like any other. */
const STAGE_REASON = "test: stage a project and its people for the upload seam";

/** The password every staged account is made with. */
const PASSWORD = "correct horse battery staple";

/** The address the sign-up door is told the request came from (the harness states the same one). */
const SIGNUP_ORIGIN = "https://cubit.example";

/** The address the in-process requests are dialled at. Nothing is served: the handlers are called. */
const DIALLED = "http://127.0.0.1:3100";

/* ------------------------------------------------------------------ loading product modules */

/** Import a product module by repo-relative path, asserting it exists first. */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/* ------------------------------------------------------------------ the shapes the seam answers in */

/** A registered refusal, as the register holds it and as the routes answer with it. */
export interface RefusalEntryShape {
  code: string;
  message: string;
  remedy: string;
  severity: string;
  surface: string;
}

/** One drawing a completed upload records (test contract: the PATCH answer's `drawings`). */
export interface DrawingAnswer {
  drawingId: string;
  name: string;
  sha256: string;
  format: string;
  duplicate: boolean;
}

/** The answer a route makes, read as JSON when it carries any. */
export interface Answered {
  status: number;
  body: {
    uploadId?: string;
    receivedBytes?: number;
    chunkBytes?: number;
    size?: number;
    state?: string;
    complete?: boolean;
    drawings?: DrawingAnswer[];
    skipped?: { name: string; reason: string }[];
    refusal?: RefusalEntryShape;
    faultId?: string;
  };
}

/** The storage seam, seen through the surface this acceptance reads. */
export interface StorageSeam {
  makeStorage(options: { root: string; signingSecret: string }): {
    get(tenantId: string, sha256: string): Promise<Uint8Array | null>;
  };
}

/** A fetch, as `uploadFiles` is handed one. */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** The dropzone barrel's client half (test contract). */
export interface UploadFiles {
  (files: { name: string; file: Blob }[], options: { projectId: string; fetch?: FetchLike; onProgress?: (item: unknown) => void }): Promise<unknown[]>;
}

/* ------------------------------------------------------------------ the database and the disk */

let opened: ScratchDb | undefined;
let storageRoot: string | undefined;

/** The scratch database and the scratch storage root, made once per file. */
export async function openStage(): Promise<{ db: ScratchDb; root: string }> {
  if (opened === undefined) {
    opened = await provisionScratchDb();
    process.env["DATABASE_URL"] = opened.urlApp;
  }
  if (storageRoot === undefined) {
    storageRoot = mkdtempSync(join(tmpdir(), "cubit-upload-root-"));
    process.env[STORAGE_ROOT_VAR] = storageRoot;
  }
  return { db: opened, root: storageRoot };
}

/** Take away whatever this file provisioned, whether or not staging got past it. */
export async function closeStage(): Promise<void> {
  const held = opened;
  const root = storageRoot;
  opened = undefined;
  storageRoot = undefined;
  await held?.drop();
  if (root !== undefined) await rm(root, { recursive: true, force: true });
}

/** Where the scratch storage stands — the root the product is told to write under. */
export function root(): string {
  if (storageRoot === undefined) throw new Error("the stage's storage root has not been opened yet");
  return storageRoot;
}

function ownerUrl(): string {
  const held = opened;
  if (held === undefined) throw new Error("the stage's database has not been opened yet");
  return held.urlMigrate;
}

/** Read the store as the system, with the reason recorded — the acceptance's own audit read. */
export function sql(script: string): string[][] {
  return run(ownerUrl(), withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));
}

/** One value out of the store, the same way. */
export function sqlValue(script: string): string {
  return scalar(ownerUrl(), withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));
}

/** How many rows of a table carry this content address, in this tenant. */
export function rowsFor(table: string, tenantId: string, sha256: string): number {
  return Number(sqlValue(`select count(*)::text from ${ident(table)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and sha256 = ${lit(sha256)};`));
}

/* ------------------------------------------------------------------ real people and projects */

/** One staged account: who they are, the workspace sign-up minted, and this device's session. */
export interface Person {
  userId: string;
  email: string;
  tenantId: string;
  cookie: string;
}

interface AuthModule {
  signUp(request: Record<string, unknown>): Promise<{ sessionToken?: string }>;
  SESSION_COOKIE?: string;
}

/** One real account and its personal workspace, made through the shipped sign-up door. */
export async function enrol(label: string): Promise<Person> {
  const auth = await productModule<AuthModule>("src/server/auth/session.ts");
  const cookieName = typeof auth.SESSION_COOKIE === "string" ? auth.SESSION_COOKIE : "cubit_session";
  const marker = `${label}-${randomUUID().slice(0, 8)}`.toLowerCase();
  const email = `${marker}@cubit.test`;
  const answer = await auth.signUp({
    email,
    password: PASSWORD,
    tenantName: `Uploads ${marker}`,
    deviceLabel: "acceptance",
    origin: SIGNUP_ORIGIN,
    requestId: randomUUID(),
  });
  const sessionToken = answer.sessionToken ?? "";
  expect(sessionToken.length, "the sign-up door answers with a session token (R-SPINE-002)").toBeGreaterThan(0);

  const userId = sqlValue(`select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
  const tenantId = sqlValue(`select ${ident(TENANT_COLUMN)}::text from memberships where user_id = ${lit(userId)} limit 1;`);
  return { userId, email, tenantId, cookie: `${cookieName}=${sessionToken}` };
}

/** A project of a workspace, made in the store — the thing an upload is addressed to. */
export function stageProject(tenantId: string, name = "Upload acceptance"): string {
  return sqlValue(`insert into projects (${ident(TENANT_COLUMN)}, name) values (${lit(tenantId)}, ${lit(name)}) returning project_id::text;`);
}

/* ------------------------------------------------------------------ the shipped doors, in process */

interface RouteModule {
  POST?: (request: Request) => Promise<Response>;
  GET?: (request: Request, context: { params: Promise<{ uploadId: string }> }) => Promise<Response>;
  PATCH?: (request: Request, context: { params: Promise<{ uploadId: string }> }) => Promise<Response>;
}

let createRoute: RouteModule | undefined;
let oneRoute: RouteModule | undefined;

/** Both shipped handlers, loaded once. */
export async function loadRoutes(): Promise<void> {
  createRoute ??= await productModule<RouteModule>(UPLOAD_ROUTE);
  oneRoute ??= await productModule<RouteModule>(UPLOAD_ID_ROUTE);
}

/** Which handler a request addresses, and the upload it names — the routes of the test contract. */
async function dispatch(request: Request): Promise<Response> {
  await loadRoutes();
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  expect(segments.slice(0, 2), `nothing but the upload routes is bound in-process (asked for ${url.pathname})`).toEqual(["api", "upload"]);

  if (segments.length === 2) {
    const post = createRoute?.POST;
    expect(typeof post, `${UPLOAD_ROUTE} exports POST (test contract: POST /api/upload)`).toBe("function");
    return (post as (r: Request) => Promise<Response>)(request);
  }

  const uploadId = segments[2] ?? "";
  const context = { params: Promise.resolve({ uploadId }) };
  const handler = request.method === "GET" ? oneRoute?.GET : oneRoute?.PATCH;
  expect(typeof handler, `${UPLOAD_ID_ROUTE} exports ${request.method} (test contract: ${request.method} /api/upload/{uploadId})`).toBe("function");
  return (handler as (r: Request, c: { params: Promise<{ uploadId: string }> }) => Promise<Response>)(request, context);
}

/** Compose the request the handler is handed: the caller's, wearing this session and this address. */
async function requestFor(input: string | URL | Request, init: RequestInit | undefined, cookie: string | null): Promise<Request> {
  const given = input instanceof Request ? input : new Request(new URL(String(input), DIALLED), init);
  const url = new URL(given.url, DIALLED);
  const headers = new Headers(given.headers);
  if (cookie !== null) headers.set("cookie", cookie);
  headers.set("host", url.host);
  const method = given.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : new Uint8Array(await given.arrayBuffer());
  return new Request(url, { method, headers, body });
}

/** What a bound fetch lets a case interpose on, request by request. */
export interface FetchHooks {
  /** Called before every dispatch, with the sequence number of this call and the request made. */
  before?(call: { index: number; method: string; path: string; offset: string | null }): Promise<Response | void> | Response | void;
  /** Called with every answer, before it reaches the caller. */
  after?(call: { index: number; method: string; path: string }, answer: Response): Promise<Response | void> | Response | void;
}

/**
 * A `fetch` bound in-process to the shipped route handlers, wearing one session (AC-1). A case may
 * interpose on any call — that is how an interrupted transfer is staged without a network.
 */
export function boundFetch(cookie: string | null, hooks: FetchHooks = {}): FetchLike {
  let index = 0;
  return async (input, init) => {
    const request = await requestFor(input, init, cookie);
    const call = {
      index: (index += 1),
      method: request.method,
      path: new URL(request.url).pathname,
      offset: request.headers.get("upload-offset"),
    };
    const interposed = await hooks.before?.(call);
    if (interposed instanceof Response) return interposed;
    const answer = await dispatch(request);
    const replaced = await hooks.after?.(call, answer);
    return replaced instanceof Response ? replaced : answer;
  };
}

/** One call to a door, read as the acceptance reads answers. */
export async function call(
  cookie: string | null,
  method: string,
  path: string,
  options: { body?: Uint8Array | string; headers?: Record<string, string> } = {},
): Promise<Answered> {
  const headers = new Headers(options.headers ?? {});
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", typeof options.body === "string" ? "application/json" : "application/octet-stream");
  const request = await requestFor(new URL(path, DIALLED), { method, headers, body: options.body as BodyInit | undefined }, cookie);
  return readAnswer(await dispatch(request));
}

/** An answer's status and its JSON body, or an empty body when it carries none. */
export async function readAnswer(answer: Response): Promise<Answered> {
  const text = await answer.text();
  let body: Answered["body"] = {};
  if (text.trim() !== "") {
    try {
      body = JSON.parse(text) as Answered["body"];
    } catch {
      throw new Error(`the door answered ${answer.status} with a body that is not JSON: ${text.slice(0, 300)}`);
    }
  }
  return { status: answer.status, body };
}

/** Open an upload session the way the contract spells it. */
export async function createUpload(cookie: string | null, input: { projectId: string; name: string; size: number; sha256: string }): Promise<Answered> {
  return call(cookie, "POST", ROUTES.create, { body: JSON.stringify(input) });
}

/** Send one chunk from an offset. */
export async function patchChunk(cookie: string | null, uploadId: string, offset: number, bytes: Uint8Array): Promise<Answered> {
  return call(cookie, "PATCH", ROUTES.one(uploadId), { body: bytes, headers: { "upload-offset": String(offset) } });
}

/** Probe an upload session. */
export async function uploadStatus(cookie: string | null, uploadId: string): Promise<Answered> {
  return call(cookie, "GET", ROUTES.one(uploadId));
}

/* ------------------------------------------------------------------ bytes */

/** The sha256 of some bytes, lowercase hex — node's own digest, which the server must agree with. */
export function sha256Of(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A fixture of the corpus, as bytes. */
export function fixture(relative: string): Uint8Array {
  const path = join(REPO_ROOT, "fixtures", relative);
  expect(existsSync(path), `fixtures/${relative} is part of the declared corpus`).toBe(true);
  return new Uint8Array(readFileSync(path));
}

/**
 * A distinct, structurally whole DXF whose leading bytes are the corpus fixture's own — so a
 * content check that accepts `fixtures/rcc6/rcc6.dxf` accepts this too, and two members built with
 * different labels are two different contents. The head is READ from the fixture rather than
 * transcribed, so a corpus that changes its version group takes these with it.
 */
export function dxfLike(label: string): Uint8Array {
  const source = new TextDecoder().decode(fixture("rcc6/rcc6.dxf"));
  const headerEnd = source.indexOf("\n", source.indexOf("$ACADVER"));
  const versionEnd = source.indexOf("\n", source.indexOf("\n", headerEnd + 1) + 1);
  expect(versionEnd, "the DXF fixture opens with a HEADER section naming $ACADVER").toBeGreaterThan(0);
  const head = source.slice(0, versionEnd + 1);
  const body = ["  0", "ENDSEC", "  0", "SECTION", "  2", "ENTITIES", "  0", "LINE", "  8", label, " 10", "0.0", " 20", "0.0", " 30", "0.0", " 11", "100.0", " 21", "0.0", " 31", "0.0", "  0", "ENDSEC", "  0", "EOF", ""].join("\n");
  return new TextEncoder().encode(head + body);
}

/** The bytes an address holds under a tenant, through the shipped storage seam. */
export async function stored(tenantId: string, sha256: string): Promise<Uint8Array | null> {
  const seam = await productModule<StorageSeam>(STORAGE_SEAM);
  return seam.makeStorage({ root: root(), signingSecret: "acceptance" }).get(tenantId, sha256);
}

/** Where the staging copy of an upload stands, per the increment's declared interfaces. */
export function stagingPath(tenantId: string, uploadId: string): string {
  return join(root(), ".uploads", tenantId, uploadId);
}

/** The register, read from its one home so no test re-spells a code (ARCH-02). */
export async function refusals(): Promise<Readonly<Record<string, RefusalEntryShape>>> {
  const errors = await productModule<{ REFUSALS: Readonly<Record<string, RefusalEntryShape>> }>(ERRORS_MODULE);
  return errors.REFUSALS;
}

/** The registered entry a refusal answer must be, message and remedy included (R-SPINE-062). */
export async function expectRegistered(answer: Answered, code: string, status: number): Promise<void> {
  const register = await refusals();
  const entry = register[code];
  expect(entry, `${code} is registered in ${ERRORS_MODULE} (Q-07: the register is the one home of a code)`).toBeTruthy();
  expect(answer.status, `${code} is answered under ${status} (test contract)`).toBe(status);
  expect(answer.body.refusal?.code, `the answer carries the refusal ${code}`).toBe(code);
  expect(answer.body.refusal?.message, `the refusal's message is the registered one`).toBe(entry?.message);
  expect(answer.body.refusal?.remedy, `the refusal's remedy is the registered one`).toBe(entry?.remedy);
}
