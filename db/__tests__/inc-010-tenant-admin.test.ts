/**
 * inc-010 acceptance — tenant administration on S-Settings (AC-1, AC-2, AC-3, AC-4).
 *
 * R-SPINE-003, S-Settings, J-002, R-UI-050, R-SPINE-062, P-ADMIN, SEAM-TENANT.
 *
 * It lives under db/__tests__ because it opens live connections and spawns `pnpm e2e`, which
 * drops and recreates a database and builds the app. `pnpm verify`'s vitest stage and CI both
 * run without a provisioned cluster, so a lane-spawning test in the root config would be red
 * for a reason that has nothing to do with the code under review — the reading inc-001
 * recorded and inc-008/inc-009 followed. Run it as
 *
 *     pnpm test:db db/__tests__/inc-010-tenant-admin.test.ts
 *
 * A bare `pnpm vitest run db/__tests__/…` finds no tests: the root config excludes db/**.
 *
 * Four arms:
 *
 *   SURFACE — what the tree has to carry: the migration, the probes, the module's exports,
 *   the journey and its page object, the declared fixtures. Read off the filesystem.
 *
 *   SCHEMA — the cold database `pnpm test:db` provisioned: the two new tables, both RLS arms
 *   on each, append-only grants on `acts`, and `tenant_memberships.role` closed over the
 *   three role names. Read as consequences (a refused write), never as DDL text.
 *
 *   SEAM — `src/modules/spine/members` driven directly over SEAM-TENANT handles, against a
 *   tenant this file founds for itself so no fixture is disturbed. The whole invitation
 *   lifecycle, the role change, both removal outcomes and all three refusals.
 *
 *   LANE + SERVED — `pnpm e2e --journey J-002` and `--journey J-000` exit green, and the
 *   build the last of them produced is served once and driven over HTTP with a real session
 *   cookie (plus one browser, for the axe scan AC-2 asks for). R-UI-031 makes the URL the
 *   source of truth, so a fresh GET of /t/cubit-e2e/settings is the right instrument for a
 *   server-rendered list; what genuinely needs a browser is the journey's and the held-out
 *   set's.
 *
 * ── Recorded readings ──────────────────────────────────────────────────────────────────
 *
 * R1. **The seam's call shape.** The Increment Spec fixes the eight exported names and says
 *     they all take "a SEAM-TENANT scoped handle/ctx", and AC-6 requires the seam to refuse
 *     a MEMBER's writes — which it can only do if it knows who is acting. So the first
 *     argument is read as the tenant-admin context `{ tenantId, userId }`: the scope the
 *     handle is taken for and the member taking it. Everything else is named, never
 *     positional. This is the Verifier's reading, pinned here in the public set on purpose —
 *     the held-out set never depends on it.
 *
 * R2. **The seam speaks role codes; the table stores role names.** `TENANT_ROLES` is the
 *     exported closed set (OWNER, ADMIN, MEMBER) and the screen renders those codes verbatim
 *     (design §2), while AC-1 fixes `tenant_memberships.role ∈ owner|admin|member`. So the
 *     module's arguments and results carry the codes and the column carries the lower-case
 *     name.
 *
 * R3. **A refusal is a rejection carrying its code.** SEAM-TENANT already refuses this way
 *     (`src/core/db.ts` throws an Error whose message spells the code, exercised by
 *     src/core/__tests__/seam-refusals.test.ts). A `code` property is accepted too — what is
 *     asserted is that the code reaches the caller, not how it is packaged.
 *
 * ── Two objections this file deliberately does not settle ──────────────────────────────
 *
 * AC-4 says J-000 must stay green while AC-2 says this screen is built to
 * docs/design/s-settings.md. As the tree stands those two cannot both hold, in two separate
 * places, and neither file that would have to move is in this increment's ownership:
 *
 *   O1. **The empty state's action.** tests/e2e/shell.spec.ts (the J-000 shell slice) opens
 *       `/t/{slug}/settings`, clicks `empty-state-action`, waits for the sessions URL and
 *       expects a `session-row` — "Settings teaches the one real destination there is today".
 *       docs/design/s-settings.md §4 makes that same control move focus to `invite-email`.
 *       A control cannot both navigate away and keep the reader on the form.
 *
 *   O2. **The empty state's words.** docs/design/s-settings.md §8 re-words
 *       `tenant.settings.empty.teach` and `.empty.action`; db/__tests__/inc-009-shell.test.ts
 *       reads those two keys' values out of docs/design/shell.md §7 and asserts they are on
 *       `/settings`. That file is Verifier-locked, and shell.md is not this increment's to
 *       amend.
 *
 * Neither is forced here. Nothing below asserts where `empty-state-action` goes, and the
 * empty state's copy is read out of `src/app/t/strings.ts` at run time *through the locked
 * keys* — which is exactly what AC-2 asks for ("carrying the copy under the … string keys")
 * and says nothing about which wording those keys should hold. The lane assertion is left as
 * AC-4 words it: `pnpm e2e --journey J-000` exits 0. Resolving O1 and O2 is an arbitration
 * between committed documents — most plainly by widening ownership to docs/design/shell.md
 * and tests/e2e/shell.spec.ts, whose settings paragraph this screen supersedes — and not
 * something an acceptance file should decide by quietly pinning one horn.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { REPO, isNested, lastLine, run } from './support/lanes';
import type { Ran } from './support/lanes';
import { APP_ROLE, MIGRATE_ROLE, connectAs, connectTo, endAll, query, urlFor } from './support/live';
import type { Client } from 'pg';
import type { Row } from './support/live';
import { loadSeam, ready, rowsOf, sql } from './support/seam';
import type { Seam } from './support/seam';
import { probes } from './probes/index';

/* ────────────────────────────── what the contract fixes ────────────────────────────── */

/** C-05: the journey and the page object the test contract names for J-002. */
const JOURNEY = ['tests', 'e2e', 'j-002-tenant-admin.spec.ts'];
const PAGE_OBJECT = ['tests', 'e2e', 'pages', 'settings.ts'];

/** The Design Decision this screen is graded against, and the source of its copy. */
const DESIGN_DOC = ['docs', 'design', 's-settings.md'];

/** AC-1: one new migration, and the journal that registers it. */
const MIGRATION_TAG = '0002';
const JOURNAL = ['db', 'migrations', 'meta', '_journal.json'];

/** The module the Increment Spec's interfaces section founds, and what it exports. */
const MEMBERS_MODULE = 'src/modules/spine/members';
const MEMBERS_EXPORTS: readonly string[] = [
  'listMembers',
  'listInvitations',
  'inviteMember',
  'resendInvitation',
  'revokeInvitation',
  'setMemberRole',
  'removeMember',
  'TENANT_ROLES',
];

/** SEAM-TENANT: the driver and the schema live in src/core/db.ts and nowhere else. */
const BANNED_IMPORTS: readonly string[] = ["'pg'", "'drizzle-orm", 'db/schema'];

