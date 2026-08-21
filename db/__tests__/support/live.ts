/**
 * What every live-database test needs (V-DB): a raw connection as a named login role, the
 * SQLSTATE behind a refusal, and the names the spec makes public.
 *
 * Raw here means "not through the seam" on purpose: SEAM-TENANT is only proven if a
 * connection that skips `forTenant` is shown to see nothing.
 */
import pg from 'pg';
import type { Client } from 'pg';

/** C-07: PostgreSQL 16 native on 127.0.0.1:5544. This is the seam's documented default. */
export const DEFAULT_APP_URL = 'postgres://cubit_app:cubit_app@127.0.0.1:5544/cubit_dev';

/** SEAM-TENANT's three login roles. */
export const MIGRATE_ROLE = 'cubit_migrate';
export const APP_ROLE = 'cubit_app';
export const AUTH_ROLE = 'cubit_auth';

/** The refusal the acceptance names: insufficient_privilege, which is also RLS's answer. */
export const INSUFFICIENT_PRIVILEGE = '42501';

export type Row = Record<string, unknown>;

/** The database `pnpm test:db` pointed this run at. */
export function appUrl(): string {
  const url = process.env['DATABASE_URL'];
  return url === undefined || url.trim() === '' ? DEFAULT_APP_URL : url;
}

/** The same database, reached as another login role (dev password equals the role name). */
export function urlAs(role: string): string {
  const url = new URL(appUrl());
  url.username = role;
  url.password = role;
  return url.toString();
}

/** Another database on the same cluster, as the given role — how a scratch lane is read. */
export function urlFor(database: string, role: string): string {
  const url = new URL(urlAs(role));
  url.pathname = `/${database}`;
  return url.toString();
}

export function databaseName(): string {
  return new URL(appUrl()).pathname.replace(/^\//, '');
}

/** A connection that has had no `cubit.scope` or `cubit.tenant_id` set on it. */
export async function connectAs(role: string): Promise<Client> {
  const client = new pg.Client({ connectionString: urlAs(role) });
  await client.connect();
  return client;
}

export async function connectTo(url: string): Promise<Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

export async function query(
  client: Client,
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  const result = await client.query(text, [...values]);
  return result.rows as Row[];
}

export async function count(client: Client, table: string): Promise<number> {
  const rows = await query(client, `select count(*)::int as n from public."${table}"`);
  const n = rows[0]?.['n'];
  return typeof n === 'number' ? n : -1;
}

export async function endAll(clients: readonly (Client | undefined)[]): Promise<void> {
  for (const client of clients) {
    if (client === undefined) continue;
    await client.end();
  }
}

/** Every error in a thrown value's cause chain — drizzle wraps the driver's error. */
function chain(error: unknown): unknown[] {
  const seen: unknown[] = [];
  let current = error;
  for (let depth = 0; depth < 8 && current !== null && current !== undefined; depth += 1) {
    seen.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return seen;
}

/** Every SQLSTATE the thrown value carries, at any depth. */
export function sqlstates(error: unknown): string[] {
  return chain(error)
    .map((link) => (link as { code?: unknown }).code)
    .filter((code): code is string => typeof code === 'string');
}

/** Everything the thrown value says, for an assertion message that can be acted on. */
export function describeError(error: unknown): string {
  return chain(error)
    .map((link) => {
      const code = (link as { code?: unknown }).code;
      const message = (link as { message?: unknown }).message;
      return `${typeof code === 'string' ? `[${code}] ` : ''}${String(message ?? link)}`;
    })
    .join(' <- ');
}

/** A privilege refusal: the grant said no. */
export function isPrivilegeRefusal(error: unknown): boolean {
  return sqlstates(error).includes(INSUFFICIENT_PRIVILEGE);
}

/**
 * A row-level-security refusal. Postgres answers a policy violation with 42501; the
 * message is read too so that a refusal is still a refusal if the driver drops the code.
 */
export function isRlsRefusal(error: unknown): boolean {
  if (isPrivilegeRefusal(error)) return true;
  return /row-level security/i.test(describeError(error));
}

/** What a call did: the value it returned, or the error it threw. Never both. */
export type Outcome = { ok: true; value: unknown } | { ok: false; error: unknown };

export async function attempt(action: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { ok: true, value: await action() };
  } catch (error: unknown) {
    return { ok: false, error };
  }
}

/** A refusal, described for the assertion message whichever way the call went. */
export function outcomeText(outcome: Outcome): string {
  return outcome.ok
    ? `it succeeded and returned ${JSON.stringify(outcome.value)}`
    : describeError(outcome.error);
}
