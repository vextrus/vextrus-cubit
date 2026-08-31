// SEAM-TENANT: forTenant(ctx) and runAsSystem(reason) are the only database handles the tree has.
// The driver, the schema and drizzle's typed read/write surface live here and nowhere else, and
// every query a handle issues runs on a connection its scope has been armed on — the row-level
// security the tenancy-base migration installs reads that scope and nothing else.
//
// The table definitions sit here rather than in db/schema/*.ts because the ORM's table builders are
// a driver import, and this file is their one lawful home; db/schema/*.ts is the tree drizzle-kit
// reads them back out of.
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql as statement } from "drizzle-orm";
import { check, foreignKey, index, integer, json, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ELEMENT_TYPES, type ElementType } from "./catalogue/element-types";
import { KINDS, type Kind } from "./catalogue/kinds";
import { attributableReason } from "./db/reason";
import { DEFAULT_DENSITY, DENSITIES, type Density } from "./prefs/density";
import { BUILDING_TYPES, type BuildingType } from "./projects";
import type { EditionParameter, EditionScope, MethodPair } from "./rulesets/editions/content";
import { CANONICAL_UNITS, DIMENSIONS, type Dimension } from "./units/canon";

/** A closed roster as the SQL fragment a CHECK compares against — the one spelling of that list. */
const closedList = (roster: readonly string[]): string => roster.map((member) => `'${member}'`).join(", ");

/** The canon's dimension→canonical-unit map as row values, so a CHECK can close the pair (L-FRM-06). */
const canonicalUnitPairs = (): string => DIMENSIONS.map((dimension) => `('${dimension}', '${CANONICAL_UNITS[dimension]}')`).join(", ");

// The query operators a caller needs to say which rows it means. They are the driver's, so they are
// handed out from here rather than imported at a call site: SEAM-TENANT makes this file the one
// lawful home of the driver, and a module that reached for them itself would be holding half a
// handle (ARCH-02).
export { and, asc, desc, eq, gt, inArray, isNull, lt };

export { recordSystemReasonsWith, type SystemReasonRecord, type SystemReasonRecorder } from "./db/reason";

/** The session settings a scope is spoken through; the migration's policies read these two names. */
const TENANT_GUC = "cubit.tenant_id";
const SYSTEM_REASON_GUC = "cubit.system_reason";

/** Tenancy's base table: every tenant-scoped table in the tree carries this table's key. */
export const tenants = pgTable("tenants", {
  tenantId: uuid("tenant_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The five, as a SQL value list, so the constraint spells them exactly once (B-17). */
const BUILDING_TYPE_LIST = statement.raw(BUILDING_TYPES.map((type) => `'${type}'`).join(", "));

/**
 * A project (R-SPINE-010): what it is called and where it stands, in the workspace that owns it.
 *
 * Only the name is required. R-SPINE-010 enumerates the fields a project carries, and a workspace
 * naming a project before it knows its client or its storey count is naming a real project — so
 * every other field is nullable and stored as presented, and the door is where presentability is
 * judged. `building_type` is the one exception to "stored as presented": the clause closes it over
 * five names, so the CHECK admits those and nothing else, whatever writes the row.
 *
 * Target GFA is held in m² as `numeric` — B-07 keeps a figure a person entered exact from the
 * column to the page — and the square-feet readout is a conversion the format seam makes, never a
 * second stored fact.
 *
 * `archived_at` is the archived marker: AC-4's archive flips it and deletes nothing, and holding the
 * moment rather than a boolean answers "when" as well as "whether" for the same width.
 */
export const projects = pgTable(
  "projects",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code"),
    client: text("client"),
    siteAddress: text("site_address"),
    // Stored text at M0: the district → zone derivation is book law, and nothing here derives from it.
    district: text("district"),
    buildingType: text("building_type").$type<BuildingType>(),
    storeys: integer("storeys"),
    targetGfaM2: numeric("target_gfa_m2"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("projects_building_type_closed", statement`${table.buildingType} in (${BUILDING_TYPE_LIST})`),
    // Every read of this table is tenant-scoped and then ordered by last activity: the policy adds
    // the same `tenant_id` predicate again, so without this the workspace home is a sequential scan
    // plus a sort over every tenant's projects. The order the index is built in is the order S-Home
    // asks in (the shape `tenant_ruleset_editions_scope` already has beside its own table).
    index("projects_tenant_updated").on(table.tenantId, table.updatedAt),
  ],
);

/**
 * Participation: who may act on a project at all (L-ACT-03). The pair (project, user) is the
 * identity, so the act log can point at it with one composite key; the row is append-only, and the
 * migration's trigger is what makes that true of the owner too.
 */
export const participants = pgTable(
  "participants",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.projectId, table.userId] })],
);

