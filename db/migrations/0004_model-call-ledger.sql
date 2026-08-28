CREATE TABLE "model_calls" (
	"call_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"transport" text NOT NULL,
	"outcome" text NOT NULL,
	"refusal_code" text,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"attributed_cost" numeric NOT NULL,
	"called_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_calls_transport_closed" CHECK ("model_calls"."transport" in ('live', 'fixture')),
	CONSTRAINT "model_calls_outcome_closed" CHECK ("model_calls"."outcome" in ('proposed', 'refused')),
	CONSTRAINT "model_calls_refusal_code_iff_refused" CHECK (("model_calls"."refusal_code" is not null) = ("model_calls"."outcome" = 'refused')),
	CONSTRAINT "model_calls_tokens_counted" CHECK ("model_calls"."input_tokens" >= 0 and "model_calls"."output_tokens" >= 0),
	CONSTRAINT "model_calls_cost_is_money" CHECK ("model_calls"."attributed_cost" >= 0 and "model_calls"."attributed_cost" < 'Infinity'::numeric)
);
--> statement-breakpoint
CREATE TABLE "model_fixtures" (
	"tenant_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"fixture_digest" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_fixtures_tenant_id_request_hash_pk" PRIMARY KEY("tenant_id","request_hash")
);
--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_fixtures" ADD CONSTRAINT "model_fixtures_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_calls_by_project" ON "model_calls" USING btree ("tenant_id","project_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Row-level security, its policies, the ledger's owner-proof immutability and the app role's
-- privileges are written by hand and appended here, in the form 0000_tenancy-base.sql set: the drift
-- lane proves the schema and the committed migrations agree by generating into a scratch directory,
-- and that proof only holds while the generated DDL above is what the generator would write.
ALTER TABLE "model_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "model_calls" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "model_calls_tenant_scope" ON "model_calls"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "model_calls_system_scope" ON "model_calls"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "model_fixtures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "model_fixtures" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "model_fixtures_tenant_scope" ON "model_fixtures"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "model_fixtures_system_scope" ON "model_fixtures"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- L-AI-01: the model-call ledger is written by the machine and never unwritten — a record of every
-- call is only a record while the calls that embarrassed somebody are still in it. The belt is the
-- one the tree already carries (0001_act-log.sql's "cubit_append_only"): one rule, one home (B-17).
CREATE TRIGGER "model_calls_append_only" BEFORE UPDATE OR DELETE ON "model_calls"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "model_calls_append_only_truncate" BEFORE TRUNCATE ON "model_calls"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "model_fixtures_append_only" BEFORE UPDATE OR DELETE ON "model_fixtures"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "model_fixtures_append_only_truncate" BEFORE TRUNCATE ON "model_fixtures"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
-- Append-only privileges: the app role may read the ledger and add to it, and holds no privilege
-- that writes a row away — the triggers above are what make the same true of the owner.
GRANT SELECT, INSERT ON TABLE "model_calls" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "model_fixtures" TO "cubit_app";
