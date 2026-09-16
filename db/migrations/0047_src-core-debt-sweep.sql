ALTER TABLE "work_items" DROP CONSTRAINT "work_items_unit_closed";--> statement-breakpoint
ALTER TABLE "register_objects" DROP CONSTRAINT "register_objects_level_stated_once";--> statement-breakpoint
ALTER TABLE "register_observations" DROP CONSTRAINT "register_observations_unit_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_unit_closed";--> statement-breakpoint
ALTER TABLE "placement_runs" DROP CONSTRAINT "placement_runs_clear_unit_closed";--> statement-breakpoint
ALTER TABLE "placement_runs" DROP CONSTRAINT "placement_runs_side_a_unit_closed";--> statement-breakpoint
ALTER TABLE "placement_runs" DROP CONSTRAINT "placement_runs_side_b_unit_closed";--> statement-breakpoint
-- A calibration is the content address of what it says — the view key and the two factors — so a
-- column its key does not cover stamps the first act's record on a row every later act naming the
-- same reading shares (L-MEA-05). The record scope is `scale_affirmations`', and the reads that
-- scoped calibrations by record go with the columns they were over.
DROP INDEX "calibrations_by_ingest";--> statement-breakpoint
DROP INDEX "calibrations_by_drawing";--> statement-breakpoint
ALTER TABLE "scale_affirmations" ADD COLUMN "append_seq" bigserial NOT NULL;--> statement-breakpoint
-- A `bigserial` added to a table numbers the rows already standing in it in the heap's own scan
-- order, which is not the order they were appended in. The order these three ledgers were READ in
-- until this column existed is the order the store now reads through it, so a standing row may not
-- change which answer the product gives because a rewrite happened to meet it first (L-REG-04). The
-- order is written into the column here rather than left to the rewrite, and each sequence is moved
-- past the last number handed out (0037's pattern).
UPDATE "scale_affirmations" AS a
SET "append_seq" = ordered."seq"
FROM (SELECT "affirmation_id", row_number() OVER (ORDER BY "created_at", "affirmation_id") AS "seq" FROM "scale_affirmations") AS ordered
WHERE a."affirmation_id" = ordered."affirmation_id";--> statement-breakpoint
SELECT setval('scale_affirmations_append_seq_seq', coalesce((SELECT max("append_seq") FROM "scale_affirmations"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" ADD COLUMN "append_seq" bigserial NOT NULL;--> statement-breakpoint
UPDATE "drawing_set_revisions" AS r
SET "append_seq" = ordered."seq"
FROM (SELECT "set_revision_id", row_number() OVER (ORDER BY "created_at", "set_revision_id") AS "seq" FROM "drawing_set_revisions") AS ordered
WHERE r."set_revision_id" = ordered."set_revision_id";--> statement-breakpoint
SELECT setval('drawing_set_revisions_append_seq_seq', coalesce((SELECT max("append_seq") FROM "drawing_set_revisions"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "storey_height_readings" ADD COLUMN "append_seq" bigserial NOT NULL;--> statement-breakpoint
UPDATE "storey_height_readings" AS h
SET "append_seq" = ordered."seq"
FROM (SELECT "reading_id", row_number() OVER (ORDER BY "read_at", "reading_id") AS "seq" FROM "storey_height_readings") AS ordered
WHERE h."reading_id" = ordered."reading_id";--> statement-breakpoint
SELECT setval('storey_height_readings_append_seq_seq', coalesce((SELECT max("append_seq") FROM "storey_height_readings"), 0) + 1, false);--> statement-breakpoint
-- The runtime role appends to all three ledgers, and the number in the append order is handed out by
-- the column's own sequence: without USAGE on it every insert the app role makes refuses
-- (SEAM-TENANT grants the runtime exactly what it writes with, and nothing more).
GRANT USAGE ON SEQUENCE "scale_affirmations_append_seq_seq" TO "cubit_app";--> statement-breakpoint
GRANT USAGE ON SEQUENCE "drawing_set_revisions_append_seq_seq" TO "cubit_app";--> statement-breakpoint
GRANT USAGE ON SEQUENCE "storey_height_readings_append_seq_seq" TO "cubit_app";--> statement-breakpoint
ALTER TABLE "calibrations" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "calibrations" DROP COLUMN "drawing_id";--> statement-breakpoint
ALTER TABLE "calibrations" DROP COLUMN "ingest_id";--> statement-breakpoint
ALTER TABLE "calibrations" DROP COLUMN "act_id";--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_unit_closed" CHECK ("work_items"."canonical_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'cm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_level_stated_once" CHECK (num_nonnulls("register_objects"."level_id", "register_objects"."level_slot", "register_objects"."level_label") = 1 and "register_objects"."object_key" = "register_objects"."placement_key" || case when "register_objects"."level_id" is not null then '@' || "register_objects"."level_id"::text when "register_objects"."level_slot" is not null then '@' || "register_objects"."level_slot" when "register_objects"."level_label" is not null then '@unregistered:' || "register_objects"."level_label" end);--> statement-breakpoint
ALTER TABLE "register_observations" ADD CONSTRAINT "register_observations_unit_closed" CHECK ("register_observations"."canonical_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'cm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_unit_closed" CHECK ("quantity_lines"."unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'cm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "placement_runs" ADD CONSTRAINT "placement_runs_clear_unit_closed" CHECK ("placement_runs"."clear_unit" is null or "placement_runs"."clear_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'cm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "placement_runs" ADD CONSTRAINT "placement_runs_side_a_unit_closed" CHECK ("placement_runs"."side_a_unit" is null or "placement_runs"."side_a_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'cm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "placement_runs" ADD CONSTRAINT "placement_runs_side_b_unit_closed" CHECK ("placement_runs"."side_b_unit" is null or "placement_runs"."side_b_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'cm2', 'sft', 'pcs'));