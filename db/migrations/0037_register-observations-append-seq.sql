DROP INDEX "register_observations_by_attribute";--> statement-breakpoint
ALTER TABLE "register_observations" ADD COLUMN "append_seq" bigserial NOT NULL;--> statement-breakpoint
CREATE INDEX "register_observations_by_attribute" ON "register_observations" USING btree ("tenant_id","set_revision_id","object_key","attribute","append_seq");--> statement-breakpoint
-- The runtime role inserts readings, and the number in the append order is handed out by the
-- column's own sequence: without USAGE on it the insert refuses (SEAM-TENANT grants the runtime
-- exactly what it writes with, and nothing more).
GRANT USAGE ON SEQUENCE "register_observations_append_seq_seq" TO "cubit_app";