CREATE TABLE "bar_rows" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"bar_key" text NOT NULL,
	"class" text NOT NULL,
	"level" text,
	"mark" text NOT NULL,
	"bar_mark" text NOT NULL,
	"role" text NOT NULL,
	"diameter_mm" integer NOT NULL,
	"shape" text NOT NULL,
	"dims_mm" json NOT NULL,
	"cutting_raw_mm" text NOT NULL,
	"cutting_rounded_mm" text NOT NULL,
	"cutting_is_additive_mm" text NOT NULL,
	"pieces_per_bar" integer NOT NULL,
	"lap_mm" text NOT NULL,
	"laps_per_bar" integer NOT NULL,
	"bars_per_unit" integer NOT NULL,
	"parent_count" text NOT NULL,
	"bars" text NOT NULL,
	"kg_per_metre" text NOT NULL,
	"kg_net" text NOT NULL,
	"kg_lap" text NOT NULL,
	"kg" text NOT NULL,
	"source_keys" json NOT NULL,
	"detailing_source_keys" json NOT NULL,
	"edition_digest" text NOT NULL,
	"semantic" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bar_rows_key" PRIMARY KEY("tenant_id","campaign_id","bar_key"),
	CONSTRAINT "bar_rows_class_closed" CHECK ("bar_rows"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel', 'brick_wall', 'surface')),
	CONSTRAINT "bar_rows_role_closed" CHECK ("bar_rows"."role" in ('MAIN', 'SIDE', 'TIE', 'STIRRUP', 'EXTRA_TOP', 'EXTRA_BOTTOM', 'DISTRIBUTION', 'HORIZONTAL', 'SPIRAL')),
	CONSTRAINT "bar_rows_shape_closed" CHECK ("bar_rows"."shape" in ('00', '11', '21', '51', 'SP', 'CT', 'CRK'))
);
--> statement-breakpoint
ALTER TABLE "work_items" DROP CONSTRAINT "work_items_kind_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" DROP CONSTRAINT "quantity_lines_kind_closed";--> statement-breakpoint
ALTER TABLE "queue_items" DROP CONSTRAINT "queue_items_kind_closed";--> statement-breakpoint
ALTER TABLE "rail_observations" DROP CONSTRAINT "rail_observations_kind_closed";--> statement-breakpoint
ALTER TABLE "scope_declarations" DROP CONSTRAINT "scope_declarations_kind_closed";--> statement-breakpoint
ALTER TABLE "bar_rows" ADD CONSTRAINT "bar_rows_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bar_rows_by_campaign" ON "bar_rows" USING btree ("tenant_id","campaign_id","object_key");--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_kind_closed" CHECK ("work_items"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_kind_closed" CHECK ("quantity_lines"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar'));--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_kind_closed" CHECK ("queue_items"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar'));--> statement-breakpoint
ALTER TABLE "rail_observations" ADD CONSTRAINT "rail_observations_kind_closed" CHECK ("rail_observations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar'));--> statement-breakpoint
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_kind_closed" CHECK ("scope_declarations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar'));
--> statement-breakpoint
-- carried by the engine from db/migrations/0048_rebar-kind-and-bar-rows.sql (v22 fault 538)
-- SEAM-TENANT: the bill of bars is tenant data, so it wears the seam's full posture — row-level
-- security ENABLED and FORCED, the tenant scope every statement of a tenant's own session satisfies,
-- and the system scope a named reason opens for the platform's own work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "bar_rows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bar_rows" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "bar_rows_tenant_scope" ON "bar_rows"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);
--> statement-breakpoint
CREATE POLICY "bar_rows_system_scope" ON "bar_rows"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);
--> statement-breakpoint
-- DELETE and INSERT and no UPDATE: a campaign's bill of bars is REPLACED whole on every measurement,
-- because the keys are derived from content and an unchanged campaign re-measures to the identical
-- key multiset (L-REG-04). A content-keyed row is rewritten, never amended — so there is no
-- statement the app role could make that an UPDATE privilege would let it make honestly.
GRANT SELECT, INSERT, DELETE ON TABLE "bar_rows" TO "cubit_app";
--> statement-breakpoint
ALTER TABLE "work_items" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bears" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO "work_items" ("kind", "description", "canonical_unit", "dimension", "document_precision")
	VALUES ('rcc.rebar', 'Reinforcement steel in place, measured as nominal mass with laps billed beside the net', 'kg', 'MASS', 3);
--> statement-breakpoint
INSERT INTO "bears" ("class", "kind")
	VALUES ('column', 'rcc.rebar'),
		('beam', 'rcc.rebar'),
		('tie_beam', 'rcc.rebar'),
		('slab', 'rcc.rebar'),
		('footing', 'rcc.rebar'),
		('pile_cap', 'rcc.rebar'),
		('pile', 'rcc.rebar'),
		('shear_wall', 'rcc.rebar'),
		('stair', 'rcc.rebar'),
		('lintel', 'rcc.rebar');
--> statement-breakpoint
ALTER TABLE "work_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bears" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- carried by the engine from db/migrations/0049_ruleset-edition-rebar.sql (v22 fault 538)
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
SELECT set_config('cubit.system_reason', 'migration 0049 mints the platform rule-set edition IS1200_IN @ 2027.01', false);
--> statement-breakpoint
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
		'[{ "ruleId": "conventions.resolve", "version": "1" }, { "ruleId": "detailing.BNBC2020_BD", "version": "2026.07" }, { "ruleId": "earthwork.pit_rect", "version": "1" }, { "ruleId": "finish.surface.paint", "version": "1" }, { "ruleId": "finish.surface.plaster", "version": "1" }, { "ruleId": "masonry.brick_wall.volume", "version": "1" }, { "ruleId": "member.volume", "version": "1" }, { "ruleId": "pcc.blinding_rect", "version": "1" }, { "ruleId": "piling.bored.count", "version": "1" }, { "ruleId": "piling.bored.length", "version": "1" }, { "ruleId": "rcc.beam.concrete", "version": "1" }, { "ruleId": "rcc.beam.formwork", "version": "1" }, { "ruleId": "rcc.column.concrete", "version": "1" }, { "ruleId": "rcc.foundation.prism_poly", "version": "1" }, { "ruleId": "rcc.foundation.prism_rect", "version": "1" }, { "ruleId": "rcc.lintel.concrete", "version": "1" }, { "ruleId": "rcc.lintel.formwork", "version": "1" }, { "ruleId": "rcc.pile.concrete", "version": "1" }, { "ruleId": "rcc.rebar.cutting_length", "version": "1" }, { "ruleId": "rcc.rebar.mass", "version": "1" }, { "ruleId": "rcc.rebar.stock", "version": "1" }, { "ruleId": "rcc.rebar.synthesis", "version": "1" }, { "ruleId": "rcc.tie_beam.concrete", "version": "1" }, { "ruleId": "rcc.tie_beam.formwork", "version": "1" }]'::json
	);
--> statement-breakpoint
SELECT set_config('cubit.system_reason', '', false);
