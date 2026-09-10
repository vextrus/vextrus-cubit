// SEAM-TENANT: every table the tenant seam publishes, with the closed rosters their CHECKs are
// written from. The ORM's table builders are a driver import and the seam's own directory is their
// one lawful home; db/schema/*.ts is the tree drizzle-kit reads them back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so
// the dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).
import { sql as statement } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { CAMPAIGN_STATUSES, type CampaignStatus } from "../campaigns/law";
import { ELEMENT_TYPES, type ElementType } from "../catalogue/classes";
import { KINDS, type Kind } from "../catalogue/kinds";
import { QUEUE_ITEM_CAUSES, type QueueItemCause } from "../gate/law";
import { COVERAGES, ENGINES, QUANTITY_BASES, type Coverage, type Engine, type QuantityBasis } from "../offers/law";
import { INGEST_SCHEME } from "../entitygraph/schema";
import {
  EXPANSION_DEFERRAL_REASONS,
  REFUSALS,
  SCHEDULE_DEFERRAL_REASONS,
  SCOPE_DECLARATION_CAUSES,
  type ExpansionDeferralReason,
  type RefusalCode,
  type ScheduleDeferralReason,
  type ScopeDeclarationCause,
} from "../errors";
import { LEVEL_MARKER, LEVEL_SLOTS, OBSERVATION_BASES, SIGHTING_STANDINGS, UNREGISTERED_PREFIX, type ObservationBasis, type SightingStanding } from "../identity";
import { STOREY_HEIGHT_BASES, type StoreyHeightBasis } from "../levels/law";
import { VIEW_TYPE_SPELLINGS } from "../errors/transport-vocabulary";
import { MODEL_IDS } from "../model-ledger.types";
import type { SourceScheme } from "../model";
import { DEFAULT_DENSITY, DENSITIES, type Density } from "../prefs/density";
import { BUILDING_TYPES, type BuildingType } from "../projects";
import { DISCIPLINES, type Discipline } from "../sheets/law";
import { FACTOR_MINIMUM, FACTOR_PATTERN, SCALE_RANKS, type ScaleRank } from "../scale/law";
import { DIMENSIONS, UNITS, type Dimension, type Unit } from "../units/canon";
import type { EditionParameter, EditionScope, MethodPair } from "../rulesets/editions/content";
import type { ConventionProfile, EntityCensus } from "../rulesets/methods/conventions/resolve";
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
/**
 * A view class as a column holds one. L-CAD-06's vocabulary is closed and its law lives in a module
 * core may not import (ARCH-01), so the store is written from the roster the transport declares —
 * the same eleven spellings, read from their one home rather than repeated here (B-17).
 */
type ViewTypeSpelling = (typeof VIEW_TYPE_SPELLINGS)[number];

