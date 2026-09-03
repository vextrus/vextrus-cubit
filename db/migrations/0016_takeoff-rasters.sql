CREATE TABLE "sheet_rasters" (
	"tenant_id" uuid NOT NULL,
	"raster_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingest_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"layout_name" text NOT NULL,
	"tier" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sheet_rasters_tier_closed" CHECK ("sheet_rasters"."tier" in ('thumb', 'preview', 'full'))
);
--> statement-breakpoint
ALTER TABLE "sheet_rasters" ADD CONSTRAINT "sheet_rasters_ingest_id_ingests_ingest_id_fk" FOREIGN KEY ("ingest_id") REFERENCES "public"."ingests"("ingest_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_rasters" ADD CONSTRAINT "sheet_rasters_drawing_id_drawings_drawing_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("drawing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sheet_rasters_once" ON "sheet_rasters" USING btree ("tenant_id","ingest_id","layout_name","tier");--> statement-breakpoint
CREATE INDEX "sheet_rasters_by_drawing" ON "sheet_rasters" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "sheet_rasters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "sheet_rasters" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sheet_rasters_tenant_scope" ON "sheet_rasters"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "sheet_rasters_system_scope" ON "sheet_rasters"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A raster is evidence of what a revision looked like (R-SPINE-022, R-SPINE-021): the app role adds
-- rows and reads them, and holds no privilege that writes one away.
GRANT SELECT, INSERT ON TABLE "sheet_rasters" TO "cubit_app";
--> statement-breakpoint
-- The same owner-proof belt every other ledger wears (L-ACT-03's reading): the trigger refuses the
-- owner too, because a guarantee the owner escapes is not a guarantee. The function is the tree's
-- one spelling of the rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "sheet_rasters_append_only" BEFORE UPDATE OR DELETE ON "sheet_rasters"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "sheet_rasters_append_only_truncate" BEFORE TRUNCATE ON "sheet_rasters"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();