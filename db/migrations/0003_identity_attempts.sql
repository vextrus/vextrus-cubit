CREATE TABLE "auth_attempts" (
	"attempt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"door" text NOT NULL,
	"identity" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_attempts_window" ON "auth_attempts" USING btree ("door","identity","attempted_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_attempted_at" ON "auth_attempts" USING btree ("attempted_at");--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand for the same reason the tenancy base appends its own: the drift lane proves the
-- schema and the committed migrations agree by generating into a scratch directory, and that proof
-- only holds while the generated DDL above is what the generator would write.
--
-- The limiter's rows are nobody's tenant's: an attempt is counted against a server-derived identity
-- (R-SPINE-001), which is an account or an address and not a workspace. So the table is scoped the
-- way the other global tables are — FORCE row-level security with a system-scope policy — and the
-- limiter takes its handle through runAsSystem with a reason, like every other identity statement.
ALTER TABLE "auth_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_attempts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "auth_attempts_system_scope" ON "auth_attempts"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "auth_attempts" TO "cubit_app";
