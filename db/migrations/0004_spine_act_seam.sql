CREATE TABLE "participant_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"act_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_project_id_user_id_uniq" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "acts" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "participant_roles" ADD CONSTRAINT "participant_roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_roles" ADD CONSTRAINT "participant_roles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_roles" ADD CONSTRAINT "participant_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_roles" ADD CONSTRAINT "participant_roles_act_id_acts_id_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_roles_project_id_user_id_idx" ON "participant_roles" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "participant_roles_act_id_idx" ON "participant_roles" USING btree ("act_id");--> statement-breakpoint
CREATE INDEX "participants_user_id_idx" ON "participants" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acts" ADD CONSTRAINT "acts_project_id_actor_id_participants_fk" FOREIGN KEY ("project_id","actor_id") REFERENCES "public"."participants"("project_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acts_project_id_idx" ON "acts" USING btree ("project_id");--> statement-breakpoint
-- SEAM-TENANT's backstop for the act seam's two new tables, hand-written below the generated
-- DDL and copying 0003_spine_rulesets.sql's shape exactly (which copies 0002's, and 0002
-- copies 0001's). Landed migrations are superseded, never edited.
--
-- Both tables take the two-arm form every tenant-carrying table takes: a tenant-scoped handle
-- reads its own rows and cannot write another tenant's. The policy fails closed —
-- `current_setting(..., true)` is NULL on a connection nobody scoped, and a policy that is not
-- true refuses. `acts` already carries its own from 0002.
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "participants" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND "tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
		)
	)
	WITH CHECK (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND "tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
		)
	);--> statement-breakpoint
ALTER TABLE "participant_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "participant_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "participant_roles" AS PERMISSIVE FOR ALL TO PUBLIC
	USING (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND "tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
		)
	)
	WITH CHECK (
		current_setting('cubit.scope', true) = 'system'
		OR (
			current_setting('cubit.scope', true) = 'tenant'
			AND "tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid
		)
	);--> statement-breakpoint
-- Grants (V-DB, B-05). SELECT and INSERT alone, exactly as `acts` has held since 0002:
-- L-ACT-01 makes the log and the state it carries append-only, so a grant that could rewrite
-- a role somebody held would make "who could do what, when" unanswerable. A demotion is a new
-- row; removing a participant is not an act M0 has at all.
REVOKE ALL ON TABLE "participants" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "participant_roles" FROM PUBLIC;--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "participants" TO "cubit_app";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "participant_roles" TO "cubit_app";
