CREATE TYPE "public"."ruleset_scope" AS ENUM('platform', 'tenant', 'project');--> statement-breakpoint
CREATE TABLE "ruleset_editions" (
	"edition_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "ruleset_scope" NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"content_digest" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"methods" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ruleset_editions_identity" UNIQUE("scope","name","version")
);
--> statement-breakpoint
CREATE TABLE "tenant_ruleset_editions" (
	"tenant_id" uuid NOT NULL,
	"edition_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "ruleset_scope" NOT NULL,
	"project_id" uuid,
	"parent_edition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"content_digest" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"methods" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_ruleset_editions_template_once" ON "tenant_ruleset_editions" USING btree ("tenant_id") WHERE "scope" = 'tenant';--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_ruleset_editions_pin_once" ON "tenant_ruleset_editions" USING btree ("tenant_id","project_id") WHERE "scope" = 'project';--> statement-breakpoint
CREATE INDEX "tenant_ruleset_editions_scope" ON "tenant_ruleset_editions" USING btree ("tenant_id","scope");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form 0000_tenancy-base.sql set: the drift lane proves the schema and the
-- committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
--
-- L-MEA-01 seeds the platform rule set `IS1200_IN @ 2026.08` — the version string names India
-- because Bangladesh has no measurement authority for these values. The seventeen parameter values
-- are the clause's own, and `content_digest` is `editionDigest` over exactly the content
-- src/core/rulesets/seed exports: the digest keys CONTENT, so a stored digest that disagreed would
-- mean the row and the module hold different allowances. The row is written before row-level
-- security is enabled below, because a migration names no scope and would satisfy no policy.
INSERT INTO "ruleset_editions" ("scope", "name", "version", "content_digest", "parameters", "methods")
	VALUES (
		'platform',
		'IS1200_IN',
		'2026.08',
		'34460b4cf8972ceb11ddfb8b275b6d46de1fd51ef785330c2c3f9be14583612b',
		'{
			"openingDeductionMinM2": { "value": "0.1", "unit": "m²" },
			"memberEndNoDeductMaxCm2": { "value": "500", "unit": "cm²" },
			"embeddedDuctNoDeductMaxCm2": { "value": "100", "unit": "cm²" },
			"finishOpeningDeductionMinM2": { "value": "0.1", "unit": "m²" },
			"finishMinOutlineArea": { "value": "0.2", "unit": "sft" },
			"finishMaxOutlineArea": { "value": "20000", "unit": "sft" },
			"scaleVerificationTolerance": { "value": "0.01", "unit": "ratio" },
			"scaleAnisotropyTolerance": { "value": "0.01", "unit": "ratio" },
			"earthworkWorkingAllowance": { "value": "1.5", "unit": "ft" },
			"earthworkDepthExtra": { "value": "0.5", "unit": "ft" },
			"blindingProjection": { "value": "3", "unit": "in" },
			"blindingThickness": { "value": "3", "unit": "in" },
			"placementContainmentMerge": { "value": "0.08", "unit": "ratio" },
			"placementNearAnchor": { "value": "0.9", "unit": "ratio" },
			"placementFootprintMin": { "value": "0.6", "unit": "ratio" },
			"placementFootprintMax": { "value": "2.5", "unit": "ratio" },
			"placementHumanSnap": { "value": "0.5", "unit": "ratio" }
		}'::jsonb,
		'[]'::jsonb
	);--> statement-breakpoint
-- `ruleset_editions` carries no tenant id: a platform edition belongs to no workspace (L-REG-07).
-- Having no tenant column is not a reason to have no policy — `cubit_app` is the one role the
-- runtime connects as, and a table it holds DML on with no policy is reachable by any handle in the
-- tree. Minting a platform edition is system work and is scoped as such; reading one is what a
-- workspace's own pin is a fork of, so a tenant handle may see it and write nothing here.
ALTER TABLE "ruleset_editions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "ruleset_editions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "ruleset_editions_system_scope" ON "ruleset_editions"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A scoped session reads the platform editions its own pins are forked from; a session that names
-- neither a tenant nor a reason reads nothing, here as everywhere else.
CREATE POLICY "ruleset_editions_scoped_read" ON "ruleset_editions"
	FOR SELECT
	USING (nullif(current_setting('cubit.tenant_id', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "tenant_ruleset_editions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_ruleset_editions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_ruleset_editions_tenant_scope" ON "tenant_ruleset_editions"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_ruleset_editions_system_scope" ON "tenant_ruleset_editions"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- L-MEA-01: an edition is immutable — authoring mints a new one, never rewrites one — and the belt
-- is owner-proof, like the act log's. The rule is one rule, so it is the same function 0001_act-log
-- installed, naming the table it fired for (B-17).
CREATE TRIGGER "ruleset_editions_append_only" BEFORE UPDATE OR DELETE ON "ruleset_editions"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "ruleset_editions_append_only_truncate" BEFORE TRUNCATE ON "ruleset_editions"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "tenant_ruleset_editions_append_only" BEFORE UPDATE OR DELETE ON "tenant_ruleset_editions"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "tenant_ruleset_editions_append_only_truncate" BEFORE TRUNCATE ON "tenant_ruleset_editions"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
-- Append-only privileges: the app role may read the store and add to it, and holds nothing that can
-- take a row away — the triggers above are what make the same true of the owner.
GRANT SELECT, INSERT ON TABLE "ruleset_editions" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "tenant_ruleset_editions" TO "cubit_app";