/**
 * The act log (L-ACT-01): one row per human act, carrying the digest of the consequence the actor
 * was shown. The actor's participation is a composite foreign key rather than a check the writer
 * remembers to make — L-ACT-03 puts the participation link in the log itself.
 */
export const acts = pgTable(
  "acts",
  {
    tenantId: uuid("tenant_id").notNull(),
    actId: uuid("act_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    actType: text("act_type").notNull(),
    // The facts judged, at the granularity performed: a confirm-all is one act with N subjects.
    subjects: jsonb("subjects").$type<readonly string[]>().notNull(),
    consequenceDigest: text("consequence_digest").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.projectId, table.actorId],
      foreignColumns: [participants.tenantId, participants.projectId, participants.userId],
      name: "acts_actor_participates_fk",
    }),
  ],
);

/**
 * Role grants, append-only: a role is bundled permissions, and holding one is a fact the log made.
 * `act_id` is nullable because a grant can predate the act log's writ over it — a project's first
 * PRINCIPAL is installed by project creation, which is not an act somebody performed.
 */
export const participantRoles = pgTable(
  "participant_roles",
  {
    tenantId: uuid("tenant_id").notNull(),
    grantId: uuid("grant_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    actId: uuid("act_id"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.projectId, table.userId],
      foreignColumns: [participants.tenantId, participants.projectId, participants.userId],
      name: "participant_roles_participant_fk",
    }),
    foreignKey({ columns: [table.actId], foreignColumns: [acts.actId], name: "participant_roles_act_fk" }),
    // A role is held or it is not: the same role twice over is a second row saying the same thing.
    unique("participant_roles_role_once").on(table.tenantId, table.projectId, table.userId, table.role),
  ],
);

/**
 * The countermanding ledger (R-SPINE-011, L-ACT-03): a role a project took back. `participant_roles`
 * wears owner-proof immutability, so a withdrawal is never an update or a delete of the grant — it
 * is a row appended here naming the grant it countermands, and the effective roles a person holds
 * are the grants this table has not answered. The grant stays on the record, which is what makes the
 * history readable both ways round.
 *
 * `grant_id` is unique because a grant is countermanded once: a second row would say the same thing
 * twice, and "how many withdrawals stand against this grant" is not a question with two answers.
 * `act_id` is not null, unlike the grant's — every withdrawal is an act somebody performed, where a
 * project's first PRINCIPAL is installed by creation.
 */
export const participantRoleWithdrawals = pgTable(
  "participant_role_withdrawals",
  {
    tenantId: uuid("tenant_id").notNull(),
    withdrawalId: uuid("withdrawal_id").primaryKey().defaultRandom(),
    grantId: uuid("grant_id").notNull().unique(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    actId: uuid("act_id").notNull(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.grantId], foreignColumns: [participantRoles.grantId], name: "participant_role_withdrawals_grant_fk" }),
    foreignKey({ columns: [table.actId], foreignColumns: [acts.actId], name: "participant_role_withdrawals_act_fk" }),
    // Every effective-roles read is "this project's withdrawals, for this person": the policy adds
    // the tenant predicate again, so without this the seam's own permission check scans the ledger.
    index("participant_role_withdrawals_project_user").on(table.tenantId, table.projectId, table.userId),
  ],
);

