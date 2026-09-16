-- The REBAR area joins the closed rosters: one kind, `rcc.rebar`, borne by the ten element classes
-- that hold steel — so every CHECK written from `closedList(KINDS)` is re-stated over the roster the
-- tree now closes over (L-MEA-04, AM-11). No element class is added: reinforcement is measured in
-- the members that already stand.
--
-- Re-stated, never edited: 0028, 0032, 0033, 0039, 0041, 0043 and 0045 stand as they landed, and
-- this migration drops the CHECK each of them installed and adds the same CHECK over the grown
-- roster — history is append-only, and a landed migration is superseded rather than rewritten (B-20).
--
-- And it builds `bar_rows`, L-REG-04's bill of bars: one CONTENT-KEYED row per (member, role,
-- diameter, group), carrying the three BS 8666 lengths AM-01 names side by side — the raw length
-- never rounded, the one rounded surface, and the IS 2502 additive figure recorded beside them and
-- billed by nothing — with what the bar weighs, net and lapped (L-FRM-05, AM-03).
--
-- L-MEA-04: the catalogue is CODE-OWNED — "a kind, a work item or a borne class changes by an edit
-- to the consts, a re-emission and a migration, and by no other path" (0028). The rows below are
-- `db/catalogue/work-items.json` and `db/catalogue/bears.json` as the emitter wrote them from the
-- consts this increment moved, and the catalogue-drift stage is what keeps the three copies from
-- parting company. As 0041, 0043 and 0045 did, the force is lifted for exactly those statements and
-- restored immediately: a migration names no tenant and satisfies no policy, and `cubit_app` still
-- holds no privilege that writes either table.
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
ALTER TABLE "scope_declarations" ADD CONSTRAINT "scope_declarations_kind_closed" CHECK ("scope_declarations"."kind" in ('rcc.concrete', 'rcc.formwork', 'piling.bored', 'piling.boring', 'earthwork.excavation', 'pcc.blinding', 'masonry.brickwork', 'finish.plaster', 'finish.paint', 'rcc.rebar'));--> statement-breakpoint
-- SEAM-TENANT: the bill of bars is tenant data, so it wears the seam's full posture — row-level
-- security ENABLED and FORCED, the tenant scope every statement of a tenant's own session satisfies,
-- and the system scope a named reason opens for the platform's own work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "bar_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bar_rows" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "bar_rows_tenant_scope" ON "bar_rows"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "bar_rows_system_scope" ON "bar_rows"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- DELETE and INSERT and no UPDATE: a campaign's bill of bars is REPLACED whole on every measurement,
-- because the keys are derived from content and an unchanged campaign re-measures to the identical
-- key multiset (L-REG-04). A content-keyed row is rewritten, never amended — so there is no
-- statement the app role could make that an UPDATE privilege would let it make honestly.
GRANT SELECT, INSERT, DELETE ON TABLE "bar_rows" TO "cubit_app";--> statement-breakpoint
ALTER TABLE "work_items" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "work_items" ("kind", "description", "canonical_unit", "dimension", "document_precision")
	VALUES ('rcc.rebar', 'Reinforcement steel in place, measured as nominal mass with laps billed beside the net', 'kg', 'MASS', 3);--> statement-breakpoint
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
		('lintel', 'rcc.rebar');--> statement-breakpoint
ALTER TABLE "work_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bears" FORCE ROW LEVEL SECURITY;