/** AC-1: the two tenant-carrying tables 0002 founds, with the columns the criterion names. */
const NEW_TABLES: readonly { readonly table: string; readonly columns: readonly string[] }[] = [
  {
    table: 'invitations',
    columns: ['id', 'tenant_id', 'email', 'role', 'invited_by', 'status', 'created_at'],
  },
  {
    table: 'acts',
    columns: ['id', 'tenant_id', 'actor_id', 'act_type', 'campaign_ref', 'created_at'],
  },
];

/** AC-1: `tenant_memberships.role` holds exactly these three, and nothing else. */
const ROLE_NAMES: readonly string[] = ['owner', 'admin', 'member'];

/** R-SPINE-003 / the Increment Spec: the closed role set the module exports. */
const ROLE_CODES: readonly string[] = ['OWNER', 'ADMIN', 'MEMBER'];

/** The three codes AC-3 puts in the closed taxonomy. Each is made to fire below. */
const MEMBER_HAS_ACTS = 'MEMBER_HAS_ACTS';
const NOT_TENANT_ADMIN = 'NOT_TENANT_ADMIN';
const INVITATION_NOT_PENDING = 'INVITATION_NOT_PENDING';

/** C-05's test ids for this screen. Every one of them is spoken by the journey surface. */
const TESTIDS: readonly string[] = [
  'tenant-settings',
  'members-section',
  'member-row',
  'member-role',
  'member-remove',
  'invitations-section',
  'invitation-row',
  'invite-email',
  'invite-role',
  'invite-submit',
  'invitation-resend',
  'invitation-revoke',
  'settings-refusal',
  'refusal-code',
  'refusal-remedy',
  'permission-denied',
  'empty-state',
  'empty-state-action',
];

/** The test ids the document itself carries for an OWNER with no pending invitation. */
const SERVED_TESTIDS: readonly string[] = [
  'tenant-settings',
  'members-section',
  'member-row',
  'member-role',
  'member-remove',
  'invitations-section',
  'invite-email',
  'invite-role',
  'invite-submit',
  'empty-state',
  'empty-state-action',
];

/** J-002's checkpoints, as the Increment Spec names them. */
const CHECKPOINTS: readonly string[] = [
  'invite-pending',
  'resend-outbox-grows',
  'revoke-clears-pending',
  'role-persists',
  'remove-succeeds',
  'remove-refused',
];

/** The seeded actors the test contract fixes, in the existing fixture tenant. */
const TENANT_SLUG = 'cubit-e2e';
const PASSWORD = 'cubit-e2e-Passw0rd!';
const OWNER_EMAIL = 'owner@cubit-e2e.test';
const WORKER_EMAIL = 'worker@cubit-e2e.test';
const IDLE_EMAIL = 'idle@cubit-e2e.test';
const INVITEE_EMAIL = 'invitee@cubit-e2e.test';

/** email → the role name the seeded membership carries (AC-4's procedures). */
const ROSTER: readonly (readonly [string, string])[] = [
  [OWNER_EMAIL, 'owner'],
  [WORKER_EMAIL, 'member'],
  [IDLE_EMAIL, 'member'],
];

/** The fixture files the Increment Spec declares. */
const FIXTURES: readonly string[] = [
  'users.json',
  'accounts.json',
  'tenant-memberships.json',
  'acts.json',
];

/** The route the whole increment is about. */
const SETTINGS_PATH = `/t/${TENANT_SLUG}/settings`;

/** The lane's success line, exactly as scripts/lib/lane.mjs says it (C-06). */
const LANE_OK = /^e2e: ok \(\d+(\.\d+)?s\)$/;

/** A build, a cold database and a browser are minutes, twice over. */
const LANE_BUDGET_MS = 1_500_000;

/** The e2e lane's own database and build output, which this file reads after the lane ran. */
const E2E_DB = (() => {
  const name = process.env['CUBIT_E2E_DB'];
  return name === undefined || name.trim() === '' ? 'cubit_e2e' : name;
})();
const E2E_DIST = '.next-e2e';

/** Q-11 / AC-2: the impacts that block. Nothing below serious is this criterion's business. */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/* ─────────────────────────────────── small helpers ─────────────────────────────────── */

const at = (...parts: string[]): string => join(REPO, ...parts);
const there = (...parts: string[]): boolean => existsSync(at(...parts));
const read = (...parts: string[]): string => readFileSync(at(...parts), 'utf8');

const open: Client[] = [];
let seam: Seam | undefined;

afterAll(async () => {
  await endAll(open);
  open.length = 0;
  if (seam !== undefined) {
    await seam.closeDb();
    seam = undefined;
  }
});

/**
 * A connection that can see the spine's rows. FORCEd row-level security binds the owner too,
 * so a raw connection with no `cubit.scope` sees nothing whichever role it is.
 */
async function systemClient(url?: string): Promise<Client> {
  const client = url === undefined ? await connectAs(APP_ROLE) : await connectTo(url);
  open.push(client);
  await client.query("select set_config('cubit.scope', 'system', false)");
  return client;
}

/** The migrate role, unscoped by default like every other login role. */
async function ownerClient(): Promise<Client> {
  const client = await connectAs(MIGRATE_ROLE);
  open.push(client);
  await client.query("select set_config('cubit.scope', 'system', false)");
  return client;
}

/**
 * A product module, loaded by an absolute path assembled at run time.
 *
 * A *literal* specifier is resolved while this file is transformed, so one
 * `import '../../src/modules/spine/members'` would make vite fail the whole file and vitest
 * would report "0 test" — no failing assertion at all, on the very day the module does not
 * exist yet. Built at run time, a missing module is one named failure in one test.
 */
async function importProduct(relative: string): Promise<Record<string, unknown>> {
  const path = at(...relative.split('/'));
  const candidates = [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) throw new Error(`${relative} is not in the tree`);
  return (await import(pathToFileURL(found).href)) as Record<string, unknown>;
}

/** A port nobody is on, asked of the OS rather than guessed (C-07 keeps 3210/3211 taken). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => (port === 0 ? reject(new Error('no free port')) : resolve(port)));
    });
  });
}

/** The last of a lane's output, which is where its reason for failing is. */
function tail(merged: string): string {
  return merged
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(-40)
    .join('\n');
}

