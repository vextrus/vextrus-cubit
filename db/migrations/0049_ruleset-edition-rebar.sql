-- L-MEA-01, B-20: the platform rule set re-minted as `IS1200_IN @ 2027.01`, beside the row 0046
-- minted and never over it.
--
-- An edition is immutable: a method landing in the tree is a NEW edition rather than an edit to the
-- standing one. 2026.08 through 2026.12 stand untouched as the rows every campaign opened under them
-- measured against, and this row is the head every pin minted afterwards forks (L-REG-07). Nothing
-- here touches the earlier rows — the append-only trigger 0004 installed would refuse it, and that
-- refusal is the point.
--
-- What it cites is every method the shards enumerate (`enumerateMethods()`), which is now twenty-four
-- pairs: the nineteen the edition before it cited and the five the REBAR area records. Four of those
-- five are ordinary methods — BS 8666's cutting length, the stock split, the member synthesis and the
-- kg/m mass. The fifth, `detailing.BNBC2020_BD @ 2026.07`, is the DETAILING edition itself: L-FRM-05
-- requires the detailing rules a schedule is cut under to be versioned DATA, and carrying them as a
-- method pair is what puts them under the manifest hash and inside an edition a campaign can pin. A
-- pair the tree can compute and no edition cites is a method in force that nothing in force names.
--
-- The seventeen parameter values are 0004's, unchanged — this edition differs from its parent in its
-- methods alone. `content_digest` is `editionDigest` over exactly the content src/core/rulesets/seed
-- exports, so a stored digest that disagreed would mean the row and the module hold different content.
--
-- Hand-written: an edition's rows are data, not schema, so no column, key or check moves here and the
-- snapshot beside this entry says exactly what the one before it does.
--
-- Minting a platform edition is system work, and 0004's `ruleset_editions_system_scope` policy arms
-- on a named reason and on nothing else — the migrator names no tenant, so it names the reason here
-- and disarms it again below rather than leaving a session that can write editions at will.
SELECT set_config('cubit.system_reason', 'migration 0049 mints the platform rule-set edition IS1200_IN @ 2027.01', false);--> statement-breakpoint
INSERT INTO "ruleset_editions" ("scope", "name", "version", "content_digest", "parameters", "methods")
	VALUES (
		'platform',
		'IS1200_IN',
		'2027.01',
		'c11ca247d68b6f3335db418800b5af01dd9dc3cfab9df899068fd8d3f4aa3489',
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
			{ "ruleId": "rcc.tie_beam.concrete", "version": "1" },
			{ "ruleId": "rcc.tie_beam.formwork", "version": "1" }
		]'::json
	);--> statement-breakpoint
SELECT set_config('cubit.system_reason', '', false);
