-- L-MEA-01, B-20: the platform rule set re-minted as `IS1200_IN @ 2026.11`, beside the row 0042
-- minted and never over it.
--
-- An edition is immutable: a method landing in the tree is a NEW edition rather than an edit to the
-- standing one. 2026.08, 2026.09 and 2026.10 stand untouched as the rows every campaign opened under
-- them measured against, and this row is the head every pin minted afterwards forks (L-REG-07).
-- Nothing here touches the earlier rows — the append-only trigger 0004 installed would refuse it, and
-- that refusal is the point.
--
-- What it cites is every method the shards enumerate (`enumerateMethods()`), which is now sixteen
-- pairs: the nine 2026.10 cited and the seven the FOUNDATIONS area records for L-FRM-02's prisms and
-- pile, R-TO-032's bored pile and L-FRM-04's pit and blinding. A pair the tree can compute and no
-- edition cites is a method in force that nothing in force names. The seventeen parameter values are
-- 0004's, unchanged — this edition differs from its parent in its methods alone, and L-FRM-04's
-- working allowance, depth extra, blinding projection and thickness are read from exactly these
-- values as DERIVED unless a SITE fact overrides them. `content_digest` is `editionDigest` over
-- exactly the content src/core/rulesets/seed exports, so a stored digest that disagreed would mean
-- the row and the module hold different content.
--
-- Hand-written: an edition's rows are data, not schema, so no column, key or check moves here and the
-- snapshot beside this entry says exactly what the one before it does.
--
-- Minting a platform edition is system work, and 0004's `ruleset_editions_system_scope` policy arms
-- on a named reason and on nothing else — the migrator names no tenant, so it names the reason here
-- and disarms it again below rather than leaving a session that can write editions at will.
SELECT set_config('cubit.system_reason', 'migration 0044 mints the platform rule-set edition IS1200_IN @ 2026.11', false);--> statement-breakpoint
INSERT INTO "ruleset_editions" ("scope", "name", "version", "content_digest", "parameters", "methods")
	VALUES (
		'platform',
		'IS1200_IN',
		'2026.11',
		'b8b5a0c93e99062316bceece166cd7ba490c1c9e589397016b20653834757f37',
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
			{ "ruleId": "earthwork.pit_rect", "version": "1" },
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
			{ "ruleId": "rcc.tie_beam.concrete", "version": "1" },
			{ "ruleId": "rcc.tie_beam.formwork", "version": "1" }
		]'::json
	);--> statement-breakpoint
SELECT set_config('cubit.system_reason', '', false);
