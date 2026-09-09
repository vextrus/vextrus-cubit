DROP INDEX "register_observations_by_attribute";--> statement-breakpoint
ALTER TABLE "register_observations" ADD COLUMN "append_seq" bigserial NOT NULL;--> statement-breakpoint
-- A `bigserial` added to a table numbers the rows already standing in it in the heap's own scan
-- order, which is not the order they were appended in. The order those readings were READ in until
-- this column existed — `observed_at`, settled by `observation_id` — is the order the store now
-- reads through it, and a standing reading may not change which value a register reports because a
-- rewrite happened to meet its row first (L-REG-01). So the order is written into the column here
-- rather than left to the rewrite, and the sequence is moved past the last number handed out.
UPDATE "register_observations" AS o
SET "append_seq" = ordered."seq"
FROM (SELECT "observation_id", row_number() OVER (ORDER BY "observed_at", "observation_id") AS "seq" FROM "register_observations") AS ordered
WHERE o."observation_id" = ordered."observation_id";--> statement-breakpoint
SELECT setval('register_observations_append_seq_seq', coalesce((SELECT max("append_seq") FROM "register_observations"), 0) + 1, false);--> statement-breakpoint
CREATE INDEX "register_observations_by_attribute" ON "register_observations" USING btree ("tenant_id","set_revision_id","object_key","attribute","append_seq");--> statement-breakpoint
-- The runtime role inserts readings, and the number in the append order is handed out by the
-- column's own sequence: without USAGE on it the insert refuses (SEAM-TENANT grants the runtime
-- exactly what it writes with, and nothing more).
GRANT USAGE ON SEQUENCE "register_observations_append_seq_seq" TO "cubit_app";