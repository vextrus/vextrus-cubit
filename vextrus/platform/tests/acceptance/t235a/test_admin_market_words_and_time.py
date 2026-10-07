"""Ticket T-235a (#235; the M0 finish line, item 13: dates and times in Dhaka time): the admin shows
a time in the acting Developer's Market time zone, and says the Market and the home region in words.

The seam the ticket fixes: `vextrus.platform.http.middleware.AdminTimeZoneMiddleware`, straight after
`TenantMiddleware` in `settings.MIDDLEWARE`. Inside a request to the admin with a current tenant it
runs the rest of the request under that Developer's Market's `time_zone`; otherwise it changes
nothing. `TIME_ZONE` stays `"UTC"`: times are stored in UTC and the zone is data (ADR 0038).

The class is looked up inside each test that needs it (an `AttributeError` until it is built), so
the page cases fail on their own words.
Every name, region id and instant here is invented.
"""

import re
import uuid
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from importlib import import_module
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.test import Client, RequestFactory
from django.urls import reverse
from django.utils import timezone
from django.utils.formats import date_format

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import Developer, Market, Membership, User
from vextrus.platform.services import tenancy
from vextrus.platform.services.markets import MarketProfile

TENANT_MIDDLEWARE = "vextrus.platform.http.middleware.TenantMiddleware"
ADMIN_TIME_ZONE_MIDDLEWARE = "vextrus.platform.http.middleware.AdminTimeZoneMiddleware"

BANGLADESH_ZONE = "Asia/Dhaka"
"""The seeded Market's zone, read from the fixture and checked, so each case names what it expects."""
HALF_AN_HOUR_BEHIND = "Asia/Kolkata"
"""UTC+5:30, half an hour from the Bangladesh Market's UTC+6."""
STORED_REGION = "asia-south1"
STORED_REGION_NAME = "Mumbai"
UNNAMED_REGION = "xx-test9"

CREATED = datetime(2026, 3, 14, 19, 40, tzinfo=UTC)
"""Shown as March 15, 1:40 a.m. at UTC+6 and 1:10 a.m. at UTC+5:30; 7:40 p.m. the day before in UTC."""
EXPIRES = datetime(2026, 12, 31, 20, 15, tzinfo=UTC)
"""Past midnight in the Market's zone, so the local date differs from UTC's too."""


@pytest.fixture
def admin_client(db: None, staff: User) -> Client:
    client = Client()
    client.force_login(staff)
    return client


def pick(client: Client, developer: uuid.UUID) -> None:
    response = client.post(f"/admin/platform/developer/{developer}/pick/")
    assert response.status_code == 302


def readonly_rows(page: bytes) -> dict[str, str]:
    """A Developer page's read-only rows: {heading: the text shown}, tags stripped."""
    found = re.findall(
        r'<label[^>]*>\s*([^<]*?):?\s*</label>\s*<div class="readonly">(.*?)</div>',
        page.decode(),
        flags=re.DOTALL,
    )
    return {heading: re.sub(r"<[^>]+>", "", shown).strip() for heading, shown in found}


def developer_page(client: Client, developer: uuid.UUID) -> bytes:
    response = client.get(f"/admin/platform/developer/{developer}/change/")
    assert response.status_code == 200
    return response.content


def set_created_at(developer: uuid.UUID, when: datetime) -> None:
    """Through the owner: `vextrus_app` never updates a Developer's row."""
    changed = Developer.objects.using(OWNER_ALIAS).filter(id=developer).update(created_at=when)
    assert changed == 1


@pytest.fixture
def market_zone(market: MarketProfile) -> Iterator[Callable[[str], None]]:
    """Change the Market's `time_zone` through the owner (committed); put it back after."""

    def change(zone: str) -> None:
        Market.objects.using(OWNER_ALIAS).filter(id=market.id).update(time_zone=zone)

    yield change
    Market.objects.using(OWNER_ALIAS).filter(id=market.id).update(time_zone=market.time_zone)


@pytest.mark.django_db(transaction=True, databases=["default", OWNER_ALIAS])
def test_the_developer_page_shows_created_at_in_the_market_s_time_zone(
    admin_client: Client, make_developer: Callable[..., uuid.UUID], market: MarketProfile
) -> None:
    assert market.time_zone == BANGLADESH_ZONE
    developer = make_developer("Kestrel Row Builders Ltd")
    set_created_at(developer, CREATED)
    pick(admin_client, developer)

    page = developer_page(admin_client, developer)

    assert readonly_rows(page)["Created at"] == "March 15, 2026, 1:40 a.m."
    assert b"7:40 p.m." not in page
    assert b"March 14, 2026" not in page


@pytest.mark.django_db(transaction=True, databases=["default", OWNER_ALIAS])
def test_the_zone_is_the_market_s_data_not_code(
    admin_client: Client,
    make_developer: Callable[..., uuid.UUID],
    market_zone: Callable[[str], None],
) -> None:
    developer = make_developer("Lindenmoor Estates Ltd")
    set_created_at(developer, CREATED)
    market_zone(HALF_AN_HOUR_BEHIND)
    pick(admin_client, developer)

    page = developer_page(admin_client, developer)

    assert readonly_rows(page)["Created at"] == "March 15, 2026, 1:10 a.m."
    assert b"1:40 a.m." not in page
    assert b"7:40 p.m." not in page


