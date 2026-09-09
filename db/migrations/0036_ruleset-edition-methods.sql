-- L-MEA-01, B-20: the platform rule set re-minted as `IS1200_IN @ 2026.09`, beside the row 0004
-- seeded and never over it.
--
-- An edition is immutable: a method landing in the tree is a NEW edition rather than an edit to the
-- standing one. 2026.08 stands untouched as the row every campaign opened under it measured against,
-- and this row is the head every pin minted afterwards forks (L-REG-07). Nothing here touches the
-- earlier row — the append-only trigger 0004 installed would refuse it, and that refusal is the
-- point.
--
-- What it cites is every method the shards enumerate (`enumerateMethods()`): a pair the tree can
-- compute and no campaign could cite would be a method in force that nothing in force names. The
-- seventeen parameter values are 0004's, unchanged — this edition differs from its parent in its
-- methods alone. `content_digest` is `editionDigest` over exactly the content
-- src/core/rulesets/seed exports, so a stored digest that disagreed would mean the row and the
-- module hold different content.
--
-- Hand-written: an edition's rows are data, not schema, so no column, key or check moves here and
-- the snapshot beside this entry says exactly what 0035's does.
--
-- Minting a platform edition is system work, and 0004's `ruleset_editions_system_scope` policy arms
-- on a named reason and on nothing else — the migrator names no tenant, so it names the reason here
-- and disarms it again below rather than leaving a session that can write editions at will.
SELECT set_config('cubit.system_reason', 'migration 0036 mints the platform rule-set edition IS1200_IN @ 2026.09', false);--> statement-breakpoint
INSERT INTO "ruleset_editions" ("scope", "name", "version", "content_digest", "parameters", "methods")
	VALUES (
		'platform',
		'IS1200_IN',
		'2026.09',
		'e3b4e0b4a22e59f5f7de1c58ff877b85cc4ba13786b7a8a5656f1ace5ab2a737',
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
			{ "ruleId": "member.volume", "version": "1" },
			{ "ruleId": "rcc.column.concrete", "version": "1" }
		]'::json
	);--> statement-breakpoint
SELECT set_config('cubit.system_reason', '', false);