/** Text as a reader sees it: React escapes apostrophes and angle brackets on the way out. */
function decodeEntities(html: string): string {
  return html
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/* ─────────────────────────────── the decided copy (§7, §8) ─────────────────────────── */

/** One markdown table under a `## <n>.` heading, as rows of cells. */
function tableRows(section: string): string[][] {
  const rows: string[][] = [];
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function section(doc: string, from: number, to: number): string {
  const opened = doc.split(new RegExp(`^## ${String(from)}\\.`, 'm'))[1] ?? '';
  return opened.split(new RegExp(`^## ${String(to)}\\.`, 'm'))[0] ?? '';
}

/**
 * §8's copy table: key → value. The designer owns the words; nothing is typed in here. */
let copyOnce: Map<string, string> | undefined;

function decidedCopy(): Map<string, string> {
  if (copyOnce !== undefined) return copyOnce;
  const rows = tableRows(section(read(...DESIGN_DOC), 8, 9));
  const found = new Map<string, string>();
  for (const cells of rows) {
    const key = /`([^`]+)`/.exec(cells[0] ?? '')?.[1];
    const value = cells[1];
    if (key === undefined || value === undefined) continue;
    found.set(key, value);
  }
  if (found.size < 20) {
    throw new Error(`docs/design/s-settings.md §8 yielded ${String(found.size)} copy rows`);
  }
  copyOnce = found;
  return found;
}

function copy(key: string): string {
  const value = decidedCopy().get(key);
  expect(value, `docs/design/s-settings.md §8 has no row for ${key}`).toBeDefined();
  return value ?? '';
}

/* ────────────────────────────── the members seam, as read ─────────────────────────── */

/** R1: the tenant-admin context every exported function takes. */
interface AdminCtx {
  readonly tenantId: string;
  readonly userId: string;
}

interface MemberRow {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

interface InvitationRow {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
}

/** The module as its callers see it, typed by what the Increment Spec says it exports. */
interface Members {
  readonly TENANT_ROLES: unknown;
  readonly listMembers: (ctx: AdminCtx) => Promise<readonly MemberRow[]>;
  readonly listInvitations: (ctx: AdminCtx) => Promise<readonly InvitationRow[]>;
  readonly inviteMember: (
    ctx: AdminCtx,
    args: { email: string; role: string },
  ) => Promise<InvitationRow>;
  readonly resendInvitation: (ctx: AdminCtx, args: { invitationId: string }) => Promise<unknown>;
  readonly revokeInvitation: (ctx: AdminCtx, args: { invitationId: string }) => Promise<unknown>;
  readonly setMemberRole: (
    ctx: AdminCtx,
    args: { userId: string; role: string },
  ) => Promise<unknown>;
  readonly removeMember: (ctx: AdminCtx, args: { userId: string }) => Promise<unknown>;
}

async function loadMembers(): Promise<Members> {
  return (await importProduct(MEMBERS_MODULE)) as unknown as Members;
}

/** TENANT_ROLES as a set of strings, however the module chose to shape it (R2). */
function roleCodesOf(exported: unknown): string[] {
  if (Array.isArray(exported)) return exported.map((role) => String(role));
  if (typeof exported === 'object' && exported !== null) {
    return Object.values(exported as Record<string, unknown>).map((role) => String(role));
  }
  return [];
}

/** R3: the code a rejection carried, or undefined if it carried none. */
function refusalCodeOf(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) return String(error).includes(code);
  const carried = (error as { code?: unknown }).code;
  if (typeof carried === 'string' && carried === code) return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.includes(code);
}

/** What a call did. `expect.rejects` cannot say "and nothing else changed" in the same breath. */
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
  const error = outcome.error;
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** A refusal, by its code, and nothing weaker — a rejection with no code is not a refusal. */
function expectRefusal(outcome: Went, code: string, what: string): void {
  expect(outcome.ok, `${what} did not refuse — ${saidWhat(outcome)}`).toBe(false);
  if (outcome.ok) return;
  expect(
    refusalCodeOf(outcome.error, code),
    `${what} refused, but not as ${code}: ${saidWhat(outcome)}`,
  ).toBe(true);
}

/* ─────────────────────────── a tenant of this file's own (SEAM) ─────────────────────── */

interface Fixture {
  readonly tenantId: string;
  readonly owner: string;
  readonly worker: string;
  readonly idle: string;
  readonly run: string;
}

/**
 * A tenant, three members and one act, founded through the seam in the cold `cubit_test`
 * database `pnpm test:db` provisioned. Its own tenant on purpose: the fixture tenant belongs
 * to the e2e lane, and a seam test that mutated it would make the served arm's reads depend
 * on the order vitest happened to run in.
 *
 * Memoised into a promise each test awaits rather than built in `beforeAll`: a throwing
 * `beforeAll` reports its tests as skipped, and a skipped acceptance claim says nothing.
 */
let fixtureOnce: Promise<Fixture> | undefined;

function seamFixture(): Promise<Fixture> {
  fixtureOnce ??= (async () => {
    seam ??= await loadSeam();
    const run = randomUUID().slice(0, 8);
    const system = await ready(seam.runAsSystem('inc-010 acceptance: founding its own tenant'));

    const tenantRows = await rowsOf(
      system,
      sql`insert into tenants (slug, name) values (${`inc010-${run}`}, ${`inc010 ${run}`}) returning id`,
    );
    const tenantId = String(tenantRows[0]?.['id'] ?? '');
    expect(tenantId, 'runAsSystem could not found the acceptance tenant').not.toBe('');

    const mint = async (label: string, role: string): Promise<string> => {
      const rows = await rowsOf(
        system,
        sql`insert into users (email, name) values (${`inc010-${run}-${label}@example.test`}, ${label}) returning id`,
      );
      const userId = String(rows[0]?.['id'] ?? '');
      expect(userId, `runAsSystem could not mint the ${label} user`).not.toBe('');
      await system.execute(
        sql`insert into tenant_memberships (tenant_id, user_id, role) values (${tenantId}, ${userId}, ${role})`,
      );
      return userId;
    };

    // The founder reads first: listMembers is ordered by membership createdAt ascending
    // (design §2), so they are minted in the order the screen lists them.
    const owner = await mint('owner', 'owner');
    const worker = await mint('worker', 'member');
    const idle = await mint('idle', 'member');

    // AC-5's substrate: one act on an open campaign. Written through a *tenant-scoped*
    // handle, which is how the product will write acts — the append-only grant and the
    // policy's WITH CHECK arm both have to allow a tenant its own row.
    const scoped = await ready(seam.forTenant({ tenantId }));
    await scoped.execute(
      sql`insert into acts (tenant_id, actor_id, act_type, campaign_ref)
          values (${tenantId}, ${worker}, ${'measure'}, ${`campaign-${run}`})`,
    );

    return { tenantId, owner, worker, idle, run };
  })();
  return fixtureOnce;
}

/** How many rows of a table belong to the acceptance tenant, read outside the seam. */
async function tenantRowCount(table: string, tenantId: string): Promise<number> {
  const client = await systemClient();
  const rows = await query(
    client,
    `select count(*)::int as n from public."${table}" where tenant_id = $1`,
    [tenantId],
  );
  return Number(rows[0]?.['n'] ?? -1);
}

/** The outbox rows sent to an address, newest first — the mail seam is a table (J-001). */
async function outboxFor(email: string, url?: string): Promise<Row[]> {
  const client = await systemClient(url);
  return query(
    client,
    `select url, created_at from public.auth_mail_outbox
      where to_email = $1 order by created_at desc, id desc`,
    [email],
  );
}

/* ─────────────────────────────── the lanes and the server ─────────────────────────── */

/**
 * Both journeys, in order, once for every claim that reads either.
 *
 * J-002 first, then J-000: each `pnpm e2e` run drops and recreates its database and reseeds
 * it, so the tree the served arm reads afterwards is the one J-000 left — the fixture roster
 * exactly as seeded, with no invitation pending and nobody removed. Running them the other
 * way round would make AC-2's empty state depend on what J-002 did to the fixture tenant.
 */
let lanesOnce: Promise<{ readonly j002: Ran; readonly j000: Ran }> | undefined;

function laneRuns(): Promise<{ readonly j002: Ran; readonly j000: Ran }> {
  lanesOnce ??= (async () => {
    const j002 = await run('pnpm', ['run', 'e2e', '--journey', 'J-002']);
    const j000 = await run('pnpm', ['run', 'e2e', '--journey', 'J-000']);
    return { j002, j000 };
  })();
  return lanesOnce;
}

interface Served {
  readonly port: number;
  readonly stop: () => Promise<void>;
}

let servedOnce: Promise<Served> | undefined;

/**
 * The build the lanes produced, served once against the database they seeded. This costs a
 * `next start` and nothing else — a second `next build` would prove nothing and take minutes,
 * and a fresh distDir would rewrite the locked tsconfig on its way past.
 */
function servedApp(): Promise<Served> {
  servedOnce ??= (async () => {
    await laneRuns();
    if (!there(E2E_DIST)) {
      throw new Error(`${E2E_DIST} is not in the tree — the e2e lane never got as far as a build`);
    }
    const port = await freePort();
    return { port, stop: await serveBuild(port) };
  })();
  return servedOnce;
}

afterAll(async () => {
  if (servedOnce === undefined) return;
  try {
    await (await servedOnce).stop();
  } catch {
    /* it never came up; the failing tests already say why */
  }
});

/**
 * The e2e build, on a port of its own, against the e2e database. Its own process group:
 * `next start` is a parent, and killing the pid alone can leave a worker holding the port.
 */
async function serveBuild(port: number): Promise<() => Promise<void>> {
  const server = spawn(
    join(REPO, 'node_modules', '.bin', 'next'),
    ['start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: REPO,
      env: {
        ...process.env,
        DATABASE_URL: urlFor(E2E_DB, APP_ROLE),
        NEXT_DIST_DIR: E2E_DIST,
        BETTER_AUTH_URL: `http://127.0.0.1:${String(port)}`,
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  );
  let said = '';
  const collect = (chunk: Buffer): void => {
    said += chunk.toString('utf8');
  };
  server.stdout?.on('data', collect);
  server.stderr?.on('data', collect);

  const stop = async (): Promise<void> => {
    if (server.exitCode !== null || server.pid === undefined) return;
    const pid = server.pid;
    await new Promise<void>((resolve) => {
      const hard = setTimeout(() => {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          /* already gone */
        }
      }, 5_000);
      server.on('close', () => {
        clearTimeout(hard);
        resolve();
      });
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        clearTimeout(hard);
        resolve();
      }
    });
  };

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited ${String(server.exitCode)} before it served:\n${said}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${String(port)}/`, { redirect: 'manual' });
      await response.text();
      if (response.status < 500) return stop;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  await stop();
  throw new Error(`the served build did not answer on ${String(port)} within 120s:\n${said}`);
}

/* ──────────────────────────────── a session, over HTTP ──────────────────────────────── */

type Jar = Map<string, string>;

function absorb(response: Response, jar: Jar): void {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0] ?? '';
    const split = pair.indexOf('=');
    if (split <= 0) continue;
    jar.set(pair.slice(0, split).trim(), pair.slice(split + 1));
  }
}

const cookieHeader = (jar: Jar): string =>
  [...jar].map(([name, value]) => `${name}=${value}`).join('; ');

interface Answered {
  readonly status: number;
  readonly url: string;
  readonly body: string;
  readonly location: string | null;
}

async function ask(url: string, jar: Jar): Promise<Answered> {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: jar.size === 0 ? {} : { cookie: cookieHeader(jar) },
  });
  absorb(response, jar);
  return {
    status: response.status,
    url,
    body: await response.text(),
    location: response.headers.get('location'),
  };
}

async function follow(url: string, jar: Jar): Promise<Answered> {
  let current = url;
  for (let hop = 0; hop < 8; hop += 1) {
    const answered = await ask(current, jar);
    if (answered.status < 300 || answered.status >= 400 || answered.location === null) {
      return { ...answered, url: current };
    }
    current = new URL(answered.location, current).toString();
  }
  throw new Error(`more than 8 redirects from ${url}`);
}

async function post(url: string, body: unknown, jar: Jar): Promise<Answered> {
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      ...(jar.size === 0 ? {} : { cookie: cookieHeader(jar) }),
    },
    body: JSON.stringify(body),
  });
  absorb(response, jar);
  return {
    status: response.status,
    url,
    body: await response.text(),
    location: response.headers.get('location'),
  };
}

/**
 * A seeded actor, signed in through the product's own credential endpoint.
 *
 * The test contract fixes the password and says the roster is seeded with a real better-auth
 * credential hash, so this is the same sign-in a person performs — a session row written by
 * hand would prove the screen renders for a session the guard never issued.
 */
async function signedIn(email: string): Promise<Jar> {
  const { port } = await servedApp();
  const jar: Jar = new Map();
  const answered = await post(
    `http://127.0.0.1:${String(port)}/api/auth/sign-in/email`,
    { email, password: PASSWORD },
    jar,
  );
  expect(
    answered.status,
    `POST /api/auth/sign-in/email as ${email} answered ${String(answered.status)}: ${answered.body.slice(0, 300)}`,
  ).toBeLessThan(400);
  expect(jar.size, `signing in as ${email} set no cookie`).toBeGreaterThan(0);
  return jar;
}

