// SEAM-TENANT: the takeoff-schedules area's tables, with the closed rosters their CHECKs are written from.
//
// The ORM's table builders are a driver import and the seam's own directory is their one lawful home,
// which is why this file is a flat sibling of `schema.ts` rather than a file in a directory beneath it
// (scripts/eslint/rules/no-db-outside-seam.mjs allowlists `src/core/db.ts` and ONE level under
// `src/core/db/`, and nothing deeper). `db/schema/*.ts` is the tree drizzle-kit reads these back out of.
//
// Nothing here reaches the seam, the pools or the jobs store: those are built over the schema, so the
// dependency runs one way and no cycle is representable (ARCH-01, ARCH-02).

import { PRINTED_QUANTITY_REFUSAL_CODES, SCHEDULE_DEFERRAL_REASONS, type PrintedQuantityRefusal, type ScheduleDeferralReason } from "../errors";
import { NOTE_ACCEPTANCES, NOTE_BASIS, NOTE_KINDS, type NoteAcceptance, type NoteKind } from "../notes/law";
import { acts } from "./schema-acts";
import { closedList } from "./sql";
import { sql as statement } from "drizzle-orm";
import { check, doublePrecision, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
 * The dimensions a schedule states for a member BESIDE its section (R-TO-032, AM-06 §2): a pile's
 * diameter and its length, a foundation's depth and the level its top stands at. The names are the
 * ones the foundation methods declare their variables under, and the rails bind them by these names
 * (`MemberVariantSetup.dimensions`), so the store closes the roster the rails read (Q-07, B-17).
 *
 * An architect's schedules state two more (s-schedules I-506, I-508): the SILL an opening
 * stands on above its floor, and the THICKNESS a wall type is built to. They are appended, never
 * inserted, so the four the foundation rails bind keep their places.
 */
export const SCHEDULE_DIMENSIONS = ["depth", "dia", "length", "top", "sill", "thickness"] as const;

/** One of the four. */
export type ScheduleDimension = (typeof SCHEDULE_DIMENSIONS)[number];

/** The one of them that is a LEVEL rather than a size — the only figure that may stand below zero. */
const LEVEL_DIMENSION: ScheduleDimension = "top";

/**
 * Why a schedule view defers: the register's own narrowing to the two a schedule defers under, so
 * the column cannot hold a reason nobody registered (Q-07, riskNotes (2)). The list is the refusal
 * register's, and this CHECK is written from it — one vocabulary, two readers (B-17).
 */
export type { ScheduleDeferralReason };

/** Why a printed quantity is declared rather than simply read (s-schedules I-507): the register's own two, never a third spelling. */
export type { PrintedQuantityRefusal };

/** The one of them a disagreement with a plan is declared under — the check that it names its plan reads it. */
const DISAGREES: PrintedQuantityRefusal = "OPENING_QUANTITY_DISAGREES";

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
 * The dimensions a schedule states for one variant BESIDE its section, one row per dimension its
 * columns name: the cell verbatim, the figure it reads as, and the unit it was written in — the
 * column head's `(mm)`, or the unit the drawing declares where the head states none (I-302).
 *
 * Its own table rather than a column of the variant, for the reason `rebar_zones` is one: a schedule
 * states as many of these as it has columns for, and a column per dimension on the variant would fix
 * in the store a set the drawing decides. What a member IS and never how many stand — a schedule's
 * NOS column is corroboration read at placement and stored nowhere (R-TO-031, T-SCHED-NORULES).
 *
 * Rewritten per ingest with the variants it hangs from, in the partition's one transaction, so the
 * app role holds a DELETE here as it does on the variants (L-REG-04, R-TO-030).
 */
export const memberTypeDimensions = pgTable(
  "member_type_dimensions",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    family: text("family").notNull(),
    variantKey: text("variant_key").notNull(),
    dimension: text("dimension").$type<ScheduleDimension>().notNull(),
    text: text("text").notNull(),
    value: doublePrecision("value").notNull(),
    unit: text("unit").$type<SectionUnit>().notNull(),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "member_type_dimensions_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.family, table.variantKey, table.dimension] }),
    // The roster is closed, so the store closes it: a dimension no method declares cannot be written.
    check("member_type_dimensions_dimension_closed", statement`${table.dimension} in (${statement.raw(closedList(SCHEDULE_DIMENSIONS))})`),
    // A figure nobody gave a unit to is not a dimension anybody can carry into metres (L-MEA-01), so
    // the reader reads none and the store admits none.
    check("member_type_dimensions_unit_closed", statement`${table.unit} in (${statement.raw(closedList(SECTION_UNITS))})`),
    // A diameter, a length or a depth of nothing is no reading; only a LEVEL may stand below zero.
    check("member_type_dimensions_value_measured", statement`${table.dimension} = ${statement.raw(closedList([LEVEL_DIMENSION]))} or ${table.value} > 0`),
    check("member_type_dimensions_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("member_type_dimensions_by_drawing").on(table.tenantId, table.drawingId),
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
 * The bases an opening schedule states its quantity column on (s-schedules I-507): per floor, read
 * off a note that says so (`QUANTITY PER FLOOR`) or off a caption naming one floor, where per floor
 * and per group are one statement. A quantity whose basis nothing states has none, and is compared
 * with nothing (L-MEA-02). Spelled in the store's lower case, as its zones and dimensions are.
 */
export const PRINTED_QUANTITY_BASES = ["per-floor"] as const;

/** One of them. */
export type PrintedQuantityBasis = (typeof PRINTED_QUANTITY_BASES)[number];

/**
 * The quantity an opening schedule PRINTS for one of its rows (`08 NOS`), as a cited reading of the
 * schedule and never as a count of members (L-CAD-08, L-MEA-02; s-schedules I-507). How many of a
 * mark stand is placement's answer off the plans; this is what the schedule SAYS, kept so the two can
 * be compared and a disagreement declared rather than resolved in silence.
 *
 * Its own table, and not a row of `member_type_dimensions`: the member-type registry states what a
 * member IS, and a printed quantity filed there would be a count registered as a property of the type
 * (R-TO-031). One row per variant of an opening family — the floors the schedule's caption states.
 *
 * `basis_keys` cite what the basis was read at (the note, or the caption naming one floor);
 * `plan_key` is the one layout plan of the same floors in the same drawing the check was made
 * against, and `tag_keys` that plan's tags of this mark — the evidence of the check, never a count
 * any bill reads. `refusal` is the check's declared outcome: null where the printed quantity and the
 * plan's tags agree, or where no plan of those floors stands in the drawing to check against (then
 * `plan_key` is null too); otherwise the registered code it is declared under.
 *
 * Rewritten per ingest with the variants it stands beside, in the partition's one transaction, so the
 * app role holds a DELETE here as it does there (L-REG-04, R-TO-030).
 */
export const schedulePrintedQuantities = pgTable(
  "schedule_printed_quantities",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    scheduleKey: text("schedule_key").notNull(),
    family: text("family").notNull(),
    variantKey: text("variant_key").notNull(),
    text: text("text").notNull(),
    printed: integer("printed").notNull(),
    basis: text("basis").$type<PrintedQuantityBasis>(),
    basisKeys: text("basis_keys").array().notNull(),
    planKey: text("plan_key"),
    tagKeys: text("tag_keys").array().notNull(),
    refusal: text("refusal").$type<PrintedQuantityRefusal>(),
    sourceKeys: citedKeys(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "schedule_printed_quantities_key", columns: [table.tenantId, table.ingestId, table.scheduleKey, table.family, table.variantKey] }),
    // A schedule prints how many of a thing it lists; a negative quantity is no reading at all.
    check("schedule_printed_quantities_printed_whole", statement`${table.printed} >= 0`),
    check("schedule_printed_quantities_basis_closed", statement`${table.basis} is null or ${table.basis} in (${statement.raw(closedList(PRINTED_QUANTITY_BASES))})`),
    // A basis is read AT something, and an unstated one cites nothing (L-CAD-03).
    check("schedule_printed_quantities_basis_cited", statement`(${table.basis} is null) = (cardinality(${table.basisKeys}) = 0)`),
    // Another area's code stored here would render as this check's, so the CHECK admits the two it
    // is declared under and nothing else (Q-07).
    check("schedule_printed_quantities_refusal_closed", statement`${table.refusal} is null or ${table.refusal} in (${statement.raw(closedList(PRINTED_QUANTITY_REFUSAL_CODES))})`),
    // A disagreement is a disagreement WITH a plan: it is never declared without the plan it was read against.
    check("schedule_printed_quantities_disagreement_planned", statement`${table.refusal} is distinct from ${statement.raw(closedList([DISAGREES]))} or ${table.planKey} is not null`),
    check("schedule_printed_quantities_cited", statement`cardinality(${table.sourceKeys}) >= 1`),
    index("schedule_printed_quantities_by_drawing").on(table.tenantId, table.drawingId),
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
 * R-TO-034's transcribed half: one row per detailing figure a person read off a sheet's general
 * notes — which sheet, which figure, who read it, off which text, what they wrote, and the act that
 * carried it.
 *
 * APPEND-ONLY, like every reading (R-TO-051): a re-reading is another row under the same key and the
 * earlier one is superseded rather than rewritten, so the app role holds no UPDATE and no DELETE
 * here. Nothing stores a "current figure": how a kind stands is derived from the rows at read time
 * (`@/core/notes/standing`), because a stored current value is exactly the overwrite the law forbids.
 *
 * Keyed on (tenant, act, reading key): one act may carry several readings of one sheet, and one key
 * may be read again under a later act — what neither may do is write the same reading twice under
 * one act (L-ACT-01).
 */
export const notesReadings = pgTable(
  "notes_readings",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    layoutName: text("layout_name").notNull(),
    readingKey: text("reading_key").notNull(),
    kind: text("kind").$type<NoteKind>().notNull(),
    actorId: uuid("actor_id").notNull(),
    sourceKey: text("source_key").notNull(),
    valueAsWritten: text("value_as_written").notNull(),
    unitAsWritten: text("unit_as_written").notNull(),
    canonical: text("canonical").notNull(),
    basis: text("basis").notNull(),
    acceptance: text("acceptance").$type<NoteAcceptance>().notNull(),
    // Every reading is an act's, and the ledger says so in the schema rather than in the one code
    // path that happens to write it — the storey-height reading's own constraint (L-ACT-01, R-TO-051).
    actId: uuid("act_id")
      .notNull()
      .references(() => acts.actId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "notes_readings_key", columns: [table.tenantId, table.actId, table.readingKey] }),
    // The three rosters are closed, so the store closes them: a kind, a basis or a verdict outside
    // the law cannot be written at all, however it reached the insert (Q-07, B-19).
    check("notes_readings_kind_closed", statement`${table.kind} in (${statement.raw(closedList(NOTE_KINDS))})`),
    // L-QTY-01: a note reading is read off the drawing's own text, so it is transcribed and nothing
    // else — a basis is not a field this act has a choice about.
    check("notes_readings_basis_transcribed", statement`${table.basis} = ${statement.raw(closedList([NOTE_BASIS]))}`),
    check("notes_readings_acceptance_closed", statement`${table.acceptance} in (${statement.raw(closedList(NOTE_ACCEPTANCES))})`),
    // The read every surface makes: what has been read on THIS sheet.
    index("notes_readings_by_sheet").on(table.tenantId, table.drawingId, table.layoutName),
  ],
);

/**
 * R-TO-034's PROPOSED half, model arm: one row per clause of a sheet's general notes that the
 * deterministic grammar read nothing in and a model was asked to classify (L-AI-02 — a
 * classification held until confirmed).
 *
 * It stands beside `notes_readings` and never in it. A reading is what a PERSON kept, under an act;
 * this is an OFFER, and the only reason it is stored at all is that the act has to know what was
 * offered to judge what was kept: TRANSCRIBE_SHEET_NOTES re-derives ACCEPTED against EDITED by
 * comparing a kept figure with the offer it came from, and an offer that had to be asked again at
 * commit time would be a second ledger row for a question already answered (L-AI-01).
 *
 * REBUILT PER INGEST, like `partition_views`: the rows are deleted and written again in one
 * transaction, so this is a derived table and not a ledger, and the app role holds a DELETE on it.
 * The key is content-derived and mints nothing (L-REG-04) — a clause is the entity it stands on and
 * its place in that entity, so re-deriving the same artifact reproduces the same key multiset.
 *
 * It references no ledger, for the reason `partition_views` references none: a table rebuilt per
 * ingest may not be a child of an append-only one. `call_id` names the model call that proposed the
 * class, so every offer on a screen is answerable from the ledger row that made it (L-AI-01).
 *
 * THE FIGURE IS NOT THE MODEL'S (L-AI-03). `kind` is what the model proposed; the three figure
 * columns are the GRAMMAR's own reading of that clause under that kind, and they are null where its
 * reader reads nothing — a class with no figure behind it is stored as what it is, an offer nobody
 * can bill. `governs` is the probability the model gave that this clause's lap prevails over a
 * development-length table on the same sheet (AM-03(e)): a proposition presented, never a standing.
 */
export const noteClauseProposals = pgTable(
  "note_clause_proposals",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    drawingId: uuid("drawing_id").notNull(),
    ingestId: uuid("ingest_id").notNull(),
    layoutName: text("layout_name").notNull(),
    sourceKey: text("source_key").notNull(),
    /** Which clause of that entity this is, counting from one in the drawing's own order. */
    ordinal: integer("ordinal").notNull(),
    /** The clause verbatim, as the evidence the offer rests on (L-CAD-03). */
    clause: text("clause").notNull(),
    /** The class a model proposed, or null where it read none of the five in the clause. */
    kind: text("kind").$type<NoteKind>(),
    valueAsWritten: text("value_as_written"),
    unitAsWritten: text("unit_as_written"),
    canonical: text("canonical"),
    /** The Noul's own probability, exactly as it was stated — never a float (L-AI-01). */
    governs: numeric("governs"),
    callId: uuid("call_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "note_clause_proposals_key", columns: [table.tenantId, table.ingestId, table.sourceKey, table.ordinal] }),
    // The roster is closed, so the store closes it: a class outside R-TO-034's five cannot be
    // written however it reached the insert, and a clause nobody could class is null (Q-07, B-19).
    check("note_clause_proposals_kind_closed", statement`${table.kind} is null or ${table.kind} in (${statement.raw(closedList(NOTE_KINDS))})`),
    // A figure is whole or it is absent: the three columns are one reading of the grammar's, and
    // two of three would be a figure nobody could compare (L-REG-01).
    check(
      "note_clause_proposals_figure_whole",
      statement`(${table.canonical} is null) = (${table.valueAsWritten} is null) and (${table.canonical} is null) = (${table.unitAsWritten} is null)`,
    ),
    // A figure with no class behind it is a number this product would have invented (L-MEA-01).
    check("note_clause_proposals_figure_classed", statement`${table.canonical} is null or ${table.kind} is not null`),
    // A probability is a probability. A figure outside [0,1] is not a judgment anybody can read.
    check("note_clause_proposals_governs_is_probability", statement`${table.governs} is null or (${table.governs} >= 0 and ${table.governs} <= 1)`),
    // An offer cites the clause it was made about, and a blank clause is evidence of nothing.
    check("note_clause_proposals_clause_said", statement`length(btrim(${table.clause})) > 0`),
    // The read the screen and the act seam make: what was offered on THIS sheet.
    index("note_clause_proposals_by_sheet").on(table.tenantId, table.drawingId, table.layoutName),
  ],
);

/**
 * Every table this area publishes. `schema.ts` spreads it into `SEAM_SCHEMA`, so a table added to
 * this file joins the typed surface without a second roster being edited (B-19, AM-11).
 */
export const TAKEOFF_SCHEDULES_TABLES = {
  schedules,
  scheduleCells,
  memberTypes,
  memberTypeVariants,
  memberTypeDimensions,
  rebarZones,
  scheduleDeferrals,
  schedulePrintedQuantities,
  notesReadings,
  noteClauseProposals,
};