/**
 * Identity (R-SPINE-001): an account, the sessions it is signed in through, and the single-use
 * tokens that verify an address or stand in for a password. None of the three carries a tenant id —
 * a person is one account across every workspace they belong to (R-SPINE-002) — so no *tenant*
 * policy can be written for them. That is not the same as no policy: like `tenants`, each of the
 * three is under FORCE row-level security with a system-scope policy, so only a handle that named
 * an attributable reason reaches them at all (SEAM-TENANT, R-SPINE-007).
 *
 * Nothing here stores a secret in the clear: a session token and a mailed token are held as the
 * digest of the value the user was given, so a reader of these rows cannot sign in as anybody.
 */
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  // The address is the account's name, and the door refuses a second account for it by name
  // (ACCOUNT_ALREADY_EXISTS): the unique index below is the belt, never the answer.
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A signed-in device: what to call it in the list, when it arrived, when it was last seen, and — the whole point of revoke — when it stopped counting. */
export const sessions = pgTable("sessions", {
  sessionId: uuid("session_id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  tokenHash: text("token_hash").notNull().unique(),
  deviceLabel: text("device_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/** One mailed token: what it authorises, when it stops working, and whether it has been spent. */
export const authTokens = pgTable("auth_tokens", {
  authTokenId: uuid("auth_token_id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId),
  kind: text("kind").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * R-SPINE-001's rate limiting, counted where every instance of the product can see it: one row per
 * attempt at a limited door by one server-derived identity. A counter held in a process is a counter
 * a restart clears and a second instance doubles, so the allowance the law states would be the
 * allowance only of a single-process deployment.
 */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    attemptId: uuid("attempt_id").primaryKey().defaultRandom(),
    door: text("door").notNull(),
    // The server-derived identity the attempt was made against — never anything a caller wrote into
    // a header (R-SPINE-001). What derives it is the limiter's business; this column only holds it.
    identity: text("identity").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The two reads the limiter makes: one key's window, and every row old enough to drop.
    index("auth_attempts_window").on(table.door, table.identity, table.attemptedAt),
    index("auth_attempts_attempted_at").on(table.attemptedAt),
  ],
);

/**
 * R-SPINE-003's workspace roles, declared highest rank first: OWNER outranks ADMIN, which outranks
 * MEMBER. This is their one home — the CHECK below closes the column over it, and every guard that
 * compares two people reads its ranking from this order rather than restating it (B-17, B-19), the
 * same way the catalogue's closed text columns are built from the consts they mirror.
 */
export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

/** One workspace role, as the roster declares them. */
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** The role a membership carries when nobody named one — see the column's DEFAULT below. */
const DEFAULT_WORKSPACE_ROLE: WorkspaceRole = "OWNER";

/**
 * R-SPINE-002: the join that makes an account belong somewhere. The pair is the identity — a person
 * is a member of a workspace once — and the row is written in the same transaction as the account
 * and its personal tenant, so an account that belongs nowhere is unrepresentable.
 *
 * The role that membership carries is R-SPINE-003's (OWNER, ADMIN, MEMBER), closed by a CHECK built
 * from `WORKSPACE_ROLES` so the store cannot hold a role the code does not know. Its DEFAULT is
 * OWNER because the membership sign-up writes is the personal workspace's own: the account that
 * mints a workspace owns it, and the transaction R-SPINE-002 makes the only user-creating door
 * names no role at all. A membership a later door adds for somebody else states its role.
 */
export const memberships = pgTable(
  "memberships",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId),
    workspaceRole: text("workspace_role").$type<WorkspaceRole>().notNull().default(DEFAULT_WORKSPACE_ROLE),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.userId] }),
    check("memberships_workspace_role_closed", statement`${table.workspaceRole} in (${statement.raw(closedList(WORKSPACE_ROLES))})`),
  ],
);

/**
 * R-SPINE-003's invitation: an offer of membership made to an address before there is a membership
 * to hold it. The row is the offer, never the answer — accepting it writes `memberships`, and this
 * table only records that the offer was made, at what role, by whom, and how it ended.
 *
 * The address is held as the fold `users.email` holds one (`server/auth/folded-key.ts`), so an
 * invitation and the account that eventually spends it are matched on the same key, and a value too
 * long for a btree index cannot fault a door that never judged it.
 *
 * The token is a bearer secret, so only its digest is stored — the same discipline `auth_tokens`
 * keeps. `consumed_at` and `revoked_at` are the two ways an offer stops being spendable; both are
 * recorded rather than deleted, so an invitation that was withdrawn is distinguishable from one that
 * was never made when an operator asks.
 */
