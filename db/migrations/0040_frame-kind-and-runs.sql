CREATE TABLE "placement_runs" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"placement_key" text NOT NULL,
	"clear_value" text,
	"clear_unit" text,
	"clear_basis" text,
	"clear_source_keys" json,
	"side_a_value" text,
	"side_a_unit" text,
	"side_a_basis" text,
	"side_a_source_keys" json,
	"side_b_value" text,
	"side_b_unit" text,
	"side_b_basis" text,
	"side_b_source_keys" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "placement_runs_key" PRIMARY KEY("tenant_id","ingest_id","placement_key"),
	CONSTRAINT "placement_runs_clear_stated_whole" CHECK (num_nonnulls("placement_runs"."clear_value", "placement_runs"."clear_unit", "placement_runs"."clear_basis") in (0, 3)),
	CONSTRAINT "placement_runs_side_a_stated_whole" CHECK (num_nonnulls("placement_runs"."side_a_value", "placement_runs"."side_a_unit", "placement_runs"."side_a_basis") in (0, 3)),
	CONSTRAINT "placement_runs_side_b_stated_whole" CHECK (num_nonnulls("placement_runs"."side_b_value", "placement_runs"."side_b_unit", "placement_runs"."side_b_basis") in (0, 3)),
	CONSTRAINT "placement_runs_clear_unit_closed" CHECK ("placement_runs"."clear_unit" is null or "placement_runs"."clear_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'm2', 'sft', 'pcs')),
	CONSTRAINT "placement_runs_side_a_unit_closed" CHECK ("placement_runs"."side_a_unit" is null or "placement_runs"."side_a_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'm2', 'sft', 'pcs')),
	CONSTRAINT "placement_runs_side_b_unit_closed" CHECK ("placement_runs"."side_b_unit" is null or "placement_runs"."side_b_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'm2', 'sft', 'pcs')),
	CONSTRAINT "placement_runs_clear_basis_closed" CHECK ("placement_runs"."clear_basis" is null or "placement_runs"."clear_basis" in ('MEASURED', 'TRANSCRIBED', 'DERIVED', 'IMPORTED', 'ENTERED', 'INTERPRETED', 'DEFAULTED')),
	CONSTRAINT "placement_runs_side_a_basis_closed" CHECK ("placement_runs"."side_a_basis" is null or "placement_runs"."side_a_basis" in ('MEASURED', 'TRANSCRIBED', 'DERIVED', 'IMPORTED', 'ENTERED', 'INTERPRETED', 'DEFAULTED')),
	CONSTRAINT "placement_runs_side_b_basis_closed" CHECK ("placement_runs"."side_b_basis" is null or "placement_runs"."side_b_basis" in ('MEASURED', 'TRANSCRIBED', 'DERIVED', 'IMPORTED', 'ENTERED', 'INTERPRETED', 'DEFAULTED'))
);
--> statement-breakpoint
ALTER TABLE "work_items" DROP CONSTRAINT "work_items_kind_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_kind_closed";--> statement-breakpoint
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_kind_closed";--> statement-breakpoint
ALTER TABLE "rail_observations" DROP CONSTRAINT "rail_observations_kind_closed";--> statement-breakpoint
ALTER TABLE "scope_declarations" DROP CONSTRAINT "scope_declarations_kind_closed";--> statement-breakpoint
CREATE INDEX "placement_runs_by_drawing" ON "placement_runs" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_kind_closed" CHECK ("work_items"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_kind_closed" CHECK ("quantity_lines"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_kind_closed" CHECK ("queue_items"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_kind_closed" CHECK ("rail_observations"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_kind_closed" CHECK ("scope_declarations"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
-- The kind rosters above are re-stated rather than edited: 0028, 0032 and 0039 stand as they landed,
-- and this migration drops the CHECK each of them installed and adds the same CHECK over the roster
-- the tree now closes over (`closedList(KINDS)`). `rcc.formwork` is the second kind this product
-- measures — the contact area L-MEA-09 gives the owner of a face — so a line, a queued item, an
-- observation and a scope declaration of that kind can now be written at all (AM-14, B-19).
--
-- The run table is a stage of the partition, REBUILT per ingest: its rows are deleted and written
-- again in one transaction with the placements they were read for, so the app role really holds a
-- DELETE on it. What makes it trustworthy is the tenant scope below and the key it stands under,
-- never an absence of privilege (R-TO-030, L-REG-04).
ALTER TABLE "placement_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "placement_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "placement_runs_tenant_scope" ON "placement_runs"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "placement_runs_system_scope" ON "placement_runs"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "placement_runs" TO "cubit_app";