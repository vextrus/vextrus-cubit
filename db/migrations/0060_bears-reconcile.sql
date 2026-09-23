-- BEARS-1 (session 7, Interpretation I-336): the `bears` relation reconciled once — ten (class, kind)
-- rows the consts now hold and the store did not.
--
-- L-MEA-04: the catalogue is CODE-OWNED — "a kind, a work item or a borne class changes by an edit
-- to the consts, a re-emission and a migration, and by no other path" (0028). These rows are
-- `db/catalogue/bears.json` as the emitter wrote it from `src/core/catalogue/bears.ts`, and the
-- catalogue-drift stage is what keeps the three copies from parting company.
--
-- What the ten say, each a pair R-TO-032 forms or casts and L-FRM-03/04 states a figure for:
--   · a pile cap, a footing and a column are cast against formwork (L-FRM-03's "Polygonal
--     foundation/cap: side faces only", "Foundation `count × 2(L+B) × depth`", "Vertical
--     `count × 2(L+B) × storey height` per level");
--   · a slab, a shear wall and a stair hold concrete and are formed — the slab area's rails already
--     publish all six pairs, so these rows are the relation catching up with what is measured;
--   · a slab cast on the ground is blinded as a footing is (L-FRM-04).
-- The four WALL pairs the F-RCC6-BNBC golden states wait for the WALL class; no row here names it.
--
-- Batched in ONE migration and ONE edit of the consts because the work-item catalogue digest a
-- campaign snapshots is taken over this relation (L-REG-07, `catalogueDigest`): every campaign opened
-- before it reads stale on `catalogue` once, not once per row.
--
-- No column, key or check moves, so the snapshot beside this entry says exactly what the one before
-- it does. As 0043, 0045 and 0049 did, the force is lifted for exactly this statement and restored
-- immediately: a migration names no tenant and satisfies no policy, and `cubit_app` still holds no
-- privilege that writes the table.
ALTER TABLE "bears" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "bears" ("class", "kind")
	VALUES ('pile_cap', 'rcc.formwork'),
		('footing', 'rcc.formwork'),
		('column', 'rcc.formwork'),
		('slab', 'rcc.concrete'),
		('slab', 'rcc.formwork'),
		('shear_wall', 'rcc.concrete'),
		('shear_wall', 'rcc.formwork'),
		('stair', 'rcc.concrete'),
		('stair', 'rcc.formwork'),
		('slab', 'pcc.blinding');--> statement-breakpoint
ALTER TABLE "bears" FORCE ROW LEVEL SECURITY;
