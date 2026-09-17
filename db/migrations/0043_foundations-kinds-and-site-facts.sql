CREATE TABLE "site_facts" (
	"tenant_id" uuid NOT NULL,
	"site_fact_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"fact" text NOT NULL,
	"value_as_written" text NOT NULL,
	"unit_as_written" text NOT NULL,
	"canonical_metres" text NOT NULL,
	"factor" text NOT NULL,
	"source_note" text NOT NULL,
	"act_id" uuid NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_facts_fact_closed" CHECK ("site_facts"."fact" in ('GROUND_LEVEL', 'WATER_TABLE', 'WORKING_ALLOWANCE', 'DEPTH_EXTRA', 'BLINDING_PROJECTION', 'BLINDING_THICKNESS'))
);
--> statement-breakpoint
ALTER TABLE "work_items" DROP CONSTRAINT "work_items_kind_closed";--> statement-breakpoint
ALTER TABLE "work_items" DROP CONSTRAINT "work_items_unit_closed";--> statement-breakpoint
ALTER TABLE "register_observations" DROP CONSTRAINT "register_observations_unit_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_kind_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_unit_closed";--> statement-breakpoint
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_kind_closed";--> statement-breakpoint
ALTER TABLE "rail_observations" DROP CONSTRAINT "rail_observations_kind_closed";--> statement-breakpoint
ALTER TABLE "scope_declarations" DROP CONSTRAINT "scope_declarations_kind_closed";--> statement-breakpoint
ALTER TABLE "placement_runs" DROP CONSTRAINT "placement_runs_clear_unit_closed";--> statement-breakpoint
ALTER TABLE "placement_runs" DROP CONSTRAINT "placement_runs_side_a_unit_closed";--> statement-breakpoint
ALTER TABLE "placement_runs" DROP CONSTRAINT "placement_runs_side_b_unit_closed";--> statement-breakpoint
ALTER TABLE "site_facts" ADD CONSTRAINT "site_facts_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_facts" ADD CONSTRAINT "site_facts_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_facts_by_project" ON "site_facts" USING btree ("tenant_id","project_id","entered_at");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_kind_closed" CHECK ("work_items"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_unit_closed" CHECK ("work_items"."canonical_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "register_observations" ADD CONSTRAINT "register_observations_unit_closed" CHECK ("register_observations"."canonical_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_kind_closed" CHECK ("quantity_lines"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_unit_closed" CHECK ("quantity_lines"."unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_kind_closed" CHECK ("queue_items"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding'));--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_kind_closed" CHECK ("rail_observations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding'));--> statement-breakpoint
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_kind_closed" CHECK ("scope_declarations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding'));--> statement-breakpoint
ALTER TABLE "placement_runs" ADD CONSTRAINT "placement_runs_clear_unit_closed" CHECK ("placement_runs"."clear_unit" is null or "placement_runs"."clear_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "placement_runs" ADD CONSTRAINT "placement_runs_side_a_unit_closed" CHECK ("placement_runs"."side_a_unit" is null or "placement_runs"."side_a_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "placement_runs" ADD CONSTRAINT "placement_runs_side_b_unit_closed" CHECK ("placement_runs"."side_b_unit" is null or "placement_runs"."side_b_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'in', 'm2', 'mm2', 'sft', 'pcs'));--> statement-breakpoint
-- The kind and unit rosters above are re-stated rather than edited: 0028, 0032, 0039 and 0041 stand
-- as they landed, and this migration drops the CHECK each of them installed and adds the same CHECK
-- over the roster the tree now closes over (`closedList(KINDS)`, `closedList(UNITS)`). The four new
-- kinds are what a foundation is measured by beside its concrete — the pile counted and bored, the
-- pit dug for it and the blinding laid under it (R-TO-032, L-FRM-04) — and the inch and the square
-- millimetre are spellings a drawing writes a foundation in, so the canon names a factor for them
-- and the closed unit lists admit them (L-FRM-06, AM-14, B-19).
--
-- L-MEA-04: the catalogue is CODE-OWNED — "a kind, a work item or a borne class changes by an edit
-- to the consts, a re-emission and a migration, and by no other path" (0028). These rows are
-- `db/catalogue/work-items.json` and `db/catalogue/bears.json` as the emitter wrote them from the
-- consts this increment moved, and the catalogue-drift stage is what keeps the three copies from
-- parting company. As 0041 did, the force is lifted for exactly these statements and restored
-- immediately: a migration names no tenant and satisfies no policy, and `cubit_app` still holds no
-- privilege that writes either table.
ALTER TABLE "work_items" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "work_items" ("kind", "description", "canonical_unit", "dimension", "document_precision")
	VALUES ('piling.bored', 'Bored cast-in-situ piles installed, counted as members', 'pcs', 'COUNT', 0),
		('piling.boring', 'Boring for cast-in-situ piles, measured along the bored length below cut-off', 'm', 'LENGTH', 3),
		('earthwork.excavation', 'Excavation in earth for foundations, measured as the pit''s volume including working space', 'm3', 'VOLUME', 3),
		('pcc.blinding', 'Plain cement concrete blinding under foundations, measured as the laid volume', 'm3', 'VOLUME', 3);--> statement-breakpoint
INSERT INTO "bears" ("class", "kind")
	VALUES ('footing', 'rcc.concrete'),
		('pile_cap', 'rcc.concrete'),
		('pile', 'rcc.concrete'),
		('pile', 'piling.bored'),
		('pile', 'piling.boring'),
		('footing', 'earthwork.excavation'),
		('pile_cap', 'earthwork.excavation'),
		('footing', 'pcc.blinding'),
		('pile_cap', 'pcc.blinding');--> statement-breakpoint
ALTER TABLE "work_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
--
-- The SITE-fact ledger. L-MEA-06: what no drawing states — the ground the pit is dug from, the
-- working space allowed beside a footing — is ENTERED by a person against a project, and the figure
-- a measurement reads is the LATEST fact standing. So the table is APPEND-ONLY: a fact is superseded
-- by a later row and never edited, and the row that measured a campaign stands exactly as it was
-- entered (L-QTY-01, L-REG-04). The act that entered it is carried beside it, so a reader can go from
-- a pit's depth to the person who stated the ground level.
ALTER TABLE "site_facts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "site_facts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "site_facts_tenant_scope" ON "site_facts"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "site_facts_system_scope" ON "site_facts"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "site_facts" TO "cubit_app";--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the rule
-- (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "site_facts_append_only" BEFORE UPDATE OR DELETE ON "site_facts"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "site_facts_append_only_truncate" BEFORE TRUNCATE ON "site_facts"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();