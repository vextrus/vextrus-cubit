# The staff wall (ticket 02; the orchestrator's review of PR #60). Written by hand, run as the owner.
#
# vextrus_app may never make a user staff: staff see every Developer through staff_developers. The
# column grants (0003) stop it updating is_vextrus_staff or is_active, but cannot stop an INSERT of a
# new user already staff, since Django writes every column on insert. This trigger, owned by vextrus,
# refuses both when the acting role is vextrus_app: an INSERT with is_vextrus_staff true, and an
# UPDATE that changes is_vextrus_staff or is_active. The owner (manage.py set_staff, migrations)
# passes. The function runs as its caller (not SECURITY DEFINER), so current_user is the app's role.

from django.conf import settings
from django.db import migrations

APP = settings.VEXTRUS_APP_ROLE

FORWARD = [
    f"""
    create function public.platform_user_staff_wall() returns trigger
    language plpgsql
    set search_path = pg_catalog, pg_temp
    as $$
    begin
      if current_user = '{APP}' and (
           (tg_op = 'INSERT' and new.is_vextrus_staff)
        or (tg_op = 'UPDATE' and (new.is_vextrus_staff is distinct from old.is_vextrus_staff
                                  or new.is_active is distinct from old.is_active))
      ) then
        raise exception
          '{APP} may not make a user staff or change whether one is staff or active'
          using errcode = '42501';
      end if;
      return new;
    end
    $$
    """,
    "revoke all on function public.platform_user_staff_wall() from public",
    """
    create trigger platform_user_staff_wall
      before insert or update on public.platform_user
      for each row execute function public.platform_user_staff_wall()
    """,
]
REVERSE = [
    "drop trigger platform_user_staff_wall on public.platform_user",
    "drop function public.platform_user_staff_wall()",
]


class Migration(migrations.Migration):

    dependencies = [
        ("platform", "0004_bangladesh_market"),
    ]

    operations = [
        migrations.RunSQL(FORWARD, REVERSE),
    ]
