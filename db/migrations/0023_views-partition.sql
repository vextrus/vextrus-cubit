CREATE TABLE "partition_views" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"type" text NOT NULL,
	"reason" text,
	"caption" text NOT NULL,
	"anchor_key" text,
	"proposed_type" text,
	"proposed_call_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partition_views_key" PRIMARY KEY("tenant_id","ingest_id","view_key"),
	CONSTRAINT "partition_views_proposal_whole" CHECK (("partition_views"."proposed_type" is null) = ("partition_views"."proposed_call_id" is null))
);
--> statement-breakpoint
CREATE TABLE "view_assignments" (
	"tenant_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"entity_key" text NOT NULL,
	"view_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "view_assignments_entity" PRIMARY KEY("tenant_id","ingest_id","entity_key")
);
--> statement-breakpoint
CREATE TABLE "view_type_confirmations" (
	"tenant_id" uuid NOT NULL,
	"confirmation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"view_key" text NOT NULL,
	"type" text NOT NULL,
	"act_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "partition_views_by_drawing" ON "partition_views" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
CREATE INDEX "view_assignments_by_view" ON "view_assignments" USING btree ("tenant_id","ingest_id","view_key");--> statement-breakpoint
CREATE UNIQUE INDEX "view_type_confirmations_once" ON "view_type_confirmations" USING btree ("tenant_id","ingest_id","view_key");--> statement-breakpoint
CREATE INDEX "view_type_confirmations_by_drawing" ON "view_type_confirmations" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand in the form the tenancy-base migration set: the drift lane proves the schema and
-- the committed migrations agree by generating into a scratch directory, and that proof only holds
-- while the generated DDL above is what the generator would write.
ALTER TABLE "partition_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "partition_views" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "partition_views_tenant_scope" ON "partition_views"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "partition_views_system_scope" ON "partition_views"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A partition is REBUILT per ingest — its rows are deleted and written again in one transaction — so
-- unlike a ledger the app role really holds a DELETE here. What makes the table trustworthy is the
-- scope above and the content-derived key, never an absence of privilege (R-TO-030, L-REG-04).
GRANT SELECT, INSERT, DELETE ON TABLE "partition_views" TO "cubit_app";
--> statement-breakpoint
ALTER TABLE "view_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "view_assignments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "view_assignments_tenant_scope" ON "view_assignments"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "view_assignments_system_scope" ON "view_assignments"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "view_assignments" TO "cubit_app";
--> statement-breakpoint
ALTER TABLE "view_type_confirmations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "view_type_confirmations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "view_type_confirmations_tenant_scope" ON "view_type_confirmations"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "view_type_confirmations_system_scope" ON "view_type_confirmations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A confirmation is a human act's own state change (L-ACT-01): the app role appends rows and reads
-- them, and holds no privilege that writes one away.
GRANT SELECT, INSERT ON TABLE "view_type_confirmations" TO "cubit_app";
--> statement-breakpoint
-- The same owner-proof belt every other ledger wears: the trigger refuses the owner too, because a
-- guarantee the owner escapes is not a guarantee. The function is the tree's one spelling of the
-- rule (0001_act-log.sql's "cubit_append_only") — one rule, one home (B-17).
CREATE TRIGGER "view_type_confirmations_append_only" BEFORE UPDATE OR DELETE ON "view_type_confirmations"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "view_type_confirmations_append_only_truncate" BEFORE TRUNCATE ON "view_type_confirmations"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();