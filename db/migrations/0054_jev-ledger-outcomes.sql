CREATE TABLE "model_call_outcomes" (
	"tenant_id" uuid NOT NULL,
	"outcome_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"question" text NOT NULL,
	"outcome" text NOT NULL,
	"act_id" uuid,
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"recorded_seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "model_call_outcomes_recorded_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	CONSTRAINT "model_call_outcomes_closed" CHECK ("model_call_outcomes"."outcome" in ('CONFIRMED', 'OVERRULED', 'REPUDIATED', 'AFFIRMED'))
);
--> statement-breakpoint
ALTER TABLE "model_calls" ADD COLUMN "question" text;--> statement-breakpoint
ALTER TABLE "model_calls" ADD COLUMN "judgment" json;--> statement-breakpoint
ALTER TABLE "model_call_outcomes" ADD CONSTRAINT "model_call_outcomes_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_call_outcomes" ADD CONSTRAINT "model_call_outcomes_call_fk" FOREIGN KEY ("tenant_id","call_id") REFERENCES "public"."model_calls"("tenant_id","call_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_call_outcomes_by_question" ON "model_call_outcomes" USING btree ("tenant_id","project_id","question");--> statement-breakpoint
CREATE INDEX "model_call_outcomes_by_call" ON "model_call_outcomes" USING btree ("tenant_id","call_id","recorded_seq");
--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
--
-- L-AI-01, L-AI-02: the ledger's outcome column is tenant data — what a workspace's people did with
-- the proposals a model made for them — and wears the seam's full posture: row-level security
-- ENABLED and FORCED, the tenant scope every statement of a tenant's own session satisfies, and the
-- system scope a named reason opens for the platform's own work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "model_call_outcomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "model_call_outcomes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "model_call_outcomes_tenant_scope" ON "model_call_outcomes"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "model_call_outcomes_system_scope" ON "model_call_outcomes"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- An outcome is a record of what a person did with a model's proposal: the app role appends rows
-- and reads them, and holds no privilege that writes one away. A second judgment of the same call
-- is a newer row, never an edit of this one.
GRANT SELECT, INSERT ON TABLE "model_call_outcomes" TO "cubit_app";--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the
-- rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "model_call_outcomes_append_only" BEFORE UPDATE OR DELETE ON "model_call_outcomes"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "model_call_outcomes_append_only_truncate" BEFORE TRUNCATE ON "model_call_outcomes"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();