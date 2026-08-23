/**
 * The personal-tenant mint (R-SPINE-002): "Every user gets a personal tenant at sign-up (in
 * the user-create transaction)".
 *
 * "In the user-create transaction" is the whole clause. A user written without its tenant is
 * an account that can sign in and belong nowhere, and a tenant written without its user is a
 * workspace nobody can reach — so the user row, the tenant row, the membership joining them
 * and the credential account that holds the password are one `db.transaction(...)` on the
 * handle the caller supplied. The handle is a parameter rather than something this module
 * reaches for, which is what lets a V-DB test inject one whose writes the database refuses
 * and watch nothing survive.
 *
 * The tables come off the handle (`db._.fullSchema`) rather than from an import: SEAM-TENANT
 * keeps the schema at `src/core/db.ts`, and a handle already carries the composed schema that
 * scopes it. Rows are filtered with the relational query builder's own operators, passed to
 * the `where` callback, for the same reason.
 */
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { ScopedDb } from '../core/db';

/** What better-auth calls the password provider, and the synthetic issuer it files it under. */
const CREDENTIAL_PROVIDER = 'credential';
const CREDENTIAL_ISSUER = 'local:credential';

/** A slug is what the URL says (`/t/{tenantSlug}/…`), so it stays short and speakable. */
const SLUG_MAX_LENGTH = 40;

/**
 * The constraint behind `users.email`, named so a caller can tell *which* uniqueness the
 * database refused. The mint writes four rows behind four unique constraints, and only this
 * one means "an account with this email already exists"; see src/app/(auth)/actions.ts.
 */
export const USER_EMAIL_CONSTRAINT = 'users_email_unique';

/** How many slugs the mint will try before it gives up — the seed, then disambiguated ones. */
const SLUG_ATTEMPTS = 5;

/** What a personal tenant is called when the email's local part yields nothing usable. */
const FALLBACK_SLUG = 'workspace';

/** The suffix that resolves a slug two people would otherwise both want. */
const DISAMBIGUATOR_LENGTH = 8;

export interface PersonalTenantInput {
  readonly email: string;
  /** The member's display name. Empty when the sign-up form did not ask for one. */
  readonly name?: string;
  /** Absent for a user who will only ever sign in by magic link. */
  readonly password?: string;
}

export interface PersonalTenant {
  readonly userId: string;
  readonly tenantId: string;
  readonly slug: string;
}

/** The handle's own view of the schema — the tables this module writes, already scoped. */
function tablesOf(db: ScopedDb): ScopedDb['_']['fullSchema'] {
  return db._.fullSchema;
}

/**
 * What the slug search needs of a handle: the relational reader, to pick a seed nobody
 * visibly holds, and the writer, because the read is only advice. A transaction is one of
 * these too, which is how the search runs inside the mint rather than beside it.
 */
type SlugWriter = Pick<ScopedDb, 'query' | 'insert'>;

/** The readable half of an email address, reduced to what a URL segment may carry. */
export function slugSeedFor(email: string): string {
  const local = email.split('@')[0] ?? '';
  const reduced = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
  return reduced === '' ? FALLBACK_SLUG : reduced;
}

/** The name a personal tenant carries on screen when nobody has typed one. */
function tenantNameFor(input: PersonalTenantInput): string {
  const given = input.name?.trim() ?? '';
  return given === '' ? slugSeedFor(input.email) : given;
}

/**
 * The tenant row, on a slug nobody holds. The seed is tried first so the common case reads
 * as the person's own name; a collision takes a suffix rather than a counter, because a
 * counter is a second round trip per attempt and tells the next reader how many people share
 * a name.
 *
 * The read is advice, not a decision: `tenants.slug` is UNIQUE, and under READ COMMITTED two
 * sign-ups whose addresses reduce to the same seed — `john@a.com` and `john@b.com`, or two
 * addresses that agree after `SLUG_MAX_LENGTH` truncation — both see it free. So the insert
 * itself decides, with `on conflict do nothing`: the loser writes no row, gets no 23505 (and
 * so does not poison the transaction it is inside), and takes a suffix on the next turn. That
 * is what keeps an unrelated slug collision between two *different* addresses from surfacing
 * as "an account with this email already exists".
 */
