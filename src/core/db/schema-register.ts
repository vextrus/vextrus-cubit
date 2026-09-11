// SEAM-TENANT: the register area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { REFUSALS, type RefusalCode } from "../errors";
import {
  LEVEL_MARKER,
  LEVEL_SLOTS,
  OBSERVATION_BASES,
  type ObservationBasis,
  SIGHTING_STANDINGS,
  type SightingStanding,
  UNREGISTERED_PREFIX,
} from "../identity";
import { DISCIPLINES, type Discipline } from "../sheets/law";
import { UNITS, type Unit } from "../units/canon";
import { acts } from "./schema-acts";
import { drawingSetRevisions } from "./schema-drawing-sets";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import {
  bigserial,
  check,
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

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
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const REGISTER_TABLES = {
  registerObjects,
  refusedSightings,
  registerAttributes,
  registerObservations,
  repudiatedObjects,
};
