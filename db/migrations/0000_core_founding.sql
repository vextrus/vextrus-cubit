CREATE TABLE "seam_smoke" (
	"tenant_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "seam_smoke_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "seam_smoke" ADD CONSTRAINT "seam_smoke_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- SEAM-TENANT's backstop, hand-written below the generated DDL.
--
-- Row-level security, the policies that read the seam's GUCs, and the grants that make
-- every tenant-carrying table append-only for the app role are not things drizzle-kit
-- generates, so they are written here rather than derived. They ride *this* file rather
-- than a later `generate --custom` migration on purpose: `pnpm db:drift` proves itself by
-- walking the journal back one entry and expecting db/schema to be ahead of db/migrations,
-- and a custom migration at the head of the journal carries a copy of the previous
-- snapshot — removing it would change nothing drizzle-kit can see, and the drift lane
-- would be green against a tree that had lost a migration. The head of the journal stays
-- schema-derived; the SQL that has no schema to be derived from rides underneath it.
--
-- The policy fails closed: `current_setting(..., true)` is NULL on a connection nobody
-- scoped, every comparison against NULL is NULL, and a policy that is not true refuses.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tenants" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND "id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
		)
	)
	WITH CHECK (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND "id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
		)
	);--> statement-breakpoint
ALTER TABLE "seam_smoke" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seam_smoke" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "seam_smoke" AS PERMISSIVE FOR ALL TO PUBLIC
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
-- Append-only grants (V-DB): the app role reads and inserts. It never updates, never
-- deletes and never truncates, on any table that carries a tenant. Nothing is left to
-- PUBLIC, so a role that was granted nothing has nothing.
REVOKE ALL ON TABLE "tenants" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "seam_smoke" FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "tenants" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "seam_smoke" TO "cubit_app";