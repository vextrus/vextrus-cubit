-- SEAM-TENANT / V-DB — row level security, the three roles' grants, and the two
-- settings the seam speaks through.
--
-- `cubit.tenant_id` is set by forTenant(ctx); `cubit.system` is set by
-- runAsSystem(reason). A connection carrying neither matches no policy and
-- therefore sees nothing — which is what the live seam test proves.
--
-- Roles are cluster objects and are created by the bootstrap (scripts/lib/postgres.mjs)
-- before a migration runs: cubit_migrate owns the schema (and holds BYPASSRLS so
-- the ledger and the seam tests can still read the truth), cubit_app carries
-- tenant traffic, cubit_auth serves better-auth's identity tables.

create or replace function cubit_current_tenant() returns uuid
  language sql stable
  as $$ select nullif(current_setting('cubit.tenant_id', true), '')::uuid $$;
--> statement-breakpoint
create or replace function cubit_is_system() returns boolean
  language sql stable
  as $$ select coalesce(nullif(current_setting('cubit.system', true), ''), 'off') = 'on' $$;
--> statement-breakpoint

-- --- every table carrying tenant_id is locked, and forced so the owner obeys too
alter table "tenant" enable row level security;
--> statement-breakpoint
alter table "tenant" force row level security;
--> statement-breakpoint
create policy "tenant_scope" on "tenant"
  for all
  using (tenant_id = cubit_current_tenant() or cubit_is_system())
  with check (tenant_id = cubit_current_tenant() or cubit_is_system());
--> statement-breakpoint

alter table "tenant_member" enable row level security;
--> statement-breakpoint
alter table "tenant_member" force row level security;
--> statement-breakpoint
create policy "tenant_member_scope" on "tenant_member"
  for all
  using (tenant_id = cubit_current_tenant() or cubit_is_system())
  with check (tenant_id = cubit_current_tenant() or cubit_is_system());
--> statement-breakpoint

-- --- grants: each role reaches exactly the tables it is responsible for -------
grant usage on schema public to cubit_app, cubit_auth;
--> statement-breakpoint
grant execute on function cubit_current_tenant() to cubit_app, cubit_auth;
--> statement-breakpoint
grant execute on function cubit_is_system() to cubit_app, cubit_auth;
--> statement-breakpoint
grant select, insert, update, delete on "tenant", "tenant_member" to cubit_app;
--> statement-breakpoint
grant select, insert, update, delete on "user", "session", "account", "verification" to cubit_auth;
