CREATE TABLE "placement_outlines" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"placement_key" text NOT NULL,
	"source_key" text NOT NULL,
	"unit_source_key" text,
	"geometry" text NOT NULL,
	"unit" text NOT NULL,
	"area_unit" text NOT NULL,
	"area" text NOT NULL,
	"perimeter" text NOT NULL,
	"length" text,
	"breadth" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "placement_outlines_key" PRIMARY KEY("tenant_id","ingest_id","placement_key"),
	CONSTRAINT "placement_outlines_geometry_closed" CHECK ("placement_outlines"."geometry" in ('PRISM_RECT', 'PRISM_POLY')),
	CONSTRAINT "placement_outlines_unit_closed" CHECK ("placement_outlines"."unit" in ('m', 'mm', 'ft', 'in')),
	CONSTRAINT "placement_outlines_area_unit_closed" CHECK ("placement_outlines"."area_unit" in ('m2', 'mm2', 'cm2', 'sft')),
	CONSTRAINT "placement_outlines_sides_by_geometry" CHECK (("placement_outlines"."geometry" = 'PRISM_RECT' and num_nonnulls("placement_outlines"."length", "placement_outlines"."breadth") = 2) or ("placement_outlines"."geometry" = 'PRISM_POLY' and num_nonnulls("placement_outlines"."length", "placement_outlines"."breadth") = 0))
);
--> statement-breakpoint
CREATE INDEX "placement_outlines_by_drawing" ON "placement_outlines" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write. It adds ONE table and touches no
-- other: nothing standing before it moves, and there is nothing to backfill — a rebuild writes the
-- rows the next time a drawing's partition is rebuilt.
--
-- I-333, L-FRM-02: the plan a placed member's ring encloses (its geometry, shoelace area, perimeter
-- and, for a rectangle, its own two sides) is one more table of the SAME stored partition as
-- `placements`, rebuilt per ingest in its one transaction, so it wears that table's posture exactly:
-- row-level security ENABLED and FORCED, the tenant scope every statement of a tenant's own session
-- satisfies, and the system scope a named reason opens for the platform's own work (SEAM-TENANT,
-- R-SPINE-002).
ALTER TABLE "placement_outlines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "placement_outlines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "placement_outlines_tenant_scope" ON "placement_outlines"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "placement_outlines_system_scope" ON "placement_outlines"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A partition is REBUILT — its rows are deleted and written again in one transaction — so the app
-- role holds here exactly what it holds on `placements`: read, add, take away, and never an UPDATE,
-- which would edit a derivation in place instead of re-deriving it (L-REG-04, R-TO-030).
GRANT SELECT, INSERT, DELETE ON TABLE "placement_outlines" TO "cubit_app";