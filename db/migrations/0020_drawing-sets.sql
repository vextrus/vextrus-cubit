CREATE TABLE "drawing_set_members" (
	"tenant_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_set_members_pk" PRIMARY KEY("tenant_id","set_id","drawing_id")
);
--> statement-breakpoint
CREATE TABLE "drawing_set_revisions" (
	"tenant_id" uuid NOT NULL,
	"set_revision_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"digest" text NOT NULL,
	"manifest" json NOT NULL,
	"act_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drawing_sets" (
	"tenant_id" uuid NOT NULL,
	"set_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_sets_named_once" UNIQUE("tenant_id","project_id","name")
);
--> statement-breakpoint
ALTER TABLE "drawing_set_members" ADD CONSTRAINT "drawing_set_members_set_id_drawing_sets_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."drawing_sets"("set_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_members" ADD CONSTRAINT "drawing_set_members_drawing_id_drawings_drawing_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("drawing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" ADD CONSTRAINT "drawing_set_revisions_set_id_drawing_sets_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."drawing_sets"("set_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" ADD CONSTRAINT "drawing_set_revisions_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drawing_set_revisions_by_set" ON "drawing_set_revisions" USING btree ("tenant_id","set_id","created_at");--> statement-breakpoint
CREATE INDEX "drawing_sets_by_project" ON "drawing_sets" USING btree ("tenant_id","project_id","created_at");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "drawing_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "drawing_sets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "drawing_sets_tenant_scope" ON "drawing_sets"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "drawing_sets_system_scope" ON "drawing_sets"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "drawing_set_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drawing_set_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "drawing_set_members_tenant_scope" ON "drawing_set_members"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "drawing_set_members_system_scope" ON "drawing_set_members"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drawing_set_revisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "drawing_set_revisions_tenant_scope" ON "drawing_set_revisions"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "drawing_set_revisions_system_scope" ON "drawing_set_revisions"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A set and every revision pinned on it are records of something that happened (R-TO-005, L-REG-06):
-- the app role appends rows and reads them, and holds no privilege that writes one away.
GRANT SELECT, INSERT ON TABLE "drawing_sets" TO "cubit_app";
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "drawing_set_revisions" TO "cubit_app";
--> statement-breakpoint
-- Membership between pins is a draft nothing is derived from (I-B), so the runtime may take a row
-- of it away — and may never rewrite one, because a changed membership is an addition and a removal.
GRANT SELECT, INSERT, DELETE ON TABLE "drawing_set_members" TO "cubit_app";
--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the
-- rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "drawing_sets_append_only" BEFORE UPDATE OR DELETE ON "drawing_sets"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "drawing_sets_append_only_truncate" BEFORE TRUNCATE ON "drawing_sets"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "drawing_set_revisions_append_only" BEFORE UPDATE OR DELETE ON "drawing_set_revisions"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "drawing_set_revisions_append_only_truncate" BEFORE TRUNCATE ON "drawing_set_revisions"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();