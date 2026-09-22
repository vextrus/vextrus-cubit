CREATE TABLE "member_type_dimensions" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"schedule_key" text NOT NULL,
	"family" text NOT NULL,
	"variant_key" text NOT NULL,
	"dimension" text NOT NULL,
	"text" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"source_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_type_dimensions_key" PRIMARY KEY("tenant_id","ingest_id","schedule_key","family","variant_key","dimension"),
	CONSTRAINT "member_type_dimensions_dimension_closed" CHECK ("member_type_dimensions"."dimension" in ('depth', 'dia', 'length', 'top')),
	CONSTRAINT "member_type_dimensions_unit_closed" CHECK ("member_type_dimensions"."unit" in ('in', 'mm')),
	CONSTRAINT "member_type_dimensions_value_measured" CHECK ("member_type_dimensions"."dimension" = 'top' or "member_type_dimensions"."value" > 0),
	CONSTRAINT "member_type_dimensions_cited" CHECK (cardinality("member_type_dimensions"."source_keys") >= 1)
);
--> statement-breakpoint
CREATE INDEX "member_type_dimensions_by_drawing" ON "member_type_dimensions" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write. It adds ONE table and touches no
-- other: nothing standing before it moves, and there is nothing to backfill — a rebuild writes the
-- rows the next time a drawing's partition is rebuilt.
--
-- I-315, AM-06 §2: the dimensions a schedule states beside a section (a pile's diameter and its
-- length) are one more table of the SAME stored partition as `member_type_variants`, rebuilt per
-- ingest in its one transaction, so it wears that table's posture exactly: row-level security
-- ENABLED and FORCED, the tenant scope every statement of a tenant's own session satisfies, and the
-- system scope a named reason opens for the platform's own work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "member_type_dimensions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "member_type_dimensions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "member_type_dimensions_tenant_scope" ON "member_type_dimensions"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "member_type_dimensions_system_scope" ON "member_type_dimensions"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A partition is REBUILT — its rows are deleted and written again in one transaction — so the app
-- role holds here exactly what it holds on `member_type_variants`: read, add, take away, and never an
-- UPDATE, which would edit a derivation in place instead of re-deriving it (L-REG-04, R-TO-030).
GRANT SELECT, INSERT, DELETE ON TABLE "member_type_dimensions" TO "cubit_app";