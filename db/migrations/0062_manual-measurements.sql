CREATE TABLE "conditions" (
	"tenant_id" uuid NOT NULL,
	"condition_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"geometry" text NOT NULL,
	"element_class" text NOT NULL,
	"kinds" json NOT NULL,
	"readings" json NOT NULL,
	"colour" text NOT NULL,
	"hatch" text NOT NULL,
	"authored_by" uuid NOT NULL,
	"authored_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_by" uuid,
	"retired_at" timestamp with time zone,
	CONSTRAINT "conditions_scoped_key" UNIQUE("tenant_id","project_id","condition_id"),
	CONSTRAINT "conditions_geometry_closed" CHECK ("conditions"."geometry" in ('POLYGON', 'POLYLINE', 'POINT_SET')),
	CONSTRAINT "conditions_element_class_closed" CHECK ("conditions"."element_class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface')),
	CONSTRAINT "conditions_colour_closed" CHECK ("conditions"."colour" in ('beam', 'column', 'footing', 'generic', 'opening', 'rebar', 'slab', 'wall')),
	CONSTRAINT "conditions_hatch_closed" CHECK ("conditions"."hatch" in ('solid', 'diagonal', 'cross', 'dots', 'horizontal', 'vertical')),
	CONSTRAINT "conditions_name_stated" CHECK (length(btrim("conditions"."name")) > 0),
	CONSTRAINT "conditions_retired_whole" CHECK (("conditions"."retired_at" is null) = ("conditions"."retired_by" is null))
);
--> statement-breakpoint
CREATE TABLE "manual_measurements" (
	"tenant_id" uuid NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"project_id" uuid NOT NULL,
	"act_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"layout_name" text NOT NULL,
	"partition_view_key" text NOT NULL,
	"view_key" text NOT NULL,
	"condition_id" uuid,
	"condition_name" text NOT NULL,
	"geometry" text NOT NULL,
	"element_class" text NOT NULL,
	"kinds" json NOT NULL,
	"readings" json NOT NULL,
	"level_id" uuid,
	"level_slot" text,
	"traced" json NOT NULL,
	"figure" json NOT NULL,
	"drawn_unit" text NOT NULL,
	"figure_unit" text NOT NULL,
	"calibration_key" text NOT NULL,
	"supersedes" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_measurements_key" PRIMARY KEY("tenant_id","set_revision_id","object_key"),
	CONSTRAINT "manual_measurements_geometry_closed" CHECK ("manual_measurements"."geometry" in ('POLYGON', 'POLYLINE', 'POINT_SET')),
	CONSTRAINT "manual_measurements_element_class_closed" CHECK ("manual_measurements"."element_class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface')),
	CONSTRAINT "manual_measurements_drawn_unit_closed" CHECK ("manual_measurements"."drawn_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'cm2', 'sft', 'pcs')),
	CONSTRAINT "manual_measurements_figure_unit_closed" CHECK ("manual_measurements"."figure_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'cm2', 'sft', 'pcs')),
	CONSTRAINT "manual_measurements_level_slot_closed" CHECK ("manual_measurements"."level_slot" is null or "manual_measurements"."level_slot" in ('FOUNDATION')),
	CONSTRAINT "manual_measurements_level_stated_once" CHECK (num_nonnulls("manual_measurements"."level_id", "manual_measurements"."level_slot") = 1),
	CONSTRAINT "manual_measurements_condition_named" CHECK (length(btrim("manual_measurements"."condition_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_measurements" ADD CONSTRAINT "manual_measurements_set_revision_id_drawing_set_revisions_set_revision_id_fk" FOREIGN KEY ("set_revision_id") REFERENCES "public"."drawing_set_revisions"("set_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_measurements" ADD CONSTRAINT "manual_measurements_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_measurements" ADD CONSTRAINT "manual_measurements_object_fk" FOREIGN KEY ("tenant_id","set_revision_id","object_key") REFERENCES "public"."register_objects"("tenant_id","set_revision_id","object_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_measurements" ADD CONSTRAINT "manual_measurements_condition_fk" FOREIGN KEY ("tenant_id","project_id","condition_id") REFERENCES "public"."conditions"("tenant_id","project_id","condition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conditions_standing_name_once" ON "conditions" USING btree ("tenant_id","project_id","name") WHERE "conditions"."retired_at" is null;--> statement-breakpoint
CREATE INDEX "conditions_by_project" ON "conditions" USING btree ("tenant_id","project_id","authored_at");--> statement-breakpoint
CREATE INDEX "manual_measurements_by_revision" ON "manual_measurements" USING btree ("tenant_id","set_revision_id","recorded_at");--> statement-breakpoint
-- hand-written (session 8, S1): RLS, grants and the owner-proof triggers of `conditions` and `manual_measurements`
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write. It adds TWO tables and touches no
-- other: nothing standing before it moves, and there is nothing to backfill.
--
-- Both tables are a workspace's own rows, so both wear the posture every tenant table wears: row-level
-- security ENABLED and FORCED, the tenant scope every statement of a tenant's own session satisfies,
-- and the system scope a named reason opens for the platform's own work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "conditions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "conditions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "conditions_tenant_scope" ON "conditions"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "conditions_system_scope" ON "conditions"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "manual_measurements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "manual_measurements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "manual_measurements_tenant_scope" ON "manual_measurements"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "manual_measurements_system_scope" ON "manual_measurements"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A condition is authored data (I-374): a person names it, edits it and retires it, so the runtime role
-- reads, adds and updates — and never takes one away, because a measurement cites the condition it
-- was applied from and that citation stays readable.
GRANT SELECT, INSERT, UPDATE ON TABLE "conditions" TO "cubit_app";--> statement-breakpoint
-- A hand measurement is a record of an act (L-ACT-01): read and added, never rewritten and never
-- taken away. An edit is a new measurement superseding this one, a delete is REPUDIATE (I-379).
GRANT SELECT, INSERT ON TABLE "manual_measurements" TO "cubit_app";--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the rule
-- (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "manual_measurements_append_only" BEFORE UPDATE OR DELETE ON "manual_measurements"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "manual_measurements_append_only_truncate" BEFORE TRUNCATE ON "manual_measurements"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "conditions_never_taken_away" BEFORE DELETE ON "conditions"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "conditions_never_taken_away_truncate" BEFORE TRUNCATE ON "conditions"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();
