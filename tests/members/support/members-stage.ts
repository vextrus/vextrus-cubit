/**
 * The live stage the members acceptance is driven on (inc-010a2 test contract).
 *
 * Mechanics only: a private database built by the tree's own migration lane, real accounts made
 * through the shipped sign-up door, a workspace staged around them, and the built product served on
 * a free port so the screens are reached through the doors a person reaches them through. Nothing
 * here judges the surface.
 *
 * Two facts shape it:
 *   - `db/__tests__/support/fixtures.ts` reads `DATABASE_URL` when it loads, so the harness is
 *     imported at the top of this file and the scratch url is only published to `process.env`
 *     afterwards, once the database exists;
 *   - the shell and the tenancy module both resolve the workspace a person is acting in as their
 *     EARLIEST membership, so a person joined to a staged workspace has that membership backdated —
 *     otherwise the personal workspace sign-up minted for them is the one they would be looking at.
 *
 * Raw SQL is spoken through psql, never a driver import (SEAM-TENANT), and every statement carries
 * the system reason it is made under.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { expect } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { GUC_SYSTEM_REASON, TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit, run, scalar, withSession } from "../../../db/__tests__/support/live-sql";

/** The checkout this suite drives — the lane runs at the root of it. */
export const REPO_ROOT: string = process.cwd();

/** The reason every statement this stage makes is recorded under — attributable, like any other. */
const STAGE_REASON = "test: stage a workspace roster for the members surface";

/** The password every staged account is made with. */
const PASSWORD = "correct horse battery staple";

/** The address the sign-up door is told the request came from. */
const SIGNUP_ORIGIN = "https://cubit.example";

/** How far back a joined membership is dated, so the staged workspace is the one they act in. */
const BACKDATE = "interval '30 days'";

/* ------------------------------------------------------------------ loading product modules */

/**
 * Import a product module by repo-relative path, asserting it exists first — so a module the
 * Builder has not written yet fails as an assertion naming the file rather than as a collection
 * death, and so a file that does not exist yet cannot be a static import this lane's typecheck
 * refuses.
 */
export async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

/** Every one of these product files must exist before a stage is worth building. */
export function requireModules(relatives: readonly string[]): void {
  for (const relative of relatives) {
    expect(existsSync(join(REPO_ROOT, relative)), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  }
}

/* ------------------------------------------------------------------ the database */

let opened: ScratchDb | undefined;

/** The scratch database, made once per file and published to `DATABASE_URL` for the product. */
export async function openDatabase(): Promise<ScratchDb> {
  if (opened === undefined) {
    opened = await provisionScratchDb();
    process.env["DATABASE_URL"] = opened.urlApp;
  }
  return opened;
}

/** Take away whatever this file provisioned, whether or not staging got past it. */
export async function dropDatabase(): Promise<void> {
  const held = opened;
  opened = undefined;
  await held?.drop();
}

/** The url every statement below is spoken as the database's owner through. */
function ownerUrl(): string {
  const held = opened;
  if (held === undefined) throw new Error("the stage's database has not been opened yet");
  return held.urlMigrate;
}

const sysRun = (script: string): string[][] => run(ownerUrl(), withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));
const sysScalar = (script: string): string => scalar(ownerUrl(), withSession({ [GUC_SYSTEM_REASON]: STAGE_REASON }, script));

/* ------------------------------------------------------------------ real people */

/** One staged account: who they are, the workspace sign-up minted, and this device's session. */
export interface Person {
  userId: string;
  email: string;
  tenantId: string;
  sessionToken: string;
  cookie: string;
}

let sessionCookieName = "cubit_session";

/**
 * One real account and its personal workspace, made through the shipped sign-up door — every
 * session driven on this stage is a session the product issued.
 */
