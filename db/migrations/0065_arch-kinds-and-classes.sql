ALTER TABLE "placements" DROP CONSTRAINT "placements_element_type_closed";--> statement-breakpoint
ALTER TABLE "bears" DROP CONSTRAINT "bears_class_closed";--> statement-breakpoint
ALTER TABLE "work_items" DROP CONSTRAINT "work_items_kind_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_class_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_kind_closed";--> statement-breakpoint
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_kind_closed";--> statement-breakpoint
ALTER TABLE "rail_observations" DROP CONSTRAINT "rail_observations_class_closed";--> statement-breakpoint
ALTER TABLE "rail_observations" DROP CONSTRAINT "rail_observations_kind_closed";--> statement-breakpoint
ALTER TABLE "scope_declarations" DROP CONSTRAINT "scope_declarations_class_closed";--> statement-breakpoint
ALTER TABLE "scope_declarations" DROP CONSTRAINT "scope_declarations_kind_closed";--> statement-breakpoint
ALTER TABLE "bar_rows" DROP CONSTRAINT "bar_rows_class_closed";--> statement-breakpoint
ALTER TABLE "conditions" DROP CONSTRAINT "conditions_element_class_closed";--> statement-breakpoint
ALTER TABLE "manual_measurements" DROP CONSTRAINT "manual_measurements_element_class_closed";--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_element_type_closed" CHECK ("placements"."element_type" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface', 'opening'));--> statement-breakpoint
ALTER TABLE "bears" ADD CONSTRAINT "bears_class_closed" CHECK ("bears"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface', 'opening'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_kind_closed" CHECK ("work_items"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar', 'finish.flooring', 'finish.tiling', 'finish.skirting'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_class_closed" CHECK ("quantity_lines"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface', 'opening'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_kind_closed" CHECK ("quantity_lines"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar', 'finish.flooring', 'finish.tiling', 'finish.skirting'));--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_kind_closed" CHECK ("queue_items"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar', 'finish.flooring', 'finish.tiling', 'finish.skirting'));--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_class_closed" CHECK ("rail_observations"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface', 'opening'));--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_kind_closed" CHECK ("rail_observations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar', 'finish.flooring', 'finish.tiling', 'finish.skirting'));--> statement-breakpoint
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_class_closed" CHECK ("scope_declarations"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface', 'opening'));--> statement-breakpoint
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_kind_closed" CHECK ("scope_declarations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar', 'finish.flooring', 'finish.tiling', 'finish.skirting'));--> statement-breakpoint
ALTER TABLE "bar_rows" ADD CONSTRAINT "bar_rows_class_closed" CHECK ("bar_rows"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface', 'opening'));--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_element_class_closed" CHECK ("conditions"."element_class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface', 'opening'));--> statement-breakpoint
ALTER TABLE "manual_measurements" ADD CONSTRAINT "manual_measurements_element_class_closed" CHECK ("manual_measurements"."element_class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface', 'opening'));--> statement-breakpoint
-- hand-written (session 8, ARCH-2): the three architectural finish work items and their three bears rows, seeded as the emitter wrote them
--
-- F-ARCH's vocabulary joins the closed rosters (I-540, I-541): one element class, `opening`
-- (a door, a window or a ventilator standing in a wall), and three kinds a SURFACE bears —
-- `finish.flooring`, `finish.tiling` and `finish.skirting` (AM-16(4)'s "floor and wall finishes").
-- Every CHECK written from `closedList(KINDS)` and `closedList(ELEMENT_TYPES)` is re-stated above
-- over the grown rosters; 0045 and 0049 stand as they landed (B-20).
--
-- L-MEA-04: the catalogue is CODE-OWNED — "a kind, a work item or a borne class changes by an edit
-- to the consts, a re-emission and a migration, and by no other path" (0028). The rows below are
-- `db/catalogue/work-items.json` and `db/catalogue/bears.json` as the emitter wrote them from the
-- consts, and the catalogue-drift stage keeps the three copies together. The `opening` class bears
-- nothing yet, so no bears row names it: it stands in the unborne set the relation derives.
--
-- The rows are batched so the work-item catalogue digest a campaign snapshots moves ONCE: every
-- campaign opened before this reads stale on `catalogue` once (L-REG-07). No bill moves: the three
-- kinds reach FINISHES through the taxonomy's standing `finish` division row, so the taxonomy
-- version is untouched.
--
-- As 0045 and 0060 did, the force is lifted for exactly these statements and restored at once: a
-- migration names no tenant and satisfies no policy, and `cubit_app` still holds no privilege that
-- writes either table.
ALTER TABLE "work_items" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "work_items" ("kind", "description", "canonical_unit", "dimension", "document_precision")
	VALUES ('finish.flooring', 'Floor finish to surfaces, measured as the finished floor within the room''s outline net of deducted openings and obstructions', 'm2', 'AREA', 2),
		('finish.tiling', 'Tiling to wall surfaces, measured as the tiled band net of scheduled openings', 'm2', 'AREA', 2),
		('finish.skirting', 'Skirting to wall surfaces, measured along the room''s outline net of the widths of openings at floor level', 'm', 'LENGTH', 2);--> statement-breakpoint
INSERT INTO "bears" ("class", "kind")
	VALUES ('surface', 'finish.flooring'),
		('surface', 'finish.tiling'),
		('surface', 'finish.skirting');--> statement-breakpoint
ALTER TABLE "work_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" FORCE ROW LEVEL SECURITY;