async function mintTenant(
  db: SlugWriter,
  tables: ScopedDb['_']['fullSchema'],
  seed: string,
  name: string,
): Promise<{ id: string; slug: string }> {
  const advised = await db.query.tenants.findFirst({
    columns: { id: true },
    where: (tenant, { eq }) => eq(tenant.slug, seed),
  });
  let slug = advised === undefined ? seed : `${seed}-${randomUUID().slice(0, DISAMBIGUATOR_LENGTH)}`;

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
    const [tenant] = await db
      .insert(tables.tenants)
      .values({ slug, name })
      .onConflictDoNothing({ target: tables.tenants.slug })
      .returning({ id: tables.tenants.id });
    if (tenant !== undefined) return { id: tenant.id, slug };
    slug = `${seed}-${randomUUID().slice(0, DISAMBIGUATOR_LENGTH)}`;
  }
  throw new Error('the personal tenant was not written: no free slug after several attempts');
}

/**
 * A user, its personal tenant, the membership joining them and its credential account — one
 * transaction on the handle it was given (R-SPINE-002).
 *
 * The password is hashed before the transaction opens: hashing is deliberately slow, and a
 * pinned connection held open for the length of it is a connection nobody else can borrow.
 */
export async function createUserWithPersonalTenant(
  db: ScopedDb,
  input: PersonalTenantInput,
): Promise<PersonalTenant> {
  const tables = tablesOf(db);
  const email = input.email.trim().toLowerCase();
  const passwordHash = input.password === undefined ? undefined : await hashPassword(input.password);

  return await db.transaction(async (tx) => {
    const tenant = await mintTenant(tx, tables, slugSeedFor(email), tenantNameFor(input));
    const slug = tenant.slug;

    const [user] = await tx
      .insert(tables.users)
      .values({ email, name: input.name?.trim() ?? '' })
      .returning({ id: tables.users.id });
    if (user === undefined) throw new Error('the user was not written');

    await tx.insert(tables.tenantMemberships).values({ tenantId: tenant.id, userId: user.id });

    if (passwordHash !== undefined) {
      await tx.insert(tables.accounts).values({
        userId: user.id,
        providerId: CREDENTIAL_PROVIDER,
        issuer: CREDENTIAL_ISSUER,
        accountId: user.id,
        password: passwordHash,
      });
    }

    return { userId: user.id, tenantId: tenant.id, slug };
  });
}

/**
 * The tenant a session lands in: the member's own, oldest first, so the slug a person sees
 * does not move when a later increment adds a second membership.
 */
export async function activeTenantSlugFor(db: ScopedDb, userId: string): Promise<string | null> {
  const membership = await db.query.tenantMemberships.findFirst({
    columns: { tenantId: true },
    where: (row, { eq }) => eq(row.userId, userId),
    orderBy: (row, { asc }) => [asc(row.createdAt)],
  });
  if (membership === undefined) return null;
  const tenant = await db.query.tenants.findFirst({
    columns: { slug: true },
    where: (row, { eq }) => eq(row.id, membership.tenantId),
  });
  return tenant?.slug ?? null;
}

/** Whether this user holds a membership in the tenant the URL names (R-SPINE-002). */
export async function membershipOf(
  db: ScopedDb,
  userId: string,
  slug: string,
): Promise<{ tenantId: string; name: string; slug: string } | null> {
  const tenant = await db.query.tenants.findFirst({
    columns: { id: true, name: true, slug: true },
    where: (row, { eq }) => eq(row.slug, slug),
  });
  if (tenant === undefined) return null;
  const membership = await db.query.tenantMemberships.findFirst({
    columns: { id: true },
    where: (row, { and, eq }) => and(eq(row.userId, userId), eq(row.tenantId, tenant.id)),
  });
  if (membership === undefined) return null;
  return { tenantId: tenant.id, name: tenant.name, slug: tenant.slug };
}

/**
 * The safety mint (R-SPINE-002). Sign-up goes through `createUserWithPersonalTenant`, but a
 * user can also arrive through better-auth's own endpoints, and R-SPINE-002 says *every* user
 * gets a personal tenant. This is idempotent: a user that already belongs somewhere is left
 * exactly as it is.
 */
export async function ensurePersonalTenant(
  db: ScopedDb,
  user: { id: string; email: string; name?: string },
): Promise<void> {
  const tables = tablesOf(db);
  const existing = await db.query.tenantMemberships.findFirst({
    columns: { id: true },
    where: (row, { eq }) => eq(row.userId, user.id),
  });
  if (existing !== undefined) return;

  await db.transaction(async (tx) => {
    const tenant = await mintTenant(
      tx,
      tables,
      slugSeedFor(user.email),
      tenantNameFor({ email: user.email, name: user.name ?? '' }),
    );
    await tx.insert(tables.tenantMemberships).values({ tenantId: tenant.id, userId: user.id });
  });
}
