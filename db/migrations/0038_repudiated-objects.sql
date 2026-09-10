CREATE TABLE "repudiated_objects" (
	"tenant_id" uuid NOT NULL,
	"repudiated_object_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_revision_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"act_id" uuid NOT NULL,
	"repudiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repudiated_objects_one_per_object" UNIQUE("tenant_id","set_revision_id","object_key")
);
--> statement-breakpoint
ALTER TABLE "repudiated_objects" ADD CONSTRAINT "repudiated_objects_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repudiated_objects_by_revision" ON "repudiated_objects" USING btree ("tenant_id","set_revision_id","repudiated_at");--> statement-breakpoint
ALTER TABLE "repudiated_objects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "repudiated_objects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "repudiated_objects_tenant_scope" ON "repudiated_objects"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "repudiated_objects_system_scope" ON "repudiated_objects"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- R-TO-051 and L-ACT-01: a repudiation is a person's judgement that an object is nothing, RECORDED —
-- the object, its readings and every line measured off it stand exactly as they did. So the runtime
-- role adds a row and reads one, and holds no UPDATE and no DELETE: unsaying a repudiation is another
-- act, never an edit of this one.
GRANT SELECT, INSERT ON TABLE "repudiated_objects" TO "cubit_app";
--> statement-breakpoint
-- L-ACT-03's owner-proof belt: an append-only the owner escapes is not an append-only. The function is
-- the tree's one spelling of the rule (0001_act-log.sql's "cubit_append_only") — one rule, one home
-- (B-17).
CREATE TRIGGER "repudiated_objects_append_only" BEFORE UPDATE OR DELETE ON "repudiated_objects"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "repudiated_objects_append_only_truncate" BEFORE TRUNCATE ON "repudiated_objects"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();