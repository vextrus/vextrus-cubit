"""The tenant middleware: a pass-through until 02 fills it (docs/data-model.md §2, Tenancy).

02 makes it open `transaction.atomic()` around the request, set `app.user_id`, read the current
Developer from the session, check the Membership is current, and set `app.tenant_id` and
`app.library_id` with `is_local = true`. Its dotted path is already in MIDDLEWARE.
"""

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse


class TenantMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        return self.get_response(request)
