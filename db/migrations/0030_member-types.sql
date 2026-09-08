CREATE TABLE "member_type_variants" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"schedule_key" text NOT NULL,
	"family" text NOT NULL,
	"variant_key" text NOT NULL,
	"band_text" text NOT NULL,
	"band_from" text,
	"band_to" text,
	"section_text" text NOT NULL,
	"section_width" double precision,
	"section_depth" double precision,
	"section_unit" text,
	"source_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_type_variants_key" PRIMARY KEY("tenant_id","ingest_id","schedule_key","family","variant_key"),
	CONSTRAINT "member_type_variants_section_unit_closed" CHECK ("member_type_variants"."section_unit" is null or "member_type_variants"."section_unit" in ('in', 'mm')),
	CONSTRAINT "member_type_variants_cited" CHECK (cardinality("member_type_variants"."source_keys") >= 1)
);
--> statement-breakpoint
CREATE TABLE "member_types" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"schedule_key" text NOT NULL,
	"family" text NOT NULL,
	"mark_text" text NOT NULL,
	"row_index" integer NOT NULL,
	"source_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_types_key" PRIMARY KEY("tenant_id","ingest_id","schedule_key","family"),
	CONSTRAINT "member_types_cited" CHECK (cardinality("member_types"."source_keys") >= 1)
);
--> statement-breakpoint
CREATE TABLE "rebar_zones" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"schedule_key" text NOT NULL,
	"family" text NOT NULL,
	"variant_key" text NOT NULL,
	"zone" text NOT NULL,
	"text" text NOT NULL,
	"bars" jsonb,
	"spacing" double precision,
	"spacing_unit" text,
	"spacing_bar" double precision,
	"source_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rebar_zones_key" PRIMARY KEY("tenant_id","ingest_id","schedule_key","family","variant_key","zone"),
	CONSTRAINT "rebar_zones_zone_closed" CHECK ("rebar_zones"."zone" in ('main', 'ties', 'ties-end', 'ties-mid')),
	CONSTRAINT "rebar_zones_spacing_unit_closed" CHECK ("rebar_zones"."spacing_unit" is null or "rebar_zones"."spacing_unit" in ('in', 'mm')),
	CONSTRAINT "rebar_zones_cited" CHECK (cardinality("rebar_zones"."source_keys") >= 1)
);
--> statement-breakpoint
CREATE TABLE "schedule_cells" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"schedule_key" text NOT NULL,
	"row_index" integer NOT NULL,
	"column_index" integer NOT NULL,
	"text" text NOT NULL,
	"source_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_cells_key" PRIMARY KEY("tenant_id","ingest_id","schedule_key","row_index","column_index"),
	CONSTRAINT "schedule_cells_cited" CHECK (cardinality("schedule_cells"."source_keys") >= 1)
);
--> statement-breakpoint
CREATE TABLE "schedule_deferrals" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_deferrals_key" PRIMARY KEY("tenant_id","ingest_id","view_key"),
	CONSTRAINT "schedule_deferrals_reason_closed" CHECK ("schedule_deferrals"."reason" in ('SCHEDULE_NONE_RECONSTRUCTED', 'SCHEDULE_VIEW_CONTRIBUTED_NOTHING'))
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"schedule_key" text NOT NULL,
	"title" text NOT NULL,
	"pitch" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_key" PRIMARY KEY("tenant_id","ingest_id","schedule_key"),
	CONSTRAINT "schedules_pitch_positive" CHECK ("schedules"."pitch" > 0)
);
--> statement-breakpoint
CREATE INDEX "member_type_variants_by_drawing" ON "member_type_variants" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "member_types_by_drawing" ON "member_types" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "rebar_zones_by_drawing" ON "rebar_zones" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "schedule_cells_by_drawing" ON "schedule_cells" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "schedule_deferrals_by_drawing" ON "schedule_deferrals" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "schedules_by_drawing" ON "schedules" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
--
-- All six wear the same scope as `convention_profiles`, which they are rebuilt beside: these are six
-- more tables of ONE stored partition, so a row of any of them is the workspace's own, or it is seen
-- by a system session that has recorded its reason, and by nobody else.
ALTER TABLE "schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "schedules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "schedules_tenant_scope" ON "schedules"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "schedules_system_scope" ON "schedules"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "schedule_cells" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schedule_cells" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "schedule_cells_tenant_scope" ON "schedule_cells"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "schedule_cells_system_scope" ON "schedule_cells"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "member_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_types" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_types_tenant_scope" ON "member_types"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "member_types_system_scope" ON "member_types"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "member_type_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_type_variants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_type_variants_tenant_scope" ON "member_type_variants"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "member_type_variants_system_scope" ON "member_type_variants"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "rebar_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rebar_zones" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "rebar_zones_tenant_scope" ON "rebar_zones"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "rebar_zones_system_scope" ON "rebar_zones"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "schedule_deferrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schedule_deferrals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "schedule_deferrals_tenant_scope" ON "schedule_deferrals"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "schedule_deferrals_system_scope" ON "schedule_deferrals"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- The schedules are the fourth stage of a partition that is REBUILT per ingest — these rows are
-- deleted and written again in one transaction with the views they were read off — so the app role
-- really holds a DELETE here. What makes the tables trustworthy is the scope above and the keys they
-- stand under, never an absence of privilege (R-TO-030, L-REG-04).
GRANT SELECT, INSERT, DELETE ON TABLE "schedules" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "schedule_cells" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "member_types" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "member_type_variants" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "rebar_zones" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "schedule_deferrals" TO "cubit_app";