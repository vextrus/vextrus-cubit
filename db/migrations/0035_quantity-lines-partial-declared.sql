ALTER TABLE "work_items" DROP CONSTRAINT "work_items_unit_closed";--> statement-breakpoint
ALTER TABLE "register_observations" DROP CONSTRAINT "register_observations_unit_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_basis_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_coverage_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_unit_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" ALTER COLUMN "value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD COLUMN "selection_basis" text DEFAULT 'DEFAULTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "quantity_lines" ALTER COLUMN "selection_basis" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD COLUMN "omitted" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "quantity_lines" ALTER COLUMN "omitted" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_unit_closed" CHECK ("work_items"."canonical_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "register_observations" ADD CONSTRAINT "register_observations_unit_closed" CHECK ("register_observations"."canonical_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'm2', 'sft', 'pcs'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_selection_basis_closed" CHECK ("quantity_lines"."selection_basis" in ('MEASURED', 'TRANSCRIBED', 'DERIVED', 'IMPORTED', 'ENTERED', 'INTERPRETED', 'DEFAULTED'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_partial_declared" CHECK (("quantity_lines"."coverage" = 'COMPLETE') = ("quantity_lines"."value" is not null));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_basis_closed" CHECK ("quantity_lines"."quantity_basis" in ('MEASURED', 'TRANSCRIBED', 'DERIVED', 'IMPORTED', 'ENTERED', 'INTERPRETED', 'DEFAULTED'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_coverage_closed" CHECK ("quantity_lines"."coverage" in ('COMPLETE', 'PARTIAL_DECLARED'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_unit_closed" CHECK ("quantity_lines"."unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'mm', 'ft', 'm2', 'sft', 'pcs'));