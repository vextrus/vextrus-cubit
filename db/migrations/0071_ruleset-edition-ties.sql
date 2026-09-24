-- L-MEA-01, B-20: the platform rule set re-minted as `IS1200_IN @ 2027.06`, beside the row 0066
-- minted and never over it (OPEN-4, session 9).
--
-- An edition is immutable: a method version landing in the tree is a NEW edition rather than an
-- edit to the standing one. 2026.08 through 2027.05 stand untouched as the rows every campaign
-- opened under them measured against, and this row is the head every pin minted afterwards forks
-- (L-REG-07). Nothing here touches the earlier rows — the append-only trigger 0004 installed would
-- refuse it.
--
-- What it cites is every method the shards enumerate (`enumerateMethods()`) narrowed by the seed's
-- explicit in-force selection (`IN_FORCE_VERSIONS`), which is fifty-one pairs — the fifty-one
-- 2027.05 cited, with one rule cited at its other version:
-- - `rcc.rebar.synthesis@2` in place of `@1` (R6b; s-bbs I-656…e, deviations D-003): a column's
--   ties derived from BNBC 2020 at the never-over bound where placed framing bounds the joint, and
--   declared by name where it does not; and a stated LAP binds the verticals outside the FY/FC
--   contest (R2). The tree computes both versions; this row names the one it puts in force, so no
--   rule is cited at two versions and `versionInForce`'s first-cited pair is the only one.
--
-- A campaign opened under 2027.05 or earlier keeps @1 and writes the bars it always wrote; only a
-- campaign pinned to this edition, or a fork of it, derives the ties (I-653).
--
-- The seventeen parameter values are 0004's, unchanged — this edition differs from its parent in its
-- methods alone. `content_digest` is `editionDigest` over exactly the content src/core/rulesets/seed
-- exports, which `src/core/rulesets/seed/edition-drift.test.ts` holds it to.
--
-- Hand-written (drizzle-kit generate --custom): an edition's rows are data, not schema, so no
-- column, key or check moves here and the snapshot beside this entry says exactly what the one
-- before it does.
--
-- Minting a platform edition is system work, and 0004's `ruleset_editions_system_scope` policy arms
-- on a named reason and on nothing else — the migrator names no tenant, so it names the reason here
-- and disarms it again below.
SELECT set_config('cubit.system_reason', 'migration 0071 mints the platform rule-set edition IS1200_IN @ 2027.06', false);--> statement-breakpoint
INSERT INTO "ruleset_editions" ("scope", "name", "version", "content_digest", "parameters", "methods")
	VALUES (
		'platform',
		'IS1200_IN',
		'2027.06',
		'c5d7df631a59baa33152faec5f5b117c3863a161a582eb11106571defd948902',
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
			{ "ruleId": "finish.surface.flooring", "version": "1" },
			{ "ruleId": "finish.surface.paint", "version": "1" },
			{ "ruleId": "finish.surface.plaster", "version": "1" },
			{ "ruleId": "finish.wall_face.paint", "version": "1" },
			{ "ruleId": "finish.wall_face.plaster", "version": "1" },
			{ "ruleId": "finish.wall_face.tiling", "version": "1" },
			{ "ruleId": "masonry.brick_wall.volume", "version": "1" },
			{ "ruleId": "member.volume", "version": "1" },
			{ "ruleId": "pcc.blinding.area", "version": "1" },
			{ "ruleId": "pcc.blinding_rect", "version": "1" },
			{ "ruleId": "pcc.blinding_rect_piled", "version": "1" },
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
			{ "ruleId": "rcc.pile_cap.formwork_poly_recess", "version": "1" },
			{ "ruleId": "rcc.pile_cap.formwork_rect_recess", "version": "1" },
			{ "ruleId": "rcc.pile_cap.prism_poly", "version": "1" },
			{ "ruleId": "rcc.pile_cap.prism_poly_recess", "version": "1" },
			{ "ruleId": "rcc.pile_cap.prism_rect", "version": "1" },
			{ "ruleId": "rcc.pile_cap.prism_rect_recess", "version": "1" },
			{ "ruleId": "rcc.rebar.cutting_length", "version": "1" },
			{ "ruleId": "rcc.rebar.mass", "version": "1" },
			{ "ruleId": "rcc.rebar.stock", "version": "1" },
			{ "ruleId": "rcc.rebar.synthesis", "version": "2" },
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
