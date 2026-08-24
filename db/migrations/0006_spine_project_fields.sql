ALTER TABLE "projects" ADD COLUMN "client" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_address" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "building_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "storeys" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_gfa_m2" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_building_type_check" CHECK ("projects"."building_type" is null or "projects"."building_type" in ('residential', 'commercial', 'mixed', 'industrial', 'infrastructure'));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_storeys_check" CHECK ("projects"."storeys" is null or "projects"."storeys" >= 0);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_target_gfa_check" CHECK ("projects"."target_gfa_m2" is null or "projects"."target_gfa_m2" >= 0);--> statement-breakpoint
-- The grant 0003 deferred, hand-written below the generated DDL (0003: "editing or archiving a
-- project is C-SPINE-PROJECT's remainder — the J-003 project increment grants what it needs
-- when it can refuse what it must"). R-SPINE-010 makes edit and archive real, so `cubit_app`
-- gains UPDATE on `projects` and on nothing else: the rule-set editions stay INSERT-only
-- (L-MEA-01), the act log stays append-only (L-ACT-01), and DELETE is granted nowhere at all —
-- archiving is a column, never a removal.
GRANT UPDATE ON TABLE "projects" TO "cubit_app";