ALTER TABLE "memberships" ADD COLUMN "workspace_role" text DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_role_closed" CHECK ("memberships"."workspace_role" in ('OWNER', 'ADMIN', 'MEMBER'));--> statement-breakpoint
-- hand-written: RLS, grants (SEAM-TENANT)
-- Appended by hand for the reason every migration in this tree appends rather than declares: the
-- drift lane proves the schema and the committed migrations agree by generating into a scratch
-- directory, and that proof holds only while the generated DDL above is exactly what the generator
-- would write.
--
-- A workspace's roster is now a thing worth forging: the column above decides who may move whom
-- (R-SPINE-006), so the row that carries it may be written by the seam under a recorded system
-- reason and by nothing else. The shipped policy was `memberships_tenant_scope FOR ALL`, which let
-- any tenant-scoped handle write the roster of the workspace it was scoped to — looser than
-- system-only, so it is tightened here (SEAM-TENANT).
--
-- The scope is kept for reading and taken away for writing, in two policies rather than one:
--   * reading stays tenant-scoped, so a workspace's own handle still sees its members and the
--     enumerated live suite's scoped read holds;
--   * a row stays VISIBLE to its own workspace under the update policy, and only a named system
--     reason satisfies its check — a tenant-scoped session that could not SEE the row would update
--     nothing and be told nothing, which is silence, not a refusal;
--   * insertion has no tenant-scoped check left at all, so a scoped session is refused as it writes.
-- `memberships_system_scope` is untouched: it is what admits the seam's own writes.
DROP POLICY "memberships_tenant_scope" ON "memberships";--> statement-breakpoint
CREATE POLICY "memberships_tenant_scope" ON "memberships"
	FOR SELECT
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "memberships_tenant_scope_write" ON "memberships"
	FOR UPDATE
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);
