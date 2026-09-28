# Row-level security, the three named cross-tenant functions and vextrus_app's grants (ticket 02;
# docs/data-model.md §2 and §3.0; the M0 plan's reviews A1, A2). Written by hand, run as the owner.
#
# - Every platform table has row-level security ENABLED, never forced, and its own-tenant policy for
#   reads and writes alike. A widening is only ever a separate FOR SELECT policy: the signed-in
#   user's own Memberships (app.user_id), and the Markets, read by everyone (they hold no tenant's
#   data: each is the index of its Library; only the owner writes them). No policy holds a join, a
#   sub-select or any function call beyond reading its setting.
# - Composite keys hold a Developer's library_id to its Market's Library and a MembershipProject to
#   a Membership of its own tenant.
# - user_developers, staff_developers and invitation_by_token are the only cross-tenant reads: each
#   SECURITY DEFINER, owned by vextrus, its search_path pinned, EXECUTE only to vextrus_app.
# - vextrus_app gets SELECT, INSERT, UPDATE and DELETE on every table, now and (by default
#   privileges) on every table the owner makes later; never TRUNCATE. It has no rights on
#   django_admin_log (the admin's LogEntry writes are off), cannot write django_migrations or the
#   Markets, cannot update or delete a DomainEvent (append-only), and updates a user's name, phone,
#   password and last sign-in only, never the staff flag or is_active.

from django.conf import settings
from django.db import migrations

APP = settings.VEXTRUS_APP_ROLE

OWN_TENANT = "tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid"
OWN_USER = "user_id = nullif(current_setting('app.user_id', true), '')::uuid"

TABLES = (
    "platform_market",
    "platform_developer",
    "platform_membership",
    "platform_membershipproject",
    "platform_domainevent",
)

POLICIES = [
    *(f"alter table {table} enable row level security" for table in TABLES),
    *(f"create policy own_tenant on {table} using ({OWN_TENANT})" for table in TABLES),
    f"create policy own_user_reads on platform_membership for select using ({OWN_USER})",
    "create policy every_market_reads on platform_market for select using (true)",
]
POLICIES_REVERSE = [
    "drop policy every_market_reads on platform_market",
    "drop policy own_user_reads on platform_membership",
    *(f"drop policy own_tenant on {table}" for table in TABLES),
    *(f"alter table {table} disable row level security" for table in TABLES),
]

KEYS = [
    """alter table platform_developer add constraint platform_developer_market_library
         foreign key (library_id, market_id) references platform_market (tenant_id, id)
         deferrable initially deferred""",
    """alter table platform_membershipproject add constraint platform_membershipproject_own_tenant
         foreign key (tenant_id, membership_id) references platform_membership (tenant_id, id)
         on delete cascade deferrable initially deferred""",
]
KEYS_REVERSE = [
    "alter table platform_membershipproject drop constraint platform_membershipproject_own_tenant",
    "alter table platform_developer drop constraint platform_developer_market_library",
]

# A Membership is current when accepted, not revoked, started and not ended.
CURRENT = """m.user_id is not null and m.accepted_at is not null and m.revoked_at is null
             and m.starts_at <= pg_catalog.now()
             and (m.expires_at is null or m.expires_at > pg_catalog.now())"""
USER_SETTING = "nullif(pg_catalog.current_setting('app.user_id', true), '')::uuid"

FUNCTIONS = [
    f"""
    create function public.user_developers()
    returns table (id uuid, name text)
    language sql stable security definer
    set search_path = pg_catalog, pg_temp
    as $$
      select d.id, d.name::text
        from public.platform_developer d
       where not d.is_library
         and exists (select 1 from public.platform_membership m
                      where m.tenant_id = d.id and m.user_id = {USER_SETTING} and {CURRENT})
       order by d.name, d.id
    $$
    """,
    f"""
    create function public.staff_developers()
    returns table (id uuid, name text)
    language sql stable security definer
    set search_path = pg_catalog, pg_temp
    as $$
      select d.id, d.name::text
        from public.platform_developer d
       where not d.is_library
         and exists (select 1 from public.platform_user u
                      where u.id = {USER_SETTING} and u.is_vextrus_staff and u.is_active)
       order by d.name, d.id
    $$
    """,
    """
    create function public.invitation_by_token(p_tenant_id uuid, p_token_hash text)
    returns table (
      id uuid, tenant_id uuid, developer_name text, role text, invited_email text,
      invited_by_id uuid, outside_org text, starts_at timestamptz, expires_at timestamptz,
      invite_expires_at timestamptz, project_ids uuid[]
    )
    language sql stable security definer
    set search_path = pg_catalog, pg_temp
    as $$
      select m.id, m.tenant_id, d.name::text, m.role::text, m.invited_email::text,
             m.invited_by_id, m.outside_org::text, m.starts_at, m.expires_at, m.invite_expires_at,
             array(select p.project_id from public.platform_membershipproject p
                    where p.tenant_id = m.tenant_id and p.membership_id = m.id
                    order by p.project_id)
        from public.platform_membership m
        join public.platform_developer d on d.id = m.tenant_id
       where m.tenant_id = p_tenant_id
         and m.invite_token_hash = p_token_hash
         and m.user_id is null and m.accepted_at is null and m.revoked_at is null
         and m.invite_expires_at > pg_catalog.now()
    $$
    """,
    *(
        statement
        for signature in ("user_developers()", "staff_developers()", "invitation_by_token(uuid, text)")
        for statement in (
            f"revoke all on function public.{signature} from public",
            f"grant execute on function public.{signature} to {APP}",
        )
    ),
]
FUNCTIONS_REVERSE = [
    "drop function public.invitation_by_token(uuid, text)",
    "drop function public.staff_developers()",
    "drop function public.user_developers()",
]

GRANTS = [
    f"alter default privileges in schema public grant select, insert, update, delete on tables to {APP}",
    f"alter default privileges in schema public grant usage, select on sequences to {APP}",
    f"grant select, insert, update, delete on all tables in schema public to {APP}",
    f"grant usage, select on all sequences in schema public to {APP}",
    f"revoke all on django_admin_log from {APP}",
    f"revoke all on sequence django_admin_log_id_seq from {APP}",
    f"revoke insert, update, delete on django_migrations from {APP}",
    f"revoke insert, update, delete on platform_market from {APP}",
    f"revoke update, delete on platform_domainevent from {APP}",
    # A user's staff flag and whether they may sign in change only through the owner
    # (manage.py set_staff): the app updates only what a person and sign-in change.
    f"revoke update on platform_user from {APP}",
    f"grant update (name, phone, password, last_login) on platform_user to {APP}",
]
GRANTS_REVERSE = [
    f"alter default privileges in schema public revoke usage, select on sequences from {APP}",
    f"alter default privileges in schema public revoke select, insert, update, delete on tables from {APP}",
    f"revoke all on all sequences in schema public from {APP}",
    f"revoke all on all tables in schema public from {APP}",
]


class Migration(migrations.Migration):

    dependencies = [
        ("platform", "0002_tenancy"),
        # django_admin_log must exist before its rights are taken away.
        ("admin", "0003_logentry_add_action_flag_choices"),
    ]

    operations = [
        migrations.RunSQL(POLICIES, POLICIES_REVERSE),
        migrations.RunSQL(KEYS, KEYS_REVERSE),
        migrations.RunSQL(FUNCTIONS, FUNCTIONS_REVERSE),
        migrations.RunSQL(GRANTS, GRANTS_REVERSE),
    ]
