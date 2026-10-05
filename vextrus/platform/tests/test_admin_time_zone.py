"""T-235a's unit seams: the admin's words for a Market and a home region, and where the admin's
time-zone middleware stays out (no database). The pages and the zone itself are pinned in
`acceptance/t235a`. Every name and id here is invented."""

from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from django.utils import timezone, translation

from vextrus.platform.admin.tenancy import REGION_NAMES, market_name, region_name
from vextrus.platform.http.middleware import AdminTimeZoneMiddleware
from vextrus.platform.models import Market


def test_a_named_region_reads_as_its_place() -> None:
    for cell, place in REGION_NAMES.items():
        assert region_name(cell) == place


def test_a_region_with_no_name_reads_as_stored() -> None:
    assert region_name("zz-nowhere4") == "zz-nowhere4"
    assert region_name("") == ""


def test_a_market_reads_in_the_language_shown_then_english_then_its_code() -> None:
    market = Market(code="QQ", labels={"en": "Quarterland", "xx": "Quarterlandia"})
    with translation.override("xx"):
        assert market_name(market) == "Quarterlandia"
    with translation.override("en"):
        assert market_name(market) == "Quarterland"
    with translation.override("yy"):
        assert market_name(market) == "Quarterland"
    assert market_name(Market(code="QQ", labels={})) == "QQ"


def test_a_request_outside_the_admin_with_no_developer_is_left_in_utc() -> None:
    seen: list[str] = []

    def get_response(request: HttpRequest) -> HttpResponse:
        seen.append(timezone.get_current_timezone_name())
        return HttpResponse()

    middleware = AdminTimeZoneMiddleware(get_response)
    middleware(RequestFactory().get("/api/me"))
    middleware(RequestFactory().get("/admin/"))

    assert seen == ["UTC", "UTC"]
