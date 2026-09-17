CREATE TABLE "partition_rebuilds" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"rebuilt_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partition_rebuilds_key" PRIMARY KEY("tenant_id","ingest_id")
);
--> statement-breakpoint
CREATE INDEX "partition_rebuilds_by_drawing" ON "partition_rebuilds" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "partition_rebuilds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "partition_rebuilds" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "partition_rebuilds_tenant_scope" ON "partition_rebuilds"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "partition_rebuilds_system_scope" ON "partition_rebuilds"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- The row says a partition was rebuilt for this record, and a partition is REBUILT per ingest — the
-- row is deleted and written again in one transaction with the views it stands beside — so the app
-- role holds a DELETE here, exactly as it does on `convention_profiles` (R-TO-030, L-REG-04).
GRANT SELECT, INSERT, DELETE ON TABLE "partition_rebuilds" TO "cubit_app";