/** The settings screen, as the seeded owner receives it. Memoised: one GET, many claims. */
let ownerSettingsOnce: Promise<Answered> | undefined;

function ownerSettings(): Promise<Answered> {
  ownerSettingsOnce ??= (async () => {
    const { port } = await servedApp();
    const jar = await signedIn(OWNER_EMAIL);
    const answered = await follow(`http://127.0.0.1:${String(port)}${SETTINGS_PATH}`, jar);
    expect(
      answered.status,
      `GET ${SETTINGS_PATH} as ${OWNER_EMAIL} answered ${String(answered.status)} at ${answered.url}`,
    ).toBe(200);
    return answered;
  })();
  return ownerSettingsOnce;
}

const carries = (html: string, testId: string): boolean =>
  html.includes(`data-testid="${testId}"`);

/** The slice of a document from a row's opening tag to the next row's, as text. */
function rowText(html: string, testId: string, email: string): string {
  const marker = `data-email="${email}"`;
  const found = html.indexOf(marker);
  if (found === -1) return '';
  const start = html.lastIndexOf('<', found);
  const next = html.indexOf(`data-testid="${testId}"`, found + marker.length);
  const end = next === -1 ? html.length : html.lastIndexOf('<', next);
  return decodeEntities(html.slice(start, end).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

/* ═══════════════════════════════════ SURFACE ═══════════════════════════════════════ */

describe('inc-010 — the committed surface (AC-1, AC-4)', () => {
  it('AC-4 / C-05: the J-002 journey and its page object are committed, titled J-002, and speak the whole contract', () => {
    expect(there(...JOURNEY), `${join(...JOURNEY)} is not in the tree`).toBe(true);
    expect(there(...PAGE_OBJECT), `${join(...PAGE_OBJECT)} is not in the tree`).toBe(true);

    const spec = read(...JOURNEY);
    const surface = `${spec}\n${read(...PAGE_OBJECT)}`;

    // `--journey J-002` is Playwright's grep over the full title path: a spec that never
    // says J-002 is a journey nothing selects, and a journey nobody runs.
    expect(spec, 'the journey never names J-002, so --journey J-002 selects nothing').toContain(
      'J-002',
    );
    expect(spec, 'the journey does not import its page object (tests/e2e/pages/settings.ts)').toMatch(
      /pages\/settings/,
    );

    expect(surface, `neither the journey nor its page object opens ${SETTINGS_PATH}`).toContain(
      `/t/${TENANT_SLUG}/settings`,
    );
    for (const testid of TESTIDS) {
      expect(surface, `neither the journey nor its page object names ${testid}`).toContain(testid);
    }
    for (const checkpoint of CHECKPOINTS) {
      expect(
        surface,
        `the journey names no “${checkpoint}” checkpoint; J-002's segments are [${CHECKPOINTS.join(', ')}]`,
      ).toContain(checkpoint);
    }

    // AC-4's own words: the walk ends on the refusal, by code, with worker@ still listed.
    expect(surface, `the journey never names ${MEMBER_HAS_ACTS}`).toContain(MEMBER_HAS_ACTS);
    for (const email of [INVITEE_EMAIL, IDLE_EMAIL, WORKER_EMAIL]) {
      expect(surface, `the journey never drives ${email}`).toContain(email);
    }
  });

  it('AC-1: migration 0002 is committed and registered in the journal, and 0000/0001 are untouched', () => {
    const migrations = ['0000_core_founding.sql', '0001_spine_auth.sql'];
    for (const name of migrations) {
      expect(there('db', 'migrations', name), `db/migrations/${name} left the tree`).toBe(true);
    }

    const journal = JSON.parse(read(...JOURNAL)) as { entries?: { tag?: string }[] };
    const tags = (journal.entries ?? []).map((entry) => String(entry.tag ?? ''));
    // The landed migrations are never edited or renumbered — they are superseded.
    for (const name of migrations) {
      expect(tags, `${name} is no longer registered in the journal`).toContain(
        name.replace(/\.sql$/, ''),
      );
    }
    const added = tags.filter((tag) => tag.startsWith(MIGRATION_TAG));
    expect(
      added.length,
      `the journal registers no ${MIGRATION_TAG}_* migration; its tags are [${tags.join(', ')}]`,
    ).toBe(1);
    const tag = added[0] ?? '';
    expect(
      there('db', 'migrations', `${tag}.sql`),
      `the journal registers ${tag} but db/migrations/${tag}.sql is not in the tree`,
    ).toBe(true);
  });

  it('AC-1: both new tables are registered in db/__tests__/probes, so the RLS enumeration exercises them', async () => {
    const registered = await probes();
    for (const { table } of NEW_TABLES) {
      expect(
        registered.has(table),
        `no probe registers public.${table}; the RLS enumeration refuses to pass over a tenant-carrying table it cannot exercise`,
      ).toBe(true);
    }
  });

  it('AC-1: src/modules/spine/members exports the whole interface and holds no driver or schema import (SEAM-TENANT)', async () => {
    const members = (await loadMembers()) as unknown as Record<string, unknown>;
    for (const name of MEMBERS_EXPORTS) {
      expect(members[name], `${MEMBERS_MODULE} does not export ${name}`).toBeDefined();
    }

    // R-SPINE-003's closed role set, as a value. Exactly three: the Bible names three.
    const codes = roleCodesOf(members['TENANT_ROLES']);
    expect([...codes].sort(), `TENANT_ROLES is not the closed set the Bible names`).toEqual(
      [...ROLE_CODES].sort(),
    );

    // SEAM-TENANT: "driver and schema imports lint-banned outside src/core/db.ts". The lint
    // rule is the law; this reads the module itself so a suppression cannot hide it.
    const dir = at(...MEMBERS_MODULE.split('/'));
    const sources = walkFiles(dir).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
    expect(sources.length, `${MEMBERS_MODULE} holds no TypeScript`).toBeGreaterThan(0);
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const banned of BANNED_IMPORTS) {
        const importLines = text
          .split('\n')
          .filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line) && line.includes(banned));
        expect(
          importLines,
          `${file.slice(REPO.length + 1)} imports ${banned} — SEAM-TENANT keeps the driver and the schema in src/core/db.ts`,
        ).toEqual([]);
      }
    }
  });

  it('AC-4: the declared fixture files are committed', () => {
    for (const file of FIXTURES) {
      expect(
        there('fixtures', 'e2e', file),
        `fixtures/e2e/${file} is not in the tree — the Increment Spec declares it`,
      ).toBe(true);
    }
  });
});

