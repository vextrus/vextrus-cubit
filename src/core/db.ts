// SEAM-TENANT: forTenant(ctx) and runAsSystem(reason) are the only database handles the tree has.
// The driver, the schema and drizzle's typed read/write surface live here and nowhere else, and
// every query a handle issues runs on a connection its scope has been armed on — the row-level
// security the tenancy-base migration installs reads that scope and nothing else.
//
// The table definitions sit here rather than in db/schema/*.ts because the ORM's table builders are
// a driver import, and this file is their one lawful home; db/schema/*.ts is the tree drizzle-kit
// reads them back out of.
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql as statement, type AnyColumn, type SQL } from "drizzle-orm";
import { PgDialect, bigserial, check, foreignKey, index, integer, json, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import PgBoss from "pg-boss";
import postgres from "postgres";
import { ELEMENT_TYPES, type ElementType } from "./catalogue/element-types";
import { KINDS, type Kind } from "./catalogue/kinds";
import { attributableReason } from "./db/reason";
import { INGEST_SCHEME } from "./entitygraph/schema";
import { reportFault } from "./faults/report";
import { TERMINAL_STATUSES } from "./jobs/statuses";
import { MODEL_IDS, minimalDecimal } from "./model-ledger.types";
import type { SourceScheme } from "./model";
import { DEFAULT_DENSITY, DENSITIES, type Density } from "./prefs/density";
import { BUILDING_TYPES, type BuildingType } from "./projects";
import { DISCIPLINES, type Discipline } from "./sheets/law";
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
 * Role grants, append-only: a role is bundled permissions, and holding one is a fact the log made
 * (L-ACT-03). What `act_id` being nullable means is stated on the column itself.
 */
export const participantRoles = pgTable(
  "participant_roles",
  {
    tenantId: uuid("tenant_id").notNull(),
    grantId: uuid("grant_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    /**
     * The act that made this grant, where one did. It is nullable for exactly one lawful grant: the
     * creation PRINCIPAL L-ACT-03 installs in the project's own transaction ("project creation
     * inserts its creator as PRINCIPAL in the same transaction"), which is not an act somebody
     * performed and so has none to name. Every other grant is itself an act and carries its id.
     *
     * No CHECK enforces that reading. A constraint of the form "act_id is not null or role is
     * PRINCIPAL" would refuse the act-less non-PRINCIPAL grants the tree's own staging helpers
     * lawfully write, so the rule lives where a refusal can be answered — the act seam — and the
     * column stays as the law describes it (L-ACT-03).
     */
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
  // The account's fold key, not the address a person typed: `foldedKey` (src/server/auth/folded-key.ts)
  // writes what lands here, and `presentedValue` from that same home untags it back into the address
  // a person is shown or mailed at. Two addresses that fold together are one account, which is what
  // makes the unique index below a belt for the door's own answer (ACCOUNT_ALREADY_EXISTS) rather
  // than the answer itself.
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
    /**
     * The order the store pinned them in. `created_at` is a clock, and two pins of one set can share
     * an instant — `defaultNow()` is the transaction's own timestamp, so two pins in one transaction
     * share it exactly. "Which revision is current" then tie-broke on a random uuid, which is to say
     * on nothing: the answer could differ between two reads of unmoved state (R-SPINE-021). The
     * sequence is the store's own monotonic order, and it is what the tie is broken on. The clock
     * stays the first key so `drawing_set_revisions_by_set` still serves the browser's read.
     */
    seq: bigserial("seq", { mode: "number" }).notNull(),
  },
  (table) => [
    // The read the set browser makes: one set's pinned revisions, in the order they were pinned —
    // the clock first, then the sequence that decides a tie in it.
    index("drawing_set_revisions_by_set").on(table.tenantId, table.setId, table.createdAt, table.seq),
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
  workItemCatalogue,
  bears,
  files,
  drawings,
  uploads,
  ingests,
  sheetRasters,
  sheetDisciplines,
  drawingSets,
  drawingSetMembers,
  drawingSetRevisions,
};

/**
 * A handle scoped to one tenant: the typed read/write surface, filtered by row-level security. The
 * handle carries the scope it was armed with, so a read that must name its tenant asks the handle
 * rather than the session — the seam set the setting, and reading it back would be a round trip
 * spent asking the database what this file already knows (SEAM-TENANT).
 */
export type TenantDb = PostgresJsDatabase<typeof SEAM_SCHEMA> & { readonly scope: Scope };

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
  await tx.execute(advisoryXactLock(key));
}

/**
 * The one spelling of a transaction-scoped advisory lock on a name (B-17): the hash the name is
 * folded to is a fact both the state lock above and the jobs seam's key lock depend on, and two
 * spellings of it would be two locks that never contend.
 */
function advisoryXactLock(name: string): SQL {
  return statement`select pg_advisory_xact_lock(hashtextextended(${name}, 0))`;
}

/**
 * The store's own clock, as a value a write stamps a column with. A column whose default is `now()`
 * and whose upsert branch stamps `new Date()` is stamped by two clocks — the database's and this
 * process's — which agree only as far as the two machines' time does, so the same row can be written
 * "before" the row it replaced. Every branch of every write stamps from here (B-17, ARCH-02).
 */
export function storeNow(): SQL {
  return statement`now()`;
}

/** A handle running under an attributable system reason: the same surface, unfiltered by tenant. */
export type SystemDb = TenantDb;

/**
 * How many connections one process holds, how long an idle one is kept, and how long a close waits
 * for what is still outstanding before it destroys the connections anyway (all in seconds).
 */
const POOL = { max: 10, idleTimeout: 20, connectTimeout: 10, endTimeout: 5 } as const;

/**
 * One pool per database the seam is pointed at, built on first use — so importing the seam neither
 * reads nor needs a live server, and a process told to reach a different database reaches it rather
 * than answering out of a pool built for the last one.
 */
const pools = new Map<string, postgres.Sql>();

/**
 * End every pool the seam built and forget it, so a process that touched the seam can exit. The
 * registry is emptied as well as ended: a later scoped call builds a fresh pool rather than handing
 * out an ended one, and closing pools that were never built closes nothing.
 *
 * Bounded, because "so a process can exit" is the whole point: an unbounded `end()` waits for every
 * outstanding query, and a query against a server that accepts a socket and never answers has no
 * outstanding time. Past the bound the connections are destroyed and the outstanding query is
 * rejected — which is a failure its own caller hears, where a process that never exits is a failure
 * nobody hears at all (ARCH-03).
 */
export async function closePools(): Promise<void> {
  const built = [...pools.values()];
  pools.clear();
  await Promise.all(built.map(async (sql) => await sql.end({ timeout: POOL.endTimeout })));
}

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
export type Scope = { readonly tenantId: string; readonly systemReason: string };

/** One round trip that arms this scope and disarms the other, on whichever connection is in hand. */
const ARM_SCOPE = `select set_config('${TENANT_GUC}', $1, false), set_config('${SYSTEM_REASON_GUC}', $2, false)`;

/** The parameter list shape the driver takes; the seam's own values are strings. */
type DriverParams = NonNullable<Parameters<postgres.Sql["unsafe"]>[1]>;

/** What drizzle's postgres-js driver asks a query for: the row objects, or the raw value tuples. */
type PendingRows = PromiseLike<unknown> & { readonly values: () => PromiseLike<unknown> };

/**
 * Arm this scope and do the work on one connection. The driver's own transaction is what makes the
 * scope and the query inseparable — a session setting written on a pooled connection the query might
 * not land on would scope nothing. It is not free: `begin` sends a BEGIN before the arming statement
 * and a COMMIT after the work, so a scoped read costs two round trips beyond the statement itself.
 * They are paid because the alternative is unsound — a session setting and a query on two different
 * pooled connections scope nothing at all — and because the driver pipelines the arming and the
 * work onto the connection the transaction already holds, where reserving a connection per statement
 * made the seam pay for one twice over.
 *
 * The work's answer is carried inside a wrapper because the driver executes an array a transaction
 * body returns; a result set is an array, and handing it back bare would run its rows as queries.
 */
async function inScope<T>(sql: postgres.Sql, scope: Scope, work: (session: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const held = await sql.begin(async (tx) => {
    await tx.unsafe(ARM_SCOPE, [scope.tenantId, scope.systemReason] as DriverParams);
    return { answer: await work(tx) };
  });
  return (held as unknown as { answer: T }).answer;
}

/** One statement on one session, in whichever of the two shapes drizzle asked for it. */
async function issue(session: Pick<postgres.Sql, "unsafe">, query: string, params: DriverParams, asValues: boolean): Promise<unknown> {
  const pending = session.unsafe(query, params);
  return asValues ? await pending.values() : await pending;
}

/**
 * A query that has not run yet, and runs — once per shape — in whichever shape drizzle asks it for.
 * The memo is keyed by the shape rather than held as one slot: a slot answers the second reader with
 * the first reader's shape, so a pending query awaited for rows and then asked for value tuples would
 * hand back row objects that nothing can read positionally.
 */
function pendingRows(execute: (asValues: boolean) => Promise<unknown>): PendingRows {
  const started = new Map<boolean, Promise<unknown>>();
  const start = (asValues: boolean): Promise<unknown> => {
    const running = started.get(asValues) ?? execute(asValues);
    started.set(asValues, running);
    return running;
  };
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

  // The wrapper states the options of the handle it wraps, so a driver reading them off this client
  // reads the transaction's own settings and never another handle's.
  const client = {
    options: (tx as unknown as { options?: postgres.Sql["options"] }).options,
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
export function scopedClient(sql: postgres.Sql, scope: Scope): postgres.Sql {
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

function handleFor(scope: Scope): TenantDb {
  const db = drizzle({ client: scopedClient(connection(), scope), schema: SEAM_SCHEMA });
  // Pinned on the handle, not writable: the scope a handle was armed with is what every query of
  // it runs under, and a member a caller could overwrite would say one thing while the session
  // said another.
  const armed: TenantDb = Object.assign(db, { scope });
  Object.defineProperty(armed, "scope", { writable: false, configurable: false });
  return boundSurface(armed);
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

/**
 * The tenant filter a scoped read states for itself, beside the policy that states the same thing.
 * The scope a handle armed is a session setting, so the predicate reads it rather than taking a
 * tenant id as an argument no caller has: under a tenant handle it narrows to that tenant, and under
 * a system handle — which is armed with no tenant on purpose (SEAM-TENANT) — it narrows to the row's
 * own tenant, so the seam's own filter can never contradict the policy it stands beside.
 *
 * It is a recheck, not an access path: the fallback arm names the column, so the planner cannot use
 * this predicate as an index qualifier. What it buys is that a read states what it narrows to.
 *
 * Handed out from here because the setting's name is the migration's and this file is its one home
 * (ARCH-02): a read that spelled `current_setting` itself would be a second copy of that name.
 */
export function inCurrentScope(column: AnyColumn): SQL {
  return statement`${column} = coalesce(nullif(current_setting(${TENANT_GUC}, true), '')::uuid, ${column})`;
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

/** What one project spent on model calls: how many were made, how they ended, and what they cost. */
export type ModelSpend = {
  projectId: string;
  calls: number;
  proposed: number;
  refused: number;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
};

/** The tenant a handle is armed for, as the handle itself carries it; a handle armed for none is refused. */
function armedTenantId(db: TenantDb): string {
  const tenantId = db.scope.tenantId;
  if (tenantId === "") {
    throw new Error("modelSpendByProject needs a tenant's handle — a system-scoped handle would answer one entry per project across every tenant, which no caller could tell from a scoped answer (SEAM-TENANT)");
  }
  return tenantId;
}

/**
 * A count postgres answered with, as a number. Counts and token sums come back as text because they
 * are `bigint`s, and one past what a double counts exactly would come back quietly rounded — in the
 * one surface whose whole job is exact attribution. Unreachable by ordinary spending, and a fault
 * rather than a wrong total if it ever is reached.
 */
function counted(value: string, field: string): number {
  const total = Number(value);
  if (!Number.isSafeInteger(total)) {
    throw new Error(`model spend's ${field} totals ${value}, which is past the last whole number a double counts exactly — the total would be rounded, not reported`);
  }
  return total;
}

/**
 * Per-project model spend for the tenant the handle is scoped to (R-AI-005): one entry per project
 * the tenant has calls for, counting proposed and refused alike — L-AI-01 records every call, and a
 * spend report that dropped the refusals would understate what the tenant was charged.
 *
 * The money is summed by the database, whose numeric addition is exact, and comes back as a decimal
 * string: a total that became a double on the way out would be a different total. The counts are
 * what postgres answers a count with — text — turned back into numbers here, so no caller has to.
 *
 * The tenant is named in the query as well as left to row-level security. `TenantDb` and `SystemDb`
 * are the same typed surface, so a system handle reaches this function without a type error, and a
 * read governed by policy alone would answer it with every tenant's calls merged into one entry per
 * project — an answer indistinguishable from a scoped one. So the handle is asked which tenant it is
 * armed for, before any statement is issued: one that names none is refused where it is taken, like
 * `forTenant`'s own tenant id. The read is then the one statement.
 */
export async function modelSpendByProject(db: TenantDb): Promise<ModelSpend[]> {
  const tenantId = armedTenantId(db);
  const rows = await db
    .select({
      projectId: modelCalls.projectId,
      calls: statement<string>`count(*)`,
      proposed: statement<string>`count(*) filter (where ${modelCalls.outcome} = 'proposed')`,
      refused: statement<string>`count(*) filter (where ${modelCalls.outcome} = 'refused')`,
      inputTokens: statement<string>`coalesce(sum(${modelCalls.inputTokens}), 0)`,
      outputTokens: statement<string>`coalesce(sum(${modelCalls.outputTokens}), 0)`,
      attributedCost: statement<string>`coalesce(sum(${modelCalls.attributedCost}), 0)::text`,
    })
    .from(modelCalls)
    .where(eq(modelCalls.tenantId, tenantId))
    .groupBy(modelCalls.projectId)
    .orderBy(asc(modelCalls.projectId));

  return rows.map((row) => ({
    projectId: row.projectId,
    calls: counted(row.calls, "calls"),
    proposed: counted(row.proposed, "proposed"),
    refused: counted(row.refused, "refused"),
    inputTokens: counted(row.inputTokens, "inputTokens"),
    outputTokens: counted(row.outputTokens, "outputTokens"),
    attributedCost: minimalDecimal(row.attributedCost),
  }));
}

/* ------------------------------------------------------------------------------------------------
 * SEAM-JOBS' storage (R-SPINE-030, R-SPINE-031).
 *
 * A queue library is a database driver by the same reading that makes `postgres` one, so pg-boss is
 * imported here and nowhere else (SEAM-TENANT). What follows hands `src/core/jobs` a driver-free
 * handle on two things and only two: the queue, and the durable per-step event log the clause asks
 * for. The meaning of a job — which kinds exist, what a refusal is, when a key is free again —
 * belongs to the seam above; this is where those decisions are stored, not where they are made
 * (ARCH-02).
 *
 * Both stores stand outside the schema tree drizzle-kit reads, so neither can drift from it. The
 * ground they need — the log's schema and the door that installs the queue library's — is made by
 * the migrate lane; the log's tables are the seam's own repeatable DDL, written by whichever tier
 * writes first, and the queue's storage is installed by the managing tier through that door.
 * ---------------------------------------------------------------------------------------------- */

/** The schema the event log lives in; the queue library keeps its own tables beside it. */
const JOBS_SCHEMA = "cubit_jobs";
const BOSS_SCHEMA = "pgboss";

/** The channel every appended event is announced on, so a reader elsewhere need not poll hard. */
const EVENTS_CHANNEL = "cubit_job_events";

/**
 * How often a queue asks for work when nothing has woken it. The library's floor is 500ms, and the
 * floor is what is wanted: a retry's backoff is only observable to the accuracy of the poll that
 * picks the retry up.
 */
const QUEUE_POLL_SECONDS = 0.5;

/** How many connections the log holds. Its own pool, so closing it cannot close a tenant's handle. */
const JOBS_POOL = { max: 5, idleTimeout: 20, connectTimeout: 10 } as const;

/**
 * The key lock's connections, which are deliberately not the log's.
 *
 * A session advisory lock is held on one physical connection for the whole of the guarded section,
 * and that section reads and writes the log — on the pool. Taking both from one pool is a deadlock
 * with no way out: as many concurrent enqueues of *different* keys as the pool is wide would each
 * hold a reservation and each wait for a connection only another one of them could give back. The
 * lock therefore has a pool of its own, so a waiter only ever waits for a lock holder to finish.
 */
const LOCK_POOL = { max: 8, idleTimeout: 20, connectTimeout: 10 } as const;

/**
 * How long an enqueue waits for another enqueue of the SAME key before giving up, in milliseconds.
 * Generous — the guarded section is a claim and a send — but finite: a wait with no end turns one
 * wedged key into every connection in the lock pool, and then into every key (SEAM-JOBS).
 */
const LOCK_WAIT_MS = 30_000;

/** What Postgres answers when the log has not been provisioned yet: no such table, no such schema. */
const UNDEFINED_TABLE = "42P01";
const INVALID_SCHEMA_NAME = "3F000";
/** What Postgres answers when a unique index cannot be built over rows that already collide. */
const UNIQUE_VIOLATION = "23505";

/**
 * How the queue's own outages are recorded. A lost connection, a failed maintenance pass or a
 * queue that would not start is a non-refusal server-side failure like any other, so it crosses
 * the one fault seam rather than being written down in a dialect of its own (ARCH-03, ARCH-02).
 * It belongs to no request, so the one name serves as the request id and the route alike.
 */
const QUEUE_ROUTE = "jobs/queue";
const QUEUE_ACTOR = "pg-boss";

/**
 * How a log that could not be provisioned is recorded. The log's DDL runs on the first write of a
 * process; a statement of it that fails would otherwise reject every enqueue and every event write
 * after it with a raw driver error, so it crosses the one fault seam like the queue's own start
 * (ARCH-03, B-21).
 */
const LOG_ROUTE = "jobs/log";
const LOG_ACTOR = "jobs/log";

/**
 * How a failure of the key lock itself is recorded. A wait that hit its bound, a lock connection
 * that died, a transaction that would not commit: none is a refusal any registered code covers and
 * all are this seam's own failure, so they cross the one fault seam before the caller sees anything
 * (ARCH-03, B-21).
 */
const LOCK_ACTOR = "jobs/lock";
const LOCK_ROUTE = "jobs/lock";

/** The dialect the lock statement is rendered in for the driver, which takes text and parameters. */
const LOCK_DIALECT = new PgDialect();

/**
 * `advisoryXactLock` rendered as the text and parameters the driver takes, so the one spelling of an
 * advisory lock (B-17) serves the seams that hold a raw session as well as those holding a drizzle
 * handle — the key lock and the ending's own critical section render the same statement.
 */
function advisoryLockStatement(name: string): { text: string; params: DriverParams } {
  const rendered = LOCK_DIALECT.sqlToQuery(advisoryXactLock(name));
  return { text: rendered.sql, params: rendered.params as DriverParams };
}

/** One row of the event log, as the storage holds it before the seam gives it its meaning. */
export type JobEventDraft = {
  jobId: string;
  kind: string;
  key: string;
  step: string;
  status: string;
  attempt: number;
  refusalCode: string | null;
  faultId: string | null;
  detail: Record<string, unknown> | null;
  elapsedMs: number | null;
};

/** An appended event, with the sequence and the instant the log gave it. */
export type JobEventRow = JobEventDraft & { seq: number; at: string };

/** A job handed to a consumer: which job it is, what it carries, and which attempt this is. */
export type QueuedJob = { jobId: string; data: unknown; attempt: number };

/**
 * The queue policy one kind is run under, as the seam above declares it. `concurrency` is how many
 * of the kind's jobs THIS process takes at a time; `expireSeconds` is how long the queue lets one
 * attempt run before it treats the runner as gone and re-queues the attempt.
 */
export type QueueShape = { concurrency: number; retryLimit: number; retryDelaySeconds: number; retryBackoff: boolean; expireSeconds: number };

/** A claim on a (kind, key) pair whose job the log records no ending for. */
export type LiveClaim = { kind: string; key: string; jobId: string };

/** Where a batch of claims left off: the claim's own primary key, which no later write moves. */
export type ClaimCursor = { kind: string; key: string };

/**
 * Where a job has got to according to the queue itself, which is a different question from where
 * the log says it got to. `ended` covers every way the queue is done with a job — finished,
 * cancelled, failed, or no longer there at all.
 */
export type QueueState = "pending" | "active" | "ended";

/** The one handle on the queue and on the event log (ARCH-02). Nothing else speaks to either. */
export interface JobsStore {
  /**
   * Reach the server. `manage` says whether this opener is the one that owns the storage: only a
   * managing opener creates the log's tables and migrates the queue's own schema. A tier that
   * merely reads the log opens neither, so reading needs no privilege to create anything and
   * starts no queue maintenance in the reader's process.
   */
  open(options: { manage: boolean }): Promise<void>;
  /** Reach the server and come back, so a health answer states what is true rather than what is declared. */
  ping(): Promise<void>;
  declareQueue(name: string, shape: QueueShape): Promise<void>;
  consume(name: string, shape: QueueShape, run: (job: QueuedJob) => Promise<void>): Promise<void>;
  publish(name: string, jobId: string, data: Record<string, unknown>, shape: QueueShape): Promise<string>;
  queueStateOf(name: string, jobId: string): Promise<QueueState>;
  /**
   * Run `work` with the (kind, key) pair to itself. `requestId` is the caller's own — the job an
   * enqueue minted, the claim a sweep is settling — so a failure of the locking is recorded against
   * the request it failed, never against a name of the lock's own (ARCH-03).
   */
  withKeyLock<T>(kind: string, key: string, requestId: string, work: () => Promise<T>): Promise<T>;
  liveJobFor(kind: string, key: string, endedStatuses: readonly string[]): Promise<string | null>;
  /**
   * At most `limit` claims whose job the log records no ending for, in (kind, key) order, and
   * only those after `after` where one is given — so a caller reading batch by batch reaches every
   * claim, however many live ones stand before it.
   */
  liveClaims(endedStatuses: readonly string[], limit: number, after?: ClaimCursor): Promise<LiveClaim[]>;
  claimKey(kind: string, key: string, jobId: string): Promise<void>;
  releaseKey(kind: string, key: string, jobId: string): Promise<void>;
  append(draft: JobEventDraft): Promise<JobEventRow>;
  /**
   * A job's last word, in one statement: the terminal row is written only if the log holds no
   * ending for the job yet, and the key's claim — where it still names this job — is released in
   * the same step. Answers the row written, or null when the job had already ended, so a second
   * ending is impossible by construction rather than by a check somebody remembers to make
   * (R-SPINE-030).
   */
  appendEnding(draft: JobEventDraft, endedStatuses: readonly string[]): Promise<JobEventRow | null>;
  read(jobId: string, afterSeq: number): Promise<JobEventRow[]>;
  /** The newest `limit` ending rows in the given statuses, in the order the log recorded them. */
  deadLetterRows(endedStatuses: readonly string[], limit: number): Promise<JobEventRow[]>;
  listen(onJob: (jobId: string) => void): Promise<void>;
  close(): Promise<void>;
}

/** The log's tables, as the runtime makes them. Statement by statement, each one repeatable. */
const JOBS_DDL: readonly string[] = [
  `create table if not exists ${JOBS_SCHEMA}.job_events (
     seq bigserial primary key,
     job_id text not null,
     kind text not null,
     key text not null,
     step text not null,
     status text not null,
     attempt integer not null,
     refusal_code text,
     fault_id text,
     detail jsonb,
     at timestamptz not null default clock_timestamp(),
     elapsed_ms integer
   )`,
  `create index if not exists job_events_by_job on ${JOBS_SCHEMA}.job_events (job_id, seq)`,
  `create index if not exists job_events_by_status on ${JOBS_SCHEMA}.job_events (status, seq)`,
  `create table if not exists ${JOBS_SCHEMA}.job_claims (
     kind text not null,
     key text not null,
     job_id text not null,
     claimed_at timestamptz not null default clock_timestamp(),
     primary key (kind, key)
   )`,
];

/**
 * The log's schema, made only where it is absent. `create schema if not exists` is checked against
 * the right to create in the DATABASE before it looks to see whether the schema is already there, so
 * a tier that states it unconditionally asks every database it opens for a standing privilege it
 * needs on almost none of them. The migrate lane makes this schema and hands the app role the right
 * to make the log's tables inside it; a database no migration has crossed is still provisioned by
 * the first writer that may (R-SPINE-030).
 */
const JOBS_SCHEMA_DDL = `create schema if not exists ${JOBS_SCHEMA}`;

/** The door the migrations publish for installing the queue library's own schema (R-SPINE-031). */
const PROVISION_QUEUE = "provision_queue_storage";

/** The queue schema version db/migrations/0018 holds pg-boss 10.4.2's construction plans for. */
const PROVISIONED_QUEUE_VERSION = 24;

/**
 * The schema version the pg-boss that is actually installed would construct, read back off its own
 * plans rather than restated beside them (B-19). `migrate: false` on every tier means nothing
 * corrects a mismatch, so a bump of the library whose plans build another version is named at the one
 * place that asks the migration's door to install them — never left to surface as SQL that does not
 * fit the storage the door made.
 */
function plannedQueueVersion(): number | null {
  const stated = /version\s*\(\s*version\s*\)\s*values\s*\(\s*'?(\d+)'?\s*\)/i.exec(PgBoss.getConstructionPlans(BOSS_SCHEMA));
  return stated === undefined || stated === null ? null : Number(stated[1]);
}

/**
 * One ending per job is a constraint of the storage, not a courtesy of its callers: two racing
 * writers cannot both land in a unique index (R-SPINE-030, B-17). Built after the tables, on its
 * own, because a log written before the ending was a constraint may already hold two endings for
 * a job — two writers that both passed a read-committed "no ending yet" check — and such a log is
 * reported, never edited (see `createLog`).
 */
const ONE_ENDING_INDEX = `create unique index if not exists job_events_one_ending on ${JOBS_SCHEMA}.job_events (job_id)
   where status in (${closedList([...TERMINAL_STATUSES])})`;

/** How many offending job ids a fault about a log that cannot carry the constraint names, at most. */
const DUPLICATE_ENDINGS_NAMED = 10;

/** The row as the driver hands it back, before it is folded into the shape the seam publishes. */
type RawJobEvent = {
  seq: string;
  job_id: string;
  kind: string;
  key: string;
  step: string;
  status: string;
  attempt: number;
  refusal_code: string | null;
  fault_id: string | null;
  detail: Record<string, unknown> | null;
  at: Date;
  elapsed_ms: number | null;
};

/**
 * An event's detail as the driver writes it. The log's detail is an ordinary JSON object — every
 * one of them is built from literals in this tree — but the seam above states it as the open shape
 * its own callers speak, so the narrowing to what a `jsonb` parameter accepts happens here, once.
 */
function jsonDetail(detail: Record<string, unknown> | null): postgres.JSONValue {
  return (detail ?? null) as postgres.JSONValue;
}

/** `seq` is a bigint, which the driver hands over as text; the log's instants are read as ISO. */
function eventRow(raw: RawJobEvent): JobEventRow {
  return {
    seq: Number(raw.seq),
    jobId: raw.job_id,
    kind: raw.kind,
    key: raw.key,
    step: raw.step,
    status: raw.status,
    attempt: raw.attempt,
    refusalCode: raw.refusal_code,
    faultId: raw.fault_id,
    detail: raw.detail,
    at: raw.at.toISOString(),
    elapsedMs: raw.elapsed_ms,
  };
}

/** A resource reached lazily: `reach()` reaches or answers the reach in hand; `pending()` is that reach, if any. */
type ReachedOnce<T> = { reach: () => Promise<T>; pending: () => Promise<T> | undefined };

/**
 * A resource reached lazily and then remembered. A failed attempt is forgotten rather than kept:
 * one outage at the moment of the first call must not leave the process holding a rejection it
 * answers every later caller with, long after the server has come back. The reach in hand is
 * visible, so a close can wait for a start still in flight instead of ending pools under it.
 */
function reachedOnce<T>(reach: () => Promise<T>): ReachedOnce<T> {
  let held: Promise<T> | undefined;
  return {
    reach: () => {
      const reaching: Promise<T> = (held ??= reach().catch((failure: unknown) => {
        if (held === reaching) held = undefined;
        throw failure;
      }));
      return reaching;
    },
    pending: () => held,
  };
}

/**
 * The job store for one database. Nothing is opened by building it — `open()` is what reaches the
 * server — so a module that merely imports the seam neither needs nor makes a connection.
 *
 * Neither the queue library nor the log's schema is touched by a tier that only reads: the pg-boss
 * instance is built the first time something actually uses the queue, and nothing is created until
 * something is written. Reading the event log therefore needs no privilege to create anything and
 * starts no queue maintenance in the reader's process — a read of storage that does not exist yet is
 * a read that finds nothing, not an outage.
 *
 * `manage` says who MANAGES: only a managing opener installs the queue library's own schema, runs
 * its maintenance and consumes. The log is provisioned by whoever writes to it first (`if not
 * exists` DDL, repeatable), so a tier that only enqueues reaches a database a worker has already
 * provisioned; against one no worker has ever opened, its queue cannot start, and it says so as a
 * fault rather than migrating storage it does not manage.
 */
export function jobsStore(url: string): JobsStore {
  const sql = postgres(url, {
    max: JOBS_POOL.max,
    idle_timeout: JOBS_POOL.idleTimeout,
    connect_timeout: JOBS_POOL.connectTimeout,
    onnotice: () => undefined,
  });
  const locks = postgres(url, {
    max: LOCK_POOL.max,
    idle_timeout: LOCK_POOL.idleTimeout,
    connect_timeout: LOCK_POOL.connectTimeout,
    onnotice: () => undefined,
  });

  /** Whether this opener manages the storage: only it migrates the queue, runs its maintenance and consumes. */
  let managing = false;
  /** The open in flight, if any, so a close waits for it rather than ending pools under it. */
  let opening: Promise<void> | undefined;

  const createLog = reachedOnce(async () => {
    try {
      const [schema] = await sql<{ stands: boolean }[]>`select exists (select 1 from pg_namespace where nspname = ${JOBS_SCHEMA}) as stands`;
      if (schema?.stands !== true) await sql.unsafe(JOBS_SCHEMA_DDL);
      for (const statement of JOBS_DDL) await sql.unsafe(statement);
      try {
        await sql.unsafe(ONE_ENDING_INDEX);
      } catch (collision) {
        if ((collision as { code?: unknown }).code !== UNIQUE_VIOLATION) throw collision;
        // The log is the seam's own record of how every job went, so no row of it is deleted to
        // make the constraint fit: the jobs that hold two endings are recorded as a fault, the log
        // stays writable under the existence check alone, and the index is built by the next
        // process once an operator has resolved them (R-SPINE-030, ARCH-03).
        //
        // How many, and a bounded sample of which — in one statement, so the count is the log's own
        // and not the length of the sample. A fault naming every offending job is a fault an
        // operator cannot read: a log that grew this way at scale would put an unbounded list into
        // the record, and it is the count that says how bad it is (B-21).
        const [duplicated] = await sql<{ total: string; named: string[] | null }[]>`
          with duplicated as (
            select job_id
              from ${sql(JOBS_SCHEMA)}.job_events
             where status in ${sql([...TERMINAL_STATUSES])}
             group by job_id
            having count(*) > 1
          )
          select (select count(*) from duplicated)::text as total,
                 (select array_agg(job_id order by job_id) from (select job_id from duplicated order by job_id limit ${DUPLICATE_ENDINGS_NAMED}) as sample) as named`;
        const total = Number(duplicated?.total ?? "0");
        const named = duplicated?.named ?? [];
        // Zero is not this log's story at all: `create unique index if not exists` is not atomic
        // against another process running the same statement, and the loser is answered 23505 by
        // the catalogue rather than by any row. The index stands — which is what was wanted — so a
        // concurrent first provisioning is recorded nowhere (ARCH-03).
        if (total > 0) {
          const more = total > named.length ? ` (and ${total - named.length} more)` : "";
          const cause = new Error(
            `the job log holds more than one ending for ${total} job(s) — ${named.join(", ")}${more} — so job_events_one_ending cannot be built until they are resolved (R-SPINE-030)`,
            { cause: collision },
          );
          reportFault({ requestId: LOG_ROUTE, actor: LOG_ACTOR, route: LOG_ROUTE, cause });
        }
      }
    } catch (failure) {
      // A log that could not be provisioned is this seam's failure to answer for, and one every
      // later write would otherwise repeat unmarked (ARCH-03, B-21).
      const { faultId } = reportFault({ requestId: LOG_ROUTE, actor: LOG_ACTOR, route: LOG_ROUTE, cause: failure });
      throw new Error(`the job log could not be provisioned — recorded as fault ${faultId}`, { cause: failure });
    }
  });

  const queue = reachedOnce(async () => {
    // Installing the queue library's schema is the managing tier's act (R-SPINE-031) and the
    // migration role's authority: making a schema is a privilege over the whole database, which the
    // role this runs as does not hold and is not owed. The managing tier therefore asks the one door
    // the migrations publish for it — it installs the library's own schema and grants the runtime
    // what it needs, or, where the storage already stands, does nothing.
    if (managing) {
      try {
        const planned = plannedQueueVersion();
        if (planned !== PROVISIONED_QUEUE_VERSION) {
          throw new Error(
            `the installed pg-boss constructs queue schema version ${String(planned)}, and the migration's door installs version ${String(PROVISIONED_QUEUE_VERSION)} — no tier migrates the queue (R-SPINE-031), so the two must be moved together`,
          );
        }
        await sql`select ${sql(JOBS_SCHEMA)}.${sql(PROVISION_QUEUE)}()`;
      } catch (failure) {
        // Storage that could not be provisioned is this seam's failure to answer for, like a queue
        // that would not start (ARCH-03, B-21).
        const { faultId } = reportFault({ requestId: QUEUE_ROUTE, actor: QUEUE_ACTOR, route: QUEUE_ROUTE, cause: failure });
        throw new Error(`the job queue's storage could not be provisioned — recorded as fault ${faultId}`, { cause: failure });
      }
    }
    const boss = new PgBoss({
      connectionString: url,
      schema: BOSS_SCHEMA,
      pollingIntervalSeconds: QUEUE_POLL_SECONDS,
      // The library migrates nothing on any tier: its schema is installed by the door above, whose
      // one act is to install exactly this version of it. A tier that finds no storage is told so
      // rather than left to create it (R-SPINE-031).
      migrate: false,
      supervise: managing,
      schedule: false,
    });
    // The library reports a lost connection or a maintenance failure on this emitter, and an emitter
    // with no listener throws the error at the process instead. A worker's outage is the operator's
    // to read through the one fault seam, never a reason for the process running the queue to die
    // (ARCH-03, R-SPINE-031).
    boss.on("error", (failure) => {
      reportFault({ requestId: QUEUE_ROUTE, actor: QUEUE_ACTOR, route: QUEUE_ROUTE, cause: failure });
    });
    try {
      await boss.start();
    } catch (failure) {
      // A start that rejected may still have started something. The library arms its manager and,
      // where it supervises, its maintenance loop BEFORE the step that failed, and neither is torn
      // down by the rejection: an interval that outlives a failed open goes on maintaining a queue
      // this process was told it does not have (R-SPINE-031). So the instance is stopped first —
      // its own rejection swallowed, because a stop that fails on an instance that never opened has
      // nothing to tell an operator that the start's failure below does not tell better.
      await boss.stop({ close: true, graceful: false, wait: false }).catch(() => undefined);
      // The library opens its pool before it checks for its schema and closes nothing when the
      // check fails, and a start that failed is one it will not stop: the pool is given back here,
      // or every failed start leaks one.
      // (The library's typing states its handle as a query runner only; the close is its own.)
      const handle = boss.getDb() as { close?: () => Promise<void> };
      await handle.close?.().catch(() => undefined);
      // A queue that would not start — the library's own schema missing where nothing here may
      // create it, or a server that could not be reached — is this seam's failure to answer for
      // (ARCH-03, B-21).
      const { faultId } = reportFault({ requestId: QUEUE_ROUTE, actor: QUEUE_ACTOR, route: QUEUE_ROUTE, cause: failure });
      throw new Error(`the job queue could not be started — recorded as fault ${faultId}`, { cause: failure });
    }
    return boss;
  });

  /**
   * Run one piece of work with the (kind, key) pair to itself, under a transaction-scoped advisory
   * lock on a connection of the lock pool's own.
   *
   * The transaction holds the lock and nothing else: every read and write the guarded work does
   * happens on the log's pool, so no statement of the caller's is hidden inside it. What the
   * transaction buys is that there is no unlock left to fail — postgres drops an xact lock when the
   * transaction ends, however it ends, the connection dying included. A session lock has to be given
   * back by hand, and a hand-back that does not land wedges the key for the life of the process and
   * either loses its connection or hands the next enqueue one that can never take the lock its own
   * predecessor is sitting on (SEAM-JOBS, ARCH-03).
   *
   * Three failures are told apart here, and each is answered once (ARCH-03, B-21). A failure of the
   * locking — a wait that hit its bound, a pool already ended, a hand-back that would not land — is
   * the seam's own: it crosses the fault seam under the caller's request id and reaches the caller
   * as a fault id. The guarded work's own failure travels exactly as it was raised — whoever wrote
   * it answered for it already — and is never wrapped. A hand-back that fails under a failed work is
   * recorded on the lock's route and masks nothing: the caller still hears the work's failure.
   *
   * The hand-back is the driver's own COMMIT and nothing else. Once the lock is taken, the body
   * never throws: a work that failed is CAUGHT and carried out on a variable, and the body returns.
   * The transaction then ends the one way it can — the driver commits, or reports that it could not
   * — and the lock is gone either way, because postgres drops an xact lock when the transaction
   * ends however it ends. A hand ROLLBACK would add a statement issued on a connection that may
   * already be gone; parking the body to avoid that would leave a promise, and whatever it closed
   * over, alive for the life of the process. Neither buys anything the COMMIT does not: the guarded
   * work's writes went out on the LOG's pool, so there is nothing under this transaction to undo.
   */
  const withKeyLock = async <T>(kind: string, key: string, requestId: string, work: () => Promise<T>): Promise<T> => {
    const lockFailure = (what: string, cause: unknown): Error => {
      const { faultId } = reportFault({ requestId, actor: LOCK_ACTOR, route: LOCK_ROUTE, cause });
      return new Error(`a ${kind} job could not ${what} on key ${key} — recorded as fault ${faultId}`, { cause });
    };

    let lockTaken = false;
    /** What the work did, carried out of the transaction: a COMMIT that fails must not lose it. */
    let ran: { ok: true; answer: T } | { ok: false; guarded: unknown } | undefined;

    const handBack = await locks
      .begin(async (tx) => {
        // A wait that cannot end is worse than a failure that can: bounded, an enqueue behind a
        // holder that will not let go fails and says so, instead of holding a connection until the
        // pool has none left and no key can be enqueued at all.
        await tx.unsafe(`set local lock_timeout = ${LOCK_WAIT_MS}`);
        const lock = advisoryLockStatement(`${kind}:${key}`);
        await tx.unsafe(lock.text, lock.params);
        lockTaken = true;
        try {
          ran = { ok: true, answer: await work() };
        } catch (failure) {
          ran = { ok: false, guarded: failure };
        }
        // Wrapped in one: the driver runs an array a transaction body answers with as queries, and
        // a caller's own array result is not this seam's to run.
        return { handedBack: true };
      })
      .then(
        () => undefined,
        (failure: unknown) => ({ failure }),
      );

    // The work was never reached: the lock itself is what failed, and it is the seam's own.
    if (ran === undefined) {
      const cause = handBack === undefined ? new Error(`the lock transaction on ${kind}:${key} ended without running its work`) : handBack.failure;
      throw lockFailure(lockTaken ? "give the lock back" : "take the lock", cause);
    }
    // A hand-back that did not land is recorded once, whichever way the work went: the key was
    // unguarded for the tail of the work, and an operator is owed that. It never becomes the
    // caller's answer — the work's effects landed on the log's pool and are there either way, so
    // the caller hears what the work did (ARCH-03).
    if (handBack !== undefined) reportFault({ requestId, actor: LOCK_ACTOR, route: LOCK_ROUTE, cause: handBack.failure });
    if (ran.ok) return ran.answer;
    throw ran.guarded;
  };

  /** Which queues this store has already made, so the row is made once per process, not per send. */
  const declared = new Map<string, Promise<void>>();

  /**
   * Make the queue's row if this store has not already made it.
   *
   * A send names a queue by name, and the library's insert joins the send against that row: a name
   * with no row accepts no job at all. Declaring is therefore not the consuming tier's privilege but
   * every writer's obligation — a tier that only enqueues must be able to reach a database no worker
   * has ever started on (R-SPINE-030). The statement is an upsert of the library's own, so declaring
   * a queue a worker already declared changes nothing.
   */
  const declareOnce = async (name: string, shape: QueueShape): Promise<void> => {
    const already = declared.get(name);
    if (already !== undefined) return await already;
    const declaring: Promise<void> = (async () => {
      const boss = await queue.reach();
      await boss.createQueue(name, {
        name,
        retryLimit: shape.retryLimit,
        retryDelay: shape.retryDelaySeconds,
        retryBackoff: shape.retryBackoff,
        expireInSeconds: shape.expireSeconds,
      });
    })().catch((failure: unknown) => {
      // A declaration that failed is forgotten rather than remembered as done: the next send tries
      // again, instead of every later one being sent at a queue that was never made.
      if (declared.get(name) === declaring) declared.delete(name);
      throw failure;
    });
    declared.set(name, declaring);
    await declaring;
  };

  /**
   * A read of a log that has not been provisioned yet. A tier that reads before anything has ever
   * been written asks a lawful question about a job that cannot exist, and the honest answer is
   * "nothing", not an internal error carrying a fault id (ARCH-03, B-21). Any other failure travels.
   */
  const readingStored = async <T>(read: () => Promise<T>, whenAbsent: T): Promise<T> => {
    try {
      return await read();
    } catch (failure) {
      const code = (failure as { code?: unknown }).code;
      if (code === UNDEFINED_TABLE || code === INVALID_SCHEMA_NAME) return whenAbsent;
      throw failure;
    }
  };

  return {
    open: async ({ manage }) => {
      managing = manage;
      if (!manage) return;
      opening = (async () => {
        await createLog.reach();
        await queue.reach();
      })();
      await opening;
    },

    ping: async () => {
      await sql`select 1`;
    },

    declareQueue: async (name, shape) => {
      await declareOnce(name, shape);
    },

    consume: async (name, shape, run) => {
      const boss = await queue.reach();
      // One worker per slot, each taking a single job at a time, so a kind's concurrency limit is
      // exactly how many of its jobs one process can have in flight (R-SPINE-030). A batch shared
      // by several jobs would make one job's failure the whole batch's.
      //
      // The limit is per process and nothing here coordinates across them: a fleet of N runtimes
      // serves N × `concurrency` of this kind at once. The seam states the number a single runtime
      // holds, which is the number the operator multiplies by however many workers are run.
      for (let slot = 0; slot < shape.concurrency; slot += 1) {
        await boss.work<Record<string, unknown>>(name, { batchSize: 1, includeMetadata: true, pollingIntervalSeconds: QUEUE_POLL_SECONDS }, async (batch) => {
          for (const job of batch) await run({ jobId: job.id, data: job.data, attempt: job.retryCount + 1 });
        });
      }
    },

    publish: async (name, jobId, data, shape) => {
      const boss = await queue.reach();
      // The writer declares the queue row it writes to: a first enqueue from a tier that consumes
      // nothing must land on a provisioned database no worker is running against (R-SPINE-030).
      await declareOnce(name, shape);
      // The id is the seam's rather than the queue's: it is written down as the key's claim before
      // the job exists, so a crash between the two leaves a claim naming a job the queue never got
      // — which is recoverable — instead of a job no claim guards (SEAM-JOBS).
      const sent = await boss.send(name, data, {
        id: jobId,
        retryLimit: shape.retryLimit,
        retryDelay: shape.retryDelaySeconds,
        retryBackoff: shape.retryBackoff,
        // Stated rather than inherited: the library's default expiration would re-queue an attempt
        // that outlived it while the first is still running, which is two attempts of one key at
        // once. The kind declares a window its longest attempt fits inside (R-SPINE-030).
        expireInSeconds: shape.expireSeconds,
      });
      if (sent === null) throw new Error(`the queue "${name}" accepted no job for this send (SEAM-JOBS)`);
      return sent;
    },

    queueStateOf: async (name, jobId) => {
      const boss = await queue.reach();
      const job = await boss.getJobById(name, jobId, { includeArchive: true });
      // A job the queue has never heard of, or no longer holds, is one it is done with — including
      // the job a send never managed to insert.
      if (job === null) return "ended";
      if (job.state === "active") return "active";
      return job.state === "created" || job.state === "retry" ? "pending" : "ended";
    },

    withKeyLock,

    liveJobFor: async (kind, key, endedStatuses) => await readingStored(async () => {
      const rows = await sql<{ job_id: string }[]>`
        select claim.job_id
          from ${sql(JOBS_SCHEMA)}.job_claims as claim
         where claim.kind = ${kind}
           and claim.key = ${key}
           and not exists (
             select 1
               from ${sql(JOBS_SCHEMA)}.job_events as ended
              where ended.job_id = claim.job_id
                and ended.status in ${sql(endedStatuses as string[])}
           )`;
      return rows[0]?.job_id ?? null;
    }, null),

    liveClaims: async (endedStatuses, limit, after) => await readingStored(async () => {
      // Keyed on the claim's primary key rather than offset: a claim a batch settled is gone from
      // the table by the next read, and an offset would skip the one that moved into its place.
      const afterCursor = after === undefined ? sql`` : sql`and (claim.kind, claim.key) > (${after.kind}, ${after.key})`;
      const rows = await sql<{ kind: string; key: string; job_id: string }[]>`
        select claim.kind, claim.key, claim.job_id
          from ${sql(JOBS_SCHEMA)}.job_claims as claim
         where not exists (
                 select 1
                   from ${sql(JOBS_SCHEMA)}.job_events as ended
                  where ended.job_id = claim.job_id
                    and ended.status in ${sql(endedStatuses as string[])}
               )
           ${afterCursor}
         order by claim.kind asc, claim.key asc
         limit ${limit}`;
      return rows.map((row) => ({ kind: row.kind, key: row.key, jobId: row.job_id }));
    }, []),

    claimKey: async (kind, key, jobId) => {
      // The first write provisions the log: a tier that only enqueues reaches a database no worker
      // has written the log on yet, rather than failing on tables nobody has made for it.
      await createLog.reach();
      await sql`
        insert into ${sql(JOBS_SCHEMA)}.job_claims (kind, key, job_id)
        values (${kind}, ${key}, ${jobId})
        on conflict (kind, key) do update set job_id = excluded.job_id, claimed_at = clock_timestamp()`;
    },

    releaseKey: async (kind, key, jobId) => {
      // Only this claim: a claim some later enqueue has already replaced is that enqueue's to keep.
      await sql`
        delete from ${sql(JOBS_SCHEMA)}.job_claims
         where kind = ${kind} and key = ${key} and job_id = ${jobId}`;
    },

    append: async (draft) => {
      await createLog.reach();
      const rows = await sql<RawJobEvent[]>`
        insert into ${sql(JOBS_SCHEMA)}.job_events (job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, elapsed_ms)
        values (${draft.jobId}, ${draft.kind}, ${draft.key}, ${draft.step}, ${draft.status}, ${draft.attempt},
                ${draft.refusalCode}, ${draft.faultId}, ${sql.json(jsonDetail(draft.detail))}, ${draft.elapsedMs})
        returning seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms`;
      const row = rows[0];
      if (row === undefined) throw new Error("the job event log accepted no row for this event (R-SPINE-030)");
      // Announced rather than waited for: a reader in another process is told there is something to
      // read, and reads it for itself. The payload is the job, never the event — a notification has
      // a size limit and an event does not.
      await sql`select pg_notify(${EVENTS_CHANNEL}, ${row.job_id})`;
      return eventRow(row);
    },

    appendEnding: async (draft, endedStatuses) => {
      await createLog.reach();
      // One statement: the ending is written only where none exists, the claim is released only
      // where an ending was written, and the announcement rides on the row written — so no
      // reader can see the claim gone before the ending, or two endings for one job. A writer that
      // races another past the existence check yields to job_events_one_ending instead: no row,
      // no release, and the caller reads the same null as when the ending was already there.
      //
      // The index cannot always stand, though — a log that already held two endings for one job
      // when this process first reached it has none (see `createLog`) — and a storage guarantee
      // that holds only while its index does is not a guarantee (B-17). So the ending goes out in
      // its own transaction, behind a transaction-scoped advisory lock on the job id: the
      // existence check and the insert are one critical section per job, the second writer reads
      // the first writer's ending and answers null, and the lock is dropped by the transaction
      // ending however it ends. It is taken on the LOG's pool, never the lock pool, which is held
      // for the key lock alone and would deadlock a job holding both.
      const written = await sql.begin(async (tx) => {
        const guard = advisoryLockStatement(`${JOBS_SCHEMA}.job_events:${draft.jobId}`);
        await tx.unsafe(guard.text, guard.params);
        // Wrapped, because the driver runs an array a transaction body answers with as queries.
        return {
          rows: await tx<RawJobEvent[]>`
        with ending as (
          insert into ${tx(JOBS_SCHEMA)}.job_events (job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, elapsed_ms)
          select ${draft.jobId}::text, ${draft.kind}::text, ${draft.key}::text, ${draft.step}::text, ${draft.status}::text, ${draft.attempt}::integer,
                 ${draft.refusalCode}::text, ${draft.faultId}::text, ${tx.json(jsonDetail(draft.detail))}::jsonb, ${draft.elapsedMs}::integer
           where not exists (
                   select 1
                     from ${tx(JOBS_SCHEMA)}.job_events as ended
                    where ended.job_id = ${draft.jobId}
                      and ended.status in ${tx(endedStatuses as string[])}
                 )
              on conflict do nothing
          returning seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms
        ), released as (
          delete from ${tx(JOBS_SCHEMA)}.job_claims as claim
           where claim.kind = ${draft.kind} and claim.key = ${draft.key} and claim.job_id = ${draft.jobId}
             and exists (select 1 from ending)
        )
        select ending.seq, ending.job_id, ending.kind, ending.key, ending.step, ending.status, ending.attempt, ending.refusal_code,
               ending.fault_id, ending.detail, ending.at, ending.elapsed_ms, pg_notify(${EVENTS_CHANNEL}, ending.job_id) as announced
          from ending`,
        };
      });
      const row = (written as unknown as { rows: RawJobEvent[] }).rows[0];
      return row === undefined ? null : eventRow(row);
    },

    read: async (jobId, afterSeq) => await readingStored(async () => {
      const rows = await sql<RawJobEvent[]>`
        select seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms
          from ${sql(JOBS_SCHEMA)}.job_events
         where job_id = ${jobId} and seq > ${afterSeq}
         order by seq asc`;
      return rows.map(eventRow);
    }, []),

    deadLetterRows: async (endedStatuses, limit) => await readingStored(async () => {
      // The newest endings, bounded, then put back in the order the log wrote them: a view an
      // operator reads must stay readable however long the log grows (R-SPINE-030).
      const rows = await sql<RawJobEvent[]>`
        select newest.seq, newest.job_id, newest.kind, newest.key, newest.step, newest.status, newest.attempt, newest.refusal_code,
               newest.fault_id, newest.detail, newest.at, newest.elapsed_ms
          from (
            select seq, job_id, kind, key, step, status, attempt, refusal_code, fault_id, detail, at, elapsed_ms
              from ${sql(JOBS_SCHEMA)}.job_events
             where status in ${sql(endedStatuses as string[])}
             order by seq desc
             limit ${limit}
          ) as newest
         order by newest.seq asc`;
      return rows.map(eventRow);
    }, []),

    listen: async (onJob) => {
      await sql.listen(EVENTS_CHANNEL, (jobId) => onJob(jobId));
    },

    close: async () => {
      // Waited for, not cut off: an open still in flight finishes first, so what it was provisioning
      // is provisioned and what it started is stopped here rather than leaked. A queue that was never
      // reached has nothing to drain, and asking for one would open the very instance this store took
      // care not to open; one whose start failed gave its pool back where it failed.
      if (opening !== undefined) await opening.catch(() => undefined);
      const started = queue.pending();
      const boss = started === undefined ? undefined : await started.catch(() => undefined);
      if (boss !== undefined) await boss.stop({ close: true, graceful: true, wait: true });
      await Promise.all([sql.end({ timeout: 5 }), locks.end({ timeout: 5 })]);
    },
  };
}