export async function enrol(label: string): Promise<Person> {
  const auth = await productModule<Record<string, unknown>>("src/server/auth/session.ts");
  const signUp = auth["signUp"];
  expect(typeof signUp, "src/server/auth/session.ts exports signUp").toBe("function");
  if (typeof auth["SESSION_COOKIE"] === "string") sessionCookieName = auth["SESSION_COOKIE"];

  // Lower case throughout: the door normalises an address before it stores it, so a marker that is
  // not already normalised would not find the row it just made.
  const marker = `${label}-${randomUUID().slice(0, 8)}`.toLowerCase();
  const email = `${marker}@cubit.test`;
  const answer = (await (signUp as (request: Record<string, unknown>) => Promise<{ sessionToken?: string }>)({
    email,
    password: PASSWORD,
    tenantName: `Members ${marker}`,
    deviceLabel: "acceptance",
    origin: SIGNUP_ORIGIN,
    requestId: randomUUID(),
  })) as { sessionToken?: string };
  const sessionToken = answer.sessionToken ?? "";
  expect(sessionToken.length, "the sign-up door answers with a session token (R-SPINE-002)").toBeGreaterThan(0);

  const userId = sysScalar(`select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
  const tenantId = sysScalar(`select ${ident(TENANT_COLUMN)}::text from memberships where user_id = ${lit(userId)} limit 1;`);
  return { userId, email, tenantId, sessionToken, cookie: `${sessionCookieName}=${sessionToken}` };
}

/**
 * Join an account to a workspace it did not make, at a role. The membership is backdated so that
 * this workspace — and not the personal one sign-up minted — is the one the shell frames and the
 * one the tenancy module acts in.
 */
export function joinWorkspace(tenantId: string, person: Person, role: string): void {
  sysRun(
    `insert into memberships (${ident(TENANT_COLUMN)}, user_id, workspace_role, created_at)
       values (${lit(tenantId)}, ${lit(person.userId)}, ${lit(role)}, now() - ${BACKDATE})
       on conflict do nothing;`,
  );
}

/** Move one membership's role, without going near the guards the acceptance is judging. */
export function setRole(tenantId: string, userId: string, role: string): void {
  sysRun(`update memberships set workspace_role = ${lit(role)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and user_id = ${lit(userId)};`);
}

/** Every membership of a workspace with the role it holds, by user id — the roster, as stored. */
export function rosterOf(tenantId: string): Map<string, string> {
  const rows = sysRun(`select user_id::text, workspace_role::text from memberships where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} order by user_id::text;`);
  const roster = new Map<string, string>();
  for (const row of rows) {
    const userId = row[0];
    const role = row[1];
    if (userId !== undefined && role !== undefined) roster.set(userId, role);
  }
  return roster;
}

/**
 * A project of the workspace with participants standing on it, and one role grant per subject —
 * the movements a role history is read from (`participant_roles` is the ledger `roleHistory`
 * answers out of).
 */
export function stageProject(tenantId: string, standing: readonly Person[], grants: readonly { person: Person; role: string }[]): string {
  const projectId = sysScalar(`insert into projects (${ident(TENANT_COLUMN)}, name) values (${lit(tenantId)}, 'Members acceptance') returning project_id::text;`);
  for (const person of standing) {
    sysRun(`insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(person.userId)}) on conflict do nothing;`);
  }
  for (const grant of grants) {
    sysRun(
      `insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role)
         values (${lit(tenantId)}, ${lit(projectId)}, ${lit(grant.person.userId)}, ${lit(grant.role)});`,
    );
  }
  return projectId;
}

/** How many role movements one workspace's ledgers hold about one subject, across its projects. */
export function movementsAbout(tenantId: string, userId: string): number {
  const granted = sysScalar(`select count(*)::text from participant_roles where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and user_id = ${lit(userId)};`);
  const withdrawn = sysScalar(`select count(*)::text from participant_role_withdrawals where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and user_id = ${lit(userId)};`);
  return Number(granted) + Number(withdrawn);
}

/** One act on the log, authored by this person on a project they stand on (the removal coupling). */
export function stageAct(tenantId: string, projectId: string, actor: Person): string {
  return sysScalar(
    `insert into acts (${ident(TENANT_COLUMN)}, project_id, actor_id, act_type, subjects, consequence_digest)
       values (${lit(tenantId)}, ${lit(projectId)}, ${lit(actor.userId)}, 'STAGED_FOR_ACCEPTANCE', '[]'::jsonb, ${lit(randomUUID())})
       returning act_id::text;`,
  );
}

/* ------------------------------------------------------------------ the served product */

/** A built product answering on a port of its own. */
export interface ServedApp {
  origin: string;
  stop(): void;
}

let served: ServedApp | undefined;
let child: ChildProcess | undefined;

/** A free port, taken by asking the kernel for one and giving it straight back. */
async function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => (address !== null && typeof address === "object" ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}

/**
 * Build the product once into a dist directory of its own (so `git status` stays clean and no other
 * lane's build is disturbed) and serve it on a free port, against the scratch database.
 *
 * The deployment states its own address: `CUBIT_PUBLIC_ORIGIN` is the origin it is actually served
 * at, which is what a cookie-authenticated mutation's origin check is judged against (R-SPINE-006).
 */
export async function serveApp(distDir: string): Promise<ServedApp> {
  if (served !== undefined) return served;
  const database = process.env["DATABASE_URL"];
  expect(typeof database, "the scratch database is open before the product is served").toBe("string");

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const next = join(REPO_ROOT, "node_modules", ".bin", "next");
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  env["NEXT_DIST_DIR"] = distDir;
  env["CUBIT_PUBLIC_ORIGIN"] = origin;
  // NODE_ENV=test makes `next build` skip devDependency paths; the built product is production.
  delete env["NODE_ENV"];

  // The deployment's environment, as a plain record: `NODE_ENV` is required by the tree's own
  // `ProcessEnv`, and the build must not inherit the runner's `test`.
  const childEnv = env as unknown as NodeJS.ProcessEnv;
  const built = spawnSync(next, ["build"], { cwd: REPO_ROOT, env: childEnv, encoding: "utf8", timeout: 420_000 });
  expect(built.status, `next build failed:\n${(built.stderr || built.stdout || "").slice(-1500)}`).toBe(0);

  const started = spawn(next, ["start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: REPO_ROOT, env: childEnv, stdio: "ignore" });
  child = started;
  const startedAt = Date.now();
  for (;;) {
    try {
      const answer = await fetch(origin, { signal: AbortSignal.timeout(2000) });
      if (answer.status < 500) break;
    } catch {
      /* not answering yet */
    }
    if (Date.now() - startedAt > 90_000) {
      started.kill("SIGKILL");
      throw new Error("next start did not answer within 90s");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  served = { origin, stop: () => started.kill("SIGKILL") };
  return served;
}

/** Stop whatever this file started. */
export function stopApp(): void {
  child?.kill("SIGKILL");
  child = undefined;
  served = undefined;
}

/** One page, fetched as a person holding this session, following the redirects a browser follows. */
export async function fetchPage(origin: string, path: string, cookie: string | null): Promise<{ status: number; url: string; html: string }> {
  const headers: Record<string, string> = { accept: "text/html" };
  if (cookie !== null) headers["cookie"] = cookie;
  const answer = await fetch(`${origin}${path}`, { headers, redirect: "follow" });
  return { status: answer.status, url: answer.url, html: await answer.text() };
}
