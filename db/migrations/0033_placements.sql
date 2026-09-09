CREATE TABLE "expansion_deferrals" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expansion_deferrals_key" PRIMARY KEY("tenant_id","ingest_id","view_key"),
	CONSTRAINT "expansion_deferrals_reason_closed" CHECK ("expansion_deferrals"."reason" in ('TYPICAL_RANGE_UNSTATED', 'LEVEL_RANGE_ENDPOINT_UNMAPPED'))
);
--> statement-breakpoint
CREATE TABLE "placements" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"placement_key" text NOT NULL,
	"view_key" text NOT NULL,
	"mark" text NOT NULL,
	"mark_text" text NOT NULL,
	"element_type" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"grid_letter" text,
	"grid_numeral" text,
	"outline_key" text NOT NULL,
	"mark_key" text NOT NULL,
	"member_family" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "placements_key" PRIMARY KEY("tenant_id","ingest_id","placement_key"),
	CONSTRAINT "placements_element_type_closed" CHECK ("placements"."element_type" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel'))
);
--> statement-breakpoint
CREATE TABLE "proposed_levels" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"label" text NOT NULL,
	"ordinal" integer NOT NULL,
	"elevation" double precision NOT NULL,
	"height_as_written" text,
	"height_unit" text,
	"mark_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposed_levels_key" PRIMARY KEY("tenant_id","ingest_id","mark_key"),
	CONSTRAINT "proposed_levels_height_stated_with_unit" CHECK (num_nonnulls("proposed_levels"."height_as_written", "proposed_levels"."height_unit") <> 1)
);
--> statement-breakpoint
CREATE TABLE "typical_ranges" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"from_level_id" uuid NOT NULL,
	"to_level_id" uuid NOT NULL,
	"act_id" uuid NOT NULL,
	"authored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "typical_ranges_key" PRIMARY KEY("tenant_id","project_id","view_key")
);
--> statement-breakpoint
ALTER TABLE "typical_ranges" ADD CONSTRAINT "typical_ranges_from_level_id_levels_level_id_fk" FOREIGN KEY ("from_level_id") REFERENCES "public"."levels"("level_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "typical_ranges" ADD CONSTRAINT "typical_ranges_to_level_id_levels_level_id_fk" FOREIGN KEY ("to_level_id") REFERENCES "public"."levels"("level_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "typical_ranges" ADD CONSTRAINT "typical_ranges_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expansion_deferrals_by_drawing" ON "expansion_deferrals" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "placements_by_drawing" ON "placements" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "placements_by_view" ON "placements" USING btree ("tenant_id","ingest_id","view_key");--> statement-breakpoint
CREATE INDEX "proposed_levels_by_drawing" ON "proposed_levels" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "typical_ranges_by_project" ON "typical_ranges" USING btree ("tenant_id","project_id");--> statement-breakpoint
ALTER TABLE "placements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "placements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "placements_tenant_scope" ON "placements"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "placements_system_scope" ON "placements"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "expansion_deferrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expansion_deferrals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "expansion_deferrals_tenant_scope" ON "expansion_deferrals"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "expansion_deferrals_system_scope" ON "expansion_deferrals"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "typical_ranges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "typical_ranges" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "typical_ranges_tenant_scope" ON "typical_ranges"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "typical_ranges_system_scope" ON "typical_ranges"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "proposed_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "proposed_levels" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "proposed_levels_tenant_scope" ON "proposed_levels"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "proposed_levels_system_scope" ON "proposed_levels"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- The placements, the deferrals and the proposed levels are stages of a partition that is REBUILT
-- per ingest — those rows are deleted and written again in one transaction with the views they were
-- read off — so the app role really holds a DELETE on them. What makes them trustworthy is the scope
-- above and the keys they stand under, never an absence of privilege (R-TO-030, L-REG-04).
GRANT SELECT, INSERT, DELETE ON TABLE "placements" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "expansion_deferrals" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "proposed_levels" TO "cubit_app";--> statement-breakpoint
-- An authored range is a person's statement about a view, not a stage's derivation: a rebuild reads
-- it and never replaces it, so the app role holds neither UPDATE nor DELETE here (L-ACT-01).
GRANT SELECT, INSERT ON TABLE "typical_ranges" TO "cubit_app";