/**
 * Every file at or under a path, absolute. Whether the module is a directory of files or a
 * single one is the Builder's arrangement; that none of them holds a driver is the law.
 */
function walkFiles(path: string): string[] {
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`]) {
    if (!existsSync(candidate)) continue;
    if (!statSync(candidate).isDirectory()) return [candidate];
    const found: string[] = [];
    for (const entry of readdirSync(candidate, { withFileTypes: true })) {
      found.push(...walkFiles(join(candidate, entry.name)));
    }
    return found;
  }
  return [];
}

/* ═══════════════════════════════════ SCHEMA ═══════════════════════════════════════ */

describe('AC-1 — the schema 0002 founds (SEAM-TENANT, R-SPINE-004)', () => {
  it('founds invitations and acts, tenant-carrying, with the columns the criterion names', async () => {
    const client = await ownerClient();
    for (const { table, columns } of NEW_TABLES) {
      const rows = await query(
        client,
        `select column_name from information_schema.columns
          where table_schema = 'public' and table_name = $1`,
        [table],
      );
      const present = new Set(rows.map((row) => String(row['column_name'])));
      expect(present.size, `public.${table} does not exist in the migrated database`).toBeGreaterThan(
        0,
      );
      const missing = columns.filter((column) => !present.has(column));
      expect(missing, `public.${table} is missing ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('arms row-level security on both tables, FORCEd so the owner is bound by it too', async () => {
    const client = await ownerClient();
    for (const { table } of NEW_TABLES) {
      const rel = await query(
        client,
        `select relrowsecurity, relforcerowsecurity from pg_class
          where oid = ('public.' || $1)::regclass`,
        [table],
      );
      expect(rel[0]?.['relrowsecurity'], `public.${table} has row-level security off`).toBe(true);
      expect(
        rel[0]?.['relforcerowsecurity'],
        `public.${table} does not FORCE row-level security, so its owner walks past every policy`,
      ).toBe(true);
      const policies = await query(
        client,
        `select policyname from pg_policies where schemaname = 'public' and tablename = $1`,
        [table],
      );
      expect(policies.length, `public.${table} carries no policy at all`).toBeGreaterThan(0);
    }
    // What the two arms actually *do* is not asserted here twice over: the tables are
    // registered as probes above, and db/__tests__/rls-enumeration.test.ts drives the
    // scoped read, the RLS refusal and the cross-tenant write refusal on every
    // tenant-carrying table it discovers. AC-6's held-out set asks the same of the
    // fixture tenant's rows from another tenant's scope.
  });

  it('keeps acts append-only: the app role may add to the ledger and may never rewrite it', async () => {
    const client = await ownerClient();
    const rows = await query(
      client,
      `select privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'acts' and grantee = $1`,
      [APP_ROLE],
    );
    const granted = new Set(rows.map((row) => String(row['privilege_type'])));
    expect(granted.has('SELECT'), `${APP_ROLE} cannot read public.acts`).toBe(true);
    expect(granted.has('INSERT'), `${APP_ROLE} cannot append to public.acts`).toBe(true);
    // Append-only is the whole point of a ledger: an act that can be edited or deleted is
    // not a record of what happened.
    expect(granted.has('UPDATE'), `${APP_ROLE} may UPDATE public.acts — the ledger is not append-only`).toBe(
      false,
    );
    expect(granted.has('DELETE'), `${APP_ROLE} may DELETE public.acts — the ledger is not append-only`).toBe(
      false,
    );
  });

  it('closes tenant_memberships.role over owner|admin|member and nothing else', async () => {
    const fixture = await seamFixture();
    const client = await systemClient();

    // Each of the three the criterion names is writable — a constraint that closed the
    // column over two of them would pass a "a fourth is refused" test on its own.
    for (const role of ROLE_NAMES) {
      const user = await query(
        client,
        `insert into public.users (email, name) values ($1, $2) returning id`,
        [`inc010-${fixture.run}-role-${role}@example.test`, role],
      );
      const userId = String(user[0]?.['id'] ?? '');
      const written = await went(() =>
        client.query(
          `insert into public.tenant_memberships (tenant_id, user_id, role) values ($1, $2, $3)`,
          [fixture.tenantId, userId, role],
        ),
      );
      expect(written.ok, `tenant_memberships refused the role "${role}": ${saidWhat(written)}`).toBe(
        true,
      );
    }

    // And a fourth is refused by the database itself, not by a caller who remembered to check.
    const user = await query(
      client,
      `insert into public.users (email, name) values ($1, $2) returning id`,
      [`inc010-${fixture.run}-role-outside@example.test`, 'outside'],
    );
    const outsider = String(user[0]?.['id'] ?? '');
    const refused = await went(() =>
      client.query(
        `insert into public.tenant_memberships (tenant_id, user_id, role) values ($1, $2, $3)`,
        [fixture.tenantId, outsider, 'superuser'],
      ),
    );
    expect(
      refused.ok,
      `tenant_memberships accepted the role "superuser"; AC-1 closes the column over ${ROLE_NAMES.join('|')}`,
    ).toBe(false);
    if (refused.ok) return;
    expect(
      (refused.error as { code?: unknown }).code,
      `the role outside the closed set was refused, but not by a check constraint: ${saidWhat(refused)}`,
    ).toBe('23514');
  });
});

