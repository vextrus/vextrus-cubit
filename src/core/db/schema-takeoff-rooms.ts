// SEAM-TENANT: the takeoff-rooms area's table — the rooms the rooms stage reads off an architect's plan
// (s-takeoff I-643…d), stored beside the placements their surfaces stand as.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` (scripts/eslint/rules/no-db-outside-seam.mjs).
// `db/schema/takeoff-rooms.ts` is where drizzle-kit reads it back out of.
//
// A row of the SAME stored partition as `placements`: rewritten per ingest in the partition's one
// transaction, keyed by a content-derived room key, so a re-derivation of the same artifact writes the
// same rows (L-REG-04, R-TO-030).
import { ROOM_OUTLINE_REASONS } from "../errors";
import { ROOM_OUTLINE_STATUSES, type RoomFace, type RoomOutlineStatus } from "../rooms/law";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, doublePrecision, index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

// The statuses and the faces are law (`../rooms/law.ts`), read from there rather than copied (B-17);
// their types stay published beside the table that stores them.
export type { RoomFace, RoomOutlineStatus } from "../rooms/law";

/** One label as a room carries it (I-644). */
export type StoredRoomLabel = {
  readonly key: string;
  readonly name: string;
  readonly size: string | null;
  readonly agrees: boolean | null;
  readonly astray: boolean;
};

/** An outline as stored: its ring and its holes, each a list of [x, y] in the drawing's own coordinates. */
export type StoredRoomOutline = { readonly outer: readonly (readonly [number, number])[]; readonly holes: readonly (readonly (readonly [number, number])[])[] };

/** A face a room registered, by the placement it stands as. */
export type StoredRoomFace = { readonly face: RoomFace; readonly placementKey: string };

/**
 * One room of an architect's plan — or one closed region that is not one, with the reason (I-643).
 * The outline is the region between the walls' inner faces, in the drawing's own coordinates; its area
 * is carried into square metres by the canon's exact factors and kept as the decimal it is (B-07). The
 * surfaces it registered are named by their placement keys, so a reader goes from a register row's
 * placement to the room it is a face of.
 */
export const roomOutlines = pgTable(
  "room_outlines",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    roomKey: text("room_key").notNull(),
    viewKey: text("view_key").notNull(),
    layoutName: text("layout_name"),
    status: text("status").$type<RoomOutlineStatus>().notNull(),
    reason: text("reason"),
    name: text("name"),
    labels: jsonb("labels").$type<readonly StoredRoomLabel[]>().notNull(),
    outline: jsonb("outline").$type<StoredRoomOutline>(),
    areaM2: text("area_m2"),
    anchorX: doublePrecision("anchor_x").notNull(),
    anchorY: doublePrecision("anchor_y").notNull(),
    faces: jsonb("faces").$type<readonly StoredRoomFace[]>().notNull(),
    sourceKeys: text("source_keys").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "room_outlines_key", columns: [table.tenantId, table.ingestId, table.roomKey] }),
    check("room_outlines_status_closed", statement`${table.status} in (${statement.raw(closedList(ROOM_OUTLINE_STATUSES))})`),
    // A region not registered says why, by the register's own codes; one registered or a void says nothing.
    check("room_outlines_reason_closed", statement`${table.reason} is null or ${table.reason} in (${statement.raw(closedList(ROOM_OUTLINE_REASONS))})`),
    check("room_outlines_reason_stated", statement`(${table.status} in ('CLOSED', 'VOID')) = (${table.reason} is null)`),
    // Only a room whose outline closed carries an outline and an area — never a bounding box (L-MEA-03).
    check("room_outlines_outline_closed", statement`(${table.status} = 'NOT_CLOSED') = (${table.outline} is null)`),
    // What a room was read off answers for it (L-CAD-03).
    check("room_outlines_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    // The read the overlay makes: one drawing's rooms.
    index("room_outlines_by_drawing").on(table.tenantId, table.drawingId),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to this
 * file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_ROOMS_TABLES = {
  roomOutlines,
};
