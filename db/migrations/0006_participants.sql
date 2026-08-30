CREATE TABLE "participant_role_withdrawals" (
	"tenant_id" uuid NOT NULL,
	"withdrawal_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"act_id" uuid NOT NULL,
	"withdrawn_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_role_withdrawals_grant_id_unique" UNIQUE("grant_id")
);
--> statement-breakpoint
ALTER TABLE "participant_role_withdrawals" ADD CONSTRAINT "participant_role_withdrawals_grant_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."participant_roles"("grant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_role_withdrawals" ADD CONSTRAINT "participant_role_withdrawals_act_fk" FOREIGN KEY ("act_id") REFERENCES "public"."acts"("act_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_role_withdrawals_project_user" ON "participant_role_withdrawals" USING btree ("tenant_id","project_id","user_id");--> statement-breakpoint
-- hand-written: RLS, grants, immutability and the last-PRINCIPAL backstop (SEAM-TENANT, L-ACT-03)
-- Written by hand and appended here, in the form 0000_tenancy-base.sql set and 0001_act-log.sql
-- followed: the drift lane proves the schema and the committed migrations agree by generating into a
-- scratch directory, and that proof only holds while the generated DDL above is what the generator
-- would write.
ALTER TABLE "participant_role_withdrawals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- WITH FORCE: without it the table's owner reads and writes past its own policies, and a guarantee
-- the owner escapes is not a guarantee (SEAM-TENANT).
ALTER TABLE "participant_role_withdrawals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "participant_role_withdrawals_tenant_scope" ON "participant_role_withdrawals"
	FOR ALL
	USING ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid)
	WITH CHECK ("tenant_id" = nullif(current_setting('cubit.tenant_id', true), '')::uuid);--> statement-breakpoint
-- System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
-- so a session that names none sees no row at all.
CREATE POLICY "participant_role_withdrawals_system_scope" ON "participant_role_withdrawals"
	FOR ALL
	USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
	WITH CHECK (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL);--> statement-breakpoint
-- L-ACT-03: "The acts, participants and participant-role tables carry the same owner-proof
-- immutability triggers as rule-set editions." A withdrawal countermands a grant; nothing
-- countermands a withdrawal, so this ledger wears the same belts its siblings do, through the one
-- function 0001 installed for all of them (B-17).
CREATE TRIGGER "participant_role_withdrawals_append_only" BEFORE UPDATE OR DELETE ON "participant_role_withdrawals"
	FOR EACH ROW EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
CREATE TRIGGER "participant_role_withdrawals_append_only_truncate" BEFORE TRUNCATE ON "participant_role_withdrawals"
	FOR EACH STATEMENT EXECUTE FUNCTION "cubit_append_only"();--> statement-breakpoint
-- L-ACT-03: "'a project holds at least one PRINCIPAL at every moment' is load-bearing law with a
-- database backstop (an owner-installed trigger) beside the seam's advisory-locked guard." This is
-- that backstop. It counts the PRINCIPAL grants this project still holds — the ones no withdrawal
-- has answered, and not the one this row is answering now — and refuses the write when the answer is
-- none. The raised message carries the registered code so a machine reading the failure knows which
-- law stopped it; what a person reads is the registry's own entry, rendered by the one renderer.
--
-- What it judges is the GRANT this row countermands, read out of `participant_roles` by the row's
-- own `grant_id`, never the tenant/project/role columns the writer wrote beside it: a withdrawal
-- subtracts a grant (that is what `effectiveGrants` reads it as), so a row naming MEASURER on some
-- other project while pointing at a PRINCIPAL grant still takes that PRINCIPAL away. A backstop
-- that believed the writer's own labels would be countermanded by the very statement it guards.
--
-- SECURITY INVOKER, deliberately: the reading has to happen under the scope the writer armed, or a
-- definer's own unscoped session would see no row through FORCE row-level security and refuse every
-- withdrawal ever attempted. Owner-proof does not mean owner-scoped — the trigger fires for the
-- table's owner exactly as it fires for `cubit_app`, which is what makes it a backstop at all.
CREATE FUNCTION "cubit_project_keeps_a_principal"() RETURNS trigger LANGUAGE plpgsql AS $cubit_project_keeps_a_principal$
DECLARE
	countermanded record;
	standing integer;
BEGIN
	-- The grant this row answers. Read plainly: a row lock on an append-only ledger is not available
	-- to the role that writes withdrawals — `cubit_app` holds SELECT and INSERT and nothing else, and
	-- `SELECT … FOR UPDATE` wants UPDATE or DELETE — so the turn-taking is taken below instead.
	SELECT held."tenant_id" AS tenant_id, held."project_id" AS project_id, held."role" AS role
		INTO countermanded
		FROM "participant_roles" held
		WHERE held."grant_id" = NEW."grant_id";
	-- The read happens under the scope the writer armed, so NOT FOUND covers two rows at once: a
	-- `grant_id` that names nothing, and a `grant_id` naming a grant row security keeps from this
	-- session — another tenant's. The foreign key is not the answer to the second one: FK checks
	-- bypass row security, so such a row would pass the key and land here unjudged, subtracting by
	-- `grant_id` a PRINCIPAL grant this backstop never counted. A grant this statement may not read
	-- is a grant it may not countermand, and both cases are refused in the same words.
	IF NOT FOUND THEN
		RAISE EXCEPTION 'participant_role_withdrawals: grant % is not readable in this session, and a withdrawal is judged against the grant it countermands', NEW."grant_id"
			USING ERRCODE = '23514';
	END IF;
	IF countermanded.role <> 'PRINCIPAL' THEN
		RETURN NEW;
	END IF;
	-- The project's own state lock — the very key the act seam takes before it recomputes a
	-- Consequence (`holdStateLock`, `tenantId:projectId` through `hashtextextended`), so the backstop
	-- and the seam's advisory-locked guard take turns on one lock rather than two. Without it two
	-- withdrawals of one project's two PRINCIPALs would each count the other as standing and both
	-- write. Held until the transaction ends; the counting statement below then runs under a fresh
	-- snapshot (READ COMMITTED takes one per statement) and so sees what the other transaction
	-- committed while this one waited.
	PERFORM pg_advisory_xact_lock(hashtextextended(countermanded.tenant_id::text || ':' || countermanded.project_id::text, 0));
	SELECT count(DISTINCT held."user_id") INTO standing
		FROM "participant_roles" held
		WHERE held."tenant_id" = countermanded.tenant_id
			AND held."project_id" = countermanded.project_id
			AND held."role" = 'PRINCIPAL'
			AND held."grant_id" <> NEW."grant_id"
			AND NOT EXISTS (
				SELECT 1 FROM "participant_role_withdrawals" answered WHERE answered."grant_id" = held."grant_id"
			);
	IF standing = 0 THEN
		RAISE EXCEPTION 'PROJECT_WOULD_HAVE_NO_PRINCIPAL: withdrawing this grant would leave project % with no effective PRINCIPAL, and a project holds at least one at every moment', countermanded.project_id
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END
$cubit_project_keeps_a_principal$;--> statement-breakpoint
CREATE TRIGGER "participant_role_withdrawals_keeps_a_principal" BEFORE INSERT ON "participant_role_withdrawals"
	FOR EACH ROW EXECUTE FUNCTION "cubit_project_keeps_a_principal"();--> statement-breakpoint
-- Append-only privileges: the app role may read and write the ledger, and nothing it holds can name
-- an UPDATE or a DELETE at all — the trigger above is what makes the same true of the owner.
GRANT SELECT, INSERT ON TABLE "participant_role_withdrawals" TO "cubit_app";