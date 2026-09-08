CREATE TABLE "calibrations" (
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"factor_x" text NOT NULL,
	"factor_y" text NOT NULL,
	"act_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calibrations_key" PRIMARY KEY("tenant_id","key"),
	CONSTRAINT "calibrations_key_shape" CHECK ("calibrations"."key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "calibrations_factor_x_shape" CHECK ("calibrations"."factor_x" ~ '^[0-9]+\.[0-9]{12}$' and "calibrations"."factor_x"::numeric > 0),
	CONSTRAINT "calibrations_factor_y_shape" CHECK ("calibrations"."factor_y" ~ '^[0-9]+\.[0-9]{12}$' and "calibrations"."factor_y"::numeric > 0)
);
--> statement-breakpoint
CREATE TABLE "scale_affirmations" (
	"tenant_id" uuid NOT NULL,
	"affirmation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"rank" text NOT NULL,
	"view_keys" text[] NOT NULL,
	"incoming_keys" text[] NOT NULL,
	"outgoing_keys" text[] NOT NULL,
	"source_keys" text[] NOT NULL,
	"observations" json NOT NULL,
	"supersedes" uuid,
	"act_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scale_affirmations_rank_closed" CHECK ("scale_affirmations"."rank" in ('QS_TWO_POINT', 'GRID_SPACING', 'DIMENSION_RATIO', 'FILE_UNITS'))
);
--> statement-breakpoint
CREATE INDEX "calibrations_by_ingest" ON "calibrations" USING btree ("tenant_id","ingest_id");--> statement-breakpoint
CREATE INDEX "calibrations_by_drawing" ON "calibrations" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "scale_affirmations_by_ingest" ON "scale_affirmations" USING btree ("tenant_id","ingest_id","created_at");--> statement-breakpoint
CREATE INDEX "scale_affirmations_by_drawing" ON "scale_affirmations" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "scale_affirmations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "scale_affirmations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "scale_affirmations_tenant_scope" ON "scale_affirmations"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "scale_affirmations_system_scope" ON "scale_affirmations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- An affirmation is a human act's own state change (L-ACT-01, L-MEA-05): the app role appends rows
-- and reads them, and holds no privilege that writes one away — re-scaling is a later act.
GRANT SELECT, INSERT ON TABLE "scale_affirmations" TO "cubit_app";--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the
-- rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "scale_affirmations_append_only" BEFORE UPDATE OR DELETE ON "scale_affirmations"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "scale_affirmations_append_only_truncate" BEFORE TRUNCATE ON "scale_affirmations"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
ALTER TABLE "calibrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "calibrations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "calibrations_tenant_scope" ON "calibrations"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "calibrations_system_scope" ON "calibrations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A calibration is what an affirmation filed, content-addressed (L-MEA-05): the app role appends
-- and reads, and a calibration once filed is never rewritten — the same reading is the same row.
GRANT SELECT, INSERT ON TABLE "calibrations" TO "cubit_app";--> statement-breakpoint
CREATE TRIGGER "calibrations_append_only" BEFORE UPDATE OR DELETE ON "calibrations"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "calibrations_append_only_truncate" BEFORE TRUNCATE ON "calibrations"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();
