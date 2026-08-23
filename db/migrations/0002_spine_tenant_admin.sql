CREATE TABLE "acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"act_type" text NOT NULL,
	"campaign_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_role_check" CHECK ("invitations"."role" in ('owner', 'admin', 'member')),
	CONSTRAINT "invitations_status_check" CHECK ("invitations"."status" in ('pending', 'revoked', 'accepted'))
);
--> statement-breakpoint
ALTER TABLE "auth_mail_outbox" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "auth_mail_outbox" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_role_check" CHECK ("tenant_memberships"."role" in ('owner', 'admin', 'member'));--> statement-breakpoint
-- SEAM-TENANT's backstop for tenant administration, hand-written below the generated DDL and
-- copying 0001_spine_auth.sql's shape exactly (which copies 0000_core_founding.sql's, and
-- explains why the head of the journal stays schema-derived and the SQL that has no schema to
-- be derived from rides underneath it). 0000 and 0001 are never edited — they are superseded.
--
-- Both new tables carry `tenant_id`, so both take the two-arm form: a tenant-scoped handle
-- sees its own rows and cannot write another tenant's. The policy fails closed —
-- `current_setting(..., true)` is NULL on a connection nobody scoped, and a policy that is
-- not true refuses.
-- The reads every request makes. The invitations section lists one tenant's pending rows, and
-- `MEMBER_HAS_ACTS` asks whether one actor holds an act on an open campaign; both were
-- sequential scans whose cost grows with the table.
CREATE INDEX "invitations_tenant_id_status_idx" ON "invitations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "acts_actor_id_idx" ON "acts" USING btree ("actor_id");--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "invitations" AS PERMISSIVE FOR ALL TO PUBLIC
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
ALTER TABLE "acts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "acts" AS PERMISSIVE FOR ALL TO PUBLIC
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
-- The invitation mail is a fourth kind of mail this product sends (docs/design/s-settings.md
-- §9). 0001 closed the column over the three the identity spine had; the constraint is
-- replaced rather than edited, which is what superseding a landed migration looks like in SQL.
ALTER TABLE "auth_mail_outbox" DROP CONSTRAINT "auth_mail_outbox_kind_check";--> statement-breakpoint
ALTER TABLE "auth_mail_outbox" ADD CONSTRAINT "auth_mail_outbox_kind_check"
	CHECK ("kind" IN ('verify', 'magic-link', 'reset', 'invite'));--> statement-breakpoint
-- Retention, widened to the body. 0001's sweep blanks the `url` after 24 hours because a live
-- link is a bearer credential; the invitation mail's body quotes that same link inside its
-- sentence, so a sweep that cleared only the column would leave the credential in the prose.
CREATE OR REPLACE FUNCTION "auth_mail_outbox_redact"() RETURNS trigger
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
	UPDATE "auth_mail_outbox"
		SET "url" = '', "body" = NULL
		WHERE "created_at" < now() - interval '24 hours'
			AND ("url" <> '' OR "body" IS NOT NULL);
	RETURN NULL;
END;
$$;--> statement-breakpoint
-- Grants (V-DB). `invitations` is SELECT, INSERT and UPDATE: revoking an invitation moves its
-- status out of pending and never deletes the row, because history is not deleted
-- (Interpretation 5). `acts` is SELECT and INSERT alone — an act that can be edited or deleted
-- is not a record of what happened. `tenant_memberships` gains DELETE, which is what removing
-- a member is; 0001 granted it before there was any way to remove one.
REVOKE ALL ON TABLE "invitations" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "acts" FROM PUBLIC;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "invitations" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "acts" TO "cubit_app";--> statement-breakpoint
GRANT DELETE ON TABLE "tenant_memberships" TO "cubit_app";
