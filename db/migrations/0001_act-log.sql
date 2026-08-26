CREATE TABLE "acts" (
	"tenant_id" uuid NOT NULL,
	"act_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"act_type" text NOT NULL,
	"subjects" jsonb NOT NULL,
	"consequence_digest" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_roles" (
	"tenant_id" uuid NOT NULL,
	"grant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"act_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_roles_role_once" UNIQUE("tenant_id","project_id","user_id","role")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_tenant_id_project_id_user_id_pk" PRIMARY KEY("tenant_id","project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_actor_participates_fk" FOREIGN KEY ("tenant_id","project_id","actor_id") REFERENCES "public"."participants"("tenant_id","project_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_roles" ADD CONSTRAINT "participant_roles_participant_fk" FOREIGN KEY ("tenant_id","project_id","user_id") REFERENCES "public"."participants"("tenant_id","project_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_roles" ADD CONSTRAINT "participant_roles_act_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Row-level security, its policies, the act log's owner-proof immutability and the app role's
-- privileges are written by hand and appended here, in the form 0000_tenancy-base.sql set: the
-- drift lane proves the schema and the committed migrations agree by generating into a scratch
-- directory, and that proof only holds while the generated DDL above is what the generator would
-- write.
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "participants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "participants_tenant_scope" ON "participants"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "participants_system_scope" ON "participants"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "acts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "acts_tenant_scope" ON "acts"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "acts_system_scope" ON "acts"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "participant_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participant_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "participant_roles_tenant_scope" ON "participant_roles"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "participant_roles_system_scope" ON "participant_roles"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- L-ACT-01/L-ACT-03: the act log and the participation it points at are append-only, and the belt is
-- owner-proof — "the most consequential ledger never wears weaker belts than the parameter store".
-- One function for all three tables: the rule is one rule, and it names the table it fired for.
CREATE FUNCTION "cubit_append_only"() RETURNS trigger LANGUAGE plpgsql AS $cubit_append_only$
BEGIN
	RAISE EXCEPTION 'the % ledger is append-only: a row written is immutable, and % is not a write anybody may make', TG_TABLE_NAME, TG_OP
		USING ERRCODE = '42501';
	RETURN NULL;
END
$cubit_append_only$;--> statement-breakpoint
CREATE TRIGGER "participants_append_only" BEFORE UPDATE OR DELETE ON "participants"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "participants_append_only_truncate" BEFORE TRUNCATE ON "participants"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "acts_append_only" BEFORE UPDATE OR DELETE ON "acts"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "acts_append_only_truncate" BEFORE TRUNCATE ON "acts"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "participant_roles_append_only" BEFORE UPDATE OR DELETE ON "participant_roles"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "participant_roles_append_only_truncate" BEFORE TRUNCATE ON "participant_roles"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
-- Append-only privileges: the app role may read and write the log, and nothing it holds can name an
-- UPDATE or a DELETE at all — the trigger above is what makes the same true of the owner.
GRANT SELECT, INSERT ON TABLE "participants" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "acts" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "participant_roles" TO "cubit_app";
