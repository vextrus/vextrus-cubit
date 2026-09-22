-- I-303 and I-305, in one migration because there is one next number and history is append-only.
--
-- TWO HALVES, AND THEY ARE ONE INCREMENT. F-RCC6-BNBC's column layout plan writes two notes against
-- two marks — `C7 %%C450 PORCH COLUMN` and `C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)` — and until
-- tonight the product read neither. The first says the porch column is a CIRCLE, which is the method
-- this migration's second half mints an edition for; the second says where a member STANDS, which is
-- what the five columns below carry. Read together they are the whole of what the golden band refused
-- on this fixture: a 450 x 450 prism where a circle is drawn, and a plan's authored range carried
-- over a member the plan itself singled out.
--
-- THE COLUMNS (I-303). A plan note that names a mark is evidence about that MEMBER: the member it
-- names is not one of the plan's typical, so it is not expanded by the view's authored typical range.
-- The note is STORED on the placement rather than re-read, because the partition is built two ways —
-- `rebuild` reads the drawing, `reexpand` reads only these rows — and a reading that lived in one of
-- them would give the two a different answer for the same drawing (B-17). Every column is nullable
-- and null already says the truth of every row standing before this migration: no note named it. So
-- there is no backfill here, and nothing to guess.
--
-- The three CHECKs are what keeps a half-read note out of the store: a note is read whole or not at
-- all (`note_read_whole`); nothing may be stated under no note (`note_statement_under_a_note`); and
-- the shape roster is closed over the seam's own `MEMBER_SHAPES` (`note_shape_closed`). A row with a
-- note key and BOTH labels null is lawful and is the ordinary case — it is what `C7 Ø450 PORCH
-- COLUMN` states, a note that singles a member out and names no storeys for it, which I-303 reads as
-- the level the plan draws and no other.
--
ALTER TABLE "placements" ADD COLUMN "note_key" text;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "note_text" text;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "note_from_label" text;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "note_to_label" text;--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "note_shape" text;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_note_read_whole" CHECK (num_nonnulls("placements"."note_key", "placements"."note_text") <> 1);--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_note_statement_under_a_note" CHECK ("placements"."note_key" is not null or num_nonnulls("placements"."note_from_label", "placements"."note_to_label", "placements"."note_shape") = 0);--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_note_shape_closed" CHECK ("placements"."note_shape" is null or "placements"."note_shape" in ('ROUND'));--> statement-breakpoint
-- L-MEA-01, B-20: the platform rule set re-minted as `IS1200_IN @ 2027.03`, beside the row 0051
-- minted and never over it.
--
-- An edition is immutable: a method landing in the tree is a NEW edition rather than an edit to the
-- standing one. 2026.08 through 2027.02 stand untouched as the rows every campaign opened under them
-- measured against, and this row is the head every pin minted afterwards forks (L-REG-07). Nothing
-- here touches the earlier rows — the append-only trigger 0004 installed would refuse it, and that
-- refusal is the point.
--
-- What it cites is every method the shards enumerate (`enumerateMethods()`), which is now thirty-seven
-- pairs: the thirty-six 2027.02 cited and L-FRM-02's other prism — the quarter of pi d squared a
-- CIRCULAR column holds over one storey. A column is not always a rectangle, and the drawing says so
-- in its own words: F-RCC6-BNBC's S-10 writes `C7 %%C450 PORCH COLUMN` against the porch column, which
-- is Interpretation I-304's shape (the plan states the shape; the schedule's `450x450` states the
-- size, and `b = d = 450` either way, so the two do not disagree). Measured as a 450 x 450 prism that
-- member is 27.3 % over — and L-FRM-01 forbids exactly that: "no silent bounding-box fallback".
-- The reading is not new here; it is the one `rcc.pile.concrete@1` already landed for a bored pile.
-- A pair the tree can compute and no edition cites is a method in force that nothing in force names.
--
-- The seventeen parameter values are 0004's, unchanged — this edition differs from its parent in its
-- methods alone. `content_digest` is `editionDigest` over exactly the content src/core/rulesets/seed
-- exports, so a stored digest that disagreed would mean the row and the module hold different
-- content, which is what `src/core/rulesets/seed/edition-drift.test.ts` refuses.
--
-- Hand-written: an edition's rows are data, not schema, so no column, key or check moves in THIS
-- block. The columns above it are the increment's other half — the plan note a placement was read
-- with — and the snapshot beside this entry carries those and nothing of this.
--
-- Minting a platform edition is system work, and 0004's `ruleset_editions_system_scope` policy arms
-- on a named reason and on nothing else — the migrator names no tenant, so it names the reason here
-- and disarms it again below rather than leaving a session that can write editions at will.
SELECT set_config('cubit.system_reason', 'migration 0056 mints the platform rule-set edition IS1200_IN @ 2027.03', false);--> statement-breakpoint
INSERT INTO "ruleset_editions" ("scope", "name", "version", "content_digest", "parameters", "methods")
	VALUES (
		'platform',
		'IS1200_IN',
		'2027.03',
		'0475191d92d306ace55deca166fe31fda56fbb8111f8be596931dab5e4a9bdcf',
		'{
			"openingDeductionMinM2": { "value": "0.1", "unit": "m2" },
			"memberEndNoDeductMaxCm2": { "value": "500", "unit": "cm2" },
			"embeddedDuctNoDeductMaxCm2": { "value": "100", "unit": "cm2" },
			"finishOpeningDeductionMinM2": { "value": "0.1", "unit": "m2" },
			"finishMinOutlineArea": { "value": "0.2", "unit": "sft" },
			"finishMaxOutlineArea": { "value": "20000", "unit": "sft" },
			"scaleVerificationTolerance": { "value": "0.01", "unit": "ratio" },
			"scaleAnisotropyTolerance": { "value": "0.01", "unit": "ratio" },
			"earthworkWorkingAllowance": { "value": "1.5", "unit": "ft" },
			"earthworkDepthExtra": { "value": "0.5", "unit": "ft" },
			"blindingProjection": { "value": "3", "unit": "in" },
			"blindingThickness": { "value": "3", "unit": "in" },
			"placementContainmentMerge": { "value": "0.08", "unit": "ratio" },
			"placementNearAnchor": { "value": "0.9", "unit": "ratio" },
			"placementFootprintMin": { "value": "0.6", "unit": "ratio" },
			"placementFootprintMax": { "value": "2.5", "unit": "ratio" },
			"placementHumanSnap": { "value": "0.5", "unit": "ratio" }
		}'::json,
		'[
			{ "ruleId": "conventions.resolve", "version": "1" },
			{ "ruleId": "detailing.BNBC2020_BD", "version": "2026.07" },
			{ "ruleId": "earthwork.pit_rect", "version": "1" },
			{ "ruleId": "finish.surface.paint", "version": "1" },
			{ "ruleId": "finish.surface.plaster", "version": "1" },
			{ "ruleId": "masonry.brick_wall.volume", "version": "1" },
			{ "ruleId": "member.volume", "version": "1" },
			{ "ruleId": "pcc.blinding_rect", "version": "1" },
			{ "ruleId": "piling.bored.count", "version": "1" },
			{ "ruleId": "piling.bored.length", "version": "1" },
			{ "ruleId": "rcc.beam.concrete", "version": "1" },
			{ "ruleId": "rcc.beam.formwork", "version": "1" },
			{ "ruleId": "rcc.column.circular.concrete", "version": "1" },
			{ "ruleId": "rcc.column.concrete", "version": "1" },
			{ "ruleId": "rcc.foundation.prism_poly", "version": "1" },
			{ "ruleId": "rcc.foundation.prism_rect", "version": "1" },
			{ "ruleId": "rcc.lintel.concrete", "version": "1" },
			{ "ruleId": "rcc.lintel.formwork", "version": "1" },
			{ "ruleId": "rcc.pile.concrete", "version": "1" },
			{ "ruleId": "rcc.rebar.cutting_length", "version": "1" },
			{ "ruleId": "rcc.rebar.mass", "version": "1" },
			{ "ruleId": "rcc.rebar.stock", "version": "1" },
			{ "ruleId": "rcc.rebar.synthesis", "version": "1" },
			{ "ruleId": "rcc.slab.concrete", "version": "1" },
			{ "ruleId": "rcc.slab.drop.concrete", "version": "1" },
			{ "ruleId": "rcc.slab.drop.formwork", "version": "1" },
			{ "ruleId": "rcc.slab.edge-formwork", "version": "1" },
			{ "ruleId": "rcc.slab.formwork", "version": "1" },
			{ "ruleId": "rcc.slab.taper.concrete", "version": "1" },
			{ "ruleId": "rcc.stair.flight.concrete", "version": "1" },
			{ "ruleId": "rcc.stair.flight.formwork", "version": "1" },
			{ "ruleId": "rcc.stair.landing.concrete", "version": "1" },
			{ "ruleId": "rcc.stair.landing.formwork", "version": "1" },
			{ "ruleId": "rcc.tie_beam.concrete", "version": "1" },
			{ "ruleId": "rcc.tie_beam.formwork", "version": "1" },
			{ "ruleId": "rcc.wall.concrete", "version": "1" },
			{ "ruleId": "rcc.wall.formwork", "version": "1" }
		]'::json
	);--> statement-breakpoint
SELECT set_config('cubit.system_reason', '', false);
