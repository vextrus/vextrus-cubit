/**
 * inc-011 — the tRPC layer whose per-request context IS the tenant scope
 * (R-SPINE-004, SEAM-TENANT, L-ACT-02, C-05, V-DB, B-03).
 *
 * The suite lives in db/__tests__ because every claim below reaches a live database: a
 * TenantCtx is only a TenantCtx if `ctx.db` came from `forTenant`, and the only way to
 * tell that from a mock is to read one tenant's rows and fail to read another's.
 *
 * Two arms, both in this process and neither of them a browser:
 *
 *   - the **route arm** invokes the exported `GET`/`POST` of `/api/trpc/[trpc]` with a
 *     `Request` built by hand (the test contract allows exactly this), which is what makes
 *     the session cookie, the `x-cubit-tenant` header and the tRPC error envelope all real
 *     rather than described. The cookie itself is minted through the product's own
 *     `/api/auth/*` handler in the same process, so it is signed by the secret that will
 *     verify it;
 *   - the **caller arm** drives procedures through `createCaller(ctx)` with a hand-built
 *     TenantCtx, which is the surface AC-3 names for in-process acceptance.
 *
 * Every product module is loaded by an absolute path assembled at run time. A literal
 * `import '../../src/server/root'` is resolved while this file is transformed, so on the
 * day the module does not exist yet vite would fail the whole file and vitest would report
 * "0 test" — no failing assertion at all. Built at run time, a missing module is one named
 * failure in one test.
 *
 * The `import type` lines are the exception, and deliberate: they are erased before the
 * file runs, and they are how `tsc --noEmit` inside `pnpm verify` grades the two claims
 * that are types rather than values — the exact shape of `TenantCtx` and `actPair`'s
 * required members (AC-1, AC-3).
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { REPO, run } from './support/lanes';
import { APP_ROLE, connectAs, endAll, query } from './support/live';
import type { Client } from 'pg';
import type { ScopedDb } from '../../src/core/db';
import type { TenantCtx } from '../../src/server/context';
import type { actPair } from '../../src/server/trpc';

/* ────────────────────────────── the names the spec fixes (C-05) ─────────────────────── */

const TRPC_MODULE = 'src/server/trpc';
const CONTEXT_MODULE = 'src/server/context';
const ROOT_MODULE = 'src/server/root';
const SPINE_ROUTER_MODULE = 'src/server/routers/spine';
const ROUTE_MODULE = 'src/app/api/trpc/[trpc]/route';
const AUTH_ROUTE_MODULE = 'src/app/api/auth/[...all]/route';

/** The directory that decides which namespaces `appRouter` may mount — one file per module. */
const ROUTERS_DIR = ['src', 'server', 'routers'];

/** AC-1: the whole runtime namespace of src/server/trpc.ts, and nothing else. */
const TRPC_EXPORTS: readonly string[] = ['actPair', 'consequenceDigest', 'router', 'tenantProcedure'];

/** The four procedures the test contract names, with the kind each one is. */
const PROCEDURES: readonly { readonly path: string; readonly type: 'query' | 'mutation' }[] = [
  { path: 'spine.whoami', type: 'query' },
  { path: 'spine.members.list', type: 'query' },
  { path: 'spine.members.setRole.preview', type: 'mutation' },
  { path: 'spine.members.setRole.commit', type: 'mutation' },
];

/** The one namespace this increment mounts. */
const SPINE = 'spine';

/** The act pair mounted at `spine.members.setRole` — L-ACT-02's two members, and only those. */
const ACT_PAIR_MEMBERS: readonly string[] = ['commit', 'preview'];

/** The header the active tenant travels on, carrying the tenant slug. */
const TENANT_HEADER = 'x-cubit-tenant';

/** Where `fetchRequestHandler` is mounted; a wrong endpoint cannot resolve a procedure. */
const ENDPOINT = '/api/trpc';

/** SEAM-TENANT: what none of the new files may import — the driver and the schema. */
const BANNED_IMPORTS: readonly string[] = ["'pg'", "'drizzle-orm", 'db/schema'];

/** The role codes `listMembers` speaks (R-SPINE-003's closed set). */
const ROLE_CODES: readonly string[] = ['OWNER', 'ADMIN', 'MEMBER'];

/** The domain codes that surface as the exact TRPCError message. */
const NOT_TENANT_ADMIN = 'NOT_TENANT_ADMIN';
const CONSEQUENCES_NOT_CARRIED = 'CONSEQUENCES_NOT_CARRIED';
const NOT_FOUND = 'NOT_FOUND';

/** C-07 keeps 3210/3211 taken; nothing listens here — the handlers are called directly. */
const ORIGIN = 'http://127.0.0.1:3210';

/** Long enough for better-auth's own minimum, and never a real person's. */
const PASSWORD = 'cubit-inc011-Passw0rd!';

