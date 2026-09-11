CREATE TABLE "scope_declarations" (
	"tenant_id" uuid NOT NULL,
	"declaration_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"class" text NOT NULL,
	"kind" text NOT NULL,
	"level_id" uuid NOT NULL,
	"cause" text NOT NULL,
	"act_id" uuid NOT NULL,
	"in_force" boolean DEFAULT true NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scope_declarations_one_per_cell" UNIQUE("tenant_id","campaign_id","class","kind","level_id","cause"),
	CONSTRAINT "scope_declarations_cause_closed" CHECK ("scope_declarations"."cause" in ('NOT_IN_PROJECT_SCOPE', 'NOT_IN_THIS_BILL')),
	CONSTRAINT "scope_declarations_class_closed" CHECK ("scope_declarations"."class" in ('column', 'beam', 'slab', 'footing', 'pile_cap', 'pile', 'tie_beam', 'shear_wall', 'stair', 'lintel')),
	CONSTRAINT "scope_declarations_kind_closed" CHECK ("scope_declarations"."kind" in ('rcc.concrete'))
);
--> statement-breakpoint
CREATE INDEX "scope_declarations_by_campaign" ON "scope_declarations" USING btree ("tenant_id","campaign_id","declared_at");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "scope_declarations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "scope_declarations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "scope_declarations_tenant_scope" ON "scope_declarations"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "scope_declarations_system_scope" ON "scope_declarations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- The application role holds exactly what its tenant-scoped peers hold. A declaration is written by
-- the act seam inside the act's own transaction and read back by the residue query; withdrawing one
-- is another act and not an edit of this row, so nothing in this milestone updates one (§ 8's IOU).
GRANT SELECT, INSERT, DELETE ON TABLE "scope_declarations" TO "cubit_app";