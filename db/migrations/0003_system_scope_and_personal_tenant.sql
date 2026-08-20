-- Two things the database owes the product rather than the application code.
--
-- 1. SEAM-TENANT names RLS a *backstop*. A backstop that the guarded role can
--    switch off is not one: `cubit.system` was a session setting, and any
--    connection may set its own settings, so a fragment that reached SQL as
--    cubit_app could grant itself system scope in the same statement
--    (`select set_config('cubit.system','on',false), count(*) from tenant`).
--    System scope becomes a property of the *role* instead — a role attribute
--    no session can grant itself. Only cubit_migrate carries BYPASSRLS, so only
--    a connection made as cubit_migrate is system; runAsSystem() makes exactly
--    that connection (src/core/db.ts) and still records its reason on it.
--
-- 2. R-SPINE-002 / AC-12 say the personal tenant is minted *in the user-create
--    transaction*. Two writes on two connections in two roles cannot be one
--    transaction, so the mint moves to where the insert already is: a trigger on
--    "user" runs inside the inserting transaction, and an account that exists
--    therefore has somewhere to stand — there is no window in which a crash can
--    leave one without the other, and nothing to compensate afterwards.

create or replace function cubit_is_system() returns boolean
  language sql stable
  as $$ select coalesce((select rolbypassrls from pg_roles where rolname = current_user), false) $$;
--> statement-breakpoint

-- The address is derived from the name exactly as slugify() derives it in
-- TypeScript (src/server/tenant.ts): lowercase, non-alphanumerics to hyphens,
-- trimmed, 48 characters. `acme`, then `acme-2`, `acme-3` — a coincidence of
-- addresses never fails a sign-up, and the unique index is the arbiter when two
-- sign-ups reach for one address at the same moment.
create or replace function cubit_mint_personal_tenant() returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
declare
  base text;
  candidate text;
  suffix int := 1;
  minted uuid;
begin
  base := left(
    regexp_replace(
      regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'),
    48);
  if base = '' then
    base := 'tenant';
  end if;

  candidate := base;
  loop
    begin
      insert into tenant (slug, name, kind)
        values (candidate, new.name, 'personal')
        returning tenant_id into minted;
      exit;
    exception when unique_violation then
      suffix := suffix + 1;
      candidate := base || '-' || suffix;
      if suffix > 1000 then
        raise;
      end if;
    end;
  end loop;

  insert into tenant_member (tenant_id, user_id, role) values (minted, new.id, 'OWNER');
  return new;
end;
$$;
--> statement-breakpoint

drop trigger if exists user_personal_tenant on "user";
--> statement-breakpoint
create trigger user_personal_tenant
  after insert on "user"
  for each row execute function cubit_mint_personal_tenant();
