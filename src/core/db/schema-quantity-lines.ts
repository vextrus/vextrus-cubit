// SEAM-TENANT: the quantity-lines area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { CAMPAIGN_STATUSES, type CampaignStatus } from "../campaigns/law";
import { ELEMENT_TYPES, type ElementType } from "../catalogue/classes";
import { KINDS, type Kind } from "../catalogue/kinds";
import { QUEUE_ITEM_CAUSES, type QueueItemCause } from "../gate/law";
import { COVERAGES, type Coverage, ENGINES, type Engine, QUANTITY_BASES, type QuantityBasis } from "../offers/law";
import { UNITS, type Unit } from "../units/canon";
import { acts } from "./schema-acts";
import { drawingSetRevisions } from "./schema-drawing-sets";
import { projects } from "./schema-projects";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, json, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const QUANTITY_LINES_TABLES = {
  campaigns,
  quantityLines,
  railObservations,
  queueItems,
};
