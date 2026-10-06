"""The tenant middleware (docs/data-model.md §2, Tenancy).

It opens `transaction.atomic()` around the rest of the request (the view and its template's
rendering), and inside it sets `app.user_id`, reads the current Developer from the session, checks
the Membership is current and sets `app.tenant_id` and `app.library_id`, all with `is_local = true`
(`services.tenancy.enter_request`). Django's middleware otherwise runs outside the view's
transaction, and a transaction-local setting made there would be gone before the view reads.

A request that raises, or answers with any error (4xx or 5xx), is rolled back: the API's framework
turns its errors into responses inside the view, so a status is the only sign left of a failure. An
act that must be kept on a failed request writes in a transaction of its own.

What it does not cover: a streaming response's body is produced after the block has ended, so it
runs with no tenant and sees no tenant's rows (it fails closed); the session is saved after the
block, so a failure in saving it cannot undo the request's committed writes. It must come after the
authentication middleware.

`AdminTimeZoneMiddleware` comes straight after it: a request to the admin with a current Developer
runs (view and template) in that Developer's Market's time zone, so the admin shows a time as the
web does (ADR 0038). `TIME_ZONE` stays UTC; any other request is left as it is.
"""

from collections.abc import Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.db import transaction
from django.http import HttpRequest, HttpResponse
from django.urls import NoReverseMatch, reverse
from django.utils import timezone

from vextrus.platform.services import markets, tenancy


class TenantMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        with transaction.atomic():
            try:
                tenancy.enter_request(request)
                response = self.get_response(request)
                if response.status_code >= 400:
                    transaction.set_rollback(True)
            finally:
                tenancy.leave_request()
        return response

    def process_exception(self, request: HttpRequest, exception: Exception) -> None:
        transaction.set_rollback(True)


class AdminTimeZoneMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        zone = self._zone(request)
        if zone is None:
            return self.get_response(request)
        with timezone.override(zone):
            return self.get_response(request)

    @staticmethod
    def _zone(request: HttpRequest) -> ZoneInfo | None:
        """The acting Developer's Market's zone on an admin page; None elsewhere, with no Developer,
        or when the Market's zone name is not a zone (shown in UTC, never a 500)."""
        if not _in_admin(request):
            return None
        tenant_id = tenancy.current_tenant_id()
        if tenant_id is None:
            return None
        try:
            return ZoneInfo(markets.of_developer(tenant_id).time_zone)
        except markets.MarketNotFound, ZoneInfoNotFoundError, ValueError:
            return None


def _in_admin(request: HttpRequest) -> bool:
    """Whether the request is an admin page; False where the URL configuration serves no admin (the
    job's, or a test's API-only one). Reversed on each call: `reverse` includes the script prefix,
    which is the request's own, as `path` does (`path_info` does not)."""
    try:
        prefix = reverse(
            "admin:index", urlconf=getattr(request, "urlconf", None) or settings.ROOT_URLCONF
        )
    except NoReverseMatch:
        return False
    return request.path.startswith(prefix)
