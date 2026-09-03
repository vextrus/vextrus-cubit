CREATE TABLE "ingests" (
	"tenant_id" uuid NOT NULL,
	"ingest_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drawing_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"job_id" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"extractor_scheme" text NOT NULL,
	"extractor_tool" text NOT NULL,
	"extractor_tool_version" text NOT NULL,
	"extractor_parameter_set_hash" text NOT NULL,
	"facts" json NOT NULL,
	"supersedes_ingest_id" uuid,
	"declared_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingests_extractor_scheme_closed" CHECK ("ingests"."extractor_scheme" in ('DXF_HANDLE'))
);
--> statement-breakpoint
ALTER TABLE "ingests" ADD CONSTRAINT "ingests_drawing_id_drawings_drawing_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("drawing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingests_job_once" ON "ingests" USING btree ("tenant_id","job_id");--> statement-breakpoint
CREATE INDEX "ingests_by_drawing" ON "ingests" USING btree ("tenant_id","drawing_id","created_at");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "ingests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "ingests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ingests_tenant_scope" ON "ingests"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "ingests_system_scope" ON "ingests"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- An ingest record is evidence (R-TO-001): it pins which extractor took which geometry out of which
-- bytes, so the app role adds rows and reads them, and holds no privilege that writes one away.
GRANT SELECT, INSERT ON TABLE "ingests" TO "cubit_app";
--> statement-breakpoint
-- The same owner-proof belt every other ledger wears (L-ACT-03's reading): the trigger refuses the
-- owner too, because a guarantee the owner escapes is not a guarantee. The function is the tree's
-- one spelling of the rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "ingests_append_only" BEFORE UPDATE OR DELETE ON "ingests"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "ingests_append_only_truncate" BEFORE TRUNCATE ON "ingests"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();