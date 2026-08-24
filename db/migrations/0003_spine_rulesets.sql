CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"rule_set_edition_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_set_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"tenant_id" uuid,
	"parent_edition_id" uuid,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"methods" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_set_editions_scope_check" CHECK ("rule_set_editions"."scope" in ('platform', 'tenant', 'project')),
	CONSTRAINT "rule_set_editions_lineage_check" CHECK (("rule_set_editions"."scope" = 'platform' and "rule_set_editions"."tenant_id" is null and "rule_set_editions"."parent_edition_id" is null)
          or ("rule_set_editions"."scope" <> 'platform' and "rule_set_editions"."tenant_id" is not null and "rule_set_editions"."parent_edition_id" is not null)),
	CONSTRAINT "rule_set_editions_digest_check" CHECK ("rule_set_editions"."digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_rule_set_edition_id_rule_set_editions_id_fk" FOREIGN KEY ("rule_set_edition_id") REFERENCES "public"."rule_set_editions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_editions" ADD CONSTRAINT "rule_set_editions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_editions" ADD CONSTRAINT "rule_set_editions_parent_edition_id_rule_set_editions_id_fk" FOREIGN KEY ("parent_edition_id") REFERENCES "public"."rule_set_editions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rule_set_editions_platform_key_uniq" ON "rule_set_editions" USING btree ("name","version") WHERE "rule_set_editions"."scope" = 'platform';--> statement-breakpoint
CREATE UNIQUE INDEX "rule_set_editions_tenant_template_uniq" ON "rule_set_editions" USING btree ("tenant_id","name","version") WHERE "rule_set_editions"."scope" = 'tenant';--> statement-breakpoint
CREATE INDEX "rule_set_editions_parent_edition_id_idx" ON "rule_set_editions" USING btree ("parent_edition_id");--> statement-breakpoint
-- SEAM-TENANT's backstop for the rule-set pin, hand-written below the generated DDL and
-- copying 0002_spine_tenant_admin.sql's shape exactly (which copies 0001's, and 0001 copies
-- 0000's). Landed migrations are superseded, never edited.
--
-- `projects` takes the two-arm form every tenant-carrying table takes: a tenant-scoped handle
-- reads its own projects and cannot write another tenant's. The policy fails closed —
-- `current_setting(..., true)` is NULL on a connection nobody scoped, and a policy that is not
-- true refuses.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "projects" AS PERMISSIVE FOR ALL TO PUBLIC
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
-- `rule_set_editions` takes the same two arms plus one the other tables have no need of: the
-- platform seed belongs to no tenant (`tenant_id` IS NULL) and every tenant scope reads it,
-- because a tenant that cannot see the seed cannot fork its template from it (L-REG-07's
-- "forked platform → tenant → project at creation, in one transaction"). The arm is on the
-- WITH CHECK too, for the one write that mints the seed inside that transaction; a row
-- carrying somebody else's tenant_id is still refused, which is what isolation means here.
--
-- On the WITH CHECK the platform arm is bounded to that one row and no other. A platform row
-- is readable by every tenant and, by the trigger below, can never be deleted — so an arm
-- that accepted any tenant_id-NULL row would let one workspace permanently write into the
-- namespace every other workspace reads. What it accepts instead is exactly L-MEA-01's seed:
-- its name, its version, and the digest of its parameter values × its (rule id, version)
-- pairs, which is what L-MEA-01 keys an edition by and therefore what fixes its content. Any
-- other platform row is a system-scope write (M3's authoring), not a tenant's.
ALTER TABLE "rule_set_editions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rule_set_editions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "rule_set_editions" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND (
				"tenant_id" IS NULL
				OR "tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
			)
		)
	)
	WITH CHECK (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND (
				"tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
				OR (
					"tenant_id" IS NULL
					AND "scope" = 'platform'
					AND "name" = 'IS1200_IN'
					AND "version" = '2026.08'
					AND "digest" = '6c4622a631d5b7aa2228ac0f4a85ddcc7adf47ce057d4fb3ec98fc2438d84e63'
				)
			)
		)
	);--> statement-breakpoint
-- L-MEA-01: "authoring mints a new edition, never updates one". The grants below already
-- withhold UPDATE and DELETE from the app role, but the owner is not bound by a grant and
-- FORCEd row-level security means an owner's UPDATE can also match nothing and pass in
-- silence. The trigger is per statement rather than per row for exactly that reason: it fires
-- on the statement itself, so an UPDATE that RLS made match no row is still refused by name.
CREATE OR REPLACE FUNCTION "rule_set_editions_immutable"() RETURNS trigger
	LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'EDITION_IMMUTABLE: a rule-set edition is written once; authoring mints a new edition rather than changing this one (L-MEA-01).';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "rule_set_editions_immutable_update"
	BEFORE UPDATE ON "rule_set_editions"
	FOR EACH STATEMENT EXECUTE FUNCTION "rule_set_editions_immutable"();--> statement-breakpoint
CREATE TRIGGER "rule_set_editions_immutable_delete"
	BEFORE DELETE ON "rule_set_editions"
	FOR EACH STATEMENT EXECUTE FUNCTION "rule_set_editions_immutable"();--> statement-breakpoint
-- Grants (V-DB). Both tables are SELECT and INSERT alone: an edition is immutable by clause,
-- and editing or archiving a project is C-SPINE-PROJECT's remainder — the J-003 project
-- increment grants what it needs when it can refuse what it must.
REVOKE ALL ON TABLE "rule_set_editions" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "projects" FROM PUBLIC;--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "rule_set_editions" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "projects" TO "cubit_app";