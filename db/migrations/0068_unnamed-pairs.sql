CREATE TABLE "placement_unnamed_pairs" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"edge_key_a" text NOT NULL,
	"edge_key_b" text NOT NULL,
	"layer" text NOT NULL,
	"from_x" numeric NOT NULL,
	"from_y" numeric NOT NULL,
	"to_x" numeric NOT NULL,
	"to_y" numeric NOT NULL,
	"width" numeric NOT NULL,
	"grid_letter" text,
	"grid_numeral" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "placement_unnamed_pairs_key" PRIMARY KEY("tenant_id","ingest_id","view_key","edge_key_a")
);
--> statement-breakpoint
CREATE INDEX "placement_unnamed_pairs_by_drawing" ON "placement_unnamed_pairs" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written (session 8, FRM4-AD): RLS and grants for placement_unnamed_pairs (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write. The generated part adds ONE table;
-- there is nothing to backfill — a rebuild writes the rows the next time a drawing's partition is
-- rebuilt.
--
-- I-613: the pairs a plan draws as a framed member and nobody names are one more table of the
-- SAME stored partition as `placements`, rebuilt per ingest in its one transaction, so they wear that
-- table's posture exactly: row-level security ENABLED and FORCED, the tenant scope every statement of
-- a tenant's own session satisfies, and the system scope a named reason opens for the platform's own
-- work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "placement_unnamed_pairs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "placement_unnamed_pairs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "placement_unnamed_pairs_tenant_scope" ON "placement_unnamed_pairs"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "placement_unnamed_pairs_system_scope" ON "placement_unnamed_pairs"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A partition is REBUILT — its rows are deleted and written again in one transaction — so the app
-- role holds here exactly what it holds on `placements`: read, add, take away, and never an UPDATE,
-- which would edit a derivation in place instead of re-deriving it (L-REG-04, R-TO-030).
GRANT SELECT, INSERT, DELETE ON TABLE "placement_unnamed_pairs" TO "cubit_app";
