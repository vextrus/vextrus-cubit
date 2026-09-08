CREATE TABLE "bears" (
	"class" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "bears_key" PRIMARY KEY("class","kind"),
	CONSTRAINT "bears_class_closed" CHECK ("bears"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel'))
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"kind" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"canonical_unit" text NOT NULL,
	"dimension" text NOT NULL,
	"document_precision" integer NOT NULL,
	CONSTRAINT "work_items_kind_closed" CHECK ("work_items"."kind" in ('rcc.concrete')),
	CONSTRAINT "work_items_dimension_closed" CHECK ("work_items"."dimension" in ('MASS', 'VOLUME', 'LENGTH', 'AREA', 'COUNT')),
	CONSTRAINT "work_items_unit_closed" CHECK ("work_items"."canonical_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'ft', 'm2', 'sft', 'pcs')),
	CONSTRAINT "work_items_precision_not_negative" CHECK ("work_items"."document_precision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bears" ADD CONSTRAINT "bears_kind_work_items_kind_fk" FOREIGN KEY ("kind") REFERENCES "public"."work_items"("kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- hand-written: the catalogue's rows, RLS, grants (L-MEA-04, SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
--
-- L-MEA-04: the catalogue and the `bears` relation are TS consts "emitted as tables by migration
-- with a drift stage". These rows are `db/catalogue/work-items.json` and `db/catalogue/bears.json`
-- as `src/core/catalogue/emit.ts` wrote them, and the catalogue-drift stage is what keeps the three
-- copies — the consts, the committed tables and these rows — from parting company. The rows are
-- written before row-level security is enabled below, because a migration names no scope and would
-- satisfy no policy.
INSERT INTO "work_items" ("kind", "description", "canonical_unit", "dimension", "document_precision")
	VALUES ('rcc.concrete', 'Reinforced cement concrete cast in place, measured net of its reinforcement', 'm3', 'VOLUME', 3);--> statement-breakpoint
INSERT INTO "bears" ("class", "kind")
	VALUES ('column', 'rcc.concrete');--> statement-breakpoint
-- Neither table carries a tenant id: what a kind is, and what a class bears, is the same in every
-- workspace (L-MEA-04). Having no tenant column is not a reason to have no policy — `cubit_app` is
-- the one role the runtime connects as, and a table with no policy is reachable by any handle in the
-- tree. Reading the catalogue is what every rail does, so every session may read it; writing it is
-- nobody's, which the privileges below say and these policies do not contradict.
ALTER TABLE "work_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "work_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "work_items_readable" ON "work_items"
	FOR SELECT
	USING (true);--> statement-breakpoint
ALTER TABLE "bears" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "bears_readable" ON "bears"
	FOR SELECT
	USING (true);--> statement-breakpoint
-- The catalogue is CODE-OWNED (L-MEA-04): the consts are the original, this migration is how they
-- reach the store, and the runtime role reads them and holds nothing that writes one — no INSERT,
-- no UPDATE, no DELETE. A kind, a work item or a borne class changes by an edit to the consts, a
-- re-emission and a migration, and by no other path.
GRANT SELECT ON TABLE "work_items" TO "cubit_app";--> statement-breakpoint
GRANT SELECT ON TABLE "bears" TO "cubit_app";