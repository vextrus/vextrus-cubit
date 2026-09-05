DROP INDEX "drawing_set_revisions_by_set";--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" ADD COLUMN "seq" bigserial NOT NULL;--> statement-breakpoint
CREATE INDEX "drawing_set_revisions_by_set" ON "drawing_set_revisions" USING btree ("tenant_id","set_id","created_at","seq");--> statement-breakpoint
GRANT USAGE ON SEQUENCE "drawing_set_revisions_seq_seq" TO "cubit_app";