/* ─────────────────────────── the two claims that are types (tsc) ────────────────────── */

/**
 * AC-1: `TenantCtx = { db: ScopedDb; userId: string; email: string; tenantId: string;
 * tenantSlug: string }`. Mutual assignability, so neither a missing member nor an extra one
 * passes. `pnpm verify`'s `tsc --noEmit` is what grades this; the test below only reports it.
 */
type ExpectedTenantCtx = {
  db: ScopedDb;
  userId: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
};
type Mutually<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const TENANT_CTX_IS_THE_DECLARED_SHAPE: Mutually<TenantCtx, ExpectedTenantCtx> = true;

/** AC-3: `actPair` accepts `{ preview, commit }` with **both** members required by its type. */
type ActPairArgument = Parameters<typeof actPair>[0];
type RequiredKeysOf<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];
const ACT_PAIR_REQUIRES_BOTH: 'preview' | 'commit' extends RequiredKeysOf<ActPairArgument>
  ? true
  : false = true;

/* ─────────────────────────────────── loading the tree ───────────────────────────────── */

const at = (...parts: string[]): string => join(REPO, ...parts);
const there = (...parts: string[]): boolean => existsSync(at(...parts));
const read = (...parts: string[]): string => readFileSync(at(...parts), 'utf8');

/** Everything that holds a connection, closed once at the end so vitest can exit. */
const openClients: Client[] = [];
const seamClosers = new Set<() => Promise<void>>();

afterAll(async () => {
  await endAll(openClients);
  openClients.length = 0;
  for (const close of seamClosers) {
    try {
      await close();
    } catch {
      /* a pool that never opened has nothing to close */
    }
  }
  seamClosers.clear();
});