export const invitations = pgTable(
  "invitations",
  {
    invitationId: uuid("invitation_id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    invitedEmailKey: text("invited_email_key").notNull(),
    workspaceRole: text("workspace_role").$type<WorkspaceRole>().notNull().default("MEMBER"),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.userId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    check("invitations_workspace_role_closed", statement`${table.workspaceRole} in (${statement.raw(closedList(WORKSPACE_ROLES))})`),
    // The one read a mailed link makes: the offer a presented token names. Indexed rather than made
    // UNIQUE — the digest is 256 bits of randomness from one mint, so no second row can carry it,
    // while a unique constraint on a tenant-scoped table's text column is a constraint the seam's
    // own per-tenant probe cannot satisfy for two tenants at once (SEAM-TENANT, V-DB).
    index("invitations_token_hash").on(table.tokenHash),
  ],
);

/**
 * L-REG-07's fork chain, as a column type rather than a convention: platform → tenant → project.
 * The labels are the `EditionScope` union itself, so the store and the digest cannot come to hold
 * different ideas of what a scope is; `platform` leads because it is the head of every lineage.
 */
const RULESET_SCOPES: readonly [EditionScope, ...EditionScope[]] = ["platform", "tenant", "project"];
export const rulesetScope = pgEnum("ruleset_scope", RULESET_SCOPES);

/**
 * The platform rule-set editions (L-MEA-01): the seed `IS1200_IN @ 2026.08` and whatever later
 * editions the platform mints. No tenant id — a platform edition belongs to no workspace, and a
 * row in a tenant-scoped table that no tenant owns is a row no policy can answer for.
 *
 * The row is immutable: authoring mints a new edition and never updates one, so the migration's
 * grants and trigger are what the column definitions here cannot say. `content_digest` is
 * deliberately not unique — a verbatim fork shares its parent's digest by construction, which is
 * the whole point of a digest over content.
 *
 * The content columns are `json` rather than `jsonb`: an edition is held exactly as it was written,
 * and `jsonb` would re-order its parameter keys on the way in — an edition's own order is what a
 * surface reads its parameters back in (R-SPINE-012), and a store that shuffled it would leave no
 * order for anything downstream to answer with. Nothing here queries inside the document, which is
 * the only thing `jsonb` would buy.
 */
export const rulesetEditions = pgTable(
  "ruleset_editions",
  {
    editionId: uuid("edition_id").primaryKey().defaultRandom(),
    scope: rulesetScope("scope").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    contentDigest: text("content_digest").notNull(),
    parameters: json("parameters").$type<Readonly<Record<string, EditionParameter>>>().notNull(),
    methods: json("methods").$type<readonly MethodPair[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Identity is (scope, name, version), so the same identity twice over is one edition written twice.
  (table) => [unique("ruleset_editions_identity").on(table.scope, table.name, table.version)],
);

/**
 * A workspace's own editions (L-REG-07): the tenant template forked from the platform seed, and the
 * project pins forked from that template. `parent_edition_id` names the edition this one was forked
 * from — across both tables, so it carries no foreign key: the parent of a template lives in
 * `ruleset_editions` and the parent of a pin lives here.
 */
export const tenantRulesetEditions = pgTable(
  "tenant_ruleset_editions",
  {
    tenantId: uuid("tenant_id").notNull(),
    editionId: uuid("edition_id").primaryKey().defaultRandom(),
    scope: rulesetScope("scope").notNull(),
    // Null on the template, which belongs to the workspace rather than to any one project.
    projectId: uuid("project_id"),
    parentEditionId: uuid("parent_edition_id").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    contentDigest: text("content_digest").notNull(),
    parameters: json("parameters").$type<Readonly<Record<string, EditionParameter>>>().notNull(),
    methods: json("methods").$type<readonly MethodPair[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One template per workspace, and one pin per project: L-REG-07 pins a project once, at creation.
    uniqueIndex("tenant_ruleset_editions_template_once").on(table.tenantId).where(statement`"scope" = 'tenant'`),
    uniqueIndex("tenant_ruleset_editions_pin_once").on(table.tenantId, table.projectId).where(statement`"scope" = 'project'`),
    // The two reads a pinned project makes: its own pin, and the template a second project reuses.
    index("tenant_ruleset_editions_scope").on(table.tenantId, table.scope),
  ],
);

/**
 * SEAM-PREFS' store (R-UI-005): what one person has chosen for themselves, one row per account. The
 * key is the account, so a second choice overwrites in place — a preference is a value, not a
 * history. Like the identity tables it carries no tenant id: a person is one account across every
 * workspace they belong to, so the row is scoped by the system-scope policy the migration appends.
 *
 * `density` is closed by a CHECK built from the seam's own roster, so the store cannot hold a mode
 * no table can draw; its DEFAULT is the same answer the seam gives an account with no row at all.
 */
export const userPrefs = pgTable(
  "user_prefs",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.userId),
    density: text("density").$type<Density>().notNull().default(DEFAULT_DENSITY),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("user_prefs_density_closed", statement`${table.density} in (${statement.raw(closedList(DENSITIES))})`)],
);

/**
 * L-MEA-04's work-item catalogue, as the database holds it. The consts in `src/core/catalogue` are
 * the source and this is their landed copy: the migration inserts exactly the emitted rows, and
 * V-VERIFY's catalogue drift stage is what keeps the two the same table. Every text column is
 * closed by a CHECK built from the enum itself, so the store cannot hold a kind or a dimension the
 * code does not know — the same belt `user_prefs.density` wears. The unit is closed *against its
 * dimension* rather than against a bare roster: the pair is what the catalogue asserts, and a row
 * saying VOLUME is measured in m would be junk the typed surface forbids and the store would keep.
 */
export const workItemCatalogue = pgTable(
  "work_item_catalogue",
  {
    kind: text("kind").$type<Kind>().primaryKey(),
    description: text("description").notNull(),
    canonicalUnit: text("canonical_unit").notNull(),
    dimension: text("dimension").$type<Dimension>().notNull(),
    roundingPrecision: integer("rounding_precision").notNull(),
  },
  (table) => [
    check("work_item_catalogue_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
    check("work_item_catalogue_dimension_closed", statement`${table.dimension} in (${statement.raw(closedList(DIMENSIONS))})`),
    check(
      "work_item_catalogue_unit_matches_dimension",
      statement`(${table.dimension}, ${table.canonicalUnit}) in (${statement.raw(canonicalUnitPairs())})`,
    ),
  ],
);

/** L-MEA-04's `bears` relation: which kinds a class lawfully bears, one row per admitted pair. */
export const bears = pgTable(
  "bears",
  {
    elementType: text("element_type").$type<ElementType>().notNull(),
    kind: text("kind").$type<Kind>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.elementType, table.kind] }),
    check("bears_element_type_closed", statement`${table.elementType} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    check("bears_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
  ],
);

/** Everything the typed surface covers. A table joins the surface by joining this object. */
const schema = {
  tenants,
  projects,
  participants,
  acts,
  participantRoles,
  participantRoleWithdrawals,
  users,
  sessions,
  authTokens,
  memberships,
  invitations,
  authAttempts,
  rulesetEditions,
  tenantRulesetEditions,
  userPrefs,
  workItemCatalogue,
  bears,
};

/** A handle scoped to one tenant: the typed read/write surface, filtered by row-level security. */
export type TenantDb = PostgresJsDatabase<typeof schema>;

/**
 * The handle drizzle hands a transaction body — the same typed surface, on the one connection the
 * transaction opened. Named here so a caller can take a transaction's handle as a parameter without
 * naming the driver's own types (SEAM-TENANT).
 */
export type TenantTx = Parameters<Parameters<TenantDb["transaction"]>[0]>[0];

/**
 * Hold a transaction-scoped lock on a named piece of state, so that everything a transaction reads
 * about that state stays true until it commits. Rows a transaction has not read yet cannot be locked
 * with `FOR UPDATE` — a row a concurrent writer is about to insert is locked by nothing — so the
 * lock is taken on the name of the state rather than on the rows that happen to hold it now. It is
 * released when the transaction ends, whichever way it ends.
 */
export async function holdStateLock(tx: TenantTx, key: string): Promise<void> {
  await tx.execute(statement`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

/** A handle running under an attributable system reason: the same surface, unfiltered by tenant. */
export type SystemDb = PostgresJsDatabase<typeof schema>;

/** How many connections one process holds, and how long an idle one is kept (in seconds). */
const POOL = { max: 10, idleTimeout: 20, connectTimeout: 10 } as const;

/**
 * One pool per database the seam is pointed at, built on first use — so importing the seam neither
 * reads nor needs a live server, and a process told to reach a different database reaches it rather
 * than answering out of a pool built for the last one.
 */
const pools = new Map<string, postgres.Sql>();

function connection(): postgres.Sql {
  const url = databaseUrl();
  const existing = pools.get(url);
  if (existing !== undefined) return existing;
  const sql = postgres(url, { max: POOL.max, idle_timeout: POOL.idleTimeout, connect_timeout: POOL.connectTimeout });
  pools.set(url, sql);
  return sql;
}

function databaseUrl(): string {
  const url = process.env["DATABASE_URL"]?.trim();
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL is not set — the seam has no database to reach (SEAM-TENANT)");
  }
  return url;
}

/**
 * A scope arms exactly one of the two settings and blanks the other. Both are written on every
 * connection the seam takes out, so a pooled connection can never carry one scope's arming into the
 * next one's query.
 */
type Scope = { readonly tenantId: string; readonly systemReason: string };

/** One round trip that arms this scope and disarms the other, on whichever connection is in hand. */
const ARM_SCOPE = `select set_config('${TENANT_GUC}', $1, false), set_config('${SYSTEM_REASON_GUC}', $2, false)`;

/** The parameter list shape the driver takes; the seam's own values are strings. */
type DriverParams = NonNullable<Parameters<postgres.Sql["unsafe"]>[1]>;

/** What drizzle's postgres-js driver asks a query for: the row objects, or the raw value tuples. */
type PendingRows = PromiseLike<unknown> & { readonly values: () => PromiseLike<unknown> };

/**
 * Take a connection, arm this scope on it, do the work, give it back. Reserving is what makes the
 * scope and the query inseparable: a session setting written on a pooled connection the query might
 * not land on would scope nothing.
 */
async function inScope<T>(sql: postgres.Sql, scope: Scope, work: (session: postgres.Sql) => Promise<T>): Promise<T> {
  const session = await sql.reserve();
  try {
    await session.unsafe(ARM_SCOPE, [scope.tenantId, scope.systemReason] as DriverParams);
    return await work(session);
  } finally {
    session.release();
  }
}

/** One statement on one session, in whichever of the two shapes drizzle asked for it. */
async function issue(session: Pick<postgres.Sql, "unsafe">, query: string, params: DriverParams, asValues: boolean): Promise<unknown> {
  const pending = session.unsafe(query, params);
  return asValues ? await pending.values() : await pending;
}

/** A query that has not run yet, and runs — once — in whichever shape drizzle asks it for. */
function pendingRows(execute: (asValues: boolean) => Promise<unknown>): PendingRows {
  let started: Promise<unknown> | undefined;
  const start = (asValues: boolean): Promise<unknown> => (started ??= execute(asValues));
  return {
    values: () => ({ then: (onRows, onFailure) => start(true).then(onRows, onFailure) }),
    then: (onRows, onFailure) => start(false).then(onRows, onFailure),
  };
}

/**
 * `SET TRANSACTION ISOLATION LEVEL ...`, which drizzle issues when the caller names an isolation
 * level, must come before every query of its transaction — and arming the scope is a query. So
 * inside a transaction the configuration statements go first and the arming waits for the first
 * statement that is not one.
 */
const CONFIGURES_TRANSACTION = /^\s*set\s+transaction\b/i;

/**
 * The client drizzle is handed inside a transaction: the same connection throughout, with the scope
 * armed on demand rather than as the opening statement, so the caller's isolation level is not
 * refused with 25001. The scope is still armed before anything reads or writes.
 */
function transactionClient(tx: postgres.TransactionSql, scope: Scope): postgres.TransactionSql {
  let arming: Promise<unknown> | undefined;
  const armedFor = (query: string): Promise<unknown> =>
    CONFIGURES_TRANSACTION.test(query) ? Promise.resolve() : (arming ??= tx.unsafe(ARM_SCOPE, [scope.tenantId, scope.systemReason] as DriverParams));

  // No `options` here: drizzle reads a client's options once, when the handle is built, and inside a
  // transaction it reaches this object for `unsafe` and `savepoint` alone.
  const client = {
    unsafe: (query: string, params: DriverParams = []): PendingRows =>
      pendingRows(async (asValues) => {
        await armedFor(query);
        return issue(tx, query, params, asValues);
      }),
    savepoint: (work: (nested: postgres.TransactionSql) => Promise<unknown>): Promise<unknown> => tx.savepoint((nested) => work(transactionClient(nested, scope))),
  };
  return client as unknown as postgres.TransactionSql;
}

/**
 * The client drizzle is handed. Its driver reaches a client through `unsafe`, `begin` and `options`
 * alone, and each of the three answers here with the scope armed before any statement of it — inside
 * a transaction too, where the whole transaction runs on the one connection it opened.
 */
function scopedClient(sql: postgres.Sql, scope: Scope): postgres.Sql {
  const client = {
    options: sql.options,
    unsafe: (query: string, params: DriverParams = []): PendingRows =>
      pendingRows((asValues) => inScope(sql, scope, (session) => issue(session, query, params, asValues))),
    begin: (work: (tx: postgres.TransactionSql) => Promise<unknown>): Promise<unknown> => sql.begin((tx) => work(transactionClient(tx, scope))),
  };
  return client as unknown as postgres.Sql;
}

/**
 * The handle's methods live on drizzle's prototype, so one taken off the handle — `const { execute }
 * = forTenant(ctx)` — would arrive without the handle it belongs to. Every method is handed out
 * already bound, so no caller can hold half of a scoped handle.
 */
function boundSurface<T extends object>(db: T): T {
  return new Proxy(db, {
    get: (target, property) => {
      const member: unknown = Reflect.get(target, property);
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
}

function handleFor(scope: Scope): PostgresJsDatabase<typeof schema> {
  return boundSurface(drizzle({ client: scopedClient(connection(), scope), schema }));
}

/** The shape a uuid column — and the `cubit.tenant_id` cast the policies make — can hold. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Can a uuid column hold this value? Handed out from the seam because the answer belongs to the
 * columns the seam defines: a value that is not one makes any statement comparing it fail as a cast
 * error (22P02) — a fault — rather than simply matching no row, so a door that takes an id from a
 * caller asks here before it asks the database (ARCH-02).
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** The one code point no `text` column can carry, written as an escape so this file stays readable. */
const UNSTORABLE_BYTE = "\u0000";

/**
 * Can a `text` column hold this value at all? Postgres carries text as a NUL-terminated string, so
 * U+0000 is not a character it can store at any length — the driver refuses the *parameter*, before
 * any column is reached, and the refusal it raises carries no refusal marker. Handed out from the
 * seam for the same reason `isUuid` is (ARCH-02): a door given a caller-written string it is about
 * to compare or store asks here first, or the driver's refusal reaches the caller as a fault id for
 * a value the door never judged (R-SPINE-007, R-SPINE-062).
 */
export function isStorableText(value: string): boolean {
  return !value.includes(UNSTORABLE_BYTE);
}

/**
 * The nearest thing a `text` column can hold to the value a caller presented: the same string with
 * the one code point postgres has no representation for dropped, and nothing else touched.
 *
 * Handed out from the same one home as `isStorableText` and for the same reason (ARCH-02). A door
 * that only *compares* a caller-written string can ask whether it is storable and answer without
 * looking; a door that must *store* one has no such option — it either writes something or hands the
 * caller a fault id for a value it never wrote — so it is given the fold rather than left to spell
 * U+0000 a second time.
 */
export function storableText(value: string): string {
  return value.replaceAll(UNSTORABLE_BYTE, "");
}

/**
 * The tenant a handle may be opened for: one the policies can read. Refused as the handle is taken,
 * like `runAsSystem`'s reason — a caller who names no lawful tenant gets no handle, rather than a
 * server error on every query it makes.
 */
function scopedTenantId(tenantId: string): string {
  if (!isUuid(tenantId)) {
    throw new Error(`forTenant({ tenantId }) needs a tenant uuid — ${JSON.stringify(tenantId)} names no tenant the policies can read (SEAM-TENANT)`);
  }
  return tenantId;
}

/** The tenant's handle: the only way a tenant's rows are read or written (SEAM-TENANT). */
export function forTenant(ctx: { tenantId: string }): TenantDb {
  return handleFor({ tenantId: scopedTenantId(ctx.tenantId), systemReason: "" });
}

/**
 * The system's handle, made only for work an attributable reason has been given for. The reason is
 * recorded as the handle is taken and carried on the session every query of it runs on, so what a
 * system-scoped statement did is answerable from the database's side too.
 */
export function runAsSystem(reason: string): SystemDb {
  return handleFor({ tenantId: "", systemReason: attributableReason(reason) });
}
