// SEAM-TENANT: every table the tenant seam publishes, with the closed rosters their CHECKs are
// written from. The ORM's table builders are a driver import and the seam's own directory is their
// one lawful home; db/schema/*.ts is the tree drizzle-kit reads them back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so
// the dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).
import { sql as statement } from "drizzle-orm";
import { bigint, check, foreignKey, index, integer, json, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { INGEST_SCHEME } from "../entitygraph/schema";
import { MODEL_IDS } from "../model-ledger.types";
import type { SourceScheme } from "../model";
import { DEFAULT_DENSITY, DENSITIES, type Density } from "../prefs/density";
import { BUILDING_TYPES, type BuildingType } from "../projects";
import { DISCIPLINES, type Discipline } from "../sheets/law";
import type { EditionParameter, EditionScope, MethodPair } from "../rulesets/editions/content";
import { closedList } from "./sql";

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
 * The model-call ledger (L-AI-01): one row per call to a model, whether it was proposed or refused,
 * with the request hash it was made under, the transport it went over and what it spent. Every call
 * is recorded, so the row is written before the outcome is known to anyone else — a refusal is a
 * ledger row too, carrying the code that explains it.
 *
 * The cost is stored beside the token counts rather than derived at read time: a rate can be
 * re-baselined, and what a call cost when it was made is a fact about that call.
 */
export const modelCalls = pgTable(
  "model_calls",
  {
    callId: uuid("call_id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    projectId: uuid("project_id").notNull(),
    modelId: text("model_id").notNull(),
    requestHash: text("request_hash").notNull(),
    transport: text("transport").notNull(),
    outcome: text("outcome").notNull(),
    refusalCode: text("refusal_code"),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    // Money, as an exact decimal: numeric, never a binary float (L-AI-01 attributes tokens to a
    // tenant, and an attribution that rounds attributes something else).
    attributedCost: numeric("attributed_cost").notNull(),
    calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The id a call was pinned to is one of the closed const's (AS-05): the column is closed over
    // the same roster the seam pins from, so the ledger cannot hold a call nobody can bill.
    check("model_calls_model_id_closed", statement`${table.modelId} in (${statement.raw(closedList(MODEL_IDS))})`),
    check("model_calls_transport_closed", statement`${table.transport} in ('live', 'fixture')`),
    check("model_calls_outcome_closed", statement`${table.outcome} in ('proposed', 'refused')`),
    // A refused call says which refusal it was, and a proposed one names none: nothing refused it.
    check("model_calls_refusal_code_iff_refused", statement`(${table.refusalCode} is not null) = (${table.outcome} = 'refused')`),
    // A call spends a whole, non-negative number of tokens — the same judgement `modelCallCost`
    // makes at the seam's edge, made again by the column, because the ledger is a table other
    // writers reach and a negative count would subtract from a tenant's attribution.
    check("model_calls_tokens_counted", statement`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0`),
    // Money the ledger can add up. `numeric` also admits 'NaN' and the infinities, and sum()
    // spreads either across every row of the tenant — one such row would make per-project spend
    // unanswerable rather than wrong by itself. NaN sorts above every number, so the upper bound
    // shuts it out along with 'Infinity'.
    check("model_calls_cost_is_money", statement`${table.attributedCost} >= 0 and ${table.attributedCost} < 'Infinity'::numeric`),
    // The read R-AI-005's surfaces make: one tenant's spend, gathered by project.
    index("model_calls_by_project").on(table.tenantId, table.projectId),
    // The key a tenant-scoped child points at (SEAM-TENANT). `call_id` is unique by itself, but a
    // foreign key naming it alone would accept a row of one workspace pointing at another's call:
    // referential checks run with row security bypassed, so only the composite key states "a call
    // this tenant made", and only it keeps the constraint from answering whether another workspace
    // made a given call. The precedent is `acts_actor_participates_fk`.
    unique("model_calls_call_per_tenant").on(table.tenantId, table.callId),
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
 * The fixture registry (L-AI-01): which recorded fixture answers a given request hash, per tenant.
 * The digest rather than the fixture — what is replayed is held where fixtures are held, and this
 * table is the registry that says a request hash has one and which one it is.
 */
export const modelFixtures = pgTable(
  "model_fixtures",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    requestHash: text("request_hash").notNull(),
    fixtureDigest: text("fixture_digest").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.requestHash] })],
);

