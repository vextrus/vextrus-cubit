CREATE TABLE "bears" (
	"element_type" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "bears_element_type_kind_pk" PRIMARY KEY("element_type","kind"),
	CONSTRAINT "bears_element_type_closed" CHECK ("bears"."element_type" in ('footing', 'pile', 'pile-cap', 'raft', 'grade-beam', 'column', 'beam', 'slab', 'wall', 'stair', 'lintel', 'parapet', 'plinth', 'door', 'window')),
	CONSTRAINT "bears_kind_closed" CHECK ("bears"."kind" in ('excavation', 'backfilling', 'sand-filling', 'brick-soling', 'lean-concrete', 'concrete-casting', 'reinforcement', 'formwork', 'brickwork', 'plastering', 'tiling', 'painting', 'waterproofing', 'false-ceiling', 'skirting', 'railing', 'pipework', 'sanitary-ware', 'electrical-point', 'structural-steel'))
);
--> statement-breakpoint
CREATE TABLE "work_item_catalogue" (
	"kind" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"canonical_unit" text NOT NULL,
	"dimension" text NOT NULL,
	"rounding_precision" integer NOT NULL,
	CONSTRAINT "work_item_catalogue_kind_closed" CHECK ("work_item_catalogue"."kind" in ('excavation', 'backfilling', 'sand-filling', 'brick-soling', 'lean-concrete', 'concrete-casting', 'reinforcement', 'formwork', 'brickwork', 'plastering', 'tiling', 'painting', 'waterproofing', 'false-ceiling', 'skirting', 'railing', 'pipework', 'sanitary-ware', 'electrical-point', 'structural-steel')),
	CONSTRAINT "work_item_catalogue_dimension_closed" CHECK ("work_item_catalogue"."dimension" in ('MASS', 'VOLUME', 'LENGTH', 'AREA', 'COUNT')),
	CONSTRAINT "work_item_catalogue_unit_matches_dimension" CHECK (("work_item_catalogue"."dimension", "work_item_catalogue"."canonical_unit") in (('MASS', 'kg'), ('VOLUME', 'm3'), ('LENGTH', 'm'), ('AREA', 'm2'), ('COUNT', 'pcs')))
);
--> statement-breakpoint
-- hand-written: the catalogue rows, row-level security and grants (L-MEA-04, SEAM-TENANT).
-- Appended by hand in the form the tenancy base set established: the drift lane proves the schema
-- and the committed migrations agree by generating into a scratch directory, and that proof only
-- holds while the generated DDL above is what the generator would write.
--
-- These rows are emitCatalogueTables() verbatim, the same bytes db/catalogue/*.json records and
-- V-VERIFY digests: the consts in src/core/catalogue are the source and this is their landed copy.
INSERT INTO "work_item_catalogue" ("kind", "description", "canonical_unit", "dimension", "rounding_precision") VALUES
	('backfilling', 'Backfilling around and over completed work with approved excavated earth, in layers, watered and compacted', 'm3', 'VOLUME', 3),
	('brick-soling', 'Single layer of picked jhama brick flat soling laid on prepared bed, joints filled with sand', 'm2', 'AREA', 2),
	('brickwork', 'First-class brickwork in cement mortar, including raking joints and curing', 'm3', 'VOLUME', 3),
	('concrete-casting', 'Reinforced cement concrete of the specified grade, mixed, placed, vibrated and cured', 'm3', 'VOLUME', 3),
	('electrical-point', 'Wiring point of the specified type drawn in concealed conduit, complete with switch and accessories', 'pcs', 'COUNT', 0),
	('excavation', 'Earth excavation in all kinds of soil, including shoring and dewatering as required', 'm3', 'VOLUME', 3),
	('false-ceiling', 'Suspended ceiling of the specified board on a levelled metal grid, including hangers and access panels', 'm2', 'AREA', 2),
	('formwork', 'Shuttering and centering to the specified finish, including props, and its removal', 'm2', 'AREA', 2),
	('lean-concrete', 'Lean cement concrete bed with brick chips, laid and levelled under structural work', 'm3', 'VOLUME', 3),
	('painting', 'Paint of the specified type over prepared and primed surface, in the specified number of coats', 'm2', 'AREA', 2),
	('pipework', 'Pipe of the specified material and bore, laid or fixed in position, including jointing and testing', 'm', 'LENGTH', 2),
	('plastering', 'Cement plaster of the specified thickness and mix, finished smooth and cured', 'm2', 'AREA', 2),
	('railing', 'Railing and handrail of the specified material and height, fabricated, fixed and finished', 'm', 'LENGTH', 2),
	('reinforcement', 'Deformed steel bar reinforcement cut, bent, placed and tied in position, including binding wire', 'kg', 'MASS', 2),
	('sand-filling', 'Filling with approved local sand in layers, watered and compacted to the specified density', 'm3', 'VOLUME', 3),
	('sanitary-ware', 'Sanitary appliance of the specified make, supplied and set complete with its fittings', 'pcs', 'COUNT', 0),
	('skirting', 'Skirting of the specified material and height, laid and finished flush with the wall face', 'm', 'LENGTH', 2),
	('structural-steel', 'Structural steel section fabricated, erected and fixed in position, including connections', 'kg', 'MASS', 2),
	('tiling', 'Tile work of the specified size laid in cement mortar, jointed, grouted and cleaned', 'm2', 'AREA', 2),
	('waterproofing', 'Waterproofing treatment of the specified system, including preparation, laps and protective screed', 'm2', 'AREA', 2);--> statement-breakpoint
INSERT INTO "bears" ("element_type", "kind") VALUES
	('beam', 'concrete-casting'),
	('beam', 'formwork'),
	('beam', 'painting'),
	('beam', 'plastering'),
	('beam', 'reinforcement'),
	('beam', 'structural-steel'),
	('column', 'concrete-casting'),
	('column', 'formwork'),
	('column', 'painting'),
	('column', 'plastering'),
	('column', 'reinforcement'),
	('column', 'structural-steel'),
	('column', 'tiling'),
	('footing', 'backfilling'),
	('footing', 'concrete-casting'),
	('footing', 'excavation'),
	('footing', 'formwork'),
	('footing', 'lean-concrete'),
	('footing', 'reinforcement'),
	('footing', 'sand-filling'),
	('footing', 'waterproofing'),
	('grade-beam', 'backfilling'),
	('grade-beam', 'concrete-casting'),
	('grade-beam', 'excavation'),
	('grade-beam', 'formwork'),
	('grade-beam', 'lean-concrete'),
	('grade-beam', 'reinforcement'),
	('lintel', 'concrete-casting'),
	('lintel', 'formwork'),
	('lintel', 'painting'),
	('lintel', 'plastering'),
	('lintel', 'reinforcement'),
	('parapet', 'brickwork'),
	('parapet', 'painting'),
	('parapet', 'plastering'),
	('parapet', 'railing'),
	('parapet', 'waterproofing'),
	('pile', 'concrete-casting'),
	('pile', 'reinforcement'),
	('pile-cap', 'backfilling'),
	('pile-cap', 'concrete-casting'),
	('pile-cap', 'excavation'),
	('pile-cap', 'formwork'),
	('pile-cap', 'lean-concrete'),
	('pile-cap', 'reinforcement'),
	('plinth', 'brickwork'),
	('plinth', 'painting'),
	('plinth', 'plastering'),
	('plinth', 'waterproofing'),
	('raft', 'backfilling'),
	('raft', 'brick-soling'),
	('raft', 'concrete-casting'),
	('raft', 'excavation'),
	('raft', 'formwork'),
	('raft', 'lean-concrete'),
	('raft', 'reinforcement'),
	('raft', 'sand-filling'),
	('raft', 'waterproofing'),
	('slab', 'brick-soling'),
	('slab', 'concrete-casting'),
	('slab', 'electrical-point'),
	('slab', 'false-ceiling'),
	('slab', 'formwork'),
	('slab', 'painting'),
	('slab', 'pipework'),
	('slab', 'plastering'),
	('slab', 'reinforcement'),
	('slab', 'skirting'),
	('slab', 'tiling'),
	('slab', 'waterproofing'),
	('stair', 'concrete-casting'),
	('stair', 'formwork'),
	('stair', 'painting'),
	('stair', 'plastering'),
	('stair', 'railing'),
	('stair', 'reinforcement'),
	('stair', 'tiling'),
	('wall', 'brickwork'),
	('wall', 'concrete-casting'),
	('wall', 'electrical-point'),
	('wall', 'formwork'),
	('wall', 'painting'),
	('wall', 'pipework'),
	('wall', 'plastering'),
	('wall', 'reinforcement'),
	('wall', 'sanitary-ware'),
	('wall', 'skirting'),
	('wall', 'tiling'),
	('wall', 'waterproofing');--> statement-breakpoint
-- Neither table carries a tenant id: the catalogue is the installation's measurement vocabulary,
-- the same for every workspace (L-MEA-04). Carrying no tenant column is not a reason to carry no
-- policy - cubit_app is the one role the runtime connects as, and a table it holds DML on with no
-- policy is reachable by any handle in the tree. So: readable by every session, writable by none.
ALTER TABLE "work_item_catalogue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a
-- guarantee the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "work_item_catalogue" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "work_item_catalogue_reference_read" ON "work_item_catalogue"
	FOR SELECT
	USING (true);--> statement-breakpoint
ALTER TABLE "bears" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "bears_reference_read" ON "bears"
	FOR SELECT
	USING (true);--> statement-breakpoint
-- Reference data the migration owns: the app role reads the vocabulary and holds nothing that can
-- add to it, change it or take it away. A catalogue the runtime could edit would be a second source
-- beside the consts, and the drift stage would be digesting the wrong one (B-17).
GRANT SELECT ON TABLE "work_item_catalogue" TO "cubit_app";--> statement-breakpoint
GRANT SELECT ON TABLE "bears" TO "cubit_app";
