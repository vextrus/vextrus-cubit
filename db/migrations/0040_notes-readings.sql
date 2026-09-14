CREATE TABLE "notes_readings" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"layout_name" text NOT NULL,
	"reading_key" text NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"value_as_written" text NOT NULL,
	"unit_as_written" text NOT NULL,
	"canonical" text NOT NULL,
	"basis" text NOT NULL,
	"acceptance" text NOT NULL,
	"act_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_readings_key" PRIMARY KEY("tenant_id","act_id","reading_key"),
	CONSTRAINT "notes_readings_kind_closed" CHECK ("notes_readings"."kind" in ('FY', 'FC', 'LAP', 'HOOK', 'HOOK_MIN')),
	CONSTRAINT "notes_readings_basis_transcribed" CHECK ("notes_readings"."basis" = 'TRANSCRIBED'),
	CONSTRAINT "notes_readings_acceptance_closed" CHECK ("notes_readings"."acceptance" in ('ACCEPTED', 'EDITED'))
);
--> statement-breakpoint
CREATE INDEX "notes_readings_by_sheet" ON "notes_readings" USING btree ("tenant_id","drawing_id","layout_name");--> statement-breakpoint
ALTER TABLE "notes_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes_readings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "notes_readings_tenant_scope" ON "notes_readings"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "notes_readings_system_scope" ON "notes_readings"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- R-TO-051: "every human change is an act adding a competing observation with declared precedence;
-- nothing overwrites". A re-reading of a note is another row under the same key, never a rewrite of
-- the one it supersedes, so the runtime role adds readings and reads them and nothing else.
GRANT SELECT, INSERT ON TABLE "notes_readings" TO "cubit_app";--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the
-- rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "notes_readings_append_only" BEFORE UPDATE OR DELETE ON "notes_readings"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "notes_readings_append_only_truncate" BEFORE TRUNCATE ON "notes_readings"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();
