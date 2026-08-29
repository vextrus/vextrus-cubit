CREATE TABLE "projects" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"client" text,
	"site_address" text,
	"district" text,
	"building_type" text,
	"storeys" integer,
	"target_gfa_m2" numeric,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_building_type_closed" CHECK ("projects"."building_type" in ('residential', 'commercial', 'mixed', 'industrial', 'infrastructure'))
);
--> statement-breakpoint
CREATE INDEX "projects_tenant_updated" ON "projects" USING btree ("tenant_id","updated_at");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "projects_tenant_scope" ON "projects"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "projects_system_scope" ON "projects"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A project is not a ledger: R-SPINE-010 gives it field edits, and AC-4's archive is a marker moved
-- on the row that stands. So the app role may read this table, add to it, and change what it holds;
-- nothing it holds can take a project away, because archiving is what a workspace does instead.
GRANT SELECT, INSERT, UPDATE ON TABLE "projects" TO "cubit_app";
