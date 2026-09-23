// SEAM-TENANT: the takeoff-placements area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { ELEMENT_TYPES, type ElementType } from "../catalogue/classes";
import { EXPANSION_DEFERRAL_REASONS, type ExpansionDeferralReason } from "../errors";
import type { GeometryType } from "../offers/law";
import { UNITS, dimensionOf, type Unit } from "../units/canon";
import { acts } from "./schema-acts";
import { levels } from "./schema-takeoff-levels";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, doublePrecision, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Why a view's vertical members expand over no level: the register's own narrowing to the two the
 * expansion stage stands a view under (Q-07, L-CAD-07). One vocabulary, two readers (B-17).
 */
export type { ExpansionDeferralReason };

/**
 * The shapes a plan NOTE states about its member (I-303). One member — the circle — because that is
 * the one shape a plan writes in words a schedule has no cell for: `C7 Ø450 PORCH COLUMN` is a
 * circular column whose schedule row states `450x450` under every band, and the two are not in
 * disagreement (b = d = 450 either way; a B x D column schedule has no shape column). THE PLAN STATES
 * THE SHAPE, THE SCHEDULE STATES THE SIZE.
 *
 * Its home is here for the reason `GRID_FAMILIES` and `SECTION_UNITS` have theirs in the seam: the
 * store's CHECK is written from the roster, and the reader that publishes a shape NAMES the member it
 * means against this type (`satisfies`) rather than restating the list — so the roster keeps one home
 * and a shape nobody registered cannot be written however it reached the insert (B-17, ARCH-01: core
 * imports nothing above it, so the list cannot travel the other way).
 */
export const MEMBER_SHAPES = ["ROUND"] as const;

/** One shape a note states, drawn from the closed roster above. */
export type MemberShape = (typeof MEMBER_SHAPES)[number];

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
 * The `note_*` columns carry what a plan NOTE naming this mark said about THIS member (I-303: a note
 * that names a mark is evidence about that member, so the member is not one of the plan's typical and
 * is not expanded by the view's authored typical range — it stands on the level the plan draws, or
 * over the range its own note states, and it only ever NARROWS). They are STORED rather than re-read
 * because the two readers of that fact must answer the same rows: the rebuild reads the drawing and
 * the re-expansion reads only these rows, and two spellings of one fact are two answers that drift
 * (B-17, L-REG-04).
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
    // The third entity a noted member was read from, beside its outline and its mark: the note's own
    // source key. ITS PRESENCE IS THE WHOLE DISCRIMINATOR — a row carrying one is a member some note
    // named, a row carrying none is one of the plan's typical — so there is no flag and no code beside
    // it for a reader to disagree with (I-303, L-CAD-03).
    noteKey: text("note_key"),
    // And the note's own words, kept beside the reading: a reading never replaces what was drawn
    // (L-CAD-03), and a person auditing a narrowed member reads the sentence that narrowed it.
    noteText: text("note_text"),
    // The two ends of the range the note STATED, as the labels it wrote them as — `STARTS AT 1F` is
    // `1F` and an open top. BOTH NULL UNDER A NOTE IS NORMAL AND MEANS SOMETHING: the note stated no
    // range at all, which I-303 reads as the level the plan DRAWS, alone. It can never mean "covers
    // everything": the reader cannot answer a band with both ends open at all, and `bandOpen` is what
    // that would have said (`@/core/offers/contract`).
    noteFromLabel: text("note_from_label"),
    noteToLabel: text("note_to_label"),
    // The shape the note stated, or null where it stated none — closed at the roster above.
    noteShape: text("note_shape").$type<MemberShape>(),
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
    // A note is stored WHOLE or not at all: a key with no words is a citation nobody can read back,
    // and words with no key are a reading of nothing (L-CAD-03).
    check("placements_note_read_whole", statement`num_nonnulls(${table.noteKey}, ${table.noteText}) <> 1`),
    // And nothing is STATED under no note. A range label or a shape standing on a row no note named
    // would be a narrowing with no evidence behind it, and a narrowing is the one thing I-303 does
    // (L-QTY-01: never a guess). The converse is not checked, because a note that stated no range is
    // exactly C7's note and says its member stands on the level the plan draws.
    check(
      "placements_note_statement_under_a_note",
      statement`${table.noteKey} is not null or num_nonnulls(${table.noteFromLabel}, ${table.noteToLabel}, ${table.noteShape}) = 0`,
    ),
    // The shape roster is the reader's and it is closed, so the store closes it: a shape outside it
    // cannot be written at all, however it reached the insert (I-303, R-TO-032).
    check("placements_note_shape_closed", statement`${table.noteShape} is null or ${table.noteShape} in (${statement.raw(closedList(MEMBER_SHAPES))})`),
    // The read a drawing's own overlay makes: the placements that stand for it now.
    index("placements_by_drawing").on(table.tenantId, table.drawingId),
    // And the read the expansion makes: one view's placements.
    index("placements_by_view").on(table.tenantId, table.ingestId, table.viewKey),
  ],
);

