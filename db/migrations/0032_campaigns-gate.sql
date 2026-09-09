CREATE TABLE "campaigns" (
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"edition_digest" text NOT NULL,
	"catalogue_digest" text NOT NULL,
	"level_stack_digest" text NOT NULL,
	"status" text NOT NULL,
	"act_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_one_per_revision" UNIQUE("tenant_id","set_revision_id"),
	CONSTRAINT "campaigns_status_closed" CHECK ("campaigns"."status" in ('OPEN'))
);
--> statement-breakpoint
CREATE TABLE "quantity_lines" (
	"tenant_id" uuid NOT NULL,
	"line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"drawing_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"class" text NOT NULL,
	"kind" text NOT NULL,
	"rule_id" text NOT NULL,
	"rule_version" text NOT NULL,
	"edition_digest" text NOT NULL,
	"engine" text NOT NULL,
	"quantity_basis" text NOT NULL,
	"coverage" text NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"formula" text NOT NULL,
	"bindings" json NOT NULL,
	"selectors" json NOT NULL,
	"deductions" json NOT NULL,
	"calibration_keys" json NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quantity_lines_one_per_object_kind" UNIQUE("tenant_id","campaign_id","object_key","kind"),
	CONSTRAINT "quantity_lines_class_closed" CHECK ("quantity_lines"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel')),
	CONSTRAINT "quantity_lines_kind_closed" CHECK ("quantity_lines"."kind" in ('rcc.concrete')),
	CONSTRAINT "quantity_lines_engine_closed" CHECK ("quantity_lines"."engine" in ('VECTOR', 'RASTER')),
	CONSTRAINT "quantity_lines_basis_closed" CHECK ("quantity_lines"."quantity_basis" in ('MEASURED', 'DERIVED', 'INTERPRETED')),
	CONSTRAINT "quantity_lines_coverage_closed" CHECK ("quantity_lines"."coverage" in ('COMPLETE')),
	CONSTRAINT "quantity_lines_unit_closed" CHECK ("quantity_lines"."unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'ft', 'm2', 'sft', 'pcs'))
);
--> statement-breakpoint
CREATE TABLE "queue_items" (
	"tenant_id" uuid NOT NULL,
	"queue_item_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"kind" text NOT NULL,
	"cause" text NOT NULL,
	"detail" json,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queue_items_one_per_object_kind" UNIQUE("tenant_id","campaign_id","object_key","kind"),
	CONSTRAINT "queue_items_kind_closed" CHECK ("queue_items"."kind" in ('rcc.concrete')),
	CONSTRAINT "queue_items_cause_closed" CHECK ("queue_items"."cause" in ('INTERPRETED_UNCORROBORATED'))
);
--> statement-breakpoint
CREATE TABLE "rail_observations" (
	"tenant_id" uuid NOT NULL,
	"observation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"class" text NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"object_key" text,
	"source_entity" text,
	"observation_key" text NOT NULL,
	"detail" json,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rail_observations_once_per_campaign" UNIQUE("tenant_id","campaign_id","observation_key"),
	CONSTRAINT "rail_observations_class_closed" CHECK ("rail_observations"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel')),
	CONSTRAINT "rail_observations_kind_closed" CHECK ("rail_observations"."kind" in ('rcc.concrete'))
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_set_revision_id_drawing_set_revisions_set_revision_id_fk" FOREIGN KEY ("set_revision_id") REFERENCES "public"."drawing_set_revisions"("set_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_by_project" ON "campaigns" USING btree ("tenant_id","project_id","opened_at");--> statement-breakpoint
CREATE INDEX "quantity_lines_by_campaign" ON "quantity_lines" USING btree ("tenant_id","campaign_id","published_at");--> statement-breakpoint
CREATE INDEX "queue_items_by_campaign" ON "queue_items" USING btree ("tenant_id","campaign_id","queued_at");--> statement-breakpoint
CREATE INDEX "rail_observations_by_campaign" ON "rail_observations" USING btree ("tenant_id","campaign_id","observed_at");--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaigns" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "campaigns_tenant_scope" ON "campaigns"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "campaigns_system_scope" ON "campaigns"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "quantity_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quantity_lines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "quantity_lines_tenant_scope" ON "quantity_lines"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "quantity_lines_system_scope" ON "quantity_lines"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "rail_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rail_observations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "rail_observations_tenant_scope" ON "rail_observations"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "rail_observations_system_scope" ON "rail_observations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "queue_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "queue_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "queue_items_tenant_scope" ON "queue_items"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "queue_items_system_scope" ON "queue_items"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- L-REG-07: "campaign creation copies onto the campaign, IMMUTABLY: the rule-set edition key, the
-- work-item catalogue digest and the level-stack digest". Immutability is the store's posture, not a
-- writer's habit: the runtime role opens a campaign and reads one, and holds no UPDATE and no DELETE
-- on it, so a snapshot cannot be rewritten by any code path that runs under it.
GRANT SELECT, INSERT ON TABLE "campaigns" TO "cubit_app";--> statement-breakpoint
-- SEAM-GATE: the gate is the sole writer of quantity lines and rail observations (L-MEA-08), and it
-- writes through this role. A published line, an observation and a queue item are RECORDS of what was
-- measured, deferred and seen (L-QTY-03, L-QTY-04) — so the role adds them and reads them, and there
-- is no privilege under which one is edited or taken away. A re-measure is idempotent on the natural
-- key rather than an overwrite.
GRANT SELECT, INSERT ON TABLE "quantity_lines" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "rail_observations" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "queue_items" TO "cubit_app";
--> statement-breakpoint
-- L-ACT-03's owner-proof belt: an immutability the owner escapes is not an immutability. The campaign's
-- snapshot is immutable (L-REG-07) and a line, an observation and a queue item are records of what was
-- measured, seen and deferred (L-QTY-03, L-QTY-04) — so the refusal is the store's, and it refuses the
-- owning role too. The function is the tree's one spelling of the rule (0001_act-log.sql's
-- "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "campaigns_append_only" BEFORE UPDATE OR DELETE ON "campaigns"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "campaigns_append_only_truncate" BEFORE TRUNCATE ON "campaigns"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "quantity_lines_append_only" BEFORE UPDATE OR DELETE ON "quantity_lines"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "quantity_lines_append_only_truncate" BEFORE TRUNCATE ON "quantity_lines"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "rail_observations_append_only" BEFORE UPDATE OR DELETE ON "rail_observations"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "rail_observations_append_only_truncate" BEFORE TRUNCATE ON "rail_observations"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "queue_items_append_only" BEFORE UPDATE OR DELETE ON "queue_items"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "queue_items_append_only_truncate" BEFORE TRUNCATE ON "queue_items"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();
