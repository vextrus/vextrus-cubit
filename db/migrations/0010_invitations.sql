CREATE TABLE "invitations" (
	"invitation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invited_email_key" text NOT NULL,
	"workspace_role" text DEFAULT 'MEMBER' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitations_workspace_role_closed" CHECK ("invitations"."workspace_role" in ('OWNER', 'ADMIN', 'MEMBER'))
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand for the reason every migration in this tree appends rather than declares: the
-- drift lane proves the schema and the committed migrations agree by generating into a scratch
-- directory, and that proof holds only while the generated DDL above is exactly what the generator
-- would write.
--
-- An invitation is an offer of membership, so the row that carries it decides who may join a
-- workspace. Reading stays tenant-scoped — a workspace's own handle sees its own pending offers and
-- nobody else's — and writing is system-only: there is no tenant-scoped write policy at all, so a
-- scoped session is refused as it writes rather than told nothing (SEAM-TENANT, R-SPINE-006).
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "invitations_tenant_scope" ON "invitations"
	FOR SELECT
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- and a statement made without one is a statement nobody can be asked about.
CREATE POLICY "invitations_system_scope" ON "invitations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "invitations" TO "cubit_app";