export const partitionViews = pgTable(
  "partition_views",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    type: text("type").$type<ViewTypeSpelling>().notNull(),
    /** Why the type is what it is, where the grammar read nothing — a registered refusal code. */
    reason: text("reason"),
    /** The caption this view is anchored by, as the drawing states it; empty where none anchors it. */
    caption: text("caption").notNull(),
    /** The source key of the caption's own entity, or null for the view no caption anchors. */
    anchorKey: text("anchor_key"),
    proposedType: text("proposed_type").$type<ViewTypeSpelling>(),
    proposedCallId: uuid("proposed_call_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "partition_views_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    // The vocabulary is closed, so the store closes it too: a class outside the eleven cannot be
    // written at all, however it reached the insert (L-CAD-06).
    check("partition_views_type_closed", statement`${table.type} in (${statement.raw(closedList(VIEW_TYPE_SPELLINGS))})`),
    check("partition_views_proposed_type_closed", statement`${table.proposedType} in (${statement.raw(closedList(VIEW_TYPE_SPELLINGS))})`),
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
    type: text("type").$type<ViewTypeSpelling>().notNull(),
    actId: uuid("act_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Closed here for the reason it is closed on the view itself: a person confirms a class of the
    // vocabulary, and nothing else is a class (L-CAD-06).
    check("view_type_confirmations_type_closed", statement`${table.type} in (${statement.raw(closedList(VIEW_TYPE_SPELLINGS))})`),
    // One confirmation per view of one record: a second, disagreeing reading is a competing
    // observation, which L-ACT-01 gives a path of its own rather than a second row here.
    uniqueIndex("view_type_confirmations_once").on(table.tenantId, table.ingestId, table.viewKey),
    // The read the partition makes: what a drawing's views have been confirmed as.
    index("view_type_confirmations_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * L-CAD-08's convention profile: which layers one drawing carries its linework, outlines, text and
 * dimensions on, and which caption grammars named its views — the second stage of R-TO-030's stored
 * partition.
 *
 * One row per ingest record, rewritten with the views it was read beside and in the same
 * transaction: the profile is a derivation of the artifact, so it is re-derived rather than edited
 * (L-REG-04), and the app role holds a DELETE here for the same reason it holds one on the views.
 *
 * The method that resolved it is stored as (rule id, version) — a derivation whose method is not
 * recorded is one nobody can attribute (L-CAD-08, L-MEA-01). `json`, not `jsonb`: the profile and
 * the census are read back in the order they were derived in, and jsonb re-orders what it holds.
 */
export const conventionProfiles = pgTable(
  "convention_profiles",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleVersion: text("rule_version").notNull(),
    profile: json("profile").$type<ConventionProfile>().notNull(),
    census: json("census").$type<EntityCensus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One profile per ingest, in one workspace: a rebuilt partition replaces the profile of the
    // record it rebuilt rather than standing a second one beside it.
    primaryKey({ name: "convention_profiles_key", columns: [table.tenantId, table.ingestId] }),
    // The read a drawing's own screen makes: the profile that stands for it now.
    index("convention_profiles_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/** The two families a grid bubble sorts into (L-CAD-07): the letters and the numerals. */
export const GRID_FAMILIES = ["letter", "numeral"] as const;

/** One of the two. */
export type GridFamily = (typeof GRID_FAMILIES)[number];

/** The world axes a family georeferences along — a drawing's own plane has these two (L-CAD-07). */
export const GRID_AXES = ["x", "y"] as const;

/** One of the two. */
export type GridAxis = (typeof GRID_AXES)[number];

/**
 * L-CAD-07's grid backbone: one row per lawful bubble of a layout-plan view — the family it sorts
 * into, the label it carries, the world axis its family georeferences along and where along that
 * axis it stands — the third stage of R-TO-030's stored partition.
 *
 * The bubble's ring and its text are both named, because a georeference nobody can trace back to the
 * two entities it was read from is a reading nobody can audit (L-CAD-03).
 *
 * `min_spacing` is the whole VIEW's minimum grid spacing, written on every row of that view: the
 * placement constants that read it are content-scaled shares of it (L-MEA-01), so a row that carried
 * no spacing would be a row placement could not scale by. It is a distance, and the CHECK says so.
 *
 * Rewritten per ingest with the views it was read off, in the same transaction, so the app role
 * holds a DELETE here for the reason it holds one on the views (L-REG-04).
 */
export const grids = pgTable(
  "grids",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    family: text("family").$type<GridFamily>().notNull(),
    label: text("label").notNull(),
    axis: text("axis").$type<GridAxis>().notNull(),
    position: doublePrecision("position").notNull(),
    bubbleKey: text("bubble_key").notNull(),
    labelKey: text("label_key").notNull(),
    minSpacing: doublePrecision("min_spacing").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One axis per bubble of one record, in one workspace: a bubble is read once, and a rebuilt
    // partition replaces the rows of the record it rebuilt rather than standing a second set beside
    // them (L-REG-04, R-TO-030).
    primaryKey({ name: "grids_key", columns: [table.tenantId, table.ingestId, table.bubbleKey] }),
    // Both vocabularies are closed, so the store closes them: a family or an axis outside the two
    // L-CAD-07 names cannot be written at all, however it reached the insert.
    check("grids_family_closed", statement`${table.family} in (${statement.raw(closedList(GRID_FAMILIES))})`),
    check("grids_axis_closed", statement`${table.axis} in (${statement.raw(closedList(GRID_AXES))})`),
    // A spacing placement scales a share by is a real distance: zero or less is not one (L-MEA-01).
    check("grids_min_spacing_positive", statement`${table.minSpacing} > 0`),
    // The read a drawing's own overlay makes: the grid that stands for it now.
    index("grids_by_drawing").on(table.tenantId, table.drawingId),
    // And the read placement makes: one view's whole backbone.
    index("grids_by_view").on(table.tenantId, table.ingestId, table.viewKey),
  ],
);

/**
 * Why a layout plan georeferences as deferred: a code of the register, narrowed to the ones a grid
 * defers under, so the column cannot hold a reason nobody registered (Q-07, L-CAD-07).
 */
export type GridDeferralReason = Extract<RefusalCode, "GRID_NO_BUBBLE_EVIDENCE">;

/**
 * L-CAD-07's other answer: a layout plan the drawing offered no lawful bubble evidence for
 * georeferences as DEFERRED, under a code from the register, rather than as a guessed grid — "a view
 * without lawful bubble evidence georeferences as deferred".
 *
 * One row per view of one record, rewritten with the axes beside it in the same transaction.
 */
export const gridDeferrals = pgTable(
  "grid_deferrals",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    reason: text("reason").$type<GridDeferralReason>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "grid_deferrals_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    index("grid_deferrals_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * The units a schedule's own notation is written in (R-TO-031). Not the bill's canon (L-FRM-06): a
 * drawing states a section in inches or in millimetres, and a pair it stated no unit for keeps none
 * — a number nobody gave a unit to is not an inch (L-MEA-01).
 */
export const SECTION_UNITS = ["in", "mm"] as const;

/** One of the two. */
export type SectionUnit = (typeof SECTION_UNITS)[number];

/** The four zones a rebar column of a schedule reads as (R-TO-031): the main bars, and the ties. */
export const REBAR_ZONES = ["main", "ties", "ties-end", "ties-mid"] as const;

/** One of the four. */
export type RebarZone = (typeof REBAR_ZONES)[number];

/**
 * Why a schedule view defers: the register's own narrowing to the two a schedule defers under, so
 * the column cannot hold a reason nobody registered (Q-07, riskNotes (2)). The list is the refusal
 * register's, and this CHECK is written from it — one vocabulary, two readers (B-17).
 */
export type { ScheduleDeferralReason };

/**
 * Why a view's vertical members expand over no level: the register's own narrowing to the two the
 * expansion stage stands a view under (Q-07, L-CAD-07). One vocabulary, two readers (B-17).
 */
export type { ExpansionDeferralReason };

/** The entities one row of the stored partition was read from — never none (L-CAD-03). */
const citedKeys = () => text("source_keys").array().notNull();

/**
 * L-CAD-08's gridless reconstruction: one row per table a SCHEDULE view yielded — the caption it is
 * anchored on, what that caption says, and the row spacing its bands stand at — the fourth stage of
 * R-TO-030's stored partition.
 *
 * The schedule KEY is the caption's own source key: a table anchored on nothing could not be traced
 * back to the drawing, and two tables of one drawing are two captions (L-CAD-03).
 *
 * Rewritten per ingest with the views it was read off, in the same transaction, so the app role
 * holds a DELETE here for the reason it holds one on the views (L-REG-04, R-TO-030).
 */
export const schedules = pgTable(
  "schedules",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    title: text("title").notNull(),
    pitch: doublePrecision("pitch").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "schedules_key", columns: [table.tenantId, table.ingestId, table.scheduleKey] }),
    // The pitch is what the 3.5× stop between rows is measured in, so it is a real spacing: a table
    // whose rows stood no distance apart would be one row (L-CAD-08).
    check("schedules_pitch_positive", statement`${table.pitch} > 0`),
    // The read a drawing's own screen makes: the schedules that stand for it now.
    index("schedules_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * One cell of a reconstructed table: where it stands, what it says verbatim, and the texts it was
 * read from. Row 0 is the header band the columns were taken from (AC-1).
 *
 * The text is the drawing's own — a cell is stored as it was drawn and parsed beside, never instead
 * of, itself, so a reading nobody agrees with can be re-made from what the drawing says (L-CAD-03).
 */
export const scheduleCells = pgTable(
  "schedule_cells",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    rowIndex: integer("row_index").notNull(),
    columnIndex: integer("column_index").notNull(),
    text: text("text").notNull(),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "schedule_cells_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.rowIndex, table.columnIndex] }),
    // A cell that cites no entity is a cell nobody can trace back to the drawing (L-CAD-03).
    check("schedule_cells_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("schedule_cells_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * R-TO-031's member-type registry: one row per mark family a schedule names — the normalised mark,
 * the cell's own spelling of it, and the table row it was read from (riskNotes (3)).
 *
 * What a member IS, and never how many stand: the count is placement's answer, read off the layout
 * plans, and a schedule that carried one would be answering a question it was not asked (R-TO-031).
 */
export const memberTypes = pgTable(
  "member_types",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    family: text("family").notNull(),
    markText: text("mark_text").notNull(),
    rowIndex: integer("row_index").notNull(),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "member_types_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.family] }),
    check("member_types_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("member_types_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * One variant of a mark family: the band of floors a schedule column heads, and the section that
 * family carries over it (riskNotes (3)). The band's own words are kept beside the two levels they
 * read as, and the section's own words beside the pair they read as.
 */
export const memberTypeVariants = pgTable(
  "member_type_variants",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    family: text("family").notNull(),
    variantKey: text("variant_key").notNull(),
    bandText: text("band_text").notNull(),
    bandFrom: text("band_from"),
    bandTo: text("band_to"),
    sectionText: text("section_text").notNull(),
    sectionWidth: doublePrecision("section_width"),
    sectionDepth: doublePrecision("section_depth"),
    sectionUnit: text("section_unit").$type<SectionUnit>(),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "member_type_variants_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.family, table.variantKey] }),
    // A unit the drawing did not state is no unit at all; a unit it did state is one of the two.
    check("member_type_variants_section_unit_closed", statement`${table.sectionUnit} is null or ${table.sectionUnit} in (${statement.raw(closedList(SECTION_UNITS))})`),
    check("member_type_variants_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("member_type_variants_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * The rebar a schedule states for one variant, one row per zone its columns name: the cell verbatim,
 * the groups of bars it names, and the centres it states them at.
 *
 * `bars` is jsonb because a cell may name several groups — `4-20Ø+4-16Ø` is two — and a column per
 * group would fix in the store a number the drawing decides (L-QTY-04).
 */
export const rebarZones = pgTable(
  "rebar_zones",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    family: text("family").notNull(),
    variantKey: text("variant_key").notNull(),
    zone: text("zone").$type<RebarZone>().notNull(),
    text: text("text").notNull(),
    bars: jsonb("bars").$type<readonly { readonly n: number; readonly diameterMm: number }[]>(),
    spacing: doublePrecision("spacing"),
    spacingUnit: text("spacing_unit").$type<SectionUnit>(),
    spacingBar: doublePrecision("spacing_bar"),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "rebar_zones_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.family, table.variantKey, table.zone] }),
    // The roster is closed, so the store closes it: a zone outside the four cannot be written at
    // all, however it reached the insert.
    check("rebar_zones_zone_closed", statement`${table.zone} in (${statement.raw(closedList(REBAR_ZONES))})`),
    check("rebar_zones_spacing_unit_closed", statement`${table.spacingUnit} is null or ${table.spacingUnit} in (${statement.raw(closedList(SECTION_UNITS))})`),
    check("rebar_zones_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("rebar_zones_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * The other answer a SCHEDULE view gives: a view whose bands yielded no table, and one whose table
 * named no member, stand here under a closed reason rather than as a schedule nobody can read
 * (riskNotes (2)). Its own table, because a view that yielded no table has no schedule row to carry
 * the reason on — the exact shape of `grid_deferrals`, which the overlay already knows how to read.
 */
export const scheduleDeferrals = pgTable(
  "schedule_deferrals",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    reason: text("reason").$type<ScheduleDeferralReason>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "schedule_deferrals_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    // Another stage's reason stored here would render as this stage's, so the CHECK admits the two
    // this stage defers under and nothing else (Q-07).
    check("schedule_deferrals_reason_closed", statement`${table.reason} in (${statement.raw(closedList(SCHEDULE_DEFERRAL_REASONS))})`),
    index("schedule_deferrals_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * L-CAD-07's placement: one row per member a layout-plan view places — the fifth stage of R-TO-030's
 * stored partition.
 *
 * The key is L-REG-04's placement key (`view key | mark | quantised point`), derived by `placementKey`
 * and never minted here, so a re-derivation of the same artifact writes the same rows. The mark is
 * the dotless-uppercase normalisation the label rule compares on, and `mark_text` keeps the drawing's
 * own spelling beside it (L-CAD-03: a reading never replaces what was drawn).
 *
 * The outline it was read off and the mark that anchored it are both named, because a placement
 * nobody can trace back to the two entities it was read from is a reading nobody can audit
 * (L-CAD-03). `member_family` names the schedule family of the same record whose family is this mark,
 * and is null where the record's schedules name none — a join, never a constant (R-TO-031).
 *
 * Rewritten per ingest with the views it was read off, in the same transaction, so the app role holds
 * a DELETE here for the reason it holds one on the views (L-REG-04, R-TO-030).
 */
export const placements = pgTable(
  "placements",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    placementKey: text("placement_key").notNull(),
    viewKey: text("view_key").notNull(),
    mark: text("mark").notNull(),
    markText: text("mark_text").notNull(),
    elementType: text("element_type").$type<ElementType>().notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    // The nearest axis of each family of the view's own backbone, or null where the family carries
    // none: a grid reference is read off the grid, never invented (L-CAD-07).
    gridLetter: text("grid_letter"),
    gridNumeral: text("grid_numeral"),
    outlineKey: text("outline_key").notNull(),
    markKey: text("mark_key").notNull(),
    memberFamily: text("member_family"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One placement per key of one record: the key IS the identity, and a rebuilt partition replaces
    // the rows of the record it rebuilt rather than standing a second set beside them (L-REG-04).
    primaryKey({ name: "placements_key", columns: [table.tenantId, table.ingestId, table.placementKey] }),
    // The class roster is the catalogue's and it is closed, so the store closes it: a class outside
    // it cannot be written at all, however it reached the insert (R-TO-032).
    check("placements_element_type_closed", statement`${table.elementType} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    // The read a drawing's own overlay makes: the placements that stand for it now.
    index("placements_by_drawing").on(table.tenantId, table.drawingId),
    // And the read the expansion makes: one view's placements.
    index("placements_by_view").on(table.tenantId, table.ingestId, table.viewKey),
  ],
);

/**
 * Why a view's vertical members stand on no level: the sixth stage's own answer, one row per view
 * that deferred, under a code of the register (L-CAD-07, Q-07). Its own table for the reason
 * `grid_deferrals` is its own: a view that expanded over nothing has no row of its own to carry the
 * reason on.
 *
 * Rewritten per ingest with the placements it was read off, in the same transaction.
 */
export const expansionDeferrals = pgTable(
  "expansion_deferrals",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    reason: text("reason").$type<ExpansionDeferralReason>().notNull(),
    // The two ends of the range the view STATED, kept as the labels the caption wrote them as, so a
    // person reading the deferral can see which endpoint the stack does not carry (L-CAD-07). Null
    // where the caption stated no range at all — there are no endpoints to name (L-REG-01, B-07).
    fromLabel: text("from_label"),
    toLabel: text("to_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "expansion_deferrals_key", columns: [table.tenantId, table.ingestId, table.viewKey] }),
    // Another stage's reason stored here would render as this stage's, so the CHECK admits the two
    // this stage defers under and nothing else (Q-07).
    check("expansion_deferrals_reason_closed", statement`${table.reason} in (${statement.raw(closedList(EXPANSION_DEFERRAL_REASONS))})`),
    index("expansion_deferrals_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * The seventh stage's answer: the level stack a drawing's sections STATE, read into a table of its
 * own and never into `levels` — "the machine proposes a stack, never a level" (L-ACT-03: authoring a
 * level stack is a human's act). A person confirms the whole stack as one `INSERT_LEVEL`.
 *
 * The storey height is the distance to the level above, kept as the drawing's own words beside the
 * unit they were written in (L-REG-01, B-07); the topmost level of a section states none. Each row
 * cites the level mark it was read off (L-CAD-03).
 *
 * Rewritten per ingest with the views it was read off, in the same transaction.
 */
export const proposedLevels = pgTable(
  "proposed_levels",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    label: text("label").notNull(),
    ordinal: integer("ordinal").notNull(),
    elevation: doublePrecision("elevation").notNull(),
    heightAsWritten: text("height_as_written"),
    heightUnit: text("height_unit"),
    markKey: text("mark_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "proposed_levels_key", columns: [table.tenantId, table.ingestId, table.markKey] }),
    // A height is stated with the unit it was written in or not at all: a number nobody gave a unit
    // to is not a metre (L-MEA-01, B-07).
    check("proposed_levels_height_stated_with_unit", statement`num_nonnulls(${table.heightAsWritten}, ${table.heightUnit}) <> 1`),
    index("proposed_levels_by_drawing").on(table.tenantId, table.drawingId),
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
 * L-MEA-05's affirmation act, stored: "Scale is established by affirmation acts, each naming the
 * views it covers (a scale group is the subject set of one act), the rank it stood on and the source
 * keys under it." One row per AFFIRM_SCALE act, carrying the act that wrote it (L-ACT-01: the act row
 * and this row land in one transaction or neither).
 *
 * `view_keys`, `incoming_keys` and `outgoing_keys` are parallel by position: view i moves from
 * `outgoing_keys[i]` to `incoming_keys[i]`, where the outgoing key is the calibration the view stood
 * under before this act or the empty string for none. `observations` holds the QS two-point
 * observations the act stood on (empty below rank 1) in the order they were judged — `json`, not
 * `jsonb`, because jsonb re-orders what it holds. `supersedes` names the affirmation this one
 * re-affirms over, and stands empty until re-affirmation ships.
 *
 * Append-only for the reason `view_type_confirmations` is: a scale somebody affirmed is a fact of
 * the record, superseded by a later act rather than edited (L-ACT-01).
 */
export const scaleAffirmations = pgTable(
  "scale_affirmations",
  {
    tenantId: uuid("tenant_id").notNull(),
    affirmationId: uuid("affirmation_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    rank: text("rank").$type<ScaleRank>().notNull(),
    viewKeys: text("view_keys").array().notNull(),
    incomingKeys: text("incoming_keys").array().notNull(),
    outgoingKeys: text("outgoing_keys").array().notNull(),
    sourceKeys: text("source_keys").array().notNull(),
    observations: json("observations").$type<unknown[]>().notNull(),
    supersedes: uuid("supersedes"),
    actId: uuid("act_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The precedence is closed, so the store closes it: a rank outside the four L-MEA-05 names
    // cannot be written at all, however it reached the insert (B-17: the roster is the law's own).
    check("scale_affirmations_rank_closed", statement`${table.rank} in (${statement.raw(closedList(SCALE_RANKS))})`),
    // The read the scale door makes: every affirmation of one record, newest first.
    index("scale_affirmations_by_ingest").on(table.tenantId, table.ingestId, table.createdAt),
    index("scale_affirmations_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * L-MEA-05's calibration: one view's factor pair, filed under the content address of what it says —
 * (view key, factorX, factorY) — so the same reading affirmed twice is the same row, and a
 * calibration key on a quantity line names exactly one pair forever.
 *
 * Both factors are 12-place decimal strings in metres per drawing unit, X and Y stored apart and
 * averaged by nothing; the CHECKs are written from the law's own pattern (B-17). Append-only: the
 * act that first filed a calibration is the one it names, and a later act naming the same reading
 * finds the row already there.
 */
export const calibrations = pgTable(
  "calibrations",
  {
    tenantId: uuid("tenant_id").notNull(),
    key: text("key").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    viewKey: text("view_key").notNull(),
    factorX: text("factor_x").notNull(),
    factorY: text("factor_y").notNull(),
    actId: uuid("act_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "calibrations_key", columns: [table.tenantId, table.key] }),
    // A factor is spoken in exactly one rendering, and it is a positive quantity of metres: at
    // least the least factor that rendering speaks, stated in the rendering and read as the
    // number it says (the key needs no CHECK of its own — `calibrationKey` is its one minting home).
    check("calibrations_factor_x_shape", statement`${table.factorX} ~ ${statement.raw(`'${FACTOR_PATTERN}'`)} and ${table.factorX}::numeric >= ${statement.raw(`'${FACTOR_MINIMUM}'`)}::text::numeric`),
    check("calibrations_factor_y_shape", statement`${table.factorY} ~ ${statement.raw(`'${FACTOR_PATTERN}'`)} and ${table.factorY}::numeric >= ${statement.raw(`'${FACTOR_MINIMUM}'`)}::text::numeric`),
    // The read the scale door makes: every calibration of one record.
    index("calibrations_by_ingest").on(table.tenantId, table.ingestId),
    index("calibrations_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * L-MEA-04's work-item catalogue, as the store's copy of it: per kind, what is measured of it, in
 * which dimension, in that dimension's canonical unit, to how many places a document writes it.
 *
 * The catalogue is code-owned: `src/core/catalogue/catalogue.ts` is the original, the tables under
 * `db/catalogue/` are its emission, and a migration is the only thing that moves these rows — which
 * is why the runtime role reads this table and holds no privilege that writes it. Every column that
 * draws on a closed roster is closed over that roster's own spelling here (B-17).
 */
export const workItems = pgTable(
  "work_items",
  {
    kind: text("kind").$type<Kind>().primaryKey(),
    description: text("description").notNull(),
    canonicalUnit: text("canonical_unit").$type<Unit>().notNull(),
    dimension: text("dimension").$type<Dimension>().notNull(),
    documentPrecision: integer("document_precision").notNull(),
  },
  (table) => [
    check("work_items_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
    check("work_items_dimension_closed", statement`${table.dimension} in (${statement.raw(closedList(DIMENSIONS))})`),
    check("work_items_unit_closed", statement`${table.canonicalUnit} in (${statement.raw(closedList(UNITS))})`),
    // A precision is a number of places, so it is a count and never a negative one (L-FMT-02).
    check("work_items_precision_not_negative", statement`${table.documentPrecision} >= 0`),
  ],
);

/**
 * L-MEA-04's `bears` relation: class × kind, what an element class lawfully bears. A class that
 * bears no kind is absent from this table and DECLARED in the unborne set beside the consts — the
 * store holds the relation, and the code holds the reason a class is missing from it.
 */
export const bears = pgTable(
  "bears",
  {
    class: text("class").$type<ElementType>().notNull(),
    kind: text("kind")
      .$type<Kind>()
      .notNull()
      .references(() => workItems.kind),
  },
  (table) => [
    // One row per pair: a class bears a kind or it does not, and saying so twice says nothing more.
    primaryKey({ name: "bears_key", columns: [table.class, table.kind] }),
    check("bears_class_closed", statement`${table.class} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
  ],
);

/**
 * L-REG-01's system of record for physical scope: one row per identity sighted inside one pinned
 * drawing-set revision. The key is the content-derived instance row key (L-REG-04) and there is no
 * minted id beside it — a re-derivation of the same content finds this row rather than making a
 * second one, which is what makes the double-count guard a property of the store.
 *
 * The double count is refused by the PRIMARY KEY (tenant, set revision, object key) and not by a
 * writer remembering to look: L-REG-03 scopes the guard to one drawing-set revision, so the same
 * identity sighted in the next revision of the same set is another row of the record.
 *
 * The level is a surrogate id and nothing else (L-REG-02: "a level is referenced by surrogate id; its
 * label, ordinal and height never enter a key"). Where no level is resolved the row stands in a
 * lawful-null slot, and where a drawing names a level nobody has authored yet it carries that label
 * as the placeholder the one-hop carry moves (L-REG-04) — at most one of the three at a time.
 */
export const registerObjects = pgTable(
  "register_objects",
  {
    tenantId: uuid("tenant_id").notNull(),
    setRevisionId: uuid("set_revision_id")
      .notNull()
      .references(() => drawingSetRevisions.setRevisionId),
    objectKey: text("object_key").notNull(),
    projectId: uuid("project_id").notNull(),
    discipline: text("discipline").$type<Discipline>().notNull(),
    // The element type as the sighting was made of it. Not closed over the catalogue's classes: the
    // catalogue spells what a class BEARS, and which roster a walker's element type is drawn from is
    // the discipline-confirmation leaf's to settle (L-REG-03) — the register keeps what was sighted.
    elementType: text("element_type").notNull(),
    mark: text("mark").notNull(),
    viewKey: text("view_key").notNull(),
    placementKey: text("placement_key").notNull(),
    levelId: uuid("level_id"),
    levelSlot: text("level_slot"),
    levelLabel: text("level_label"),
    standing: text("standing").$type<SightingStanding>().notNull(),
    // L-REG-04's semantic: what the row says, order-normalised and digested. It invalidates a
    // disposition; it never keys a row, which is why `object_key` is the key and this is a column.
    semantic: text("semantic").notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The double-count guard itself (L-REG-03): one identity, one row, inside one set revision.
    primaryKey({ name: "register_objects_key", columns: [table.tenantId, table.setRevisionId, table.objectKey] }),
    check("register_objects_discipline_closed", statement`${table.discipline} in (${statement.raw(closedList(DISCIPLINES))})`),
    check("register_objects_standing_closed", statement`${table.standing} in (${statement.raw(closedList(SIGHTING_STANDINGS))})`),
    check("register_objects_level_slot_closed", statement`${table.levelSlot} is null or ${table.levelSlot} in (${statement.raw(closedList(LEVEL_SLOTS))})`),
    // A level is stated once, one way — a surrogate, a lawful-null slot or a placeholder label — and
    // it is stated as the row's own key states it. An instance key is a placement key followed by one
    // level segment (L-REG-04), so the column that carries the level is the column the key names: a
    // row whose key asserts a level its columns deny, or whose columns assert one its key does not,
    // is a row that disagrees with its own identity. Derived from the segment grammar's own markers
    // rather than re-spelled here (B-17).
    check(
      "register_objects_level_stated_once",
      statement`num_nonnulls(${table.levelId}, ${table.levelSlot}, ${table.levelLabel}) <= 1 and ${table.objectKey} = ${table.placementKey} || case when ${table.levelId} is not null then ${statement.raw(closedList([LEVEL_MARKER]))} || ${table.levelId}::text when ${table.levelSlot} is not null then ${statement.raw(closedList([LEVEL_MARKER]))} || ${table.levelSlot} when ${table.levelLabel} is not null then ${statement.raw(closedList([UNREGISTERED_PREFIX]))} || ${table.levelLabel} else '' end`,
    ),
    // The reads the register makes: one revision's objects, and one mark family across it.
    index("register_objects_by_revision").on(table.tenantId, table.setRevisionId, table.registeredAt),
    index("register_objects_by_mark").on(table.tenantId, table.setRevisionId, table.mark),
  ],
);

/**
 * L-REG-03's unpriceable evidence: "a second measured sighting of the same physical scope inside one
 * drawing-set revision is refused at the door (`DUPLICATE_IDENTITY`) and kept as unpriceable evidence
 * in a separate table with no join from any bill (a status flag on the register table is one
 * forgotten WHERE from over-measurement)".
 *
 * So this table declares no foreign key to `register_objects` and nothing declares one to it. It
 * names the object key it collided with as text — a name a person reading the evidence can follow —
 * and the collision cannot be joined back into a quantity by any query the store will plan. The whole
 * refused sighting is kept: evidence discarded is evidence nobody can weigh.
 */
export const refusedSightings = pgTable(
  "refused_sightings",
  {
    tenantId: uuid("tenant_id").notNull(),
    refusedSightingId: uuid("refused_sighting_id").primaryKey().defaultRandom(),
    // Deliberately no foreign key: neither to the revision nor to the object it collided with. A
    // refused sighting is evidence standing apart from the record of scope (L-REG-03).
    setRevisionId: uuid("set_revision_id").notNull(),
    projectId: uuid("project_id").notNull(),
    objectKey: text("object_key").notNull(),
    refusal: text("refusal").$type<RefusalCode>().notNull(),
    discipline: text("discipline").$type<Discipline>().notNull(),
    // The element type as the sighting was made of it. Not closed over the catalogue's classes: the
    // catalogue spells what a class BEARS, and which roster a walker's element type is drawn from is
    // the discipline-confirmation leaf's to settle (L-REG-03) — the register keeps what was sighted.
    elementType: text("element_type").notNull(),
    mark: text("mark").notNull(),
    viewKey: text("view_key").notNull(),
    placementKey: text("placement_key").notNull(),
    semantic: text("semantic").notNull(),
    // What was sighted, whole and as it was seen — `json`, not `jsonb`, because jsonb re-orders what
    // it holds and this row is a record of what somebody presented.
    sighting: json("sighting").$type<unknown>().notNull(),
    refusedAt: timestamp("refused_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("refused_sightings_refusal_closed", statement`${table.refusal} in (${statement.raw(closedList([REFUSALS.DUPLICATE_IDENTITY.code]))})`),
    check("refused_sightings_discipline_closed", statement`${table.discipline} in (${statement.raw(closedList(DISCIPLINES))})`),
    // The read the evidence surface makes: one revision's refusals, newest last.
    index("refused_sightings_by_revision").on(table.tenantId, table.setRevisionId, table.refusedAt),
  ],
);

/**
 * One correctable attribute slot of one register object, and the authority it stands under (L-REG-03:
 * "attributes have their own authority — a general-note sheet supplies fy/cover while measuring
 * nothing"). Insert-once: the slot records that this attribute is spoken about at all.
 *
 * What the attribute IS worth is nowhere here. A standing is derived from the observations at read
 * time (L-REG-03: "disagreement is declared, never resolved silently"), because a stored "current
 * value" column is exactly the overwrite R-TO-051 forbids.
 */
export const registerAttributes = pgTable(
  "register_attributes",
  {
    tenantId: uuid("tenant_id").notNull(),
    setRevisionId: uuid("set_revision_id").notNull(),
    objectKey: text("object_key").notNull(),
    attribute: text("attribute").notNull(),
    authority: text("authority").$type<Discipline>().notNull(),
    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "register_attributes_key", columns: [table.tenantId, table.setRevisionId, table.objectKey, table.attribute] }),
    // The slot belongs to a register object of the same revision — an attribute of nothing is not an
    // attribute. The key is the object's own, so the link is the identity rather than a second id.
    foreignKey({
      columns: [table.tenantId, table.setRevisionId, table.objectKey],
      foreignColumns: [registerObjects.tenantId, registerObjects.setRevisionId, registerObjects.objectKey],
      name: "register_attributes_object_fk",
    }),
    check("register_attributes_authority_closed", statement`${table.authority} in (${statement.raw(closedList(DISCIPLINES))})`),
  ],
);

/**
 * R-TO-051's ledger of readings: "every human change is an act adding a competing observation with
 * declared precedence; disagreements suspend and show as such; nothing overwrites (L-ACT-01)".
 *
 * Every row is a reading somebody or something made, kept whole and forever. A correction is another
 * row at a higher declared precedence — never an edit of this one — which the append-only trigger and
 * the app role's privileges make true of the store and not only of the door.
 *
 * The derivation travels with the reading (L-REG-01: "a unit conversion is not origination only
 * because it carries its derivation — source value, source unit as written, canonical unit, factor,
 * factor provenance"), so a figure on a document can be traced back to what a drawing said without
 * anyone re-deriving it.
 *
 * `observation_id` is minted, and that is not L-REG-04's "zero minted ids": that rule binds derived
 * ROW KEYS. A reading is an appended ledger record like an act — two identical readings from one
 * source are two readings — so it is addressed the way `acts` is.
 */
export const registerObservations = pgTable(
  "register_observations",
  {
    tenantId: uuid("tenant_id").notNull(),
    observationId: uuid("observation_id").primaryKey().defaultRandom(),
    setRevisionId: uuid("set_revision_id").notNull(),
    objectKey: text("object_key").notNull(),
    attribute: text("attribute").notNull(),
    valueAsWritten: text("value_as_written").notNull(),
    unitAsWritten: text("unit_as_written").notNull(),
    canonicalValue: text("canonical_value").notNull(),
    canonicalUnit: text("canonical_unit").$type<Unit>().notNull(),
    factor: text("factor").notNull(),
    factorProvenance: text("factor_provenance").notNull(),
    basis: text("basis").$type<ObservationBasis>().notNull(),
    sourceKey: text("source_key").notNull(),
    precedence: integer("precedence").notNull(),
    // Null where no human act authored the reading: a machine transcription is nobody's act, and a
    // nullable column says so rather than a fabricated act id (L-ACT-01).
    actId: uuid("act_id").references(() => acts.actId),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    // The append order, handed out by the database itself. `observed_at` says when a reading says it
    // was observed; it does not order two readings appended inside one clock tick, and the standing
    // an attribute is derived at depends on which of them came last (R-TO-051). Nothing in the app
    // chooses this number and nothing reads it as a value.
    appendSeq: bigserial("append_seq", { mode: "number" }).notNull(),
  },
  (table) => [
    // A reading is about a declared attribute slot of a register object, and about nothing else.
    foreignKey({
      columns: [table.tenantId, table.setRevisionId, table.objectKey, table.attribute],
      foreignColumns: [registerAttributes.tenantId, registerAttributes.setRevisionId, registerAttributes.objectKey, registerAttributes.attribute],
      name: "register_observations_attribute_fk",
    }),
    check("register_observations_unit_closed", statement`${table.canonicalUnit} in (${statement.raw(closedList(UNITS))})`),
    check("register_observations_basis_closed", statement`${table.basis} in (${statement.raw(closedList(OBSERVATION_BASES))})`),
    // Precedence is declared, and it is a rank rather than a signed quantity.
    check("register_observations_precedence_not_negative", statement`${table.precedence} >= 0`),
    // The read a standing is derived from: one attribute's readings, in the order they were appended.
    index("register_observations_by_attribute").on(table.tenantId, table.setRevisionId, table.objectKey, table.attribute, table.appendSeq),
  ],
);

/**
 * R-TO-051's repudiation: a person judges a register object to be nothing. L-ACT-01 keeps the object
 * and everything derived from it — a repudiation is a reading of the record, not a deletion of it —
 * so the judgement is a row of its own, appended by the act that made it.
 *
 * No foreign key to `register_objects`, and none from any bill: the same posture L-REG-03 fixes for
 * refused sightings. A repudiation is evidence about scope, and a status flag on the register table
 * would be one forgotten WHERE from a quantity that a person has struck.
 */
export const repudiatedObjects = pgTable(
  "repudiated_objects",
  {
    tenantId: uuid("tenant_id").notNull(),
    repudiatedObjectId: uuid("repudiated_object_id").primaryKey().defaultRandom(),
    setRevisionId: uuid("set_revision_id").notNull(),
    projectId: uuid("project_id").notNull(),
    objectKey: text("object_key").notNull(),
    // A repudiation is a human act and nothing else, so the act that wrote it is not nullable
    // (L-ACT-01: the act row and the state change commit together or neither).
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    repudiatedAt: timestamp("repudiated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One judgement per object per revision: repudiating what is already repudiated changes nothing,
    // and the store says so as well as the seam does.
    unique("repudiated_objects_one_per_object").on(table.tenantId, table.setRevisionId, table.objectKey),
    // The read the register makes: one revision's repudiations, in the order they were made.
    index("repudiated_objects_by_revision").on(table.tenantId, table.setRevisionId, table.repudiatedAt),
  ],
);

/**
 * L-MEA-07's level: "a project-scoped object with a surrogate id; label, ordinal and height are
 * non-identifying".
 *
 * So the identity is `level_id` and nothing else — the label and the ordinal are ordinary columns a
 * later act may move, and the height is not here at all: it is READ, and its readings are the table
 * below (L-REG-02: "storey height, concrete grade, rebar spec are correctable attributes that
 * participate in diffs, never in identity").
 *
 * A level is inserted by an act and repudiated by an act, and by nothing else (L-ACT-01), which is
 * what the two act columns say. `repudiated_act_id` is the whole of "a level with live rows is never
 * deleted, only repudiated": the row stays, its ordinal stays, the register objects that stand on it
 * stay, and the live stack is the levels this column is null for. The app role holds no DELETE here,
 * so that is the store's guarantee rather than this door's habit.
 *
 * No unique constraint over (project, ordinal): inserting mid-stack shifts every live level at or
 * above the proposed ordinal up by one, and a unique index would refuse the shift halfway through
 * for a collision that does not exist at the end of it. The act is the one writer and it takes the
 * project's state lock (SEAM-ACT), so the shift is what keeps the live ordinals distinct.
 */
export const levels = pgTable(
  "levels",
  {
    tenantId: uuid("tenant_id").notNull(),
    levelId: uuid("level_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId),
    label: text("label").notNull(),
    // Physical, and signed: a basement stands below ground (L-MEA-07).
    ordinal: integer("ordinal").notNull(),
    insertedActId: uuid("inserted_act_id")
      .notNull()
      .references(() => acts.actId),
    // Null while the level is live. Set once, by the act that marks it (L-MEA-07).
    repudiatedActId: uuid("repudiated_act_id").references(() => acts.actId),
    insertedAt: timestamp("inserted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The read the stack is answered from: one project's levels, in the order they physically stand.
    index("levels_by_project").on(table.tenantId, table.projectId, table.ordinal),
  ],
);

/**
 * L-MEA-07's storey height, as it is read rather than as it is set: every reading somebody made of
 * one level's height, kept whole and forever.
 *
 * Nothing here is a "current height" — the standing is derived from these rows at read time, because
 * a stored current value is the overwrite R-TO-051 forbids and a silently-picked winner is the
 * resolution L-REG-03 forbids. A reading is superseded only by a later reading under the SAME
 * `reading_key` (level, actor, basis, source key): that is a re-affirmation, and it is the one thing
 * that clears a contest (L-MEA-07). So no unique constraint stands on the key, and the app role holds
 * neither UPDATE nor DELETE: a correction is another row.
 *
 * The derivation travels with the reading (L-REG-01): the value and unit as written, the canonical
 * metres, the factor that carried it and where that factor came from. The canonical unit is not a
 * column — a storey height is a length and the canon's canonical length unit is the metre, so the
 * column says so by name rather than storing a constant beside every row (L-FRM-06).
 *
 * `reading_id` is minted, and that is not L-REG-04's "zero minted ids": that rule binds derived ROW
 * KEYS. A reading is an appended ledger record like an act, so it is addressed the way `acts` is.
 */
export const storeyHeightReadings = pgTable(
  "storey_height_readings",
  {
    tenantId: uuid("tenant_id").notNull(),
    readingId: uuid("reading_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    levelId: uuid("level_id")
      .notNull()
      .references(() => levels.levelId),
    // What makes two readings the same reading — derived by `readingKey` (L-REG-04), never minted.
    readingKey: text("reading_key").notNull(),
    actorId: uuid("actor_id").notNull(),
    basis: text("basis").$type<StoreyHeightBasis>().notNull(),
    // Null where the reading cites no drawing entity: a height somebody entered is nobody's source key.
    sourceKey: text("source_key"),
    valueAsWritten: text("value_as_written").notNull(),
    unitAsWritten: text("unit_as_written").notNull(),
    canonicalMetres: text("canonical_metres").notNull(),
    factor: text("factor").notNull(),
    factorProvenance: text("factor_provenance").notNull(),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A defaulted storey height is barred at the store as well as at the act (L-MEA-07).
    check("storey_height_readings_basis_closed", statement`${table.basis} in (${statement.raw(closedList(STOREY_HEIGHT_BASES))})`),
    // The read a standing is derived from: one level's readings, in the order they were made.
    index("storey_height_readings_by_level").on(table.tenantId, table.levelId, table.readAt),
  ],
);

/**
 * L-CAD-07's authored range: the one-to-many expansion a person stated for a view whose caption did
 * not (`AUTHOR_TYPICAL_RANGE`). One row per act, naming the view it was authored for, the two levels
 * it runs between by surrogate id (L-REG-02) and the act that authored it (L-ACT-01).
 *
 * Not a stage's row and never rewritten by one: this is a human's statement about a view, and a
 * rebuild reads it rather than replacing it — which is why the app role holds no DELETE here.
 */
export const typicalRanges = pgTable(
  "typical_ranges",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    viewKey: text("view_key").notNull(),
    fromLevelId: uuid("from_level_id")
      .notNull()
      .references(() => levels.levelId),
    toLevelId: uuid("to_level_id")
      .notNull()
      .references(() => levels.levelId),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    authoredAt: timestamp("authored_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One authored range per view of one project: a second statement about one view would leave the
    // expansion two ranges to resolve, and a resolver that picked one would be guessing (L-CAD-07).
    primaryKey({ name: "typical_ranges_key", columns: [table.tenantId, table.projectId, table.viewKey] }),
    index("typical_ranges_by_project").on(table.tenantId, table.projectId),
  ],
);

/**
 * L-REG-07's campaign: what a pinned drawing-set revision is measured under, and what was in force
 * when it was opened.
 *
 * "Campaign creation copies onto the campaign, immutably: the rule-set edition key, the work-item
 * catalogue digest and the level-stack digest." So the three digests are columns of this row, copied
 * inside the transaction that wrote the revision, and never touched again: the app role holds no
 * UPDATE here, which is what makes the snapshot immutable in the store rather than in a habit. The
 * freshness gate diffs these against what is in force and answers stale (`PIN_STALE`).
 *
 * One campaign per pinned revision (the unique below): a re-pin writes another revision and opens
 * another campaign beside this one, so what a measurement was taken against is never rewritten.
 */
export const campaigns = pgTable(
  "campaigns",
  {
    tenantId: uuid("tenant_id").notNull(),
    campaignId: uuid("campaign_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId),
    setRevisionId: uuid("set_revision_id")
      .notNull()
      .references(() => drawingSetRevisions.setRevisionId),
    // The pinned edition's identity AND its content digest: L-MEA-01 keeps the two apart, and
    // neither substitutes for the other.
    editionId: uuid("edition_id").notNull(),
    editionDigest: text("edition_digest").notNull(),
    catalogueDigest: text("catalogue_digest").notNull(),
    levelStackDigest: text("level_stack_digest").notNull(),
    status: text("status").$type<CampaignStatus>().notNull(),
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("campaigns_one_per_revision").on(table.tenantId, table.setRevisionId),
    check("campaigns_status_closed", statement`${table.status} in (${statement.raw(closedList(CAMPAIGN_STATUSES))})`),
    // The read a project's campaign list is answered from, newest activity last.
    index("campaigns_by_project").on(table.tenantId, table.projectId, table.openedAt),
  ],
);

/**
 * L-QTY-03's published quantity line, with everything a line must always carry: the basis, the
 * coverage, the register row it provenances to, the (drawing, view) it was read from, the engine
 * that read it, the rule id and version it was derived by, the edition that version was in force
 * under, the SI value at full precision as `numeric`, the human-auditable formula, and the raw
 * readings and calibration references beside the SI value.
 *
 * The gate is the sole writer (SEAM-GATE), and the line is keyed by the fact it records — one
 * campaign, one object, one kind — so a second run of the same batch finds this row rather than
 * publishing a second one. The app role holds no UPDATE and no DELETE: a line is a record.
 */
export const quantityLines = pgTable(
  "quantity_lines",
  {
    tenantId: uuid("tenant_id").notNull(),
    lineId: uuid("line_id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.campaignId),
    projectId: uuid("project_id").notNull(),
    setRevisionId: uuid("set_revision_id").notNull(),
    // Provenance to the register row, as a reference (L-QTY-03) — the object's own key, never a
    // second id minted beside it (L-REG-04).
    objectKey: text("object_key").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    viewKey: text("view_key").notNull(),
    class: text("class").$type<ElementType>().notNull(),
    kind: text("kind").$type<Kind>().notNull(),
    ruleId: text("rule_id").notNull(),
    ruleVersion: text("rule_version").notNull(),
    editionDigest: text("edition_digest").notNull(),
    engine: text("engine").$type<Engine>().notNull(),
    // L-QTY-01's two roll-ups, derived weakest-wins from the per-attribute bases that stand beside
    // them in `bindings` and `selectors`: a wrong determining attribute is a wrong number, a wrong
    // selecting attribute is the right number at the wrong rate.
    quantityBasis: text("quantity_basis").$type<QuantityBasis>().notNull(),
    selectionBasis: text("selection_basis").$type<QuantityBasis>().notNull(),
    coverage: text("coverage").$type<Coverage>().notNull(),
    // The SI value at full precision: `numeric`, because a double cannot hold what the canon carried
    // and a line is what a bill is priced from (B-07, L-QTY-03). Null — and only — where the row is
    // PARTIAL_DECLARED: "a row kept with no quantity" carries none, never a zero (L-QTY-02).
    value: numeric("value"),
    unit: text("unit").$type<Unit>().notNull(),
    formula: text("formula").notNull(),
    // What the drawing said, beside what the canon made of it — `json`, not `jsonb`, because a
    // record of what was read keeps the order it was written in.
    bindings: json("bindings").$type<Record<string, unknown>>().notNull(),
    selectors: json("selectors").$type<Record<string, unknown>>().notNull(),
    deductions: json("deductions").$type<readonly unknown[]>().notNull(),
    // Every omitted component of the item description, by name and by registered code — what makes
    // a partial row DECLARED, and empty under COMPLETE (L-QTY-02).
    omitted: json("omitted").$type<readonly unknown[]>().notNull(),
    calibrationKeys: json("calibration_keys").$type<readonly string[]>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The natural key of a published line: one campaign measures one object for one kind once. This
    // is what makes the gate idempotent in the store rather than in a writer's memory (L-QTY-04's
    // over-measurement is a hard block, so a second line for the same fact must be unrepresentable).
    unique("quantity_lines_one_per_object_kind").on(table.tenantId, table.campaignId, table.objectKey, table.kind),
    check("quantity_lines_class_closed", statement`${table.class} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    check("quantity_lines_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
    check("quantity_lines_engine_closed", statement`${table.engine} in (${statement.raw(closedList(ENGINES))})`),
    check("quantity_lines_basis_closed", statement`${table.quantityBasis} in (${statement.raw(closedList(QUANTITY_BASES))})`),
    check("quantity_lines_selection_basis_closed", statement`${table.selectionBasis} in (${statement.raw(closedList(QUANTITY_BASES))})`),
    check("quantity_lines_coverage_closed", statement`${table.coverage} in (${statement.raw(closedList(COVERAGES))})`),
    check("quantity_lines_unit_closed", statement`${table.unit} in (${statement.raw(closedList(UNITS))})`),
    // L-QTY-02, in the store: a row carries a quantity or declares what it omitted, and never both
    // ways round. PARTIAL_UNDECLARED is unrepresentable here as well as in the contract's roster —
    // a COMPLETE row with no figure, and a partial row carrying one, cannot be written at all.
    check("quantity_lines_partial_declared", statement`(${table.coverage} = 'COMPLETE') = (${table.value} is not null)`),
    // The read a campaign's lines are answered from, in the order they were published.
    index("quantity_lines_by_campaign").on(table.tenantId, table.campaignId, table.publishedAt),
  ],
);

/**
 * L-MEA-08's rail observation: "a rail-local closed code keyed (class × kind) with optional object
 * and source entity". What a rail SAW and did not offer — the evidence a residue is later read from.
 *
 * The observation key is what makes the same observation, reported twice, one row: a re-run of a
 * rail over an unchanged revision observes what it observed before.
 */
export const railObservations = pgTable(
  "rail_observations",
  {
    tenantId: uuid("tenant_id").notNull(),
    observationId: uuid("observation_id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.campaignId),
    projectId: uuid("project_id").notNull(),
    class: text("class").$type<ElementType>().notNull(),
    kind: text("kind").$type<Kind>().notNull(),
    code: text("code").notNull(),
    // Null where the observation is about the reading rather than about one object of it.
    objectKey: text("object_key"),
    sourceEntity: text("source_entity"),
    // What makes two reports the same observation, derived from what the observation IS.
    observationKey: text("observation_key").notNull(),
    detail: json("detail").$type<Record<string, unknown>>(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("rail_observations_once_per_campaign").on(table.tenantId, table.campaignId, table.observationKey),
    check("rail_observations_class_closed", statement`${table.class} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    check("rail_observations_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
    index("rail_observations_by_campaign").on(table.tenantId, table.campaignId, table.observedAt),
  ],
);

/**
 * L-QTY-04's queue item: a scope declared excluded rather than measured, with the registered reason
 * it was deferred for. "Interpreted geometry uncorroborated → declared exclusion + queue item, never
 * a line" — so this row and a `quantity_lines` row are alternatives, and the cause is a code of the
 * closed taxonomy rather than prose.
 */
export const queueItems = pgTable(
  "queue_items",
  {
    tenantId: uuid("tenant_id").notNull(),
    queueItemId: uuid("queue_item_id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.campaignId),
    projectId: uuid("project_id").notNull(),
    objectKey: text("object_key").notNull(),
    kind: text("kind").$type<Kind>().notNull(),
    cause: text("cause").$type<QueueItemCause>().notNull(),
    detail: json("detail").$type<Record<string, unknown>>(),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The same natural key a line stands under: one campaign defers one object for one kind once,
    // and the two tables cannot both hold it because the gate answers one arm per offer.
    unique("queue_items_one_per_object_kind").on(table.tenantId, table.campaignId, table.objectKey, table.kind),
    check("queue_items_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
    check("queue_items_cause_closed", statement`${table.cause} in (${statement.raw(closedList(QUEUE_ITEM_CAUSES))})`),
    index("queue_items_by_campaign").on(table.tenantId, table.campaignId, table.queuedAt),
  ],
);

/**
 * R-TO-052's boundary declaration: a person's judgement that one cell of the residue stands outside
 * the project's scope, or outside this bill. One row per act — a declaration is one act over one
 * cell, never a bulk assembly (L-ACT-02) — naming the cell it stands over, the cause it stands
 * under, the act that made it and whether it is in force.
 *
 * The residue is a query and not a table (L-QTY-05): this store holds only what a PERSON declared,
 * and the machine's own causes are resolved on read, never written here.
 *
 * No foreign key to the act log, the campaign or the level: the row is written inside the act's own
 * transaction, so it cannot outrun the act row it names, and what the residue does with a row whose
 * act no longer resolves is a reading rather than a constraint — the query joins the act and a
 * declaration nobody can point at states nothing (L-ACT-01, `residueOf`).
 */
export const scopeDeclarations = pgTable(
  "scope_declarations",
  {
    tenantId: uuid("tenant_id").notNull(),
    declarationId: uuid("declaration_id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    campaignId: uuid("campaign_id").notNull(),
    class: text("class").$type<ElementType>().notNull(),
    kind: text("kind").$type<Kind>().notNull(),
    levelId: uuid("level_id").notNull(),
    cause: text("cause").$type<ScopeDeclarationCause>().notNull(),
    actId: uuid("act_id").notNull(),
    inForce: boolean("in_force").notNull().default(true),
    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One campaign holds one declaration of one cause over one cell: a second identical declaration
    // is an act that changes nothing, refused by name before it reaches here (L-ACT-01).
    unique("scope_declarations_one_per_cell").on(table.tenantId, table.campaignId, table.class, table.kind, table.levelId, table.cause),
    check("scope_declarations_cause_closed", statement`${table.cause} in (${statement.raw(closedList(SCOPE_DECLARATION_CAUSES))})`),
    check("scope_declarations_class_closed", statement`${table.class} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    check("scope_declarations_kind_closed", statement`${table.kind} in (${statement.raw(closedList(KINDS))})`),
    index("scope_declarations_by_campaign").on(table.tenantId, table.campaignId, table.declaredAt),
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
  conventionProfiles,
  grids,
  gridDeferrals,
  schedules,
  scheduleCells,
  memberTypes,
  memberTypeVariants,
  rebarZones,
  scheduleDeferrals,
  placements,
  expansionDeferrals,
  proposedLevels,
  drawingSets,
  drawingSetMembers,
  drawingSetRevisions,
  scaleAffirmations,
  calibrations,
  workItems,
  bears,
  registerObjects,
  refusedSightings,
  registerAttributes,
  registerObservations,
  repudiatedObjects,
  levels,
  storeyHeightReadings,
  typicalRanges,
  campaigns,
  quantityLines,
  railObservations,
  queueItems,
  scopeDeclarations,
};
