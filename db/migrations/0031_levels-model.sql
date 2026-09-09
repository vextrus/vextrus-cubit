CREATE TABLE "levels" (
	"tenant_id" uuid NOT NULL,
	"level_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"ordinal" integer NOT NULL,
	"inserted_act_id" uuid NOT NULL,
	"repudiated_act_id" uuid,
	"inserted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storey_height_readings" (
	"tenant_id" uuid NOT NULL,
	"reading_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"reading_key" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"basis" text NOT NULL,
	"source_key" text,
	"value_as_written" text NOT NULL,
	"unit_as_written" text NOT NULL,
	"canonical_metres" text NOT NULL,
	"factor" text NOT NULL,
	"factor_provenance" text NOT NULL,
	"act_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storey_height_readings_basis_closed" CHECK ("storey_height_readings"."basis" in ('TRANSCRIBED', 'DERIVED', 'ENTERED'))
);
--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_inserted_act_id_acts_act_id_fk" FOREIGN KEY ("inserted_act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_repudiated_act_id_acts_act_id_fk" FOREIGN KEY ("repudiated_act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storey_height_readings" ADD CONSTRAINT "storey_height_readings_level_id_levels_level_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("level_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storey_height_readings" ADD CONSTRAINT "storey_height_readings_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "levels_by_project" ON "levels" USING btree ("tenant_id","project_id","ordinal");--> statement-breakpoint
CREATE INDEX "storey_height_readings_by_level" ON "storey_height_readings" USING btree ("tenant_id","level_id","read_at");--> statement-breakpoint
ALTER TABLE "levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "levels" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "levels_tenant_scope" ON "levels"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "levels_system_scope" ON "levels"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "storey_height_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "storey_height_readings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "storey_height_readings_tenant_scope" ON "storey_height_readings"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "storey_height_readings_system_scope" ON "storey_height_readings"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- L-MEA-07: "a level with live rows is never deleted, only repudiated". So the runtime role holds no
-- DELETE on either table, and the guarantee is the store's rather than the door's habit. A level IS
-- moved in place, and only by an act: an insert below it pushes its ordinal up (L-MEA-07: "ordinals
-- above move") and a repudiation marks it, so the level table is updatable.
--
-- A reading is not. R-TO-051: "every human change is an act adding a competing observation with
-- declared precedence; nothing overwrites" — a re-affirmation is another reading under the same key,
-- never a rewrite of the one it supersedes, so the role adds readings and reads them and nothing else.
GRANT SELECT, INSERT, UPDATE ON TABLE "levels" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "storey_height_readings" TO "cubit_app";--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the rule
-- (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "levels_never_taken_away" BEFORE DELETE ON "levels"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "levels_never_taken_away_truncate" BEFORE TRUNCATE ON "levels"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "storey_height_readings_append_only" BEFORE UPDATE OR DELETE ON "storey_height_readings"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "storey_height_readings_append_only_truncate" BEFORE TRUNCATE ON "storey_height_readings"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();