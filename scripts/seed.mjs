#!/usr/bin/env node
/**
 * pnpm seed — plants the e2e fixture set (AC-13) into a database.
 *
 * The fixtures themselves are read from `tests/e2e/support/seed.ts`, the same
 * module the journeys read, so a fixture can never drift between the seeder and
 * the assertions. Passwords are hashed with better-auth's own hasher, so a
 * seeded account signs in through exactly the path a real one does.
 */
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { hashPassword } from 'better-auth/crypto';
import { loadEnv, seconds } from './lib/run.mjs';
import { roleUrls, withClient } from './lib/postgres.mjs';

loadEnv();

const { FIXTURE_USERS, FIXTURE_TENANTS } = await import('../tests/e2e/support/seed.ts');

/** A tenant address is derived from its name and is the tenant's URL (D-01). */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function insertUser(client, fixture) {
  const id = randomUUID();
  const hashed = await hashPassword(fixture.password);
  await client.query(
    `insert into "user" (id, name, email, email_verified) values ($1, $2, $3, true)`,
    [id, fixture.name, fixture.email],
  );
  await client.query(
    // better-auth 1.7 namespaces an identity by issuer; a password account is `local:credential`
    `insert into "account" (id, issuer, account_id, provider_id, user_id, password)
     values ($1, 'local:credential', $2, 'credential', $3, $4)`,
    [randomUUID(), id, id, hashed],
  );
  return id;
}

async function insertTenant(client, { slug, name, kind }) {
  const { rows } = await client.query(
    `insert into "tenant" (slug, name, kind) values ($1, $2, $3) returning tenant_id`,
    [slug, name, kind],
  );
  return rows[0].tenant_id;
}

async function addMember(client, tenantId, userId, role) {
  await client.query(
    `insert into "tenant_member" (tenant_id, user_id, role) values ($1, $2, $3)`,
    [tenantId, userId, role],
  );
}

/**
 * The fixture set is re-plantable: seeding a database twice replants it instead
 * of colliding with itself. Only the rows the fixtures own are cleared, and the
 * cascades take the memberships, accounts and sessions hanging off them.
 */
async function clearFixtures(client) {
  const emails = [FIXTURE_USERS.owner.email, FIXTURE_USERS.member.email];
  const slugs = [
    FIXTURE_TENANTS.acme.slug,
    FIXTURE_TENANTS.rival.slug,
    ...emails.map((email) => slugify(email.split('@')[0])),
  ];
  await client.query('delete from "tenant" where slug = any($1)', [slugs]);
  await client.query('delete from "user" where email = any($1)', [emails]);
}

/**
 * Two tenants, two users, and a tenant `owner` must never be able to reach:
 * `rival` is owned by `member` alone. That second tenant is what makes the
 * cross-tenant refusal in V-DB provable rather than vacuous.
 */
export async function seed(migrateUrl) {
  return withClient(migrateUrl, async (client) => {
    await clearFixtures(client);

    // R-SPINE-002: a seeded account looks like a signed-up one — the personal
    // tenant arrives with the user row, in its transaction, because the trigger
    // in db/migrations/0003 is what mints it for a sign-up too. The seeder
    // plants no personal tenant of its own; it would collide with that one.
    const owner = await insertUser(client, FIXTURE_USERS.owner);
    const member = await insertUser(client, FIXTURE_USERS.member);

    const acme = await insertTenant(client, {
      slug: FIXTURE_TENANTS.acme.slug,
      name: 'Acme Construction',
      kind: 'team',
    });
    await addMember(client, acme, owner, FIXTURE_USERS.owner.role);
    await addMember(client, acme, member, FIXTURE_USERS.member.role);

    const rival = await insertTenant(client, {
      slug: FIXTURE_TENANTS.rival.slug,
      name: 'Rival Builders',
      kind: 'team',
    });
    await addMember(client, rival, member, 'OWNER');

    return { users: 2, tenants: 4 };
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const startedAt = Date.now();
  // a database named on the command line wins; otherwise the environment's own
  const database = process.env.CUBIT_DATABASE ?? process.argv[2];
  const url =
    database !== undefined
      ? roleUrls(database).DATABASE_URL_MIGRATE
      : (process.env.DATABASE_URL_MIGRATE ?? roleUrls('cubit_dev').DATABASE_URL_MIGRATE);
  const planted = await seed(url);
  console.log(
    `seed ${new URL(url).pathname.slice(1)} OK — ${planted.users} users, ${planted.tenants} tenants ${seconds(startedAt)}s`,
  );
}
