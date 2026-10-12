"""The hand-written SQL migration 0002 shares with 0001's pattern (0001 keeps its own copy, as
applied): the policies' expressions, the same-tenant keys and the reach triggers."""

OWN_TENANT = "tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid"
LIBRARY = "tenant_id = nullif(current_setting('app.library_id', true), '')::uuid"


def same_tenant_keys(specs: tuple[tuple[str, str, str, str], ...]) -> list[str]:
    """(table, constraint, column, referenced table): a composite key on tenant_id for each."""
    return [
        f"""alter table {table} add constraint {name}
          foreign key (tenant_id, {column}) references {target} (tenant_id, id)
          deferrable initially deferred"""
        for table, name, column, target in specs
    ]


def same_tenant_keys_reverse(specs: tuple[tuple[str, str, str, str], ...]) -> list[str]:
    return [f"alter table {table} drop constraint {name}" for table, name, _c, _t in reversed(specs)]


def in_reach(function: str, table: str, columns: tuple[tuple[str, str], ...]) -> list[str]:
    """A trigger function run as its caller (not SECURITY DEFINER), so the lookups see only what the
    caller's policies admit: its own rows and its Library's. The owner sees every row and passes."""
    checks = "\n".join(
        f"""      if not exists (select 1 from public.{target} where id = new.{column}) then
        raise exception '{table}.{column} names a row neither this tenant''s nor its Library''s'
          using errcode = '42501';
      end if;"""
        for column, target in columns
    )
    updated = ", ".join(column for column, _target in columns)
    return [
        f"""
    create function public.{function}() returns trigger
    language plpgsql
    set search_path = pg_catalog, pg_temp
    as $$
    begin
{checks}
      return new;
    end
    $$
    """,
        f"revoke all on function public.{function}() from public",
        f"""
    create trigger {function}
      before insert or update of tenant_id, {updated} on public.{table}
      for each row execute function public.{function}()
    """,
    ]


def in_reach_reverse(function: str, table: str, _columns: object) -> list[str]:
    return [f"drop trigger {function} on public.{table}", f"drop function public.{function}()"]