/* ══════════════════════════════════════ SEAM ═══════════════════════════════════════ */

describe('AC-3 — the invitation lifecycle over SEAM-TENANT handles (R-SPINE-003)', () => {
  it('lists every membership with its role, in the order the screen reads them', async () => {
    const fixture = await seamFixture();
    const members = await loadMembers();
    const listed = await members.listMembers({ tenantId: fixture.tenantId, userId: fixture.owner });

    const byId = new Map(listed.map((member) => [member.userId, member]));
    for (const [userId, label] of [
      [fixture.owner, 'owner'],
      [fixture.worker, 'worker'],
      [fixture.idle, 'idle'],
    ] as const) {
      const member = byId.get(userId);
      expect(member, `listMembers omits the ${label} membership`).toBeDefined();
      expect(member?.email, `the ${label} member is listed without an email`).toContain('@');
      expect(
        ROLE_CODES,
        `the ${label} member's role is "${String(member?.role)}", which is outside TENANT_ROLES`,
      ).toContain(String(member?.role));
    }
    // Design §2: membership createdAt ascending, so the founder reads first and the list
    // never reshuffles under the reader.
    const order = listed.map((member) => member.userId);
    expect(
      order.indexOf(fixture.owner),
      'listMembers does not list the founder first (design §2: createdAt ascending)',
    ).toBe(0);
  });

  it('invites by email: a pending invitation, and one mail with an absolute url in the outbox', async () => {
    const fixture = await seamFixture();
    const members = await loadMembers();
    const email = `inc010-${fixture.run}-invitee@example.test`;

    const before = (await outboxFor(email)).length;
    const invitation = await members.inviteMember(
      { tenantId: fixture.tenantId, userId: fixture.owner },
      { email, role: 'MEMBER' },
    );
    expect(invitation.id, 'inviteMember returned no invitation id').toBeTruthy();
    expect(invitation.status, 'a new invitation is not pending').toBe('pending');

    const listed = await members.listInvitations({
      tenantId: fixture.tenantId,
      userId: fixture.owner,
    });
    expect(
      listed.some((row) => row.email === email && row.status === 'pending'),
      `listInvitations does not list ${email} as pending after inviteMember`,
    ).toBe(true);

    const outbox = await outboxFor(email);
    expect(
      outbox.length,
      `inviteMember landed no mail for ${email} in auth_mail_outbox`,
    ).toBeGreaterThan(before);
    const url = String(outbox[0]?.['url'] ?? '');
    // "Absolute" is what makes a link in a mail followable from outside the app.
    expect(url, `the invitation mail's url is not absolute: "${url}"`).toMatch(/^https?:\/\/\S+$/);
  });

  it('resends the same invitation as a further mail, and revokes it out of the pending list without deleting history', async () => {
    const fixture = await seamFixture();
    const members = await loadMembers();
    const ctx = { tenantId: fixture.tenantId, userId: fixture.owner };
    const email = `inc010-${fixture.run}-resend@example.test`;

    const invitation = await members.inviteMember(ctx, { email, role: 'ADMIN' });
    const afterInvite = (await outboxFor(email)).length;

    await members.resendInvitation(ctx, { invitationId: invitation.id });
    const afterResend = (await outboxFor(email)).length;
    expect(
      afterResend,
      `resendInvitation appended no further outbox row for ${email}`,
    ).toBeGreaterThan(afterInvite);

    // Still one invitation: resending sends the same invitation again (design §4).
    const storedBefore = await tenantRowCount('invitations', fixture.tenantId);

    await members.revokeInvitation(ctx, { invitationId: invitation.id });
    const listed = await members.listInvitations(ctx);
    expect(
      listed.filter((row) => row.email === email && row.status === 'pending'),
      `revokeInvitation left ${email} pending`,
    ).toEqual([]);

    // Interpretation 5 / AC-3: revoke keeps history — the row leaves the pending list, not
    // the table.
    expect(
      await tenantRowCount('invitations', fixture.tenantId),
      'revokeInvitation deleted the invitation row; history is not deleted',
    ).toBe(storedBefore);
  });

  it(`refuses ${INVITATION_NOT_PENDING} when a revoked invitation is resent or revoked again`, async () => {
    const fixture = await seamFixture();
    const members = await loadMembers();
    const ctx = { tenantId: fixture.tenantId, userId: fixture.owner };
    const email = `inc010-${fixture.run}-stale@example.test`;

    const invitation = await members.inviteMember(ctx, { email, role: 'MEMBER' });
    await members.revokeInvitation(ctx, { invitationId: invitation.id });

    expectRefusal(
      await went(() => members.resendInvitation(ctx, { invitationId: invitation.id })),
      INVITATION_NOT_PENDING,
      'resending an invitation that is no longer pending',
    );
    expectRefusal(
      await went(() => members.revokeInvitation(ctx, { invitationId: invitation.id })),
      INVITATION_NOT_PENDING,
      'revoking an invitation that is no longer pending',
    );
  });
});