/**
 * How a person answered a model's reading of a sheet (R-AI-001): they took it, they took it with
 * edits, or they turned it down. The roster lives here because the CHECK below is built from it and
 * core cannot import `src/modules` (ARCH-01) — the same reason `WORKSPACE_ROLES` and `UPLOAD_STATES`
 * live here; the AI module re-exports it, so the column and the door speak one list (B-17).
 */
export const DISPOSITIONS = ["accepted", "edited", "rejected"] as const;

/** One disposition, drawn from the closed roster above. */
export type Disposition = (typeof DISPOSITIONS)[number];

/**
 * The reading a disposition was made about, as the column carries it (R-AI-001's number, title,
 * discipline and view captions). It is stated here rather than imported because the shape's own home
 * is `src/modules/ai/sheet-understanding`, which core may not name (ARCH-01); that module takes its
 * `SheetReading` from this declaration rather than restating it, so the two cannot drift.
 */
export type SheetReadingRecord = {
  readonly number: string | null;
  readonly title: string;
  readonly discipline: Discipline;
  readonly captions: readonly string[];
};

/**
 * R-AI-001's last sentence: "every proposal accepted/edited/rejected is recorded". One append-only
 * row per disposition, keyed by the ledger's own `call_id`, so what a person did with a reading is
 * answerable from the call that proposed it (L-AI-01's ledger is the other half).
 *
 * It is a record and not an act (L-ACT-01): a disposition changes nothing the machine would derive —
 * confirming a discipline is CONFIRM_DISCIPLINE, an act of its own, which writes `sheet_disciplines`.
 * Nothing here does. The reading is stored twice over where it was edited: `proposed` is what the
 * model said and `resolved` what the person settled on, because an edit that overwrote the proposal
 * would destroy the evidence the disposition is about.
 *
 * `json`, not `jsonb`: a reading is shown back in the order its fields are named, and jsonb re-orders
 * what it holds. A later disposition of the same call is a newer row, never an edit of this one —
 * reads take newest-first.
 */
export const sheetUnderstandingDispositions = pgTable(
  "sheet_understanding_dispositions",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.tenantId),
    dispositionId: uuid("disposition_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    callId: uuid("call_id").notNull(),
    sheetId: text("sheet_id").notNull(),
    disposition: text("disposition").$type<Disposition>().notNull(),
    proposed: json("proposed").$type<SheetReadingRecord>().notNull(),
    resolved: json("resolved").$type<SheetReadingRecord>(),
    // Who dispositioned it. Provenance for a person reading the store, like `drawing_sets.created_by`
    // — the evidence a signature would rest on is the act seam's, and no act is performed here.
    actorUserId: uuid("actor_user_id").notNull(),
    // `clock_timestamp()`, not `now()`: `now()` is the transaction's start, so two dispositions made
    // inside one transaction would carry the same instant.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(statement`clock_timestamp()`),
    // The order rows were recorded in, which is what "newest-first" means when two of them share an
    // instant — a clock has a resolution and a sequence does not. GENERATED ALWAYS: it is the store's
    // own count of what it accepted, and a writer that could supply it could reorder the history.
    recordedSeq: bigint("recorded_seq", { mode: "number" }).generatedAlwaysAsIdentity(),
  },
  (table) => [
    check("sheet_understanding_dispositions_closed", statement`${table.disposition} in (${statement.raw(closedList(DISPOSITIONS))})`),
    // An edit is the only disposition that settles on a reading of its own; taking a proposal or
    // turning it down resolves nothing. The store says so too, because this table is reachable by
    // writers that are not the module's door.
    check("sheet_understanding_dispositions_resolved_iff_edited", statement`(${table.resolved} is not null) = (${table.disposition} = 'edited')`),
    // The call a disposition answers is one this tenant made: the key is composite because a foreign
    // key on `call_id` alone is checked with row security bypassed and would accept another
    // workspace's call id (SEAM-TENANT), as `acts_actor_participates_fk` is composite for the same
    // reason. It is the store's own statement of what `recordDisposition` checks before it writes.
    foreignKey({
      columns: [table.tenantId, table.callId],
      foreignColumns: [modelCalls.tenantId, modelCalls.callId],
      name: "sheet_understanding_dispositions_call_fk",
    }),
    // The read R-AI-005's surfaces make: one project's dispositions, newest first.
    index("sheet_understanding_dispositions_by_project").on(table.tenantId, table.projectId, table.createdAt, table.recordedSeq),
    // The read a sheet card makes: how this proposal was answered.
    index("sheet_understanding_dispositions_by_call").on(table.tenantId, table.callId),
  ],
);

