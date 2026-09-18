-- L-MEA-01, B-20: the platform rule set re-minted as `IS1200_IN @ 2027.02`, beside the row 0049
-- minted and never over it.
--
-- An edition is immutable: a method landing in the tree is a NEW edition rather than an edit to the
-- standing one. 2026.08, 2026.09, 2026.10, 2026.11, 2026.12 and 2027.01 stand untouched as the rows
-- every campaign opened under them measured against, and this row is the head every pin minted
-- afterwards forks (L-REG-07). Nothing here touches the earlier rows — the append-only trigger 0004
-- installed would refuse it, and that refusal is the point.
--
-- What it cites is every method the shards enumerate (`enumerateMethods()`), which is now thirty-six
-- pairs: the twenty-four 2027.01 cited and the twelve the SLABS area records — L-MEA-09 (AM-02) and
-- AM-06 §3/§4's plate, tapering plate, soffit, edge band, sunken drop, shear-wall storey, straight
-- flight and rectangular landing, each for the concrete it holds and the formwork it is cast
-- against. A pair the tree can compute and no edition cites is a method in force that nothing in
-- force names. The seventeen parameter values are 0004's, unchanged — this edition differs from its
-- parent in its methods alone, and the threshold a slab's openings are partitioned against
-- (`openingDeductionMinM2`) is read from exactly these values. `content_digest` is `editionDigest`
-- over exactly the content src/core/rulesets/seed exports, so a stored digest that disagreed would
-- mean the row and the module hold different content.
--
-- Hand-written: an edition's rows are data, not schema, so no column, key or check moves here and the
-- snapshot beside this entry says exactly what the one before it does.
--
-- Minting a platform edition is system work, and 0004's `ruleset_editions_system_scope` policy arms
-- on a named reason and on nothing else — the migrator names no tenant, so it names the reason here
-- and disarms it again below rather than leaving a session that can write editions at will.
SELECT set_config('cubit.system_reason', 'migration 0051 mints the platform rule-set edition IS1200_IN @ 2027.02', false);--> statement-breakpoint
INSERT INTO "ruleset_editions" ("scope", "name", "version", "content_digest", "parameters", "methods")
	VALUES (
		'platform',
		'IS1200_IN',
		'2027.02',
		'0b625f874a839110ea93aa8688626c4404628e1847e620122fc76068756a8212',
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
