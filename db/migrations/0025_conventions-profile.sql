CREATE TABLE "convention_profiles" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"rule_version" text NOT NULL,
	"profile" json NOT NULL,
	"census" json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "convention_profiles_key" PRIMARY KEY("tenant_id","ingest_id")
);
--> statement-breakpoint
CREATE INDEX "convention_profiles_by_drawing" ON "convention_profiles" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "convention_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "convention_profiles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "convention_profiles_tenant_scope" ON "convention_profiles"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "convention_profiles_system_scope" ON "convention_profiles"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- The profile is the second stage of a partition that is REBUILT per ingest — its row is deleted and
-- written again in one transaction with the views it was resolved beside — so the app role really
-- holds a DELETE here. What makes the table trustworthy is the scope above and the key it stands
-- under, never an absence of privilege (R-TO-030, L-REG-04).
GRANT SELECT, INSERT, DELETE ON TABLE "convention_profiles" TO "cubit_app";