describe('AC-3 / AC-1 — role management and removal over the seam (R-SPINE-003)', () => {
  it('changes a member’s role over the closed set, and the change is in the table', async () => {
    const fixture = await seamFixture();
    const members = await loadMembers();
    const ctx = { tenantId: fixture.tenantId, userId: fixture.owner };

    await members.setMemberRole(ctx, { userId: fixture.idle, role: 'ADMIN' });

    const listed = await members.listMembers(ctx);
    expect(
      listed.find((member) => member.userId === fixture.idle)?.role,
      'setMemberRole did not change the role listMembers reports',
    ).toBe('ADMIN');

    // R2: the seam speaks codes, the column carries names — and the change persists, which
    // is what "survives a reload" means once the screen is out of the picture.
    const client = await systemClient();
    const rows = await query(
      client,
      'select role from public.tenant_memberships where tenant_id = $1 and user_id = $2',
      [fixture.tenantId, fixture.idle],
    );
    expect(String(rows[0]?.['role'] ?? ''), 'the membership row still holds the old role').toBe(
      'admin',
    );
  });

  it(`refuses ${MEMBER_HAS_ACTS} while the member holds an act on an open campaign, and changes nothing`, async () => {
    const fixture = await seamFixture();
    const members = await loadMembers();
    const ctx = { tenantId: fixture.tenantId, userId: fixture.owner };

    const membershipsBefore = await tenantRowCount('tenant_memberships', fixture.tenantId);
    const actsBefore = await tenantRowCount('acts', fixture.tenantId);

    expectRefusal(
      await went(() => members.removeMember(ctx, { userId: fixture.worker })),
      MEMBER_HAS_ACTS,
      'removing a member who holds an act with campaign_ref set',
    );

    // "changes nothing — no partial write": the membership is still there, and so is the act.
    const client = await systemClient();
    const rows = await query(
      client,
      'select role from public.tenant_memberships where tenant_id = $1 and user_id = $2',
      [fixture.tenantId, fixture.worker],
    );
    expect(rows.length, 'the refused removal deleted the membership anyway').toBe(1);
    expect(
      await tenantRowCount('tenant_memberships', fixture.tenantId),
      'the refused removal changed the membership count',
    ).toBe(membershipsBefore);
    expect(
      await tenantRowCount('acts', fixture.tenantId),
      'the refused removal touched the acts ledger',
    ).toBe(actsBefore);

    expect(
      (await members.listMembers(ctx)).some((member) => member.userId === fixture.worker),
      'the refused member is no longer listed — the row is shown, never hidden (R-UI-050 partial)',
    ).toBe(true);
  });

  it('removes a member who holds no acts', async () => {
    const fixture = await seamFixture();
    const members = await loadMembers();
    const ctx = { tenantId: fixture.tenantId, userId: fixture.owner };

    await members.removeMember(ctx, { userId: fixture.idle });

    expect(
      (await members.listMembers(ctx)).some((member) => member.userId === fixture.idle),
      'removeMember left the member listed',
    ).toBe(false);

    const client = await systemClient();
    const rows = await query(
      client,
      'select id from public.tenant_memberships where tenant_id = $1 and user_id = $2',
      [fixture.tenantId, fixture.idle],
    );
    expect(rows.length, 'removeMember left the membership row in the table').toBe(0);
  });

  it(`refuses ${NOT_TENANT_ADMIN} to a member who is not an administrator (P-ADMIN)`, async () => {
    const fixture = await seamFixture();
    const members = await loadMembers();
    // Interpretation 2 of the Design Decision: OWNER and ADMIN administer; a MEMBER does not.
    const asMember = { tenantId: fixture.tenantId, userId: fixture.worker };

    expectRefusal(
      await went(() =>
        members.inviteMember(asMember, {
          email: `inc010-${fixture.run}-denied@example.test`,
          role: 'MEMBER',
        }),
      ),
      NOT_TENANT_ADMIN,
      'inviting as a MEMBER',
    );
    expectRefusal(
      await went(() => members.setMemberRole(asMember, { userId: fixture.owner, role: 'MEMBER' })),
      NOT_TENANT_ADMIN,
      'changing a role as a MEMBER',
    );
    expectRefusal(
      await went(() => members.removeMember(asMember, { userId: fixture.owner })),
      NOT_TENANT_ADMIN,
      'removing a member as a MEMBER',
    );
  });
});

/* ══════════════════════════════════ LANE + SERVED ═══════════════════════════════════ */

describe('AC-4 — both journeys are green in the lane', () => {
  /**
   * One test for both, because AC-4 is one claim: J-002 turns green *and* J-000 stays green.
   * Split in two, the J-000 half would be the only assertion in this whole file that passes
   * against the tree as it stands — a regression guard cannot be red for a feature that does
   * not exist yet, and a green test shipped with red acceptance is a green nobody reads.
   * Together they are one thing the increment either did or did not do.
   */
  it(
    '`pnpm e2e --journey J-002` exits 0 having really selected j-002-tenant-admin.spec.ts, and `--journey J-000` is still green',
    async (ctx) => {
      if (isNested()) ctx.skip();
      const { j002, j000 } = await laneRuns();

      expect(j002.code, `pnpm e2e --journey J-002 exited ${String(j002.code)}\n${tail(j002.merged)}`).toBe(
        0,
      );
      // The contract line is on stdout; the build, the migrations and Playwright's report are
      // detail on stderr (C-06).
      expect(lastLine(j002.stdout), tail(j002.merged)).toMatch(LANE_OK);
      // `--journey` is a Playwright title grep, so a spec whose titles do not carry J-002 is
      // a journey the Golden Path never runs. The runner names the file of every test it
      // selected, which is the honest way to ask whether the grep reached this one.
      expect(
        j002.merged.includes('j-002-tenant-admin.spec.ts'),
        `the J-002 run never mentions j-002-tenant-admin.spec.ts — do its titles carry "J-002"?\n${tail(j002.merged)}`,
      ).toBe(true);

      // "J-000 must merely stay green": the smoke path and the shell slice, untouched.
      expect(j000.code, `pnpm e2e --journey J-000 exited ${String(j000.code)}\n${tail(j000.merged)}`).toBe(
        0,
      );
      expect(lastLine(j000.stdout), tail(j000.merged)).toMatch(LANE_OK);
    },
    LANE_BUDGET_MS,
  );

  it(
    'the seeded roster the test contract fixes is in the e2e database, acts and all',
    async (ctx) => {
      if (isNested()) ctx.skip();
      await laneRuns();
      const client = await systemClient(urlFor(E2E_DB, APP_ROLE));

      for (const [email, role] of ROSTER) {
        const rows = await query(
          client,
          `select m.role, u.email_verified from public.tenant_memberships m
             join public.users u on u.id = m.user_id
             join public.tenants t on t.id = m.tenant_id
            where u.email = $1 and t.slug = $2`,
          [email, TENANT_SLUG],
        );
        expect(rows.length, `${email} is not a seeded member of ${TENANT_SLUG}`).toBe(1);
        expect(String(rows[0]?.['role'] ?? ''), `${email} is seeded with the wrong role`).toBe(role);
        expect(
          rows[0]?.['email_verified'],
          `${email} is seeded unverified, so the journey cannot sign in as them`,
        ).toBe(true);
      }

      // AC-4: worker@ holds an act on an open campaign — the substrate MEMBER_HAS_ACTS is
      // about. Interpretation 1: at M0 every act whose campaign_ref is set is on an open
      // campaign, because nothing can close one yet.
      const acts = await query(
        client,
        `select a.campaign_ref from public.acts a
           join public.users u on u.id = a.actor_id
          where u.email = $1 and a.campaign_ref is not null`,
        [WORKER_EMAIL],
      );
      expect(
        acts.length,
        `${WORKER_EMAIL} holds no seeded act with campaign_ref set, so the removal refusal cannot fire`,
      ).toBeGreaterThan(0);

      const idle = await query(
        client,
        `select a.id from public.acts a join public.users u on u.id = a.actor_id where u.email = $1`,
        [IDLE_EMAIL],
      );
      expect(idle.length, `${IDLE_EMAIL} holds acts, so their removal would not succeed`).toBe(0);
    },
    LANE_BUDGET_MS,
  );
});

