ALTER TABLE "participant_roles" ADD COLUMN "seq" bigserial NOT NULL;--> statement-breakpoint
-- Hand-written below the generated DDL, in 0003's and 0004's shape (landed migrations are
-- superseded, never edited).
--
-- `bigserial` mints a sequence, and a role that may INSERT into the table but not draw from its
-- sequence cannot insert at all. `cubit_app` holds SELECT and INSERT on `participant_roles`
-- (0004), so it needs `nextval` here — and nothing more: USAGE and SELECT let it draw and read a
-- number, while UPDATE (which would let it `setval` the counter backwards, and so let two grants
-- claim one position in the history) stays withheld, exactly as UPDATE on the table itself is.
REVOKE ALL ON SEQUENCE "participant_roles_seq_seq" FROM PUBLIC;--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE "participant_roles_seq_seq" TO "cubit_app";--> statement-breakpoint
-- L-ACT-03: "Participants attach to (project, user), append-only, mandatory", and an act belongs
-- to a tenant. Nothing so far said those two agree. `participants.tenant_id` comes from the
-- writer's own scope and `project_id` is a plain single-column foreign key — and a foreign key is
-- checked without row-level security, so a tenant-scoped handle could write a participation of
-- its own tenant into another tenant's project. Every read is bounded by the policy, so nothing
-- leaked; but "this project's participants" and "this tenant's participants" were two different
-- sets, and the invariant that they are one was written down nowhere.
--
-- It is checked here rather than in the seam because the seam is one caller of the table and the
-- law is about the row. AFTER INSERT, and not BEFORE: the policy's WITH CHECK runs first that
-- way, so a row that is simply another tenant's is still refused as the cross-tenant write it is
-- (`42501`), and this trigger answers only the case the policy cannot see — a row wearing the
-- writer's own tenant over a project belonging to somebody else. The lookup runs under the
-- writer's own scope, which is what makes "belonging to somebody else" mean anything: an AFTER
-- trigger sees the finished statement, so a project and its first participant may still arrive
-- in one data-modifying CTE.
CREATE OR REPLACE FUNCTION "participation_belongs_to_tenant"() RETURNS trigger
	LANGUAGE plpgsql AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM "projects"
		 WHERE "projects"."id" = NEW."project_id"
		   AND "projects"."tenant_id" = NEW."tenant_id"
	) THEN
		RAISE EXCEPTION
			'PARTICIPATION_FOREIGN_TO_TENANT: a participation belongs to the tenant its project belongs to (L-ACT-03); project % is not this tenant''s.',
			NEW."project_id";
	END IF;
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "participants_belong_to_tenant"
	AFTER INSERT ON "participants"
	FOR EACH ROW EXECUTE FUNCTION "participation_belongs_to_tenant"();--> statement-breakpoint
CREATE TRIGGER "participant_roles_belong_to_tenant"
	AFTER INSERT ON "participant_roles"
	FOR EACH ROW EXECUTE FUNCTION "participation_belongs_to_tenant"();
