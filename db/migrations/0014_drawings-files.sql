CREATE TABLE "drawings" (
	"tenant_id" uuid NOT NULL,
	"drawing_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawings_format_closed" CHECK ("drawings"."format" in ('dwg', 'dxf', 'pdf', 'png', 'jpg', 'tiff'))
);
--> statement-breakpoint
CREATE TABLE "files" (
	"tenant_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"byte_length" integer NOT NULL,
	"format" text NOT NULL,
	"scan_verdict" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_tenant_id_sha256_pk" PRIMARY KEY("tenant_id","sha256"),
	CONSTRAINT "files_format_closed" CHECK ("files"."format" in ('dwg', 'dxf', 'pdf', 'png', 'jpg', 'tiff')),
	CONSTRAINT "files_scan_verdict_closed" CHECK ("files"."scan_verdict" in ('clean', 'infected', 'skipped')),
	CONSTRAINT "files_sha256_is_an_address" CHECK ("files"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "files_byte_length_counted" CHECK ("files"."byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"tenant_id" uuid NOT NULL,
	"upload_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"declared_size" integer NOT NULL,
	"declared_sha256" text NOT NULL,
	"received_bytes" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "uploads_state_closed" CHECK ("uploads"."state" in ('open', 'stored', 'refused')),
	CONSTRAINT "uploads_received_within_declared" CHECK ("uploads"."received_bytes" >= 0 and "uploads"."received_bytes" <= "uploads"."declared_size"),
	CONSTRAINT "uploads_declared_size_counted" CHECK ("uploads"."declared_size" >= 0 and "uploads"."declared_size" <= 524288000),
	CONSTRAINT "uploads_declared_sha256_is_an_address" CHECK ("uploads"."declared_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_content" FOREIGN KEY ("tenant_id","sha256") REFERENCES "public"."files"("tenant_id","sha256") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drawings_by_project" ON "drawings" USING btree ("tenant_id","project_id","created_at");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "files_tenant_scope" ON "files"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "files_system_scope" ON "files"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "drawings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drawings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "drawings_tenant_scope" ON "drawings"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "drawings_system_scope" ON "drawings"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "uploads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "uploads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "uploads_tenant_scope" ON "uploads"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "uploads_system_scope" ON "uploads"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- Stored content and the drawings made of it are evidence (R-SPINE-021): every revision is retained
-- forever, so the app role may add rows and read them and nothing more — no UPDATE, no DELETE.
GRANT SELECT, INSERT ON TABLE "files" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "drawings" TO "cubit_app";--> statement-breakpoint
-- An upload session is not evidence but a transfer in progress: its acknowledged offset and its
-- ending move while the bytes arrive, so the app role may change what it holds. It still takes
-- nothing away — a session that was opened stays on the record with the state it ended in.
GRANT SELECT, INSERT, UPDATE ON TABLE "uploads" TO "cubit_app";
