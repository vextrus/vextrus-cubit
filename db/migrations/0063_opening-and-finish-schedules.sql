CREATE TABLE "schedule_printed_quantities" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"schedule_key" text NOT NULL,
	"family" text NOT NULL,
	"variant_key" text NOT NULL,
	"text" text NOT NULL,
	"printed" integer NOT NULL,
	"basis" text,
	"basis_keys" text[] NOT NULL,
	"plan_key" text,
	"tag_keys" text[] NOT NULL,
	"refusal" text,
	"source_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_printed_quantities_key" PRIMARY KEY("tenant_id","ingest_id","schedule_key","family","variant_key"),
	CONSTRAINT "schedule_printed_quantities_printed_whole" CHECK ("schedule_printed_quantities"."printed" >= 0),
	CONSTRAINT "schedule_printed_quantities_basis_closed" CHECK ("schedule_printed_quantities"."basis" is null or "schedule_printed_quantities"."basis" in ('per-floor')),
	CONSTRAINT "schedule_printed_quantities_basis_cited" CHECK (("schedule_printed_quantities"."basis" is null) = (cardinality("schedule_printed_quantities"."basis_keys") = 0)),
	CONSTRAINT "schedule_printed_quantities_refusal_closed" CHECK ("schedule_printed_quantities"."refusal" is null or "schedule_printed_quantities"."refusal" in ('OPENING_QUANTITY_DISAGREES', 'OPENING_QUANTITY_BASIS_UNSTATED')),
	CONSTRAINT "schedule_printed_quantities_disagreement_planned" CHECK ("schedule_printed_quantities"."refusal" is distinct from 'OPENING_QUANTITY_DISAGREES' or "schedule_printed_quantities"."plan_key" is not null),
	CONSTRAINT "schedule_printed_quantities_cited" CHECK (cardinality("schedule_printed_quantities"."source_keys") >= 1)
);
--> statement-breakpoint
ALTER TABLE "member_type_dimensions" DROP CONSTRAINT "member_type_dimensions_dimension_closed";--> statement-breakpoint
CREATE INDEX "schedule_printed_quantities_by_drawing" ON "schedule_printed_quantities" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
ALTER TABLE "member_type_dimensions" ADD CONSTRAINT "member_type_dimensions_dimension_closed" CHECK ("member_type_dimensions"."dimension" in ('depth', 'dia', 'length', 'top', 'sill', 'thickness'));--> statement-breakpoint
-- hand-written (session 8, ARCH-3): RLS and grants for schedule_printed_quantities (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write. The generated part adds ONE table
-- and re-states ONE closed CHECK (the dimension roster gains `sill` and `thickness`, appended, so no
-- row standing before it fails the new CHECK); there is nothing to backfill — a rebuild writes the
-- rows the next time a drawing's partition is rebuilt.
--
-- s-schedules I-507: what an opening schedule PRINTS for a row is one more table of the SAME
-- stored partition as `member_type_variants`, rebuilt per ingest in its one transaction, so it wears
-- that table's posture exactly: row-level security ENABLED and FORCED, the tenant scope every
-- statement of a tenant's own session satisfies, and the system scope a named reason opens for the
-- platform's own work (SEAM-TENANT, R-SPINE-002).
ALTER TABLE "schedule_printed_quantities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "schedule_printed_quantities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "schedule_printed_quantities_tenant_scope" ON "schedule_printed_quantities"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "schedule_printed_quantities_system_scope" ON "schedule_printed_quantities"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A partition is REBUILT — its rows are deleted and written again in one transaction — so the app
-- role holds here exactly what it holds on `member_type_variants`: read, add, take away, and never an
-- UPDATE, which would edit a derivation in place instead of re-deriving it (L-REG-04, R-TO-030).
GRANT SELECT, INSERT, DELETE ON TABLE "schedule_printed_quantities" TO "cubit_app";
