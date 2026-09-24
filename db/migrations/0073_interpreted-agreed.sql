CREATE TABLE "queue_item_resolutions" (
	"tenant_id" uuid NOT NULL,
	"resolution_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_item_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"act_id" uuid NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queue_item_resolutions_one_per_item" UNIQUE("tenant_id","queue_item_id")
);
--> statement-breakpoint
ALTER TABLE "register_objects" DROP CONSTRAINT "register_objects_standing_closed";--> statement-breakpoint
ALTER TABLE "register_observations" DROP CONSTRAINT "register_observations_basis_closed";--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD COLUMN "raster" json;--> statement-breakpoint
ALTER TABLE "queue_item_resolutions" ADD CONSTRAINT "queue_item_resolutions_queue_item_id_queue_items_queue_item_id_fk" FOREIGN KEY ("queue_item_id") REFERENCES "public"."queue_items"("queue_item_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_item_resolutions" ADD CONSTRAINT "queue_item_resolutions_campaign_id_campaigns_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("campaign_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_item_resolutions" ADD CONSTRAINT "queue_item_resolutions_act_id_acts_act_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "queue_item_resolutions_by_campaign" ON "queue_item_resolutions" USING btree ("tenant_id","campaign_id","resolved_at");--> statement-breakpoint
ALTER TABLE "register_objects" ADD CONSTRAINT "register_objects_standing_closed" CHECK ("register_objects"."standing" in ('MEASURED', 'DERIVED', 'INTERPRETED'));--> statement-breakpoint
ALTER TABLE "register_observations" ADD CONSTRAINT "register_observations_basis_closed" CHECK ("register_observations"."basis" in ('TRANSCRIBED', 'ENTERED', 'INTERPRETED'));--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_interpreted_names_raster" CHECK ("quantity_lines"."quantity_basis" <> 'INTERPRETED' or "quantity_lines"."raster" is not null);--> statement-breakpoint
ALTER TABLE "quantity_lines" ADD CONSTRAINT "quantity_lines_raster_under_raster_engine" CHECK ("quantity_lines"."raster" is null or "quantity_lines"."engine" = 'RASTER');--> statement-breakpoint
-- hand-written (session 8, M4P-6): queue_item_resolutions wears the gate stores' posture (0032) — row-level
-- security ENABLED and FORCED, the tenant scope and the named-reason system scope, the app role's read
-- and add with no UPDATE and no DELETE, and the owner-proof append-only belt: an item's AGREED exit is a
-- record of what a person agreed, written by the corroborating act in its own transaction (L-ACT-01,
-- L-QTY-04, SEAM-TENANT, s-takeoff I-685).
ALTER TABLE "queue_item_resolutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "queue_item_resolutions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "queue_item_resolutions_tenant_scope" ON "queue_item_resolutions"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "queue_item_resolutions_system_scope" ON "queue_item_resolutions"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "queue_item_resolutions" TO "cubit_app";--> statement-breakpoint
CREATE TRIGGER "queue_item_resolutions_append_only" BEFORE UPDATE OR DELETE ON "queue_item_resolutions"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "queue_item_resolutions_append_only_truncate" BEFORE TRUNCATE ON "queue_item_resolutions"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();