/**
 * The two geometries a placed member's RING is read as (L-FRM-01, I-333): a rectangle measured by its
 * own two sides, or a polygon measured by its shoelace. Named as members of the offer law's roster
 * rather than restated beside it, so the geometry a ring was read as and the one a line prints are
 * one spelling (B-17).
 */
export const OUTLINE_GEOMETRIES = ["PRISM_RECT", "PRISM_POLY"] as const satisfies readonly GeometryType[];

/** One geometry a ring is read as, drawn from the closed roster above. */
export type OutlineGeometry = (typeof OUTLINE_GEOMETRIES)[number];

/** The roster's two members by name, read off the roster itself rather than spelled a second time. */
const [RECT_OUTLINE, POLY_OUTLINE] = OUTLINE_GEOMETRIES;

/**
 * L-FRM-02's plan, read off the drawing: what the closed ring one member was placed by ENCLOSES — the
 * geometry it is, its shoelace area, its perimeter and, for a rectangle, its own two sides — one row
 * per placement a ring placed (Interpretation I-333).
 *
 * It is what a foundation is measured over: F-RCC6-BNBC draws fourteen pile caps chamfered and one
 * turned 45°, and neither the schedule's rectangle nor a bounding box is the plan the drawing drew
 * (3.675 m² and 4.5 m² against 3.2625 m² and 2.0 m²). So the ring's own figures are stored beside the
 * placement, never re-derived by a rail that holds no ring (L-MEA-08: rails share setup, the register
 * and the documents, and no geometry).
 *
 * Every figure is a READING and not a number: the value as it was read on the placement lattice, in
 * the length unit the ring was drawn in and that unit's square, cited to the ring and — where the
 * drawing's header named no unit and its notes declared one — to the declaration (L-REG-01, L-QTY-03,
 * I-302). A rectangle states both sides and a polygon neither: a polygon HAS no length and breadth,
 * which is exactly why its pit defers (L-FRM-04).
 *
 * Rewritten per ingest with the placements it was read off, in the same transaction, so the app role
 * holds a DELETE here for the reason it holds one on the placements (L-REG-04, R-TO-030).
 */
export const placementOutlines = pgTable(
  "placement_outlines",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    placementKey: text("placement_key").notNull(),
    sourceKey: text("source_key").notNull(),
    unitSourceKey: text("unit_source_key"),
    geometry: text("geometry").$type<OutlineGeometry>().notNull(),
    unit: text("unit").$type<Unit>().notNull(),
    areaUnit: text("area_unit").$type<Unit>().notNull(),
    area: text("area").notNull(),
    perimeter: text("perimeter").notNull(),
    length: text("length"),
    breadth: text("breadth"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One plan per placement of one record: the placement key IS the identity, and a rebuilt partition
    // replaces the rows of the record it rebuilt rather than standing a second set beside them
    // (L-REG-04).
    primaryKey({ name: "placement_outlines_key", columns: [table.tenantId, table.ingestId, table.placementKey] }),
    // The geometry roster is closed, and so are the canon's units: a plan read as anything else, or in
    // a unit the canon cannot carry, cannot be written at all, however it reached the insert (B-07).
    check("placement_outlines_geometry_closed", statement`${table.geometry} in (${statement.raw(closedList(OUTLINE_GEOMETRIES))})`),
    // A length is carried in a unit of length and an area in a unit of area, each drawn from the
    // canon's own roster by the dimension it measures (B-07, B-19).
    check("placement_outlines_unit_closed", statement`${table.unit} in (${statement.raw(closedList(UNITS.filter((unit) => dimensionOf(unit) === "LENGTH")))})`),
    check("placement_outlines_area_unit_closed", statement`${table.areaUnit} in (${statement.raw(closedList(UNITS.filter((unit) => dimensionOf(unit) === "AREA")))})`),
    // A rectangle states both of its sides, and a polygon neither: half a rectangle is no plan, and a
    // polygon given a length and a breadth would be measured as the box it is not (L-FRM-02, L-FRM-04).
    check(
      "placement_outlines_sides_by_geometry",
      statement`(${table.geometry} = ${statement.raw(closedList([RECT_OUTLINE]))} and num_nonnulls(${table.length}, ${table.breadth}) = 2) or (${table.geometry} = ${statement.raw(closedList([POLY_OUTLINE]))} and num_nonnulls(${table.length}, ${table.breadth}) = 0)`,
    ),
    // The read the measure setup makes: one drawing's plans.
    index("placement_outlines_by_drawing").on(table.tenantId, table.drawingId),
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
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_PLACEMENTS_TABLES = {
  placements,
  placementOutlines,
  expansionDeferrals,
  proposedLevels,
  typicalRanges,
};
