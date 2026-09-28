"""Fixtures for signing in, the API as the web calls it, invitations, and every served operation
(ticket 07). Built on `vextrus.testing.tenancy` (`make_developer`, `sign_in`, `Member`).

- `Api(client)`: the API as the web calls it, with CSRF enforced: every unsafe request carries the
  token from the CSRF cookie, fetched from `/api/auth/csrf` when missing (`post(..., csrf=False)`
  sends none). `api` is a signed-out one; `api_as(member)` one on a member's session.
- `team`: one Developer with a member in each role (`team["qs"]`, `["md"]`, `["vextrus_engineer"]`,
  `["guest"]`), each a signed-in `Member`.
- `invitation(member, email, role, ...)`: an invitation made by `member` through the service,
  `(membership id, token)`; `accept_as(token, user)` accepts it as an existing account (a Vextrus
  Engineer's only as one of Vextrus's staff, the fixtures `staff` and `other_staff`).
- `served_operations()`: every Ninja operation the URLs serve, found through Django's URL resolver,
  so the walking tests see every module's operations with no list to edit; `other_views()`: every
  other route served outside the admin (a plain view, or an operation wrapped at the URL).
"""

import functools
import inspect
import json
import uuid
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import pytest
from django.conf import settings
from django.middleware.csrf import CSRF_ALLOWED_CHARS, CSRF_SECRET_LENGTH
from django.test import Client
from django.urls import URLPattern, URLResolver, get_resolver
from django.utils.crypto import get_random_string
from ninja.operation import Operation, PathView

from vextrus.platform.models import User
from vextrus.platform.services import invitations, tenancy
from vextrus.testing.tenancy import Member

ROLES = ("qs", "md", "vextrus_engineer", "guest")


class Api:
    """A client calling the API as the web does: JSON bodies, CSRF enforced."""

    def __init__(self, client: Client | None = None) -> None:
        self.client = Client(enforce_csrf_checks=True)
        if client is not None:
            self.client.cookies = client.cookies

    def csrf_token(self) -> str:
        cookie = self.client.cookies.get(settings.CSRF_COOKIE_NAME)
        if cookie is None or not cookie.value:
            self.client.get("/api/auth/csrf")
            cookie = self.client.cookies.get(settings.CSRF_COOKIE_NAME)
        if cookie is None or not cookie.value:  # a test's own URLs, without platform's
            self.client.cookies[settings.CSRF_COOKIE_NAME] = get_random_string(
                CSRF_SECRET_LENGTH, CSRF_ALLOWED_CHARS
            )
            cookie = self.client.cookies[settings.CSRF_COOKIE_NAME]
        return cookie.value

    def get(self, path: str, **query: Any) -> Any:
        return self.client.get(path, query)

    def post(self, path: str, body: Any = None, *, csrf: bool = True) -> Any:
        return self.send("post", path, body, csrf=csrf)

    def send(self, method: str, path: str, body: Any = None, *, csrf: bool = True) -> Any:
        if method.upper() in ("GET", "HEAD"):
            return getattr(self.client, method.lower())(path)
        headers = {"X-CSRFToken": self.csrf_token()} if csrf else {}
        return getattr(self.client, method)(
            path,
            data=json.dumps(body if body is not None else {}, default=str),
            content_type="application/json",
            headers=headers,
        )

    @property
    def session_key(self) -> str | None:
        cookie = self.client.cookies.get(settings.SESSION_COOKIE_NAME)
        return cookie.value if cookie is not None and cookie.value else None


@pytest.fixture
def api(db: None) -> Api:
    return Api()


def api_as(member: Member) -> Api:
    return Api(member.client)


@pytest.fixture
def team(sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]) -> dict[str, Member]:
    developer_id = make_developer()
    return {role: sign_in(role=role, developer_id=developer_id) for role in ROLES}


def invitation(
    member: Member,
    email: str,
    role: str = "vextrus_engineer",
    *,
    project_ids: Iterable[uuid.UUID] | None = None,
    expires_at: datetime | None = None,
) -> tuple[uuid.UUID, str]:
    """An invitation made by `member` through the service: (its membership id, its token)."""
    with member.acting():
        link = invitations.invite(email, role, project_ids=project_ids, expires_at=expires_at)
    return link.membership_id, link.token


def accept_as(token: str, user: User) -> uuid.UUID:
    """Accept a link as an existing account, as signing in and accepting would: a Vextrus Engineer's
    only with one of Vextrus's staff (`staff`, `other_staff`). The Developer's id."""
    with tenancy.acting_in(None):
        return invitations.accept(token, user)


# Every operation the URLs serve -------------------------------------------------------------------


@dataclass(frozen=True)
class Served:
    route: str
    """The URL's pattern, as Django serves it (`api/members/<membership_id>/revoke`)."""
    method: str
    operation: Operation


def served_operations() -> list[Served]:
    """Every Ninja operation the root URLconf serves, one per method."""
    return _survey()[0]


def other_views() -> list[str]:
    """Every route the root URLconf serves that is not a Ninja operation's own view: a plain Django
    view, or an operation's view wrapped at the URL (which would run before its guard). Ninja's
    schema pages and the admin (Django's, run by 02's rules) are left out."""
    return _survey()[1]


def _survey() -> tuple[list[Served], list[str]]:
    found: list[Served] = []
    others: list[str] = []
    seen: set[int] = set()
    for route, callback, in_admin in _walk(get_resolver().url_patterns, "", in_admin=False):
        if in_admin or _ninja_page(callback):
            continue
        path_view = _path_view(callback)
        if path_view is None:
            others.append(route)
            continue
        if id(path_view) in seen:
            continue
        seen.add(id(path_view))
        for operation in path_view.operations:
            found.extend(Served(route, method, operation) for method in operation.methods)
    return found, others


def _ninja_page(callback: Any) -> bool:
    """Ninja's own schema, docs and root pages: partials of its views, served as Ninja makes them."""
    return isinstance(callback, functools.partial) and callback.func.__module__.startswith("ninja.")


def _path_view(callback: Any) -> PathView | None:
    """The PathView whose view this callback is, unwrapped by nothing; else None."""
    if not inspect.isfunction(callback) or callback.__closure__ is None:
        return None
    found = inspect.getclosurevars(callback).nonlocals.get("self")
    return found if isinstance(found, PathView) else None


def _walk(
    patterns: Iterable[URLPattern | URLResolver], prefix: str, *, in_admin: bool
) -> Iterator[tuple[str, Any, bool]]:
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from _walk(
                pattern.url_patterns,
                prefix + str(pattern.pattern),
                in_admin=in_admin or pattern.namespace == "admin",
            )
        else:
            yield prefix + str(pattern.pattern), pattern.callback, in_admin