@pytest.mark.django_db
def test_the_membership_list_shows_its_times_in_the_market_s_time_zone(
    admin_client: Client,
    staff: User,
    make_developer: Callable[..., uuid.UUID],
    market: MarketProfile,
) -> None:
    developer = make_developer("Quillbrook Homes Ltd")
    with tenancy.acting_in(developer):
        invitation = tenancy.invite_first_md("first.md@quillbrook.example", invited_by=staff)
        Membership.objects.filter(id=invitation.membership_id).update(expires_at=EXPIRES)
        expires_at = Membership.objects.get(id=invitation.membership_id).expires_at
    assert expires_at is not None
    local = expires_at.astimezone(ZoneInfo(market.time_zone))
    utc = expires_at.astimezone(UTC)
    assert local.date() != utc.date()
    pick(admin_client, developer)

    response = admin_client.get("/admin/platform/membership/")

    assert response.status_code == 200
    assert b"first.md@quillbrook.example" in response.content
    assert date_format(local, "DATETIME_FORMAT").encode() in response.content
    assert date_format(utc, "DATETIME_FORMAT").encode() not in response.content


def admin_time_zone_middleware() -> Any:
    """The class T-235a adds beside `TenantMiddleware`."""
    return import_module("vextrus.platform.http.middleware").AdminTimeZoneMiddleware


def record_the_zone(into: list[str]) -> Callable[[HttpRequest], HttpResponse]:
    def get_response(request: HttpRequest) -> HttpResponse:
        into.append(timezone.get_current_timezone_name())
        return HttpResponse()

    return get_response


@pytest.mark.django_db
def test_the_middleware_shifts_an_admin_request_and_leaves_no_zone_behind(
    make_developer: Callable[..., uuid.UUID], market: MarketProfile
) -> None:
    developer = make_developer("Harrowgate Works Ltd")
    seen: list[str] = []
    middleware = admin_time_zone_middleware()(record_the_zone(seen))

    with tenancy.acting_in(developer):
        middleware(RequestFactory().get(reverse("admin:index")))
        after = timezone.get_current_timezone_name()

    assert seen == [market.time_zone]
    assert after == "UTC"
    assert timezone.get_current_timezone_name() == "UTC"


@pytest.mark.django_db
def test_the_middleware_leaves_the_api_and_an_admin_with_no_developer_in_utc(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    developer = make_developer("Fenwick Yard Ltd")
    seen: list[str] = []
    middleware = admin_time_zone_middleware()(record_the_zone(seen))

    with tenancy.acting_in(developer):
        middleware(RequestFactory().get("/api/me"))
    with tenancy.acting_in(None):
        middleware(RequestFactory().get(reverse("admin:index")))

    assert seen == ["UTC", "UTC"]


def test_the_middleware_sits_straight_after_the_tenant_middleware_and_time_zone_stays_utc() -> None:
    middleware = list(settings.MIDDLEWARE)

    assert middleware.index(ADMIN_TIME_ZONE_MIDDLEWARE) == middleware.index(TENANT_MIDDLEWARE) + 1
    assert settings.TIME_ZONE == "UTC"


@pytest.mark.django_db
def test_the_add_form_offers_the_market_by_its_name(admin_client: Client, market: MarketProfile) -> None:
    name = market.labels["en"]
    assert name != market.code

    response = admin_client.get("/admin/platform/developer/add/")

    assert response.status_code == 200
    page = response.content.decode()
    options = dict(re.findall(r'<option value="([^"]*)"[^>]*>\s*([^<]*?)\s*</option>', page))
    assert options.get(str(market.id)) == name
    assert market.code not in options.values()


@pytest.mark.django_db
def test_the_developer_page_says_its_market_and_home_region_in_words(
    admin_client: Client, make_developer: Callable[..., uuid.UUID], market: MarketProfile
) -> None:
    assert market.default_home_region == STORED_REGION
    developer = make_developer("Ashcombe Terrace Ltd")
    pick(admin_client, developer)

    page = developer_page(admin_client, developer)
    rows = readonly_rows(page)

    assert rows["Market"] == market.labels["en"]
    assert rows["Home region"] == STORED_REGION_NAME
    assert STORED_REGION.encode() not in page
    assert not re.search(rf">\s*{re.escape(market.code)}\s*<", page.decode())


@pytest.mark.django_db
def test_a_home_region_the_admin_has_no_name_for_reads_as_stored(
    admin_client: Client, market: MarketProfile
) -> None:
    with tenancy.acting_in(None):
        developer = tenancy.create_developer(
            "Brackenfold Living Ltd", market.id, home_region=UNNAMED_REGION
        )
    pick(admin_client, developer)

    rows = readonly_rows(developer_page(admin_client, developer))

    assert rows["Home region"] == UNNAMED_REGION
    assert rows["Market"] == market.labels["en"]
