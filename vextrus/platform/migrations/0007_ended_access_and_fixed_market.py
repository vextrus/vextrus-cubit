# "Access ended" named on a fresh load, and a Developer's Market fixed (#75; docs/data-model.md §2
# and §3.0; m0-screens §4.1). Written by hand, run as the owner.
#
# - ended_access() is the fourth named cross-tenant read: once a Membership has ended, its
#   Developer's name, who revoked it and its Projects are another tenant's rows to the user. One row
#   per Developer (never a Library) where the signed-in user (app.user_id) holds no current
#   Membership: the latest-ended of the user's accepted Memberships there, newest first. How and
#   when it ended follow auth.ending: by its end date if that passed first, else by its revocation.
#   "Current" is 0003's predicate on pg_catalog.now(), the clock user_developers() reads, so one
#   transaction never finds a Developer in both. The revoker is the name (never the email or id) of
#   the actor of the latest platform.invitations.revoked event about that Membership (there is no
#   revoked_by column), null when it expired or no event names one. Like 0003's three: SECURITY
#   DEFINER, owned by vextrus, its search_path pinned, every name qualified, EXECUTE only to
#   vextrus_app. It takes no parameter, so no one can ask about a Developer they never held.
# - Both it and invitation_by_token() (0003's, made again here with one more column) give the
#   Developer's Market's code, so the web formats "Access ended" and an invitation link's page in
#   that Market's language, locale and time zone while no Developer is current (a Market is read by
#   everyone; which Market a Developer is on is its tenant's row). Nothing else changes in
#   invitation_by_token.
# - A Developer's Market is fixed (the comment on #75; the review of #68): vextrus_app loses UPDATE
#   of every column but `name`, and DELETE, on platform_developer. A column REVOKE alone does nothing
#   while the table's grant stands (measured on PostgreSQL 18.6), so the table's UPDATE goes and only
#   `name` comes back, as 0003 does for platform_user. One updatable column stays because
#   `select … for update` needs one (invitations and tenancy lock the Developer's row that way).
#   Without DELETE, a delete and re-insert with the same id (Membership's key to it is deferred)
#   cannot move it either. Its Market, Library, home region, whether it is a Library, its tenant and
#   its id change only through the owner (a migration; then projects_project_follows_market must be
#   checked again against the Projects already made).

from django.conf import settings
from django.db import migrations

APP = settings.VEXTRUS_APP_ROLE

# 0003's CURRENT and USER_SETTING, as user_developers() reads them.
CURRENT = """m.user_id is not null and m.accepted_at is not null and m.revoked_at is null
             and m.starts_at <= pg_catalog.now()
             and (m.expires_at is null or m.expires_at > pg_catalog.now())"""
USER_SETTING = "nullif(pg_catalog.current_setting('app.user_id', true), '')::uuid"
# auth.ending: its end date, if that passed before any revocation.
EXPIRED_FIRST = """m.expires_at <= pg_catalog.now()
                   and (m.revoked_at is null or m.expires_at < m.revoked_at)"""

