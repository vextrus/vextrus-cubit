CREATE TABLE "refused_sightings" (
	"tenant_id" uuid NOT NULL,
	"refused_sighting_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"refusal" text NOT NULL,
	"discipline" text NOT NULL,
	"element_type" text NOT NULL,
	"mark" text NOT NULL,
	"view_key" text NOT NULL,
	"placement_key" text NOT NULL,
	"semantic" text NOT NULL,
	"sighting" json NOT NULL,
	"refused_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refused_sightings_refusal_closed" CHECK ("refused_sightings"."refusal" in ('DUPLICATE_IDENTITY')),
	CONSTRAINT "refused_sightings_discipline_closed" CHECK ("refused_sightings"."discipline" in ('STRUCTURAL', 'ARCHITECTURAL', 'MEP', 'CIVIL', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "register_attributes" (
	"tenant_id" uuid NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"attribute" text NOT NULL,
	"authority" text NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "register_attributes_key" PRIMARY KEY("tenant_id","set_revision_id","object_key","attribute"),
	CONSTRAINT "register_attributes_authority_closed" CHECK ("register_attributes"."authority" in ('STRUCTURAL', 'ARCHITECTURAL', 'MEP', 'CIVIL', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "register_objects" (
	"tenant_id" uuid NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"project_id" uuid NOT NULL,
	"discipline" text NOT NULL,
	"element_type" text NOT NULL,
	"mark" text NOT NULL,
	"view_key" text NOT NULL,
	"placement_key" text NOT NULL,
	"level_id" uuid,
	"level_slot" text,
	"level_label" text,
	"standing" text NOT NULL,
	"semantic" text NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "register_objects_key" PRIMARY KEY("tenant_id","set_revision_id","object_key"),
	CONSTRAINT "register_objects_discipline_closed" CHECK ("register_objects"."discipline" in ('STRUCTURAL', 'ARCHITECTURAL', 'MEP', 'CIVIL', 'OTHER')),
	CONSTRAINT "register_objects_standing_closed" CHECK ("register_objects"."standing" in ('MEASURED', 'DERIVED')),
	CONSTRAINT "register_objects_level_slot_closed" CHECK ("register_objects"."level_slot" is null or "register_objects"."level_slot" in ('FOUNDATION', 'UNRESOLVED')),
	CONSTRAINT "register_objects_level_stated_once" CHECK (num_nonnulls("register_objects"."level_id", "register_objects"."level_slot", "register_objects"."level_label") = 1)
);
--> statement-breakpoint
CREATE TABLE "register_observations" (
	"tenant_id" uuid NOT NULL,
	"observation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"attribute" text NOT NULL,
	"value_as_written" text NOT NULL,
	"unit_as_written" text NOT NULL,
	"canonical_value" text NOT NULL,
	"canonical_unit" text NOT NULL,
	"factor" text NOT NULL,
	"factor_provenance" text NOT NULL,
	"basis" text NOT NULL,
	"source_key" text NOT NULL,
	"precedence" integer NOT NULL,
	"act_id" uuid,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "register_observations_unit_closed" CHECK ("register_observations"."canonical_unit" in ('kg', 'MT', 'lb', 'm3', 'cft', 'm', 'ft', 'm2', 'sft', 'pcs')),
	CONSTRAINT "register_observations_basis_closed" CHECK ("register_observations"."basis" in ('TRANSCRIBED', 'ENTERED')),
	CONSTRAINT "register_observations_precedence_not_negative" CHECK ("register_observations"."precedence" >= 0)
);
--> statement-breakpoint
ALTER TABLE "register_attributes" ADD CONSTRAINT "register_attributes_object_fk" FOREIGN KEY ("tenant_id","set_revision_id","object_key") REFERENCES "public"."register_objects"("tenant_id","set_revision_id","object_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_set_revision_id_drawing_set_revisions_set_revision_id_fk" FOREIGN KEY ("set_revision_id") REFERENCES "public"."drawing_set_revisions"("set_revision_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_observations" ADD CONSTRAINT "register_observations_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "register_observations" ADD CONSTRAINT "register_observations_attribute_fk" FOREIGN KEY ("tenant_id","set_revision_id","object_key","attribute") REFERENCES "public"."register_attributes"("tenant_id","set_revision_id","object_key","attribute") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refused_sightings_by_revision" ON "refused_sightings" USING btree ("tenant_id","set_revision_id","refused_at");--> statement-breakpoint
CREATE INDEX "register_objects_by_revision" ON "register_objects" USING btree ("tenant_id","set_revision_id","registered_at");--> statement-breakpoint
CREATE INDEX "register_objects_by_mark" ON "register_objects" USING btree ("tenant_id","set_revision_id","mark");--> statement-breakpoint
CREATE INDEX "register_observations_by_attribute" ON "register_observations" USING btree ("tenant_id","set_revision_id","object_key","attribute","observed_at");--> statement-breakpoint
-- hand-written: row-level security, grants and the append-only belt (SEAM-TENANT, L-REG-01, L-REG-03)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
--
-- Every one of the four carries tenant_id, so every one is scoped by the store and not by a caller's
-- WHERE. WITH FORCE: without it the table's owner reads and writes past its own policies, and a
-- guarantee the owner escapes is not a guarantee (SEAM-TENANT). System scope is armed by a non-empty
-- reason and by nothing else — the reason IS the attribution.
ALTER TABLE "register_objects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "register_objects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "register_objects_tenant_scope" ON "register_objects"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "register_objects_system_scope" ON "register_objects"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "refused_sightings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refused_sightings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "refused_sightings_tenant_scope" ON "refused_sightings"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "refused_sightings_system_scope" ON "refused_sightings"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "register_attributes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "register_attributes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "register_attributes_tenant_scope" ON "register_attributes"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "register_attributes_system_scope" ON "register_attributes"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "register_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "register_observations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "register_observations_tenant_scope" ON "register_observations"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "register_observations_system_scope" ON "register_observations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- The register is the system of record for physical scope (L-REG-01): a row of it is evidence of
-- something somebody measured, refused, declared or read. So the runtime role adds rows and reads
-- them, and holds no privilege that TAKES one away — the same retention the act log holds, for the
-- same reason (R-TO-051, L-ACT-01).
--
-- A refusal, an attribute slot and an observation are records of something that happened, so none of
-- them is rewritten either: a correction to one of those is another row. A register OBJECT is not
-- such a record — it is the standing identity itself, and the law moves one in place twice: a
-- measured sighting landing where a level expansion stands promotes the row (DERIVED → MEASURED,
-- L-REG-03) and authoring a level carries its key exactly once (L-REG-04). So the object table is
-- updatable, and the belt below keeps only what no clause ever undoes: nothing is deleted.
GRANT SELECT, INSERT, UPDATE ON TABLE "register_objects" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "refused_sightings" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "register_attributes" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "register_observations" TO "cubit_app";--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the rule
-- (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "register_objects_never_taken_away" BEFORE DELETE ON "register_objects"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "register_objects_never_taken_away_truncate" BEFORE TRUNCATE ON "register_objects"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "refused_sightings_append_only" BEFORE UPDATE OR DELETE ON "refused_sightings"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "refused_sightings_append_only_truncate" BEFORE TRUNCATE ON "refused_sightings"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "register_attributes_append_only" BEFORE UPDATE OR DELETE ON "register_attributes"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "register_attributes_append_only_truncate" BEFORE TRUNCATE ON "register_attributes"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "register_observations_append_only" BEFORE UPDATE OR DELETE ON "register_observations"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "register_observations_append_only_truncate" BEFORE TRUNCATE ON "register_observations"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();