describe('AC-2 — the screen the Design Decision decided, as the server sends it', () => {
  it(
    'renders the members section: one row per member, each with its email and its role code',
    async (ctx) => {
      if (isNested()) ctx.skip();
      const page = await ownerSettings();
      const html = page.body;

      for (const testid of SERVED_TESTIDS) {
        expect(carries(html, testid), `${SETTINGS_PATH} carries no ${testid}`).toBe(true);
      }

      // The h1 and the lead are §1's, read from the Design Decision rather than typed here.
      const text = decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
      expect(text, 'the settings area does not carry its title').toContain(
        copy('tenant.settings.title'),
      );
      expect(text, 'the settings area does not carry its lead').toContain(
        copy('tenant.settings.lead'),
      );
      expect(text, 'the members section is not headed').toContain(copy('tenant.members.title'));
      expect(text, 'the invitations section is not headed').toContain(
        copy('tenant.invitations.title'),
      );

      // §2: a row per member, addressed by the email it carries, showing the role code.
      for (const [email, role] of ROSTER) {
        const row = rowText(html, 'member-row', email);
        expect(row, `no member-row carries data-email="${email}"`).not.toBe('');
        expect(row, `${email}'s row does not show their email`).toContain(email);
        const code = copy(`tenant.role.${role}`);
        expect(row, `${email}'s member-role does not read ${code}`).toContain(code);
      }
      // The reader's own row is marked and offers no acts (Interpretation 4).
      expect(
        html,
        'the signed-in reader’s own row is not marked data-current (design §2)',
      ).toContain('data-current="true"');
    },
    LANE_BUDGET_MS,
  );

  it(
    'renders the invite form over the three roles, and the invitations empty state through the locked keys',
    async (ctx) => {
      if (isNested()) ctx.skip();
      const page = await ownerSettings();
      const html = page.body;
      const text = decodeEntities(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));

      // §4: the form's two labels and its submit, and a role control offering all three.
      expect(text, 'the invite form has no email label').toContain(copy('tenant.invitations.email'));
      expect(text, 'the invite form has no role label').toContain(copy('tenant.invitations.role'));
      expect(text, 'the invite form has no submit').toContain(copy('tenant.invitations.submit'));
      for (const role of ROLE_NAMES) {
        expect(
          text,
          `invite-role does not offer ${copy(`tenant.role.${role}`)}; R-SPINE-003 fixes three roles`,
        ).toContain(copy(`tenant.role.${role}`));
      }

      // AC-2 / the inc-009 lock: the empty state's copy is whatever the typed string table
      // holds under the two locked keys. Read through the keys on purpose — the key names
      // are the contract, and which wording they carry is settled elsewhere (see the header).
      const strings = (await importProduct('src/app/t/strings.ts'))['TENANT_STRINGS'] as
        | Record<string, string>
        | undefined;
      expect(strings, 'src/app/t/strings.ts no longer exports TENANT_STRINGS').toBeDefined();
      for (const key of ['tenant.settings.empty.teach', 'tenant.settings.empty.action']) {
        const value = strings?.[key];
        expect(value, `the string table no longer carries ${key} — inc-009 locked the key`).toBeDefined();
        expect(
          text,
          `the invitations empty state does not render ${key}: "${String(value)}"`,
        ).toContain(String(value));
      }
    },
    LANE_BUDGET_MS,
  );

  it(
    'is axe-clean at serious and critical with no overlay open, scanned after the animations settle',
    async (ctx) => {
      if (isNested()) ctx.skip();
      const { port } = await servedApp();
      const jar = await signedIn(OWNER_EMAIL);

      // @axe-core/playwright refuses a page that came from browser.newPage(): every page it
      // touches has to come from a context.
      const browser = await chromium.launch({ args: ['--no-sandbox'] });
      try {
        const context = await browser.newContext({ baseURL: `http://127.0.0.1:${String(port)}` });
        await context.addCookies(
          [...jar].map(([name, value]) => ({
            name,
            value,
            domain: '127.0.0.1',
            path: '/',
          })),
        );
        const browserPage = await context.newPage();
        const response = await browserPage.goto(`http://127.0.0.1:${String(port)}${SETTINGS_PATH}`, {
          waitUntil: 'networkidle',
        });
        expect(response?.status(), `the browser could not open ${SETTINGS_PATH}`).toBe(200);
        await browserPage.waitForSelector('[data-testid="tenant-settings"]');

        // An element that arrives on a --motion-state-duration fade is mid-colour on its
        // first rendered frame, and axe reads that blend as a contrast defect nobody can see.
        await browserPage.evaluate(async () => {
          const settled = Promise.all(
            document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
          );
          await Promise.race([settled, new Promise((resolve) => setTimeout(resolve, 2_000))]);
        });

        const results = await new AxeBuilder({ page: browserPage }).analyze();
        const blocking = results.violations.filter((violation) =>
          BLOCKING_IMPACTS.has(violation.impact ?? ''),
        );
        const described = blocking
          .map(
            (violation) =>
              `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} — ${violation.nodes
                .map((node) => node.target.join(' '))
                .join(', ')}`,
          )
          .join('\n');
        expect(
          blocking.map((violation) => violation.id),
          `axe found ${String(blocking.length)} serious/critical violation(s) on ${SETTINGS_PATH}:\n${described}`,
        ).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    LANE_BUDGET_MS,
  );
});
