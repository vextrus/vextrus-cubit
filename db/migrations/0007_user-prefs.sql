CREATE TABLE "user_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"density" text DEFAULT 'comfortable' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_prefs_density_closed" CHECK ("user_prefs"."density" in ('comfortable', 'compact'))
);
--> statement-breakpoint
ALTER TABLE "user_prefs" ADD CONSTRAINT "user_prefs_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand for the same reason identity appends its own: the drift lane proves the schema
-- and the committed migrations agree by generating into a scratch directory, and that proof only
-- holds while the generated DDL above is what the generator would write.
--
-- `user_prefs` carries no tenant id: what a person chose for themselves travels with the account
-- across every workspace they belong to (R-SPINE-002), so no *tenant* policy can be written for it.
-- Having no tenant column is not a reason to have no policy — `cubit_app` is the one role the
-- runtime connects as, and a table it holds DML on with no policy is reachable by any handle in the
-- tree. So the store is scoped exactly as identity scopes `users`: FORCE row-level security with a
-- system-scope policy, which makes SEAM-PREFS' `runAsSystem(reason)` the enforced way in rather
-- than the conventional one (R-SPINE-007).
ALTER TABLE "user_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "user_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "user_prefs_system_scope" ON "user_prefs"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- A preference is read and it is overwritten in place, and that is the whole of it: the runtime role
-- is given no privilege that takes a row away, because R-UI-005's control offers no such gesture.
GRANT SELECT, INSERT, UPDATE ON TABLE "user_prefs" TO "cubit_app";
