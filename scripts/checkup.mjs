#!/usr/bin/env node
/**
 * pnpm checkup — V-CHECKUP, the machine's report. Runs at session start.
 *
 * Every pin reports a line. `uv`, `typst` and `libredwg` belong to lanes that do
 * not exist yet, so they report NOT_REQUIRED rather than failing a dev machine
 * for a tool nothing has asked for. Exit 0 iff no line says FAIL.
 */
import { createServer } from 'node:net';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { capture, envOrigin, loadEnv, ROOT } from './lib/run.mjs';
import { PG_HOST, PG_PORT, ROLES, adminUrl, roleUrls } from './lib/postgres.mjs';

loadEnv();

let failed = false;
function report(line, status) {
  if (status === 'FAIL') failed = true;
  console.log(`${line} ${status}`);
}

// --- pins ------------------------------------------------------------------
const wantedNode = readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim().replace(/^v/, '');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const wantedPnpm = String(pkg.packageManager).replace(/^pnpm@/, '').replace(/\+.*$/, '');

/** A pin is met when the running version is the declared one, or narrower than it. */
const meets = (actual, wanted) => actual === wanted || actual.startsWith(`${wanted}.`);

const actualNode = process.versions.node;
report(`PIN node ${actualNode} want ${wantedNode}`, meets(actualNode, wantedNode) ? 'OK' : 'FAIL');

const actualPnpm = (await capture('pnpm', ['--version'])) ?? 'absent';
report(`PIN pnpm ${actualPnpm} want ${wantedPnpm}`, meets(actualPnpm, wantedPnpm) ? 'OK' : 'FAIL');

/** These arrive with the lanes that need them (cad, documents, DWG import). */
for (const tool of ['uv', 'typst', 'libredwg']) {
  const version = await capture(tool, ['--version']);
  const found = version === null ? 'absent' : version.split('\n')[0];
  report(`PIN ${tool} ${found} want none-yet`, 'NOT_REQUIRED');
}

// --- database (C-07) --------------------------------------------------------
const appUrl = process.env.DATABASE_URL_APP ?? roleUrls('cubit_dev').DATABASE_URL_APP;
let dbReachable;
try {
  const client = new pg.Client({ connectionString: appUrl });
  await client.connect();
  await client.query('select 1');
  await client.end();
  dbReachable = true;
} catch {
  dbReachable = false;
}
report(`DB postgres ${PG_HOST}:${PG_PORT}`, dbReachable ? 'OK' : 'FAIL');

// --- roles ------------------------------------------------------------------
let presentRoles;
try {
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  const { rows } = await admin.query('select rolname from pg_roles');
  await admin.end();
  presentRoles = rows.map((row) => row.rolname);
} catch {
  presentRoles = [];
}
for (const role of ROLES) {
  report(`ROLE ${role.name}`, presentRoles.includes(role.name) ? 'OK' : 'FAIL');
}

// --- ledger -----------------------------------------------------------------
const migrations = path.join(ROOT, 'db/migrations');
const committed = existsSync(migrations)
  ? readFileSync(path.join(migrations, 'meta/_journal.json'), 'utf8')
  : '{"entries":[]}';
const entries = JSON.parse(committed).entries ?? [];
report(`LEDGER db/migrations ${entries.length} migration(s)`, entries.length > 0 ? 'OK' : 'FAIL');

// --- ports (C-07: dev 3210, e2e 3211) ---------------------------------------
function bindable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}
/**
 * C-07 fixes dev on 3210 and the e2e build on 3211, and a parallel lane runs on
 * its own offset. The report names the two fixed ports whatever this lane is
 * using, and adds the lane's own when it differs — a machine's report that
 * changed which ports it reported with the environment would be no report at all.
 */
const ports = [3210, 3211];
for (const offset of [process.env.PORT, process.env.E2E_PORT]) {
  const port = Number(offset);
  if (Number.isFinite(port) && port > 0 && !ports.includes(port)) ports.push(port);
}
for (const port of ports) {
  const free = await bindable(port);
  /**
   * A port already held is a warning about this machine, not a broken toolchain,
   * so it does not fail the report — but it does not read NOT_REQUIRED either.
   * That word means "no lane has asked for this yet", and a reader scanning for
   * trouble must not see the same word for a tool nothing needs and for the port
   * their next `pnpm dev` cannot have.
   */
  report(`PORT ${port} bindable`, free ? 'OK' : 'IN_USE');
}

// --- storage root -----------------------------------------------------------
const storage = process.env.CUBIT_STORAGE_ROOT ?? path.join(ROOT, '.storage');
try {
  mkdirSync(storage, { recursive: true });
  report(`STORAGE ${storage}`, 'OK');
} catch {
  report(`STORAGE ${storage}`, 'FAIL');
}

// --- env --------------------------------------------------------------------
const REQUIRED_ENV = [
  'DATABASE_URL_MIGRATE',
  'DATABASE_URL_APP',
  'DATABASE_URL_AUTH',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'MAIL_TRANSPORT',
];
/**
 * Where a value came from is half the report. `.env.example` stands in for
 * whatever a fresh clone has not configured (C-07's fixed local defaults), and
 * the signing secret is minted per machine when nothing sets it — so a line that
 * only ever read OK would say a bare workspace and a configured deployment were
 * the same machine. They are not, and the report says which one this is.
 */
const ORIGIN_STATUS = {
  environment: 'OK',
  local: 'MINTED',
  minted: 'MINTED',
  example: 'DEFAULTED',
};
for (const name of REQUIRED_ENV) {
  const origin = envOrigin(name);
  report(`ENV ${name}`, process.env[name] ? (ORIGIN_STATUS[origin] ?? 'OK') : 'FAIL');
}

process.exit(failed ? 1 : 0);
