"""The tenant middleware (docs/data-model.md §2, Tenancy).

It opens `transaction.atomic()` around the rest of the request (the view and its template's
rendering), and inside it sets `app.user_id`, reads the current Developer from the session, checks
the Membership is current and sets `app.tenant_id` and `app.library_id`, all with `is_local = true`
(`services.tenancy.enter_request`). Django's middleware otherwise runs outside the view's
transaction, and a transaction-local setting made there would be gone before the view reads.

A request that raises, or answers with any error (4xx or 5xx), is rolled back: the API's framework
turns its errors into responses inside the view, so a status is the only sign left of a failure. An
act that must be kept on a failed request writes in a transaction of its own.

**An act aborted by PostgreSQL** to end a deadlock or a serialization failure (#227): the act route
called `deadlocks.retried`, which marks the request; the whole request, rolled back, is run again
in a new transaction, at most twice, after a short jittered pause, each retry logged
(`deadlocks.requests`). No other request is run again, nor a streamed one.

What it does not cover: a streaming response's body is produced after the block has ended, so it
runs with no tenant and sees no tenant's rows (it fails closed); the session is saved after the
block, so a failure in saving it cannot undo the request's committed writes. It must come after the
authentication middleware.
"""

from collections.abc import Callable

from django.db import transaction
from django.http import HttpRequest, HttpResponse

from vextrus.platform.services import deadlocks, tenancy


class TenantMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response: HttpResponse = deadlocks.requests(
            lambda: self._once(request), done=lambda r: bool(getattr(r, "streaming", False))
        )
        return response

    def _once(self, request: HttpRequest) -> HttpResponse:
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