FUNCTION = [
    f"""
    create function public.ended_access()
    returns table (
      membership_id uuid, developer_id uuid, developer_name text, market_code text, role text,
      ended_at timestamptz, how text, revoked_by text, project_ids uuid[]
    )
    language sql stable security definer
    set search_path = pg_catalog, pg_temp
    as $$
      with ended as (
        select m.id, m.tenant_id, m.role,
               case when {EXPIRED_FIRST} then m.expires_at else m.revoked_at end as ended_at,
               case when {EXPIRED_FIRST} then 'expired' else 'revoked' end as how
          from public.platform_membership m
         where m.user_id = {USER_SETTING}
           and m.accepted_at is not null
           and (m.revoked_at is not null or m.expires_at <= pg_catalog.now())
      ),
      latest as (
        select distinct on (e.tenant_id) e.id, e.tenant_id, e.role, e.ended_at, e.how
          from ended e
         order by e.tenant_id, e.ended_at desc, e.id desc
      )
      select l.id, l.tenant_id, d.name::text, mk.code::text, l.role::text, l.ended_at, l.how,
             case when l.how = 'revoked' then (
               select u.name::text
                 from (select ev.actor_user_id
                         from public.platform_domainevent ev
                        where ev.tenant_id = l.tenant_id
                          and ev.kind = 'platform.invitations.revoked'
                          and ev.subject_type = 'membership'
                          and ev.subject_id = l.id
                          and ev.actor_user_id is not null
                        order by ev.occurred_at desc, ev.id desc
                        limit 1) last
                 join public.platform_user u on u.id = last.actor_user_id
             ) end,
             array(select p.project_id from public.platform_membershipproject p
                    where p.tenant_id = l.tenant_id and p.membership_id = l.id
                    order by p.project_id)
        from latest l
        join public.platform_developer d on d.id = l.tenant_id and not d.is_library
        join public.platform_market mk on mk.id = d.market_id
       where not exists (select 1 from public.platform_membership m
                          where m.tenant_id = l.tenant_id and m.user_id = {USER_SETTING}
                            and {CURRENT})
       order by l.ended_at desc, l.id desc
    $$
    """,
    "revoke all on function public.ended_access() from public",
    f"grant execute on function public.ended_access() to {APP}",
]
FUNCTION_REVERSE = [
    "drop function public.ended_access()",
]

# invitation_by_token's body; its result gains market_code (the owner drops and makes it again,
# since a function's result columns cannot be replaced in place).
INVITATION_BY_TOKEN = """
    create function public.invitation_by_token(p_tenant_id uuid, p_token_hash text)
    returns table (
      id uuid, tenant_id uuid, developer_name text, role text, invited_email text,
      invited_by_id uuid, outside_org text, starts_at timestamptz, expires_at timestamptz,
      invite_expires_at timestamptz, project_ids uuid[]{market_code}
    )
    language sql stable security definer
    set search_path = pg_catalog, pg_temp
    as $$
      select m.id, m.tenant_id, d.name::text, m.role::text, m.invited_email::text,
             m.invited_by_id, m.outside_org::text, m.starts_at, m.expires_at, m.invite_expires_at,
             array(select p.project_id from public.platform_membershipproject p
                    where p.tenant_id = m.tenant_id and p.membership_id = m.id
                    order by p.project_id){market_code_value}
        from public.platform_membership m
        join public.platform_developer d on d.id = m.tenant_id{market_join}
       where m.tenant_id = p_tenant_id
         and m.invite_token_hash = p_token_hash
         and m.user_id is null and m.accepted_at is null and m.revoked_at is null
         and m.invite_expires_at > pg_catalog.now()
    $$
    """
INVITATION_GRANTS = [
    "revoke all on function public.invitation_by_token(uuid, text) from public",
    f"grant execute on function public.invitation_by_token(uuid, text) to {APP}",
]
INVITATION = [
    "drop function public.invitation_by_token(uuid, text)",
    INVITATION_BY_TOKEN.format(
        market_code=", market_code text",
        market_code_value=",\n             mk.code::text",
        market_join="\n        join public.platform_market mk on mk.id = d.market_id",
    ),
    *INVITATION_GRANTS,
]
INVITATION_REVERSE = [
    "drop function public.invitation_by_token(uuid, text)",
    INVITATION_BY_TOKEN.format(market_code="", market_code_value="", market_join=""),  # 0003's
    *INVITATION_GRANTS,
]

MARKET_FIXED = [
    f"revoke update, delete on platform_developer from {APP}",
    f"grant update (name) on platform_developer to {APP}",
]
MARKET_FIXED_REVERSE = [
    # Revoking the table's UPDATE takes its column grants with it.
    f"revoke update on platform_developer from {APP}",
    f"grant update, delete on platform_developer to {APP}",
]


class Migration(migrations.Migration):
    dependencies = [
        ("platform", "0006_stored_file"),
    ]

    operations = [
        migrations.RunSQL(FUNCTION, FUNCTION_REVERSE),
        migrations.RunSQL(INVITATION, INVITATION_REVERSE),
        migrations.RunSQL(MARKET_FIXED, MARKET_FIXED_REVERSE),
    ]
