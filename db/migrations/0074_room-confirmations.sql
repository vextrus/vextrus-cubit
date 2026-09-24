CREATE TABLE "room_confirmations" (
	"tenant_id" uuid NOT NULL,
	"confirmation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"room_key" text NOT NULL,
	"view_key" text NOT NULL,
	"name" text NOT NULL,
	"room_type" text NOT NULL,
	"basis" text NOT NULL,
	"call_id" uuid,
	"act_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_confirmations_type_closed" CHECK ("room_confirmations"."room_type" in ('BED', 'LIVING', 'DINING', 'FAMILY_LIVING', 'DRAWING', 'STUDY', 'PRAYER', 'KITCHEN', 'TOILET', 'LAUNDRY', 'LOBBY', 'CORRIDOR', 'STORE', 'SERVANT', 'GUARD', 'DRIVER', 'METER', 'VERANDAH')),
	CONSTRAINT "room_confirmations_basis_closed" CHECK ("room_confirmations"."basis" in ('LABEL', 'MODEL', 'PERSON')),
	CONSTRAINT "room_confirmations_call_stated" CHECK (("room_confirmations"."basis" = 'MODEL') = ("room_confirmations"."call_id" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "room_confirmations_once" ON "room_confirmations" USING btree ("tenant_id","ingest_id","room_key");--> statement-breakpoint
CREATE INDEX "room_confirmations_by_drawing" ON "room_confirmations" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written (session 8, ARCH-6): room_confirmations wears the confirmations' posture — row-level
-- security ENABLED and FORCED, the tenant scope and the named-reason system scope, the app role's read
-- and add with no UPDATE or DELETE, and the owner-proof append-only belt (L-ACT-01, SEAM-TENANT,
-- the view_type_confirmations precedent of 0023).
ALTER TABLE "room_confirmations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room_confirmations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "room_confirmations_tenant_scope" ON "room_confirmations"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "room_confirmations_system_scope" ON "room_confirmations"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "room_confirmations" TO "cubit_app";--> statement-breakpoint
CREATE TRIGGER "room_confirmations_append_only" BEFORE UPDATE OR DELETE ON "room_confirmations"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "room_confirmations_append_only_truncate" BEFORE TRUNCATE ON "room_confirmations"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();
