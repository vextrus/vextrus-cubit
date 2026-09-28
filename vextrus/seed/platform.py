"""The demo seed's `platform` rows: the two Developers on the Bangladesh Market (02), and the
people of docs/design/m0-screens.md §7, the Guest among them (07).

Kamal Uddin, Shapla's first MD, and Tanvir Ahmed, Meghna's QS, are written as current Memberships;
everyone Kamal brings in comes through the product's own invitations, so their acts are in the
event log: Nusrat Jahan (QS), Arif Rahman (Vextrus Engineer, 30 days), Farhana Kabir (a Guest from
Padma Builders, a contractor, until 26 Oct 2026) and rumana@shapla-homes.example (a QS invitation
not used yet).

The Guest's Membership is made for every Project: KR-01 does not exist until projects' seed runs.
That seed (08) scopes it through the service an MD uses, acting as Kamal:

    with tenancy.acting_in(demo["developer:shapla"], user_id=demo["user:kamal"]):
        invitations.set_projects(demo["membership:guest"], [kr01_id])

Arif Rahman is one of Vextrus's staff, since only staff accept a Vextrus Engineer's invitation (the
owner's ruling, 28 Sep 2026). The app can never mark anyone staff, so his account is made and marked
as the owner does it: through the owner alias and `manage.py set_staff`. Those two writes are the
owner's own, committed at once, and stay if the rest of the seed fails.

Passwords come from `VEXTRUS_DEMO_PASSWORD`, never printed; without it the people cannot sign in. A
person whose email already has an account keeps it and its password.
"""

import io
import logging
import os
import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.management import call_command
from django.utils import timezone

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import Membership, User
from vextrus.platform.services import invitations, markets, tenancy
from vextrus.seed.demo import Demo

log = logging.getLogger(__name__)

PASSWORD_VARIABLE = "VEXTRUS_DEMO_PASSWORD"

DEVELOPERS = {
    "developer:shapla": "Shapla Homes Ltd",
    "developer:meghna": "Meghna Properties Ltd",
}

ENGINEER = ("arif@vextrus.example", "Arif Rahman")
"""The seed's Vextrus Engineer: one of Vextrus's staff."""

GUEST_UNTIL = date(2026, 10, 26)
"""The Guest's last day (m0-screens §7). Seeded after it, the Guest gets 28 days from the seeding
instead, so the Guest's walk still works."""
GUEST_DAYS_AFTER = 28


def run(demo: Demo) -> None:
    market = markets.by_code("BD")
    demo["market"] = market
    for name, title in DEVELOPERS.items():
        with tenancy.acting_in(None):
            demo[name] = tenancy.create_developer(title, market.id)
    password = os.environ.get(PASSWORD_VARIABLE) or None
    if password is None:
        log.warning("%s is not set: the seeded people cannot sign in", PASSWORD_VARIABLE)

    shapla, meghna = demo["developer:shapla"], demo["developer:meghna"]
    demo["user:kamal"] = _member(shapla, "kamal@shapla-homes.example", "Kamal Uddin", "md", password)
    demo["user:tanvir"] = _member(meghna, "tanvir@meghna.example", "Tanvir Ahmed", "qs", password)

    with tenancy.acting_in(shapla, user_id=demo["user:kamal"]):
        demo["user:nusrat"], demo["membership:qs"] = _invited(
            "nusrat@shapla-homes.example", "Nusrat Jahan", "qs", password
        )
        engineer = _staff_account(*ENGINEER, password)
        demo["user:arif"], demo["membership:engineer"] = _invited(
            engineer.email, engineer.name, "vextrus_engineer", password
        )
        demo["user:farhana"], demo["membership:guest"] = _invited(
            "farhana@padma-builders.example",
            "Farhana Kabir",
            "guest",
            password,
            outside_org="Padma Builders",
            expires_at=_guest_until(market.time_zone),
        )
        demo["invitation:rumana"] = invitations.invite("rumana@shapla-homes.example", "qs").membership_id


def _staff_account(email: str, name: str, password: str | None) -> User:
    """One of Vextrus's staff: made if new, and marked, as the owner does both (the owner alias,
    `manage.py set_staff`); an account already staff is kept as it is."""
    found = User.objects.filter(email__iexact=email).first()
    if found is not None and found.is_vextrus_staff:
        return found
    if found is None:
        User.objects.db_manager(OWNER_ALIAS).create_user(email, name, password)
    call_command("set_staff", email, stdout=io.StringIO())
    return User.objects.get(email__iexact=email)


def _account(email: str, name: str, password: str | None) -> User:
    """The email's account, made with the demo password unless it exists."""
    found = User.objects.filter(email__iexact=email).first()
    if found is not None:
        return found
    return User.objects.create_user(email, name, password)


def _member(
    developer_id: uuid.UUID, email: str, name: str, role: str, password: str | None
) -> uuid.UUID:
    """A person holding a current Membership from the start, as a Developer's first MD does once
    staff's invitation is accepted."""
    user = _account(email, name, password)
    with tenancy.acting_in(developer_id):
        Membership.objects.create(
            tenant_id=developer_id,
            user=user,
            role=role,
            starts_at=tenancy.DATABASE_NOW,
            accepted_at=tenancy.DATABASE_NOW,
        )
    return user.pk


def _invited(
    email: str,
    name: str,
    role: str,
    password: str | None,
    *,
    outside_org: str = "",
    expires_at: datetime | None = None,
) -> tuple[uuid.UUID, uuid.UUID]:
    """Invited by the acting member, and accepted: (the user's id, the Membership's id)."""
    link = invitations.invite(email, role, expires_at=expires_at, outside_org=outside_org)
    invitations.accept(link.token, _account(email, name, password))
    return User.objects.get(email__iexact=email).pk, link.membership_id


def _guest_until(time_zone: str) -> datetime:
    """The end of the Guest's last day in the Market's time zone."""
    zone = ZoneInfo(time_zone)
    last_day = GUEST_UNTIL
    if datetime.combine(last_day, time.max, zone) <= timezone.now():
        last_day = timezone.now().astimezone(zone).date() + timedelta(days=GUEST_DAYS_AFTER)
    return datetime.combine(last_day, time(23, 59), zone)