/*
 * R-SPINE-020's upload rosters live beside the tables whose CHECKs are written from them: the three
 * columns below close on these lists, and the upload seam types its answers by the same ones
 * (re-exported from src/modules/spine/uploads/index.ts, which is where a caller reads them). One
 * home, read by both (ARCH-02, B-17).
 */

/** R-SPINE-020's roster, in the order the accepts line names them. */
export const ACCEPTED_FORMATS = ["dwg", "dxf", "pdf", "png", "jpg", "tiff"] as const;

/** One of the six formats a drawing arrives in, as a type. */
export type AcceptedFormat = (typeof ACCEPTED_FORMATS)[number];

/** Is this one of the six? Asked wherever a format arrives as text — a stored row, a query answer. */
export function isAcceptedFormat(value: string): value is AcceptedFormat {
  return (ACCEPTED_FORMATS as readonly string[]).includes(value);
}

/**
 * Where an upload session stands: taking bytes, ended with its content stored, or ended refused.
 * The set is closed because the column's CHECK is written from it — a session in no state at all is
 * a session nothing can answer for.
 */
export const UPLOAD_STATES = ["open", "stored", "refused"] as const;

/** One of the three, as a type. */
export type UploadState = (typeof UPLOAD_STATES)[number];

/**
 * What a scanner said about some bytes (R-SPINE-020's hook point). `skipped` is the honest answer of
 * an installation with no scanner wired: it is recorded on the stored file so nothing unscanned is
 * ever read back as clean.
 */
export const SCAN_VERDICTS = ["clean", "infected", "skipped"] as const;

/** One verdict, as a type. */
export type ScanVerdict = (typeof SCAN_VERDICTS)[number];

/**
 * R-SPINE-022's three zoom tiers, smallest first: the sheet index's thumbnail, the viewer's
 * preview and the full-page raster. The roster lives here because the `sheet_rasters` CHECK is
 * written from it and the raster seam types its answers by the same list (re-exported from
 * src/modules/takeoff/thumbnails, which is where a caller reads it) — one home, read by both
 * (ARCH-02, B-17). The pixels each tier is rendered at belong to the renderer, not to the store.
 */
export const RASTER_TIERS = ["thumb", "preview", "full"] as const;

/** One zoom tier, as a type. */
export type RasterTier = (typeof RASTER_TIERS)[number];

/** R-SPINE-020's ceiling: 500 MB per file, in bytes. */
export const UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

/** The chunk an upload session takes at a time, in bytes. */
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * R-SPINE-020's stored content, addressed by what it is: one row per distinct content a workspace
 * holds, keyed by the tenant and the sha256 of the bytes. A second upload of identical bytes finds
 * this row and links it rather than storing the content again, which is why the digest is the key
 * and not a column beside one.
 *
 * `scan_verdict` is recorded rather than implied: an installation with no scanner wired answers
 * `skipped`, and a file nobody scanned must never read back as one somebody passed (Q-12).
 */