/** A product module, by an absolute path assembled at run time (see the file header). */
async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const path = at(...relative.split('/'));
  const candidates = [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

/** SEAM-TENANT's own module, remembered so its pool is closed however it was reached. */
interface Seam {
  readonly forTenant: (ctx: { tenantId: string }) => unknown;
  readonly runAsSystem: (reason: string) => unknown;
}

async function seam(): Promise<Seam> {
  const module = await importProduct('src/core/db');
  const close = module['closeDb'];
  if (typeof close === 'function') seamClosers.add(close as () => Promise<void>);
  return module as unknown as Seam;
}

/**
 * A connection that can see the spine's rows. FORCEd row-level security binds the owner
 * too, so a raw connection with no `cubit.scope` sees nothing whichever role it is. This is
 * how a claim reads what the seam did without going back through the seam.
 */
let systemOnce: Promise<Client> | undefined;

function systemClient(): Promise<Client> {
  systemOnce ??= (async () => {
    const client = await connectAs(APP_ROLE);
    openClients.push(client);
    await client.query("select set_config('cubit.scope', 'system', false)");
    return client;
  })();
  return systemOnce;
}

/* ───────────────────────────── the shapes tRPC exposes at run time ──────────────────── */

interface ProcedureLike {
  readonly _def: { readonly type?: unknown; readonly procedure?: unknown };
}

interface RouterLike {
  readonly _def: {
    readonly router?: unknown;
    readonly procedures: Record<string, ProcedureLike>;
    readonly record: Record<string, unknown>;
  };
}

function asRouter(value: unknown, what: string): RouterLike {
  const def = (value as { _def?: { router?: unknown } } | undefined)?._def;
  expect(def?.router, `${what} is not a tRPC router`).toBe(true);
  return value as RouterLike;
}

/** Every procedure a router mounts, by its dotted path — tRPC's own flattened record. */
function procedurePaths(router: RouterLike): string[] {
  return Object.keys(router._def.procedures).sort();
}

function procedureType(router: RouterLike, path: string): string {
  const procedure = router._def.procedures[path];
  expect(procedure, `${path} is not mounted`).toBeDefined();
  return String(procedure?._def.type ?? '');
}

/* ──────────────────────────────── the route arm, in process ─────────────────────────── */

interface Answered {
  readonly status: number;
  readonly text: string;
  readonly json: Record<string, unknown>;
}

interface Refusal {
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number;
}

interface RouteCall {
  readonly method?: 'GET' | 'POST';
  readonly cookie?: string;
  /** Absent means the request carries no `x-cubit-tenant` header at all. */
  readonly tenant?: string;
  readonly input?: unknown;
}

async function handlerFor(relative: string, method: string): Promise<
  (request: Request, context: unknown) => Promise<Response>
> {
  const module = await importProduct(relative);
  const handler = module[method];
  expect(typeof handler, `${relative} exports no ${method}`).toBe('function');
  return handler as (request: Request, context: unknown) => Promise<Response>;
}

/** One non-batched tRPC call, straight into the route handler the product exports. */
async function callRoute(procedure: string, call: RouteCall = {}): Promise<Answered> {
  const method = call.method ?? 'GET';
  const query =
    method === 'GET' && call.input !== undefined
      ? `?input=${encodeURIComponent(JSON.stringify(call.input))}`
      : '';
  const headers: Record<string, string> = {};
  if (method === 'POST') headers['content-type'] = 'application/json';
  if (call.cookie !== undefined) headers['cookie'] = call.cookie;
  if (call.tenant !== undefined) headers[TENANT_HEADER] = call.tenant;

  const request = new Request(`${ORIGIN}${ENDPOINT}/${procedure}${query}`, {
    method,
    headers,
    ...(method === 'POST' && call.input !== undefined
      ? { body: JSON.stringify(call.input) }
      : {}),
  });
  const handler = await handlerFor(ROUTE_MODULE, method);
  const response = await handler(request, { params: Promise.resolve({ trpc: [procedure] }) });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${method} ${ENDPOINT}/${procedure} answered ${String(response.status)} with non-JSON: ${text.slice(0, 400)}`,
    );
  }
  return { status: response.status, text, json };
}

/** What a tRPC error envelope says, in the words the contract fixes. */
function refusalOf(answered: Answered): Refusal {
  const error = answered.json['error'] as Record<string, unknown> | undefined;
  const data = (error?.['data'] ?? {}) as Record<string, unknown>;
  return {
    code: String(data['code'] ?? ''),
    message: String(error?.['message'] ?? ''),
    httpStatus: Number(data['httpStatus'] ?? answered.status),
  };
}

/**
 * The payload of a successful call. No transformer is configured, so `result.data` is the
 * value itself — superjson would answer `{ json: … }` here and every read below would miss.
 */
function dataOf(answered: Answered, what: string): Record<string, unknown> {
  const result = answered.json['result'] as { data?: unknown } | undefined;
  expect(
    result?.data,
    `${what} answered ${String(answered.status)}: ${answered.text.slice(0, 400)}`,
  ).toBeDefined();
  return result?.data as Record<string, unknown>;
}

/* ──────────────────────────── a session, through the product's door ─────────────────── */

async function authPost(
  path: string,
  body: unknown,
): Promise<{ readonly status: number; readonly body: string; readonly cookies: string[] }> {
  const handler = await handlerFor(AUTH_ROUTE_MODULE, 'POST');
  const response = await handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ all: path.split('/').filter((part) => part !== '') }) },
  );
  return {
    status: response.status,
    body: await response.text(),
    cookies: response.headers.getSetCookie(),
  };
}

async function authGet(path: string, cookie: string): Promise<{ status: number; body: string }> {
  const handler = await handlerFor(AUTH_ROUTE_MODULE, 'GET');
  const response = await handler(
    new Request(`${ORIGIN}/api/auth${path}`, { headers: { cookie } }),
    { params: Promise.resolve({ all: path.split('/').filter((part) => part !== '') }) },
  );
  return { status: response.status, body: await response.text() };
}

const cookieHeaderOf = (setCookies: readonly string[]): string =>
  setCookies
    .map((header) => header.split(';')[0] ?? '')
    .filter((pair) => pair.includes('='))
    .join('; ');

/* ───────────────────────────── the tenants this file founds ─────────────────────────── */

interface Person {
  readonly userId: string;
  readonly email: string;
}

interface Tenant {
  readonly id: string;
  readonly slug: string;
}

interface Fixture {
  readonly run: string;
  /** The founder's own tenant: the reader is its OWNER and holds a real session. */
  readonly a: Tenant;
  /** A tenant the founder does not hold at all (Q-12's other half). */
  readonly b: Tenant;
  readonly founder: Person;
  readonly hand: Person;
  readonly subject: Person;
  readonly guest: Person;
  readonly cookie: string;
}

/**
 * A founder with a password, their personal tenant, two more members in it, and a second
 * tenant the founder holds nothing in — founded per run so no shared fixture is disturbed.
 *
 * The founder arrives through `/api/auth/sign-up/email`, which is the door a person uses and
 * the one that mints the personal tenant; everybody else is a row, because only the founder
 * needs to sign in. Verification is flipped in the database rather than followed through the
 * outbox: this suite is about tRPC, and the link is J-001's claim, not this one's.
 *
 * Memoised into a promise each test awaits rather than built in `beforeAll`: a throwing
 * `beforeAll` reports its tests as skipped, and a skipped acceptance claim says nothing.
 */
let fixtureOnce: Promise<Fixture> | undefined;

function fixture(): Promise<Fixture> {
  fixtureOnce ??= (async () => {
    const run = randomUUID().slice(0, 8);
    const system = await systemClient();

    // No role word in any address: AC-3 reads the roles out of the Consequence's own JSON.
    const address = (label: string): string => `inc011-${run}-${label}@example.test`;
    const founderEmail = address('founder');

    const signedUp = await authPost('/sign-up/email', {
      email: founderEmail,
      password: PASSWORD,
      name: `inc011 ${run}`,
    });
    expect(
      signedUp.status,
      `POST /api/auth/sign-up/email answered ${String(signedUp.status)}: ${signedUp.body.slice(0, 400)}`,
    ).toBeLessThan(400);

    const founderRows = await query(system, 'select id from public.users where email = $1', [
      founderEmail,
    ]);
    const founderId = String(founderRows[0]?.['id'] ?? '');
    expect(founderId, 'sign-up wrote no user row').not.toBe('');
    await query(system, 'update public.users set email_verified = true where id = $1', [founderId]);

    // R-SPINE-002: the personal tenant is minted in the user-create transaction, so it is
    // already there — and it is the tenant this reader is OWNER of.
    const tenantRows = await query(
      system,
      `select t.id, t.slug, m.role from public.tenants t
         join public.tenant_memberships m on m.tenant_id = t.id
        where m.user_id = $1`,
      [founderId],
    );
    expect(tenantRows.length, 'the founder holds no personal tenant').toBe(1);
    const a: Tenant = {
      id: String(tenantRows[0]?.['id'] ?? ''),
      slug: String(tenantRows[0]?.['slug'] ?? ''),
    };
    expect(String(tenantRows[0]?.['role'] ?? ''), 'the founder is not the OWNER').toBe('owner');

    const mint = async (label: string, tenantId: string, role: string): Promise<Person> => {
      const email = address(label);
      const rows = await query(
        system,
        'insert into public.users (email, name, email_verified) values ($1, $2, true) returning id',
        [email, label],
      );
      const userId = String(rows[0]?.['id'] ?? '');
      expect(userId, `no user row for ${label}`).not.toBe('');
      await query(
        system,
        'insert into public.tenant_memberships (tenant_id, user_id, role) values ($1, $2, $3)',
        [tenantId, userId, role],
      );
      return { userId, email };
    };

    const hand = await mint('hand', a.id, 'member');
    const subject = await mint('subject', a.id, 'member');

    const bRows = await query(
      system,
      'insert into public.tenants (slug, name) values ($1, $2) returning id',
      [`inc011-${run}-elsewhere`, `inc011 ${run} elsewhere`],
    );
    const b: Tenant = {
      id: String(bRows[0]?.['id'] ?? ''),
      slug: `inc011-${run}-elsewhere`,
    };
    expect(b.id, 'the second tenant was not written').not.toBe('');
    const guest = await mint('guest', b.id, 'owner');

    const signedIn = await authPost('/sign-in/email', { email: founderEmail, password: PASSWORD });
    expect(
      signedIn.status,
      `POST /api/auth/sign-in/email answered ${String(signedIn.status)}: ${signedIn.body.slice(0, 400)}`,
    ).toBeLessThan(400);
    const cookie = cookieHeaderOf(signedIn.cookies);
    expect(cookie, 'signing the founder in set no cookie').not.toBe('');

    // The cookie is a session or this file's every AC-2 claim would be red for a reason
    // that has nothing to do with tRPC. The product's own endpoint is what says so.
    const session = await authGet('/get-session', cookie);
    expect(
      session.body,
      `the founder’s cookie carries no session: ${String(session.status)} ${session.body.slice(0, 300)}`,
    ).toContain(founderId);

    return {
      run,
      a,
      b,
      founder: { userId: founderId, email: founderEmail },
      hand,
      subject,
      guest,
      cookie,
    };
  })();
  return fixtureOnce;
}

/** The role a membership holds, read outside the seam — what "wrote nothing" is measured on. */
async function storedRole(tenantId: string, userId: string): Promise<string> {
  const client = await systemClient();
  const rows = await query(
    client,
    'select role from public.tenant_memberships where tenant_id = $1 and user_id = $2',
    [tenantId, userId],
  );
  return String(rows[0]?.['role'] ?? '');
}

/* ─────────────────────────────── the caller arm (AC-3) ──────────────────────────────── */

interface MemberRow {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

interface Consequence {
  readonly consequence: unknown;
  readonly consequenceDigest: string;
}

interface SpineCaller {
  readonly spine: {
    readonly whoami: () => Promise<Record<string, unknown>>;
    readonly members: {
      readonly list: () => Promise<readonly MemberRow[]>;
      readonly setRole: {
        readonly preview: (input: {
          readonly userId: string;
          readonly role: string;
        }) => Promise<Consequence>;
        readonly commit: (input: {
          readonly userId: string;
          readonly role: string;
          readonly consequenceDigest: string;
        }) => Promise<unknown>;
      };
    };
  };
}

/**
 * A caller over a hand-built TenantCtx — `db` from `forTenant`, exactly as `createContext`
 * mints it (SEAM-TENANT). Nothing here can reach a handle another way.
 */
async function callerFor(person: Person, tenant: Tenant): Promise<SpineCaller> {
  const { forTenant } = await seam();
  const root = await importProduct(ROOT_MODULE);
  const createCaller = root['createCaller'];
  expect(typeof createCaller, `${ROOT_MODULE} exports no createCaller`).toBe('function');
  const ctx = {
    db: forTenant({ tenantId: tenant.id }),
    userId: person.userId,
    email: person.email,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
  };
  return (createCaller as (context: unknown) => unknown)(ctx) as SpineCaller;
}

/** What a call did: the value it returned, or the error it threw. Never both. */
type Went = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown };

async function went(action: () => Promise<unknown>): Promise<Went> {
  try {
    return { ok: true, value: await action() };
  } catch (error: unknown) {
    return { ok: false, error };
  }
}

function saidWhat(outcome: Went): string {
  if (outcome.ok) return `it succeeded and returned ${JSON.stringify(outcome.value)}`;
  const error = outcome.error as { code?: unknown; message?: unknown };
  return `[${String(error.code ?? '?')}] ${String(error.message ?? String(outcome.error))}`;
}

/**
 * A TRPCError, read the way a caller reads one: the machine-readable `code` and the message,
 * which the contract fixes to be the domain code verbatim.
 */
function expectTrpcRefusal(outcome: Went, code: string, message: string, what: string): void {
  expect(outcome.ok, `${what} did not refuse: ${saidWhat(outcome)}`).toBe(false);
  if (outcome.ok) return;
  const error = outcome.error as { code?: unknown; message?: unknown };
  expect(String(error.code ?? ''), `${what} refused as ${saidWhat(outcome)}`).toBe(code);
  expect(String(error.message ?? ''), `${what} refused as ${saidWhat(outcome)}`).toBe(message);
}

/* ═══════════════════════════ AC-1 — composition and surface ════════════════════════ */

describe('AC-1 — the composition tRPC is founded on (C-05, SEAM-TENANT, B-03)', () => {
  it('SEAM-TENANT: src/server/trpc.ts exports exactly router, tenantProcedure, actPair and consequenceDigest', async () => {
    const module = await importProduct(TRPC_MODULE);
    // The exactness IS the security property: a bare initTRPC instance or a procedure
    // builder whose context is not TenantCtx would be a documented way past the seam.
    expect(Object.keys(module).sort()).toEqual([...TRPC_EXPORTS]);
    expect(typeof module['router'], 'router is not a router factory').toBe('function');
    expect(typeof module['actPair'], 'actPair is not a function').toBe('function');
    expect(typeof module['consequenceDigest'], 'consequenceDigest is not a function').toBe(
      'function',
    );
    const builder = module['tenantProcedure'] as ProcedureLike | undefined;
    expect(builder?._def.procedure, 'tenantProcedure is not a tRPC procedure builder').toBe(true);
  });

  it('AC-1: src/server/context.ts exports createContext, and TenantCtx is the declared shape', async () => {
    const module = await importProduct(CONTEXT_MODULE);
    expect(typeof module['createContext'], `${CONTEXT_MODULE} exports no createContext`).toBe(
      'function',
    );
    // The shape itself is graded by `tsc --noEmit` in `pnpm verify`; this line only reports
    // that the type-level assertion at the top of the file compiled.
    expect(TENANT_CTX_IS_THE_DECLARED_SHAPE).toBe(true);
  });

  it('AC-1: src/server/root.ts exports appRouter, AppRouter and createCaller', async () => {
    const module = await importProduct(ROOT_MODULE);
    asRouter(module['appRouter'], 'appRouter');
    expect(typeof module['createCaller'], `${ROOT_MODULE} exports no createCaller`).toBe('function');
    // The type is erased at run time; the source is where a reader can see it declared.
    expect(read(`${ROOT_MODULE}.ts`)).toMatch(/AppRouter/);
  });

  it('AC-1: appRouter mounts spine, and every namespace it mounts is a file in src/server/routers', async () => {
    const module = await importProduct(ROOT_MODULE);
    const appRouter = asRouter(module['appRouter'], 'appRouter');
    const namespaces = Object.keys(appRouter._def.record).sort();
    expect(namespaces, 'spine is not mounted').toContain(SPINE);
    // Pinned to the thing that defines the set — one router file per module — rather than
    // to today's count, so a later module founding its own router does not redden this.
    const files = readdirSync(at(...ROUTERS_DIR))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => name.replace(/\.ts$/, ''))
      .sort();
    expect(namespaces).toEqual(files);
    const spineModule = await importProduct(SPINE_ROUTER_MODULE);
    asRouter(spineModule['spineRouter'], 'spineRouter');
  });

  it('C-05: the four contracted procedures are mounted, each as the kind the contract names', async () => {
    const module = await importProduct(ROOT_MODULE);
    const appRouter = asRouter(module['appRouter'], 'appRouter');
    const mounted = procedurePaths(appRouter);
    for (const procedure of PROCEDURES) {
      expect(mounted, `${procedure.path} is not mounted`).toContain(procedure.path);
      expect(procedureType(appRouter, procedure.path), `${procedure.path} is the wrong kind`).toBe(
        procedure.type,
      );
    }
    // L-ACT-02: an act type is a *pair*. The sub-router at spine.members.setRole carries
    // preview and commit, and nothing else — a third member would be an act without a pair.
    const underSetRole = mounted
      .filter((path) => path.startsWith('spine.members.setRole.'))
      .map((path) => path.slice('spine.members.setRole.'.length))
      .sort();
    expect(underSetRole).toEqual([...ACT_PAIR_MEMBERS]);
  });

  it('AC-1: the route hands every /api/trpc/* request to fetchRequestHandler at the contracted endpoint', async () => {
    expect(there(`${ROUTE_MODULE}.ts`), `${ROUTE_MODULE}.ts is not in the tree`).toBe(true);
    const module = await importProduct(ROUTE_MODULE);
    for (const method of ['GET', 'POST']) {
      expect(typeof module[method], `${ROUTE_MODULE} exports no ${method}`).toBe('function');
    }
    const source = read(`${ROUTE_MODULE}.ts`);
    expect(source, 'the route does not use tRPC’s fetch adapter').toMatch(/fetchRequestHandler/);
    expect(source, 'the route does not mount appRouter').toMatch(/appRouter/);
    expect(source, 'the route does not use createContext').toMatch(/createContext/);
    expect(source, `the route does not name the endpoint ${ENDPOINT}`).toContain(ENDPOINT);
  });

  it('SEAM-TENANT: none of the new files imports the driver or the schema, and eslint holds over them', async () => {
    const files = [
      `${TRPC_MODULE}.ts`,
      `${CONTEXT_MODULE}.ts`,
      `${ROOT_MODULE}.ts`,
      `${SPINE_ROUTER_MODULE}.ts`,
      `${ROUTE_MODULE}.ts`,
    ];
    for (const file of files) {
      expect(there(file), `${file} is not in the tree`).toBe(true);
      const source = read(file);
      for (const banned of BANNED_IMPORTS) {
        expect(
          source.includes(`from ${banned}`) || source.includes(banned.replace("'", 'from "')),
          `${file} imports ${banned} — SEAM-TENANT keeps the driver and the schema in src/core/db.ts`,
        ).toBe(false);
      }
    }
    // cubit/db-seam-only is bound to src/**; the rule reporting nothing here is the claim.
    const linted = await run('pnpm', ['exec', 'eslint', ...files]);
    expect(linted.code, `eslint over the new files said:\n${linted.merged}`).toBe(0);
  });
});

/* ═════════════════ AC-2 — TenantCtx minting over the route (R-SPINE-004) ═══════════ */

describe('AC-2 — the request whose context is the tenant scope (R-SPINE-004, Q-12)', () => {
  it('R-SPINE-004: a request with no session cookie is refused UNAUTHORIZED', async () => {
    const answered = await callRoute('spine.whoami');
    const refusal = refusalOf(answered);
    expect(refusal.code, `spine.whoami without a session answered: ${answered.text.slice(0, 400)}`).toBe(
      'UNAUTHORIZED',
    );
  });

  it('SEAM-TENANT: every mounted procedure refuses UNAUTHORIZED without a session — none escapes the seam', async () => {
    const module = await importProduct(ROOT_MODULE);
    const appRouter = asRouter(module['appRouter'], 'appRouter');
    // Derived from what is mounted rather than from the four the contract names today: the
    // rule is that createContext authenticates *before* any procedure runs, and it has to
    // hold for every procedure a later increment mounts too.
    for (const path of procedurePaths(appRouter)) {
      const type = procedureType(appRouter, path);
      const answered = await callRoute(path, {
        method: type === 'mutation' ? 'POST' : 'GET',
        input: type === 'mutation' ? {} : undefined,
      });
      expect(
        refusalOf(answered).code,
        `${path} without a session answered: ${answered.text.slice(0, 300)}`,
      ).toBe('UNAUTHORIZED');
    }
  });

  it('R-SPINE-004: a signed-in request naming a held slug is answered whoami for exactly that tenant', async () => {
    const found = await fixture();
    const answered = await callRoute('spine.whoami', {
      cookie: found.cookie,
      tenant: found.a.slug,
    });
    const data = dataOf(answered, 'spine.whoami');
    // B-03 / "no transformer": result.data is the value itself, not a superjson envelope.
    expect(data).toEqual({
      userId: found.founder.userId,
      email: found.founder.email,
      tenantId: found.a.id,
      tenantSlug: found.a.slug,
    });
  });

  it('R-SPINE-004: spine.members.list answers the module’s rows for exactly the header’s tenant', async () => {
    const found = await fixture();
    const answered = await callRoute('spine.members.list', {
      cookie: found.cookie,
      tenant: found.a.slug,
    });
    const rows = dataOf(answered, 'spine.members.list') as unknown as readonly MemberRow[];
    expect(Array.isArray(rows), 'spine.members.list did not answer a list').toBe(true);

    const byId = new Map(rows.map((row) => [row.userId, row]));
    // The three members this tenant has — proof `ctx.db` was minted with forTenant for the
    // header's tenant, since the same handle is what listMembers reads through.
    expect(byId.get(found.founder.userId)?.email).toBe(found.founder.email);
    expect(byId.get(found.founder.userId)?.role).toBe('OWNER');
    expect(byId.get(found.hand.userId)?.email).toBe(found.hand.email);
    expect(byId.get(found.subject.userId)?.email).toBe(found.subject.email);
    for (const row of rows) {
      expect(ROLE_CODES, `${row.email} holds ${row.role}, outside the closed set`).toContain(
        row.role,
      );
      // The module's own row, JSON-plain: the three named keys are present and string-valued.
      // Amended per arbitration (2026-08-24): C-05's frozen surface does not include response row
      // shapes, so a later increment may lawfully widen this row — presence, not an exact census.
      expect(Object.keys(row)).toEqual(expect.arrayContaining(['email', 'role', 'userId']));
      expect(typeof row.userId).toBe('string');
      expect(typeof row.email).toBe('string');
    }
    // …and nobody else's tenant leaks into it.
    expect(byId.has(found.guest.userId), 'a member of another tenant is listed').toBe(false);
  });

  it('Q-12: a signed-in request with the header absent, unknown, or naming a slug the reader does not hold is NOT_FOUND', async () => {
    const found = await fixture();
    const cases: readonly { readonly what: string; readonly tenant?: string }[] = [
      { what: 'no x-cubit-tenant header at all' },
      { what: 'a slug nobody holds', tenant: `nobody-holds-${randomUUID().slice(0, 8)}` },
      { what: 'a slug this reader does not hold', tenant: found.b.slug },
    ];
    for (const one of cases) {
      const answered = await callRoute('spine.whoami', {
        cookie: found.cookie,
        ...(one.tenant === undefined ? {} : { tenant: one.tenant }),
      });
      const refusal = refusalOf(answered);
      expect(refusal.code, `${one.what} answered: ${answered.text.slice(0, 300)}`).toBe(NOT_FOUND);
      expect(refusal.message, `${one.what} answered another message`).toBe(NOT_FOUND);
    }
  });
});

/* ═════════════════════ AC-3 — the act pair convention (L-ACT-02) ═══════════════════ */

describe('AC-3 — preview and commit, and the digest between them (L-ACT-02)', () => {
  it('L-ACT-02: actPair takes a required preview and a required commit and returns their sub-router', async () => {
    const module = await importProduct(TRPC_MODULE);
    const tenantProcedure = module['tenantProcedure'] as {
      mutation: (resolver: (options: unknown) => unknown) => unknown;
    };
    const built = (module['actPair'] as (pair: { preview: unknown; commit: unknown }) => unknown)({
      preview: tenantProcedure.mutation(() => ({ consequence: {}, consequenceDigest: '' })),
      commit: tenantProcedure.mutation(() => undefined),
    });
    const pair = asRouter(built, 'the router actPair returned');
    expect(procedurePaths(pair)).toEqual([...ACT_PAIR_MEMBERS]);
    // Both members required by the type — graded by `tsc --noEmit` in `pnpm verify`.
    expect(ACT_PAIR_REQUIRES_BOTH).toBe(true);
  });

  it('L-ACT-02: preview computes the Consequence from current state and writes nothing', async () => {
    const found = await fixture();
    const caller = await callerFor(found.founder, found.a);
    const before = await storedRole(found.a.id, found.subject.userId);
    expect(before, 'the subject did not start as a member').toBe('member');

    const previewed = await caller.spine.members.setRole.preview({
      userId: found.subject.userId,
      role: 'admin',
    });
    expect(typeof previewed.consequenceDigest, 'preview answered no digest').toBe('string');
    expect(previewed.consequenceDigest, 'the digest is empty').not.toBe('');

    const said = JSON.stringify(previewed.consequence).toLowerCase();
    expect(said, 'the Consequence does not name the member it is about').toContain(
      found.subject.userId.toLowerCase(),
    );
    expect(said, 'the Consequence does not name the current role').toContain('member');
    expect(said, 'the Consequence does not name the proposed role').toContain('admin');

    // …without writing: a preview that moved a row would be an act, not a proposal.
    expect(await storedRole(found.a.id, found.subject.userId)).toBe('member');
  });

  it('L-ACT-02: commit carries the digest, performs the change, and the list shows it', async () => {
    const found = await fixture();
    const caller = await callerFor(found.founder, found.a);
    const previewed = await caller.spine.members.setRole.preview({
      userId: found.subject.userId,
      role: 'admin',
    });
    await caller.spine.members.setRole.commit({
      userId: found.subject.userId,
      role: 'admin',
      consequenceDigest: previewed.consequenceDigest,
    });

    const rows = await caller.spine.members.list();
    const row = rows.find((member) => member.userId === found.subject.userId);
    expect(row?.role, 'spine.members.list does not show the committed role').toBe('ADMIN');
    expect(await storedRole(found.a.id, found.subject.userId)).toBe('admin');

    // The Consequence is computed from *current* state, so the next preview names the role
    // the commit just wrote as the current one.
    const next = await caller.spine.members.setRole.preview({
      userId: found.subject.userId,
      role: 'member',
    });
    expect(JSON.stringify(next.consequence).toLowerCase()).toContain('admin');
  });

  it(`L-ACT-02: a digest current state does not produce refuses CONFLICT / ${CONSEQUENCES_NOT_CARRIED}`, async () => {
    const found = await fixture();
    const caller = await callerFor(found.founder, found.a);
    const before = await storedRole(found.a.id, found.hand.userId);
    const outcome = await went(async () =>
      caller.spine.members.setRole.commit({
        userId: found.hand.userId,
        role: 'admin',
        consequenceDigest: `fabricated-${randomUUID()}`,
      }),
    );
    expectTrpcRefusal(outcome, 'CONFLICT', CONSEQUENCES_NOT_CARRIED, 'a commit carrying a fabricated digest');
    expect(await storedRole(found.a.id, found.hand.userId), 'the refused commit wrote').toBe(before);
  });

  it(`R-SPINE-003: an actor the module refuses gets FORBIDDEN / ${NOT_TENANT_ADMIN}, and nothing moves`, async () => {
    const found = await fixture();
    const caller = await callerFor(found.hand, found.a);
    const before = await storedRole(found.a.id, found.subject.userId);

    // The pair is attempted as the member would attempt it. Whether the refusal lands on
    // the proposal or on the act, it is the module's code that must surface — and the row
    // must not move either way.
    const previewed = await went(async () =>
      caller.spine.members.setRole.preview({ userId: found.subject.userId, role: 'owner' }),
    );
    if (previewed.ok) {
      const digest = (previewed.value as Consequence).consequenceDigest;
      const committed = await went(async () =>
        caller.spine.members.setRole.commit({
          userId: found.subject.userId,
          role: 'owner',
          consequenceDigest: digest,
        }),
      );
      expectTrpcRefusal(committed, 'FORBIDDEN', NOT_TENANT_ADMIN, 'a MEMBER’s commit');
    } else {
      expectTrpcRefusal(previewed, 'FORBIDDEN', NOT_TENANT_ADMIN, 'a MEMBER’s preview');
    }
    expect(await storedRole(found.a.id, found.subject.userId), 'the MEMBER’s attempt wrote').toBe(
      before,
    );
  });

  it(`AC-3: a target with no membership in the caller’s tenant is ${NOT_FOUND} from both preview and commit`, async () => {
    const found = await fixture();
    const caller = await callerFor(found.founder, found.a);
    const strangers = [found.guest.userId, randomUUID()];

    for (const userId of strangers) {
      const previewed = await went(async () =>
        caller.spine.members.setRole.preview({ userId, role: 'admin' }),
      );
      expectTrpcRefusal(previewed, NOT_FOUND, NOT_FOUND, `preview against ${userId}`);

      const committed = await went(async () =>
        caller.spine.members.setRole.commit({
          userId,
          role: 'admin',
          consequenceDigest: `unusable-${randomUUID()}`,
        }),
      );
      expectTrpcRefusal(committed, NOT_FOUND, NOT_FOUND, `commit against ${userId}`);
    }
    // The stranger's own tenant is untouched by either attempt.
    expect(await storedRole(found.b.id, found.guest.userId)).toBe('owner');
  });

  it('C-05: role is a zod enum of owner|admin|member — anything else is BAD_REQUEST', async () => {
    const found = await fixture();
    const answered = await callRoute('spine.members.setRole.preview', {
      method: 'POST',
      cookie: found.cookie,
      tenant: found.a.slug,
      input: { userId: found.hand.userId, role: 'wizard' },
    });
    expect(
      refusalOf(answered).code,
      `a role outside the enum answered: ${answered.text.slice(0, 300)}`,
    ).toBe('BAD_REQUEST');

    const accepted = await callRoute('spine.members.setRole.preview', {
      method: 'POST',
      cookie: found.cookie,
      tenant: found.a.slug,
      input: { userId: found.hand.userId, role: 'admin' },
    });
    expect(dataOf(accepted, 'preview over the route')).toHaveProperty('consequenceDigest');
  });
});
