CREATE TABLE "sheet_disciplines" (
	"tenant_id" uuid NOT NULL,
	"confirmation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"layout_name" text NOT NULL,
	"discipline" text NOT NULL,
	"act_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sheet_disciplines_discipline_closed" CHECK ("sheet_disciplines"."discipline" in ('STRUCTURAL', 'ARCHITECTURAL', 'MEP', 'CIVIL', 'OTHER'))
);
--> statement-breakpoint
ALTER TABLE "sheet_disciplines" ADD CONSTRAINT "sheet_disciplines_drawing_id_drawings_drawing_id_fk" FOREIGN KEY ("drawing_id") REFERENCES "public"."drawings"("drawing_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_disciplines" ADD CONSTRAINT "sheet_disciplines_ingest_id_ingests_ingest_id_fk" FOREIGN KEY ("ingest_id") REFERENCES "public"."ingests"("ingest_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_disciplines" ADD CONSTRAINT "sheet_disciplines_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sheet_disciplines_once" ON "sheet_disciplines" USING btree ("tenant_id","ingest_id","layout_name");--> statement-breakpoint
CREATE INDEX "sheet_disciplines_by_project" ON "sheet_disciplines" USING btree ("tenant_id","project_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "sheet_disciplines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "sheet_disciplines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sheet_disciplines_tenant_scope" ON "sheet_disciplines"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "sheet_disciplines_system_scope" ON "sheet_disciplines"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A confirmation is a human act's own state change (L-ACT-01, L-REG-03): the app role appends rows
-- and reads them, and holds no privilege that writes one away.
GRANT SELECT, INSERT ON TABLE "sheet_disciplines" TO "cubit_app";
--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the
-- rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "sheet_disciplines_append_only" BEFORE UPDATE OR DELETE ON "sheet_disciplines"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "sheet_disciplines_append_only_truncate" BEFORE TRUNCATE ON "sheet_disciplines"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();