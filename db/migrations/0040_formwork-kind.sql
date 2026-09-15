-- L-MEA-04, AM-14: `rcc.formwork` is the second kind this product measures — the contact area
-- L-MEA-09 gives the owner of a face, measured by the square metre and never by the volume behind it
-- (L-FRM-03, R-TO-032).
--
-- The kind rosters below are re-stated rather than edited: 0028, 0032 and 0039 stand as they landed,
-- and this migration drops the CHECK each of them installed and adds the same CHECK over the roster
-- the tree now closes over (`KINDS`). Only then can a quantity line, a queued item, an observation
-- or a scope declaration of the new kind be written at all (B-19, history is append-only).
ALTER TABLE "work_items" DROP CONSTRAINT "work_items_kind_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_kind_closed";--> statement-breakpoint
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_kind_closed";--> statement-breakpoint
ALTER TABLE "rail_observations" DROP CONSTRAINT "rail_observations_kind_closed";--> statement-breakpoint
ALTER TABLE "scope_declarations" DROP CONSTRAINT "scope_declarations_kind_closed";--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_kind_closed" CHECK ("work_items"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_kind_closed" CHECK ("quantity_lines"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_kind_closed" CHECK ("queue_items"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_kind_closed" CHECK ("rail_observations"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_kind_closed" CHECK ("scope_declarations"."kind" in ('rcc.concrete', 'rcc.formwork'));--> statement-breakpoint
-- L-MEA-04: the catalogue is CODE-OWNED — "a kind, a work item or a borne class changes by an edit
-- to the consts, a re-emission and a migration, and by no other path" (0028). The row below is
-- `db/catalogue/work-items.json` as `src/core/catalogue/emit.ts` wrote it from the const this
-- increment moved, and the catalogue-drift stage is what keeps the three copies from parting
-- company. 0028 wrote its rows before enabling row-level security, because a migration names no
-- scope and satisfies no policy; the table now stands FORCED, so the force is lifted for exactly
-- this statement and restored immediately — the guarantee the runtime is held to is unchanged, and
-- `cubit_app` still holds no privilege that writes it.
--
-- No `bears` row lands here: which classes bear formwork is the catalogue leaf's statement, and a
-- relation written ahead of the classes that answer for it would claim a coverage nothing measures.
ALTER TABLE "work_items" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "work_items" ("kind", "description", "canonical_unit", "dimension", "document_precision")
	VALUES ('rcc.formwork', 'Formwork to reinforced cement concrete, measured as the contact area of the cast face', 'm2', 'AREA', 2);--> statement-breakpoint
ALTER TABLE "work_items" FORCE ROW LEVEL SECURITY;
