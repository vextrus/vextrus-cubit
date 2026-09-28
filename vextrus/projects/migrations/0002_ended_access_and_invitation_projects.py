# The Projects of ended access and of an invitation link, by code (#75; m0-screens §4.1 and §4.2).
# Written by hand, run as the owner.
#
# "Your access to KR-01 at Shapla Homes Ltd has ended" and "…invited you as a Guest to KR-01 Kadam
# Residence" name Projects of a Developer the reader acts in no longer, or not yet: its rows are
# another tenant's to them. platform gives the Projects' ids (ended_access(), invitation_by_token());
# naming them is projects' (docs/architecture.md: an upward id is never resolved by the lower module;
# ADR 0034: a cross-module read goes through its owner). So two named cross-tenant reads here, under
# platform's rules (docs/data-model.md §2): SECURITY DEFINER, owned by vextrus, search_path pinned,
# every name qualified, EXECUTE only to vextrus_app. Each reads platform only through platform's own
# named function, and otherwise only projects_project:
# - ended_access_projects(): the code of each Project each of the signed-in user's ended access gave
#   (one row per code; access to every Project gives none; a Project deleted since gives none);
# - invitation_projects(tenant_id, token_hash): the code and name of each Project the one pending
#   invitation a link names gives (nothing for a link that cannot be used, or one to every Project).

from django.conf import settings
from django.db import migrations

APP = settings.VEXTRUS_APP_ROLE

SIGNATURES = ("ended_access_projects()", "invitation_projects(uuid, text)")

FUNCTIONS = [
    """
    create function public.ended_access_projects()
    returns table (membership_id uuid, code text)
    language sql stable security definer
    set search_path = pg_catalog, pg_temp
    as $$
      select e.membership_id, p.code::text
        from public.ended_access() e
        join public.projects_project p
          on p.tenant_id = e.developer_id and p.id = any(e.project_ids)
       order by e.membership_id, p.code_key, p.id
    $$
    """,
    """
    create function public.invitation_projects(p_tenant_id uuid, p_token_hash text)
    returns table (code text, name text)
    language sql stable security definer
    set search_path = pg_catalog, pg_temp
    as $$
      select p.code::text, p.name::text
        from public.invitation_by_token(p_tenant_id, p_token_hash) i
        join public.projects_project p
          on p.tenant_id = i.tenant_id and p.id = any(i.project_ids)
       order by p.code_key, p.id
    $$
    """,
    *(
        statement
        for signature in SIGNATURES
        for statement in (
            f"revoke all on function public.{signature} from public",
            f"grant execute on function public.{signature} to {APP}",
        )
    ),
]
FUNCTIONS_REVERSE = [f"drop function public.{signature}" for signature in reversed(SIGNATURES)]


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0001_initial"),
        # Each reads platform only through platform's named functions.
        ("platform", "0007_ended_access_and_fixed_market"),
    ]

    operations = [
        migrations.RunSQL(FUNCTIONS, FUNCTIONS_REVERSE),
    ]
