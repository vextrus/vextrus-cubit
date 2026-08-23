CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_mail_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_tenant_slug" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_tenant_id_user_id_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_account_id_unique" ON "accounts" USING btree ("issuer","account_id");--> statement-breakpoint
-- SEAM-TENANT's backstop for the identity spine, hand-written below the generated DDL and
-- copying 0000_core_founding.sql's shape exactly (that file explains why the head of the
-- journal stays schema-derived and the SQL that has no schema to be derived from rides
-- underneath it).
--
-- Five of the six tables carry no tenant: a user may belong to many tenants (R-SPINE-002),
-- so `users`, `sessions`, `accounts`, `verifications` and `auth_mail_outbox` are the auth
-- seam's own rows and their policy is the system arm alone. `tenant_memberships` carries
-- `tenant_id` and therefore takes the two-arm form, which is what makes forTenant() see one
-- tenant's memberships and refuse to write another's (db/__tests__/probes/spine.ts).
--
-- The policy fails closed on every one of them: `current_setting(..., true)` is NULL on a
-- connection nobody scoped, and a policy that is not true refuses.
-- Indexes for the reads every request makes. `activeTenantSlugFor` and `membershipOf`
-- (src/server/tenancy.ts) filter `tenant_memberships` by `user_id` on every `/t` screen and
-- every auth-guarded page, and better-auth lists and cleans sessions by `user_id`. The only
-- b-tree either table had was UNIQUE(tenant_id, user_id), whose leading column is the wrong
-- one for those reads, so both were sequential scans whose cost grows with the table.
CREATE INDEX "tenant_memberships_user_id_idx" ON "tenant_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
-- The whole of `kind ∈ {'verify','magic-link','reset'}` (the increment's mail seam), said
-- where it cannot be forgotten. src/server/mail.ts types it; the table now refuses anything
-- else, so a later delivery driver reading these rows cannot meet a kind nobody handles.
ALTER TABLE "auth_mail_outbox" ADD CONSTRAINT "auth_mail_outbox_kind_check"
	CHECK ("kind" IN ('verify', 'magic-link', 'reset'));--> statement-breakpoint
-- Retention. A row's `url` is the absolute, actionable link — a bearer credential — so a
-- table that keeps every one of them forever is a store anything running under
-- `cubit.scope='system'` can sign in from, as any user who ever asked for a link. The record
-- of the send is what the seam is for and it stays; the credential does not outlive the token
-- inside it. The sweep rides on the next insert (there is no scheduler at M0) and is a
-- statement-level trigger, so a burst of mail costs one sweep, and the index below keeps it
-- from scanning the table to find nothing.
CREATE INDEX "auth_mail_outbox_created_at_idx" ON "auth_mail_outbox" USING btree ("created_at");--> statement-breakpoint
-- SECURITY DEFINER, and `search_path` pinned with it: `cubit_app` is granted SELECT and
-- INSERT and nothing more, and the redaction is the one write that is allowed to be an
-- exception to that — narrowed to this function rather than opened up as a table grant, so
-- the outbox stays append-only to everything else. FORCEd RLS still binds the owner, and the
-- system-scope policy is what the app's own connection already satisfies.
CREATE FUNCTION "auth_mail_outbox_redact"() RETURNS trigger
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
	UPDATE "auth_mail_outbox"
		SET "url" = ''
		WHERE "created_at" < now() - interval '24 hours'
			AND "url" <> '';
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "auth_mail_outbox_redact_expired"
	AFTER INSERT ON "auth_mail_outbox"
	FOR EACH STATEMENT EXECUTE FUNCTION "auth_mail_outbox_redact"();--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "users" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (current_setting('cubit.scope', true) = 'system')
	WITH CHECK (current_setting('cubit.scope', true) = 'system');--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sessions" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (current_setting('cubit.scope', true) = 'system')
	WITH CHECK (current_setting('cubit.scope', true) = 'system');--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "accounts" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (current_setting('cubit.scope', true) = 'system')
	WITH CHECK (current_setting('cubit.scope', true) = 'system');--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "verifications" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (current_setting('cubit.scope', true) = 'system')
	WITH CHECK (current_setting('cubit.scope', true) = 'system');--> statement-breakpoint
ALTER TABLE "auth_mail_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_mail_outbox" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "auth_mail_outbox" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (current_setting('cubit.scope', true) = 'system')
	WITH CHECK (current_setting('cubit.scope', true) = 'system');--> statement-breakpoint
ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tenant_memberships" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND "tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
		)
	)
	WITH CHECK (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND "tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
		)
	);--> statement-breakpoint
-- Grants (V-DB). The app role is the one better-auth's adapter connects as, under system
-- scope. It DELETEs exactly where the spine's own acts are deletions: revoking a session and
-- signing out remove a `sessions` row, and a verification token is consumed — a token that
-- outlives its click is a token that can be replayed. Nothing else is deletable, and
-- `auth_mail_outbox` is append-only: a sent link is a record. Nothing is left to PUBLIC, so
-- `cubit_auth`, which was granted nothing, still holds nothing.
REVOKE ALL ON TABLE "users" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "sessions" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "accounts" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "verifications" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "tenant_memberships" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "auth_mail_outbox" FROM PUBLIC;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "users" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "sessions" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "accounts" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "verifications" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "tenant_memberships" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "auth_mail_outbox" TO "cubit_app";
