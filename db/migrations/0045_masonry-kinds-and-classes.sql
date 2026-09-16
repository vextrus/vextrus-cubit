-- The MASONRY area joins the closed rosters: three kinds (`masonry.brickwork`, `finish.plaster`,
-- `finish.paint`) and two element classes (`brick_wall`, `surface`), so every CHECK written from
-- `closedList(KINDS)` and `closedList(ELEMENT_TYPES)` is re-stated over the rosters the tree now
-- closes over (L-MEA-04, AM-11).
--
-- Re-stated, never edited: 0028, 0032, 0033, 0039, 0041 and 0043 stand as they landed, and this
-- migration drops the CHECK each of them installed and adds the same CHECK over the grown roster —
-- history is append-only, and a landed migration is superseded rather than rewritten (B-20).
--
-- L-MEA-04: the catalogue is CODE-OWNED — "a kind, a work item or a borne class changes by an edit
-- to the consts, a re-emission and a migration, and by no other path" (0028). The rows below are
-- `db/catalogue/work-items.json` and `db/catalogue/bears.json` as the emitter wrote them from the
-- consts this increment moved, and the catalogue-drift stage is what keeps the three copies from
-- parting company. As 0041 and 0043 did, the force is lifted for exactly those statements and
-- restored immediately: a migration names no tenant and satisfies no policy, and `cubit_app` still
-- holds no privilege that writes either table.
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
ALTER TABLE "placements" ADD CONSTRAINT "placements_element_type_closed" CHECK ("placements"."element_type" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface'));--> statement-breakpoint
ALTER TABLE "bears" ADD CONSTRAINT "bears_class_closed" CHECK ("bears"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface'));--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_kind_closed" CHECK ("work_items"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_class_closed" CHECK ("quantity_lines"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_kind_closed" CHECK ("quantity_lines"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint'));--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_kind_closed" CHECK ("queue_items"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint'));--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_class_closed" CHECK ("rail_observations"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface'));--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_kind_closed" CHECK ("rail_observations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint'));--> statement-breakpoint
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_class_closed" CHECK ("scope_declarations"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface'));--> statement-breakpoint
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_kind_closed" CHECK ("scope_declarations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint'));--> statement-breakpoint
ALTER TABLE "work_items" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "work_items" ("kind", "description", "canonical_unit", "dimension", "document_precision")
	VALUES ('masonry.brickwork', 'Brickwork in walls, measured as the wall face net of scheduled openings by its nominal thickness', 'm3', 'VOLUME', 3),
		('finish.plaster', 'Plaster to surfaces, measured as the finished face net of scheduled openings', 'm2', 'AREA', 2),
		('finish.paint', 'Paint to surfaces, measured as the painted face net of scheduled openings', 'm2', 'AREA', 2);--> statement-breakpoint
INSERT INTO "bears" ("class", "kind")
	VALUES ('brick_wall', 'masonry.brickwork'),
		('surface', 'finish.plaster'),
		('surface', 'finish.paint');--> statement-breakpoint
ALTER TABLE "work_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" FORCE ROW LEVEL SECURITY;