export const files = pgTable(
  "files",
  {
    tenantId: uuid("tenant_id").notNull(),
    sha256: text("sha256").notNull(),
    byteLength: integer("byte_length").notNull(),
    format: text("format").$type<AcceptedFormat>().notNull(),
    scanVerdict: text("scan_verdict").$type<ScanVerdict>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.sha256] }),
    check("files_format_closed", statement`${table.format} in (${statement.raw(closedList(ACCEPTED_FORMATS))})`),
    check("files_scan_verdict_closed", statement`${table.scanVerdict} in (${statement.raw(closedList(SCAN_VERDICTS))})`),
    check("files_byte_length_counted", statement`${table.byteLength} >= 0`),
  ],
);

/**
 * One drawing per presented file (R-SPINE-020): the name it arrived under — a member path out of a
 * `.zip` or a dropped folder's relative path, verbatim, because which folder a sheet came out of is
 * drawing information — pointing at the content it is made of.
 *
 * Two drawings of one content are two rows against one `files` row: the composite foreign key is
 * what makes "detected and linked, not re-stored" a property of the schema rather than of a writer
 * remembering to check.
 */
export const drawings = pgTable(
  "drawings",
  {
    tenantId: uuid("tenant_id").notNull(),
    drawingId: uuid("drawing_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    sha256: text("sha256").notNull(),
    name: text("name").notNull(),
    format: text("format").$type<AcceptedFormat>().notNull(),
    uploadedBy: uuid("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "drawings_content",
      columns: [table.tenantId, table.sha256],
      foreignColumns: [files.tenantId, files.sha256],
    }),
    check("drawings_format_closed", statement`${table.format} in (${statement.raw(closedList(ACCEPTED_FORMATS))})`),
    // The read every drawing surface makes: one project's drawings, newest first.
    index("drawings_by_project").on(table.tenantId, table.projectId, table.createdAt),
  ],
);

/**
 * A transfer in progress (R-SPINE-020's resumable half): what was declared when the session opened,
 * how many bytes have been acknowledged since, and how it ended. `received_bytes` is the resumption
 * point a probe answers with — the server's own count of what it holds, never the client's.
 */
