CREATE TABLE "sheet_understanding_dispositions" (
	"tenant_id" uuid NOT NULL,
	"disposition_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"sheet_id" text NOT NULL,
	"disposition" text NOT NULL,
	"proposed" json NOT NULL,
	"resolved" json,
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"recorded_seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "sheet_understanding_dispositions_recorded_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	CONSTRAINT "sheet_understanding_dispositions_closed" CHECK ("sheet_understanding_dispositions"."disposition" in ('accepted', 'edited', 'rejected')),
	CONSTRAINT "sheet_understanding_dispositions_resolved_iff_edited" CHECK (("sheet_understanding_dispositions"."resolved" is not null) = ("sheet_understanding_dispositions"."disposition" = 'edited'))
);
--> statement-breakpoint
-- Ahead of the composite foreign key below, which references it: the generator emits its ALTERs
-- table by table, and a reference to a key that does not exist yet cannot be added.
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_call_per_tenant" UNIQUE("tenant_id","call_id");--> statement-breakpoint
ALTER TABLE "sheet_understanding_dispositions" ADD CONSTRAINT "sheet_understanding_dispositions_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_understanding_dispositions" ADD CONSTRAINT "sheet_understanding_dispositions_call_fk" FOREIGN KEY ("tenant_id","call_id") REFERENCES "public"."model_calls"("tenant_id","call_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sheet_understanding_dispositions_by_project" ON "sheet_understanding_dispositions" USING btree ("tenant_id","project_id","created_at","recorded_seq");--> statement-breakpoint
CREATE INDEX "sheet_understanding_dispositions_by_call" ON "sheet_understanding_dispositions" USING btree ("tenant_id","call_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "sheet_understanding_dispositions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "sheet_understanding_dispositions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sheet_understanding_dispositions_tenant_scope" ON "sheet_understanding_dispositions"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "sheet_understanding_dispositions_system_scope" ON "sheet_understanding_dispositions"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A disposition is a record of what a person did with a model's reading (R-AI-001): the app role
-- appends rows and reads them, and holds no privilege that writes one away. A second disposition of
-- the same proposal is a newer row, never an edit of this one.
GRANT SELECT, INSERT ON TABLE "sheet_understanding_dispositions" TO "cubit_app";
--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the
-- rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "sheet_understanding_dispositions_append_only" BEFORE UPDATE OR DELETE ON "sheet_understanding_dispositions"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "sheet_understanding_dispositions_append_only_truncate" BEFORE TRUNCATE ON "sheet_understanding_dispositions"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();