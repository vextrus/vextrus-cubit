CREATE TABLE "validation_observations" (
	"tenant_id" uuid NOT NULL,
	"observation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"fixture_id" text NOT NULL,
	"engine" text NOT NULL,
	"class" text NOT NULL,
	"kind" text NOT NULL,
	"verdict" text NOT NULL,
	"ruleset_edition" text NOT NULL,
	"edition_digest" text NOT NULL,
	"method_hash" text NOT NULL,
	"converter_version" text NOT NULL,
	"provenance" text NOT NULL,
	"levels" jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validation_observations_engine_closed" CHECK ("validation_observations"."engine" in ('VECTOR', 'RASTER')),
	CONSTRAINT "validation_observations_verdict_closed" CHECK ("validation_observations"."verdict" in ('PASS', 'UNDER', 'OVER')),
	CONSTRAINT "validation_observations_provenance_closed" CHECK ("validation_observations"."provenance" in ('HAND_FROM_RENDER', 'HAND_FROM_AUTHORED_SOURCE', 'INDEPENDENT_HUMAN_TAKEOFF'))
);
--> statement-breakpoint
CREATE INDEX "validation_observations_by_cell" ON "validation_observations" USING btree ("tenant_id","project_id","engine","class","kind");
--> statement-breakpoint
-- hand-written: RLS, grants, append-only (SEAM-TENANT, R-TO-035)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "validation_observations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "validation_observations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "validation_observations_tenant_scope" ON "validation_observations"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "validation_observations_system_scope" ON "validation_observations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);
--> statement-breakpoint
-- R-TO-035: a validation observation is EVIDENCE — "readable forever and never deleted". The
-- application role appends and reads and holds neither UPDATE nor DELETE, and the trigger pair holds
-- the OWNER to the same rule, because a ledger the owner escapes is not a ledger (L-ACT-03, the
-- reading 0001 set for the act log). The function is the one the act log already installed.
CREATE TRIGGER "validation_observations_append_only" BEFORE UPDATE OR DELETE ON "validation_observations"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();
--> statement-breakpoint
CREATE TRIGGER "validation_observations_append_only_truncate" BEFORE TRUNCATE ON "validation_observations"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "validation_observations" TO "cubit_app";