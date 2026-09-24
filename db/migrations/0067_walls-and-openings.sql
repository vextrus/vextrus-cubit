CREATE TABLE "wall_openings" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"placement_key" text NOT NULL,
	"host_placement_key" text NOT NULL,
	"view_key" text NOT NULL,
	"mark" text NOT NULL,
	"tag_key" text NOT NULL,
	"layout_name" text,
	"from_x" double precision NOT NULL,
	"from_y" double precision NOT NULL,
	"to_x" double precision NOT NULL,
	"to_y" double precision NOT NULL,
	"width" text NOT NULL,
	"checked" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wall_openings_key" PRIMARY KEY("tenant_id","ingest_id","placement_key")
);
--> statement-breakpoint
CREATE TABLE "wall_runs" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"placement_key" text NOT NULL,
	"view_key" text NOT NULL,
	"family" text NOT NULL,
	"layout_name" text,
	"from_x" double precision NOT NULL,
	"from_y" double precision NOT NULL,
	"to_x" double precision NOT NULL,
	"to_y" double precision NOT NULL,
	"thickness_value" text NOT NULL,
	"thickness_unit" text NOT NULL,
	"thickness_source_keys" text[] NOT NULL,
	"length_value" text NOT NULL,
	"length_unit" text NOT NULL,
	"length_source_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wall_runs_key" PRIMARY KEY("tenant_id","ingest_id","placement_key"),
	CONSTRAINT "wall_runs_thickness_unit_closed" CHECK ("wall_runs"."thickness_unit" in ('m', 'mm', 'ft', 'in')),
	CONSTRAINT "wall_runs_length_unit_closed" CHECK ("wall_runs"."length_unit" in ('m', 'mm', 'ft', 'in')),
	CONSTRAINT "wall_runs_thickness_cited" CHECK (cardinality("wall_runs"."thickness_source_keys") >= 1),
	CONSTRAINT "wall_runs_length_cited" CHECK (cardinality("wall_runs"."length_source_keys") >= 1)
);
--> statement-breakpoint
ALTER TABLE "placements" ADD COLUMN "layout_name" text;--> statement-breakpoint
CREATE INDEX "wall_openings_by_drawing" ON "wall_openings" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "wall_runs_by_drawing" ON "wall_runs" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written (session 9, ARCH-4): RLS and grants for wall_runs and wall_openings (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write. The generated part adds TWO tables
-- and ONE nullable column (`placements.layout_name`); there is nothing to backfill — a rebuild writes
-- the rows the next time a drawing's partition is rebuilt, and a structural placement names no sheet.
--
-- s-takeoff I-593: the walls and openings the wall lane reads off an architect's plan are two more
-- tables of the SAME stored partition as `placements`, rebuilt per ingest in its one transaction, so
-- they wear that table's posture exactly: row-level security ENABLED and FORCED, the tenant scope
-- every statement of a tenant's own session satisfies, and the system scope a named reason opens for
-- the platform's own work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "wall_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "wall_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "wall_runs_tenant_scope" ON "wall_runs"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "wall_runs_system_scope" ON "wall_runs"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A partition is REBUILT — its rows are deleted and written again in one transaction — so the app
-- role holds here exactly what it holds on `placements`: read, add, take away, and never an UPDATE,
-- which would edit a derivation in place instead of re-deriving it (L-REG-04, R-TO-030).
GRANT SELECT, INSERT, DELETE ON TABLE "wall_runs" TO "cubit_app";--> statement-breakpoint
ALTER TABLE "wall_openings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wall_openings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "wall_openings_tenant_scope" ON "wall_openings"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "wall_openings_system_scope" ON "wall_openings"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "wall_openings" TO "cubit_app";
