"""The tenant middleware (docs/data-model.md §2, Tenancy).

It opens `transaction.atomic()` around the rest of the request (the view and its template's
rendering), and inside it sets `app.user_id`, reads the current Developer from the session, checks
the Membership is current and sets `app.tenant_id` and `app.library_id`, all with `is_local = true`
(`services.tenancy.enter_request`). Django's middleware otherwise runs outside the view's
transaction, and a transaction-local setting made there would be gone before the view reads.

A request that raises, or answers with a server error, is rolled back, as `ATOMIC_REQUESTS` would.
It must come after the authentication middleware.
"""

from collections.abc import Callable

from django.db import transaction
from django.http import HttpRequest, HttpResponse

from vextrus.platform.services import tenancy


class TenantMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        with transaction.atomic():
            try:
                tenancy.enter_request(request)
                response = self.get_response(request)
                if response.status_code >= 500:
                    transaction.set_rollback(True)
            finally:
                tenancy.leave_request()
        return response

    def process_exception(self, request: HttpRequest, exception: Exception) -> None:
        transaction.set_rollback(True)
