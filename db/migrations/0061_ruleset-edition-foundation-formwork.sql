-- L-MEA-01, B-20: the platform rule set re-minted as `IS1200_IN @ 2027.04`, beside the row 0056
-- minted and never over it (FND-3, Interpretation I-337).
--
-- An edition is immutable: a method landing in the tree is a NEW edition rather than an edit to the
-- standing one. 2026.08 through 2027.03 stand untouched as the rows every campaign opened under them
-- measured against, and this row is the head every pin minted afterwards forks (L-REG-07). Nothing
-- here touches the earlier rows — the append-only trigger 0004 installed would refuse it, and that
-- refusal is the point.
--
-- What it cites is every method the shards enumerate (`enumerateMethods()`), which is now thirty-nine
-- pairs: the thirty-seven 2027.03 cited and L-FRM-03's two foundation formworks — the SIDE faces of a
-- footing or a pile cap, `count × 2 × (L + B) × D` over a rectangle (`rcc.foundation.formwork_rect`)
-- and `count × P × D` over any other plan, P the length of the ring the drawing drew
-- (`rcc.foundation.formwork_poly`). Never a soffit and never a top: a foundation is cast on the
-- ground, and neither method names a variable a third face could be bound through. F-RCC6-BNBC's
-- chamfered PC2 is why the second is its own method: its ring runs 6.96 m where its schedule's
-- 2100 x 1750 rectangle would say 7.7 m, and that difference is over (L-QTY-04).
--
-- The seventeen parameter values are 0004's, unchanged — this edition differs from its parent in its
-- methods alone. `content_digest` is `editionDigest` over exactly the content src/core/rulesets/seed
-- exports, so a stored digest that disagreed would mean the row and the module hold different
-- content, which is what `src/core/rulesets/seed/edition-drift.test.ts` refuses.
--
-- Hand-written: an edition's rows are data, not schema, so no column, key or check moves here and the
-- snapshot beside this entry says exactly what the one before it does.
--
-- Minting a platform edition is system work, and 0004's `ruleset_editions_system_scope` policy arms
-- on a named reason and on nothing else — the migrator names no tenant, so it names the reason here
-- and disarms it again below rather than leaving a session that can write editions at will.
SELECT set_config('cubit.system_reason', 'migration 0061 mints the platform rule-set edition IS1200_IN @ 2027.04', false);--> statement-breakpoint
INSERT INTO "ruleset_editions" ("scope", "name", "version", "content_digest", "parameters", "methods")
	VALUES (
		'platform',
		'IS1200_IN',
		'2027.04',
		'b43500d12e5ec01b68d2139aa35089d385323c616f2979aaabd3df91d8c61a35',
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
			{ "ruleId": "rcc.foundation.formwork_poly", "version": "1" },
			{ "ruleId": "rcc.foundation.formwork_rect", "version": "1" },
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
