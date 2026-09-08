CREATE TABLE "grid_deferrals" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grid_deferrals_key" PRIMARY KEY("tenant_id","ingest_id","view_key")
);
--> statement-breakpoint
CREATE TABLE "grids" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"family" text NOT NULL,
	"label" text NOT NULL,
	"axis" text NOT NULL,
	"position" double precision NOT NULL,
	"bubble_key" text NOT NULL,
	"label_key" text NOT NULL,
	"min_spacing" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grids_key" PRIMARY KEY("tenant_id","ingest_id","bubble_key"),
	CONSTRAINT "grids_family_closed" CHECK ("grids"."family" in ('letter', 'numeral')),
	CONSTRAINT "grids_axis_closed" CHECK ("grids"."axis" in ('x', 'y')),
	CONSTRAINT "grids_min_spacing_positive" CHECK ("grids"."min_spacing" > 0)
);
--> statement-breakpoint
CREATE INDEX "grid_deferrals_by_drawing" ON "grid_deferrals" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "grids_by_drawing" ON "grids" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "grids_by_view" ON "grids" USING btree ("tenant_id","ingest_id","view_key");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "grids" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "grids" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "grids_tenant_scope" ON "grids"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "grids_system_scope" ON "grids"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
ALTER TABLE "grid_deferrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "grid_deferrals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "grid_deferrals_tenant_scope" ON "grid_deferrals"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "grid_deferrals_system_scope" ON "grid_deferrals"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- The grid is the third stage of a partition that is REBUILT per ingest — these rows are deleted and
-- written again in one transaction with the views they were read off — so the app role really holds a
-- DELETE here. What makes the tables trustworthy is the scope above and the keys they stand under,
-- never an absence of privilege (R-TO-030, L-REG-04).
GRANT SELECT, INSERT, DELETE ON TABLE "grids" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "grid_deferrals" TO "cubit_app";