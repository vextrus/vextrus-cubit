CREATE TABLE "room_outlines" (
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"drawing_id" uuid NOT NULL,
	"ingest_id" uuid NOT NULL,
	"room_key" text NOT NULL,
	"view_key" text NOT NULL,
	"layout_name" text,
	"status" text NOT NULL,
	"reason" text,
	"name" text,
	"labels" jsonb NOT NULL,
	"outline" jsonb,
	"area_m2" text,
	"anchor_x" double precision NOT NULL,
	"anchor_y" double precision NOT NULL,
	"faces" jsonb NOT NULL,
	"source_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_outlines_key" PRIMARY KEY("tenant_id","ingest_id","room_key"),
	CONSTRAINT "room_outlines_status_closed" CHECK ("room_outlines"."status" in ('CLOSED', 'NOT_CLOSED', 'VOID', 'DROPPED')),
	CONSTRAINT "room_outlines_reason_closed" CHECK ("room_outlines"."reason" is null or "room_outlines"."reason" in ('SURFACE_NOT_CLOSED', 'ROOM_OUTLINE_OUT_OF_BAND', 'ROOM_UNNAMED', 'ROOM_AREA_DISAGREES')),
	CONSTRAINT "room_outlines_reason_stated" CHECK (("room_outlines"."status" in ('CLOSED', 'VOID')) = ("room_outlines"."reason" is null)),
	CONSTRAINT "room_outlines_outline_closed" CHECK (("room_outlines"."status" = 'NOT_CLOSED') = ("room_outlines"."outline" is null)),
	CONSTRAINT "room_outlines_cited" CHECK (cardinality("room_outlines"."source_keys") >= 1)
);
--> statement-breakpoint
CREATE INDEX "room_outlines_by_drawing" ON "room_outlines" USING btree ("tenant_id","drawing_id");--> statement-breakpoint
-- hand-written (session 8, ARCH-5): room_outlines wears the partition's posture — row-level security ENABLED
-- and FORCED, the tenant scope and the named-reason system scope, and the app role's read, add and
-- take away with no UPDATE: a room is a derivation, rebuilt with the placements its surfaces stand as
-- (SEAM-TENANT, R-SPINE-002, L-REG-04, R-TO-030).
ALTER TABLE "room_outlines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room_outlines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "room_outlines_tenant_scope" ON "room_outlines"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "room_outlines_system_scope" ON "room_outlines"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE "room_outlines" TO "cubit_app";
