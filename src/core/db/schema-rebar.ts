// SEAM-TENANT: the REBAR area's tables, with the closed rosters their CHECKs are written from.
//
// The rebar rail declares its tables HERE, and re-exports them from `db/schema/rebar.ts` for the
// drift lane. `schema.ts` already enumerates this file, so a table added to the group below joins
// `SEAM_SCHEMA` and the seam's typed surface with no shared roster to edit and no other area's file
// to touch (B-19).
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper).

import { ELEMENT_TYPES, type ElementType } from "../catalogue/classes";
import { SHAPE_CODES, type ShapeCode } from "../rulesets/methods/rebar/bs8666";
import { BAR_ROLES, type BarRole } from "../rulesets/methods/rebar/synthesis";
import { campaigns } from "./schema-quantity-lines";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, index, integer, json, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * L-REG-04's bill of bars: one row per (member, role, diameter, sequence), keyed by CONTENT.
 *
 * "Bar row key = member key + role + diameter + sequence" — no UUID, no sequence number and no
 * timestamp goes into it, so re-measuring a campaign that has not changed reproduces the identical
 * key multiset and the store's own key refuses a duplicate. The campaign's rows are REPLACED whole
 * on every measurement (delete then insert in one transaction), which is why `cubit_app` holds
 * DELETE and INSERT here and no UPDATE at all: a content-keyed row is rewritten, never amended.
 *
 * Every figure is text, because every figure is an exact decimal (B-07). The three lengths AM-01
 * names stand side by side: the raw BS 8666 length, never rounded; the ONE rounded surface; and the
 * IS 2502 additive figure, recorded beside them and billed by nothing.
 */
export const barRows = pgTable(
  "bar_rows",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.campaignId),
    setRevisionId: uuid("set_revision_id").notNull(),
    /** The register object these bars belong to, and the content-derived key of the row itself. */
    objectKey: text("object_key").notNull(),
    barKey: text("bar_key").notNull(),
    class: text("class").$type<ElementType>().notNull(),
    /** The level the member stands on, or null where it stands in a lawful-null slot (L-REG-02). */
    level: text("level"),
    mark: text("mark").notNull(),
    barMark: text("bar_mark").notNull(),
    role: text("role").$type<BarRole>().notNull(),
    diameterMm: integer("diameter_mm").notNull(),
    shape: text("shape").$type<ShapeCode>().notNull(),
    /** The legs the detail dimensions, lettered as BS 8666 letters them. */
    dimsMm: json("dims_mm").$type<Record<string, string>>().notNull(),
    cuttingRawMm: text("cutting_raw_mm").notNull(),
    cuttingRoundedMm: text("cutting_rounded_mm").notNull(),
    cuttingIsAdditiveMm: text("cutting_is_additive_mm").notNull(),
    piecesPerBar: integer("pieces_per_bar").notNull(),
    lapMm: text("lap_mm").notNull(),
    lapsPerBar: integer("laps_per_bar").notNull(),
    barsPerUnit: integer("bars_per_unit").notNull(),
    parentCount: text("parent_count").notNull(),
    bars: text("bars").notNull(),
    kgPerMetre: text("kg_per_metre").notNull(),
    kgNet: text("kg_net").notNull(),
    kgLap: text("kg_lap").notNull(),
    kg: text("kg").notNull(),
    /** What the bars were read from, and what the detailing they were cut under was read from. */
    sourceKeys: json("source_keys").$type<string[]>().notNull(),
    detailingSourceKeys: json("detailing_source_keys").$type<string[]>().notNull(),
    editionDigest: text("edition_digest").notNull(),
    /** What this row SAYS, content-addressed — a re-presentation moves it (L-REG-04). */
    semantic: text("semantic").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: "bar_rows_key", columns: [table.tenantId, table.campaignId, table.barKey] }),
    index("bar_rows_by_campaign").on(table.tenantId, table.campaignId, table.objectKey),
    check("bar_rows_class_closed", statement`${table.class} in (${statement.raw(closedList(ELEMENT_TYPES))})`),
    check("bar_rows_role_closed", statement`${table.role} in (${statement.raw(closedList(BAR_ROLES))})`),
    check("bar_rows_shape_closed", statement`${table.shape} in (${statement.raw(closedList(SHAPE_CODES))})`),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const REBAR_TABLES = { barRows };
