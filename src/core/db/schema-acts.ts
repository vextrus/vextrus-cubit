// SEAM-TENANT: the acts area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { foreignKey, index, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const ACTS_TABLES = {
  participants,
  acts,
  participantRoles,
  participantRoleWithdrawals,
};
