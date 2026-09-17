CREATE TABLE "documents" (
	"tenant_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" integer NOT NULL,
	"sha256" text NOT NULL,
	"payload_digest" text NOT NULL,
	"renderer_pin" text NOT NULL,
	"font_hashes" jsonb NOT NULL,
	"taxonomy_version" text NOT NULL,
	"act_ids" uuid[] NOT NULL,
	"issued_by" uuid NOT NULL,
	"superseded_by" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_one_version_per_kind" UNIQUE("project_id","kind","version")
);
--> statement-breakpoint
CREATE INDEX "documents_by_project" ON "documents" USING btree ("tenant_id","project_id","version");
--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "documents_tenant_scope" ON "documents"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);
--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "documents_system_scope" ON "documents"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);
--> statement-breakpoint
-- The application role issues a document, reads the project's list and marks the issue a new one
-- supersedes. It never deletes: a document is evidence, and an issue that was made stays made
-- (R-SPINE-040) — what replaces one is `superseded_by`, which is why UPDATE is held and DELETE is not.
GRANT SELECT, INSERT, UPDATE ON TABLE "documents" TO "cubit_app";