export const uploads = pgTable(
  "uploads",
  {
    tenantId: uuid("tenant_id").notNull(),
    uploadId: uuid("upload_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    declaredSize: integer("declared_size").notNull(),
    declaredSha256: text("declared_sha256").notNull(),
    receivedBytes: integer("received_bytes").notNull().default(0),
    state: text("state").$type<UploadState>().notNull().default("open"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check("uploads_state_closed", statement`${table.state} in (${statement.raw(closedList(UPLOAD_STATES))})`),
    // A session never takes more than it was opened for, and never fewer than none: the offset a
    // client resumes from is a position inside the file it declared.
    check("uploads_received_within_declared", statement`${table.receivedBytes} >= 0 and ${table.receivedBytes} <= ${table.declaredSize}`),
    check("uploads_declared_size_counted", statement`${table.declaredSize} >= 0 and ${table.declaredSize} <= ${statement.raw(String(UPLOAD_MAX_BYTES))}`),
  ],
);

/**
 * The schemes an extractor is wired to mint today, out of L-CAD-02's closed universe. The column
 * below closes on this list, so a record can only ever name geometry something really took — a lane
 * landing later widens the list where its mirror admits the scheme, not here (B-19).
 */
const INGESTED_SCHEMES = [INGEST_SCHEME] as const satisfies readonly SourceScheme[];

/**
 * R-TO-001's ingest record: which extractor, at which version and parameter set, took which
 * geometry out of which bytes, and what it counted while doing it (L-CAD-02 pins the identity a
 * source key is scoped to).
 *
 * It is evidence, so it is append-only and a re-ingest never replaces one: a declared re-ingest
 * writes a new row naming the row it supersedes and the reason it was asked for, and a first ingest
 * names neither. Whether those two go together is judged at the seam, where a refusal can be
 * answered, rather than by a CHECK that could only abort a job.
 *
 * `facts` is `json` and not `jsonb`: the counters are read back in the artifact's own order, and
 * jsonb re-orders the keys of every object it stores.
 */
export const ingests = pgTable(
  "ingests",
  {
    tenantId: uuid("tenant_id").notNull(),
    ingestId: uuid("ingest_id").primaryKey().defaultRandom(),
    drawingId: uuid("drawing_id")
      .notNull()
      .references(() => drawings.drawingId),
    sha256: text("sha256").notNull(),
    jobId: text("job_id").notNull(),
    artifactSha256: text("artifact_sha256").notNull(),
    extractorScheme: text("extractor_scheme").$type<SourceScheme>().notNull(),
    extractorTool: text("extractor_tool").notNull(),
    extractorToolVersion: text("extractor_tool_version").notNull(),
    extractorParameterSetHash: text("extractor_parameter_set_hash").notNull(),
    facts: json("facts").$type<Readonly<Record<string, unknown>>>().notNull(),
    supersedesIngestId: uuid("supersedes_ingest_id"),
    declaredReason: text("declared_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("ingests_extractor_scheme_closed", statement`${table.extractorScheme} in (${statement.raw(closedList(INGESTED_SCHEMES))})`),
    // One job writes one record, however many times its attempt runs (SEAM-JOBS' idempotence).
    uniqueIndex("ingests_job_once").on(table.tenantId, table.jobId),
    // The read every ingest history makes: one drawing's records, newest first.
    index("ingests_by_drawing").on(table.tenantId, table.drawingId, table.createdAt),
  ],
);

/**
 * R-SPINE-022's rendered sheets: one row per (ingest, layout, tier), naming the address SEAM-STORAGE
 * holds that raster's bytes at and the size they were rendered to.
 *
 * A raster is evidence of what a revision looked like, so the table is append-only like the record
 * it hangs off: a re-render of the same sheet at the same tier finds the row it already wrote rather
 * than replacing it, which is what `sheet_rasters_once` is for. The dimensions carry no range CHECK
 * — a canvas of no pixels is a renderer's mistake, and the seam answers for it where a refusal can
 * be given rather than by aborting a job at the store (ARCH-03).
 */
export const sheetRasters = pgTable(
  "sheet_rasters",
  {
    tenantId: uuid("tenant_id").notNull(),
    rasterId: uuid("raster_id").primaryKey().defaultRandom(),
    ingestId: uuid("ingest_id")
      .notNull()
      .references(() => ingests.ingestId),
    drawingId: uuid("drawing_id")
      .notNull()
      .references(() => drawings.drawingId),
    jobId: text("job_id").notNull(),
    layoutName: text("layout_name").notNull(),
    tier: text("tier").$type<RasterTier>().notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("sheet_rasters_tier_closed", statement`${table.tier} in (${statement.raw(closedList(RASTER_TIERS))})`),
    // One raster per sheet per tier per record, however many attempts render it (SEAM-JOBS).
    uniqueIndex("sheet_rasters_once").on(table.tenantId, table.ingestId, table.layoutName, table.tier),
    // The read the sheet index makes: one drawing's rasters.
    index("sheet_rasters_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * L-REG-03's confirmed discipline: one append-only row per sheet a person confirmed, naming the act
 * that carried it (L-ACT-01 — the act row and the state change land in one transaction or neither).
 *
 * A confirmation is never a before-image: the machine's proposal is not stored at all, so nothing
 * here overwrites a machine value — the row is the human's own observation, with the act as its
 * basis. `sheet_disciplines_once` is what makes a sheet confirmed once per record; a re-ingest mints
 * a new record and its sheets are unconfirmed again, which is what "drawing-scoped, human-confirmed,
 * fails closed" means when the drawing is read a second time.
 */
export const sheetDisciplines = pgTable(
  "sheet_disciplines",
  {
    tenantId: uuid("tenant_id").notNull(),
    confirmationId: uuid("confirmation_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id")
      .notNull()
      .references(() => drawings.drawingId),
    ingestId: uuid("ingest_id")
      .notNull()
      .references(() => ingests.ingestId),
    layoutName: text("layout_name").notNull(),
    discipline: text("discipline").$type<Discipline>().notNull(),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("sheet_disciplines_discipline_closed", statement`${table.discipline} in (${statement.raw(closedList(DISCIPLINES))})`),
    // One confirmation per sheet of one record: a second confirmation of the same sheet is a
    // competing observation, which L-ACT-01 gives its own path and this increment does not render.
    uniqueIndex("sheet_disciplines_once").on(table.tenantId, table.ingestId, table.layoutName),
    // The read the sheet index makes: one project's confirmations.
    index("sheet_disciplines_by_project").on(table.tenantId, table.projectId),
  ],
);

/**
 * R-TO-030's stored partition, view half: one row per view an ingest's model space was cut into
 * (L-CAD-06). A partition is REBUILT per ingest rather than appended to — the rows are deleted and
 * written again in one transaction — so this is a derived table, not a ledger, and the app role holds
 * a DELETE on it.
 *
 * The key is content-derived and mints nothing (L-REG-04): a view is its class and the source key of
 * the caption that anchors it, so re-deriving the same artifact reproduces the same key multiset. The
 * primary key is that triple rather than a surrogate for the same reason.
 *
 * It references no ledger. The ingest, the drawing and the model call are named by id and pointed at
 * by nothing: a table rebuilt per ingest may not be a child of an append-only table, or emptying one
 * would fail on the constraint this table would add (0A000).
 *
 * The model's reading, where one was asked for, stands BESIDE the view and never in it (L-AI-02):
 * `proposed_type` is what a model proposed for a caption the grammar could not read, `proposed_call_id`
 * the ledger row that proposed it, and `type` stays what the grammar answered until a person confirms
 * otherwise.
 */
export const partitionViews = pgTable(
  "partition_views",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    type: text("type").notNull(),
    /** Why the type is what it is, where the grammar read nothing — a registered refusal code. */
    reason: text("reason"),
    /** The caption this view is anchored by, as the drawing states it; empty where none anchors it. */
    caption: text("caption").notNull(),
    /** The source key of the caption's own entity, or null for the view no caption anchors. */
    anchorKey: text("anchor_key"),
    proposedType: text("proposed_type"),
    proposedCallId: uuid("proposed_call_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "partition_views_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    // A proposal is a payload and the call that made it, or neither: a proposed class naming no
    // ledger row would be a reading nobody could audit (L-AI-01).
    check("partition_views_proposal_whole", statement`(${table.proposedType} is null) = (${table.proposedCallId} is null)`),
    // The read a screen and the act seam make: one drawing's current partition.
    index("partition_views_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * R-TO-030's stored partition, membership half: which view each model-space original entity landed
 * in. L-CAD-06 — "every model-space original entity belongs to exactly one view" — is this table's
 * primary key, so a partition that assigned an entity twice cannot be written at all.
 *
 * Rewritten per ingest with the views above, in the same transaction, and pointing at no ledger for
 * the same reason.
 */
export const viewAssignments = pgTable(
  "view_assignments",
  {
    tenantId: uuid("tenant_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    entityKey: text("entity_key").notNull(),
    viewKey: text("view_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "view_assignments_entity", columns: [table.tenantId, table.ingestId, table.entityKey] }),
    // The read the partition makes of itself: everything one view holds.
    index("view_assignments_by_view").on(table.tenantId, table.ingestId, table.viewKey),
  ],
);

/**
 * L-CAD-06's human half: what a person confirmed one view to be, and the act that carried it
 * (L-ACT-01 — the act row and the state change land in one transaction or neither).
 *
 * A confirmation is never a before-image and never a rewrite: the grammar's own reading stays in
 * `partition_views.type` and this row stands beside it. It is a record of something a person did, so
 * unlike the two tables above it is append-only and the app role holds no DELETE.
 */
export const viewTypeConfirmations = pgTable(
  "view_type_confirmations",
  {
    tenantId: uuid("tenant_id").notNull(),
    confirmationId: uuid("confirmation_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    type: text("type").notNull(),
    actId: uuid("act_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One confirmation per view of one record: a second, disagreeing reading is a competing
    // observation, which L-ACT-01 gives its own path and this increment does not render.
    uniqueIndex("view_type_confirmations_once").on(table.tenantId, table.ingestId, table.viewKey),
    // The read the partition makes: what a drawing's views have been confirmed as.
    index("view_type_confirmations_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * R-TO-005's drawing set: a named grouping of a project's drawings, told apart from its siblings by
 * the name a person gave it. The row is a record of a naming that happened and is never rewritten —
 * what the set NAMES lives in `drawing_set_members` beside it, which is a draft.
 */
export const drawingSets = pgTable(
  "drawing_sets",
  {
    tenantId: uuid("tenant_id").notNull(),
    setId: uuid("set_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A project tells its sets apart by name, so the store is what makes SET_NAME_NOT_USABLE true
    // rather than a writer remembering to look first.
    unique("drawing_sets_named_once").on(table.tenantId, table.projectId, table.name),
    // The read the sets index makes: one project's sets, newest first.
    index("drawing_sets_by_project").on(table.tenantId, table.projectId, table.createdAt),
  ],
);

/**
 * Which drawings a set names right now: a draft, edited one subject at a time and derived from by
 * nothing (L-ACT-01 — an act is a write that changes what the machine would derive, and this is not
 * one). A row taken out of it destroys no evidence, because the evidence is the pinned revision.
 */
export const drawingSetMembers = pgTable(
  "drawing_set_members",
  {
    tenantId: uuid("tenant_id").notNull(),
    setId: uuid("set_id")
      .notNull()
      .references(() => drawingSets.setId),
    drawingId: uuid("drawing_id")
      .notNull()
      .references(() => drawings.drawingId),
    // Who the draft edit is attributed to. It is provenance for a person reading the store and
    // never evidence: nothing is derived from a draft (I-B), and the record a campaign is measured
    // against is the pinned revision, whose author is the act it names (L-ACT-01).
    addedBy: uuid("added_by").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ name: "drawing_set_members_pk", columns: [table.tenantId, table.setId, table.drawingId] })],
);

/**
 * L-REG-06's pinned set revision: the manifest of (drawing, drawing revision) pairs a pin recorded,
 * content-addressed by the digest of its members in canonical order, naming the act that authored
 * it. Immutable — "mutation is advance, never drift", so a changed membership or a re-revved member
 * yields another row here and never an edit of this one. The digest carries no uniqueness: content
 * addressing means the same content has the same address, and A → B → A is three revisions.
 */
export const drawingSetRevisions = pgTable(
  "drawing_set_revisions",
  {
    tenantId: uuid("tenant_id").notNull(),
    setRevisionId: uuid("set_revision_id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => drawingSets.setId),
    projectId: uuid("project_id").notNull(),
    digest: text("digest").notNull(),
    // `json`, not `jsonb`: the manifest is stored in the canonical order it was addressed in, and
    // jsonb re-orders what it holds.
    manifest: json("manifest").$type<{ drawingId: string; revisionId: string; sha256: string; name: string }[]>().notNull(),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The read the set browser makes: one set's pinned revisions, in the order they were pinned.
    index("drawing_set_revisions_by_set").on(table.tenantId, table.setId, table.createdAt),
  ],
);

/**
 * Everything the typed surface covers. A table joins the surface by joining this object, and it is
 * exported because the binding to the schema tree is a check rather than a sentence: `db/schema.ts`
 * is the barrel drizzle-kit and the drift lane read, and a test beside this file compares the two
 * rosters in both directions, so a table added to the tree and forgotten here fails (B-05).
 */
export const SEAM_SCHEMA = {
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
  modelCalls,
  modelFixtures,
  sheetUnderstandingDispositions,
  files,
  drawings,
  uploads,
  ingests,
  sheetRasters,
  sheetDisciplines,
  partitionViews,
  viewAssignments,
  viewTypeConfirmations,
  drawingSets,
  drawingSetMembers,
  drawingSetRevisions,
};
