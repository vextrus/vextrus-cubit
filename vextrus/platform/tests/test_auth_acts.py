"""Acts: the role-to-act rule, `require`, the decorator every operation declares its act through, and
the walk over every operation the URLs serve (ticket 07; the M0 plan's review A8)."""

import sys
import types
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.contrib import admin
from django.http import HttpRequest
from django.urls import URLPattern, path
from ninja import NinjaAPI, Router, Schema

from vextrus.platform.http.acts import (
    SAFE_METHODS,
    Refusal,
    Session,
    declaration_of,
    declare,
    install,
    public,
)
from vextrus.platform.services import auth, tenancy
from vextrus.platform.services.auth import ROLES, Act, Grant
from vextrus.testing.auth import Api, api_as, other_views, served_operations
from vextrus.testing.tenancy import Member

# The role-to-act rule -----------------------------------------------------------------------------

EXPECTED = {
    #              qs     md     engineer guest
    Grant.ACCOUNT: (True, True, True, True),
    Grant.LOOK: (True, True, True, True),
    Grant.CHANGE: (True, False, True, False),
    Grant.PEOPLE: (True, True, True, False),
    Grant.ACCESS: (True, True, False, False),
    Grant.ACTS: (True, True, False, False),
}


@pytest.mark.parametrize("grant", list(Grant))
def test_the_role_to_act_rule_is_m0_screens(grant: Grant) -> None:
    held = tuple(role in ROLES[grant] for role in ("qs", "md", "vextrus_engineer", "guest"))

    assert held == EXPECTED[grant]


def test_the_md_and_a_guest_look_but_never_change() -> None:
    change = Act("fake.change", Grant.CHANGE)
    look = Act("fake.look", Grant.LOOK)

    assert [auth.allows(role, change) for role in ("md", "guest")] == [False, False]
    assert [auth.allows(role, look) for role in ("md", "guest")] == [True, True]


def test_an_act_is_named_like_a_message_code_and_needs_a_grant() -> None:
    with pytest.raises(ValueError, match="dotted"):
        Act("Projects Create", Grant.CHANGE)
    with pytest.raises(TypeError, match="Grant"):
        Act("projects.create", "change")  # type: ignore[arg-type]


# require -----------------------------------------------------------------------------------------

LOOK = Act("fake.look", Grant.LOOK)
CHANGE = Act("fake.change", Grant.CHANGE)


@pytest.mark.django_db
def test_require_refuses_the_signed_out() -> None:
    with tenancy.acting_in(None), pytest.raises(auth.NotSignedIn):
        auth.require(LOOK)


@pytest.mark.django_db
def test_require_refuses_a_user_with_no_current_membership(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="qs")

    with tenancy.acting_in(None, user_id=member.user.pk), pytest.raises(auth.NoDeveloper):
        auth.require(LOOK)
    with tenancy.acting_in(None, user_id=member.user.pk):
        assert auth.require(auth.ACCOUNT) is None  # an account act needs no Developer


@pytest.mark.django_db
def test_a_project_outside_the_scope_is_not_found_before_the_role_is_asked(
    sign_in: Callable[..., Member],
) -> None:
    mine, other = uuid.uuid4(), uuid.uuid4()
    guest = sign_in(role="guest", projects=[mine])

    with guest.acting():
        assert auth.require(LOOK, mine) is not None
        with pytest.raises(auth.NotAllowed):
            auth.require(CHANGE, mine)
        with pytest.raises(auth.NotFound):
            auth.require(LOOK, other)
        with pytest.raises(auth.NotFound):  # not "not allowed": the Project's existence never leaks
            auth.require(CHANGE, other)


@pytest.mark.django_db
def test_a_membership_with_no_projects_opens_any(sign_in: Callable[..., Member]) -> None:
    qs = sign_in(role="qs")

    with qs.acting():
        held = auth.require(CHANGE, uuid.uuid4())

    assert held is not None
    assert held.role == "qs"


# The decorator, on a later module's operations ----------------------------------------------------

OPEN = Act("later.open", Grant.LOOK)
EDIT = Act("later.edit", Grant.CHANGE)


class Body(Schema):
    project_id: uuid.UUID
    note: str = ""


def later_module() -> Router:
    """A module added later: it declares its acts in its own package and decorates its operations."""
    router = Router()

    @router.get("/later/{project_id}")
    @declare(OPEN, project="project_id")
    def read(request: HttpRequest, project_id: uuid.UUID) -> dict[str, str]:
        return {"read": str(project_id)}

    @router.post("/later/{project_id}", response={200: dict, 409: Refusal})
    @declare(EDIT, project="project_id")
    def write(request: HttpRequest, project_id: uuid.UUID) -> dict[str, str]:
        if project_id.int == 0:
            raise auth.Refused({"code": "later.edit.clash", "params": {}}, status=409)
        return {"wrote": str(project_id)}

    @router.post("/later-body")
    @declare(EDIT, project="payload.project_id")
    def write_body(request: HttpRequest, payload: Body) -> dict[str, str]:
        return {"wrote": str(payload.project_id)}

    @router.get("/later-undeclared")
    def undeclared(request: HttpRequest) -> dict[str, str]:
        return {}

    @router.post("/later-public", auth=None)
    @public
    def anyone(request: HttpRequest) -> dict[str, str]:
        return {"public": "yes"}

    return router


@pytest.fixture
def later_urls(settings: Any) -> Iterator[None]:
    api = NinjaAPI(auth=Session(), urls_namespace=f"later-{uuid.uuid4().hex}")
    install(api)
    api.add_router("", later_module())
    module = types.ModuleType("later_urls")
    module.urlpatterns = [path("api/", api.urls), path("admin/", admin.site.urls)]  # type: ignore[attr-defined]
    sys.modules["later_urls"] = module
    settings.ROOT_URLCONF = "later_urls"
    yield
    del sys.modules["later_urls"]


def status(response: Any) -> tuple[int, Any]:
    return response.status_code, response.json()


@pytest.mark.django_db
@pytest.mark.usefixtures("later_urls")
@pytest.mark.parametrize(
    ("role", "reads", "writes"),
    [("qs", 200, 200), ("vextrus_engineer", 200, 200), ("md", 200, 403), ("guest", 200, 403)],
)
def test_a_later_module_s_acts_follow_the_role_to_act_rule(
    sign_in: Callable[..., Member], role: str, reads: int, writes: int
) -> None:
    project = uuid.uuid4()
    member = api_as(sign_in(role=role))

    assert member.get(f"/api/later/{project}").status_code == reads
    written = member.post(f"/api/later/{project}")
    assert written.status_code == writes
    if writes == 403:
        assert written.json() == {"code": "platform.auth.not_allowed", "params": {"role": role}}
    assert member.post("/api/later-body", {"project_id": str(project)}).status_code == writes


@pytest.mark.django_db
@pytest.mark.usefixtures("later_urls")
@pytest.mark.parametrize("role", ["qs", "md", "vextrus_engineer", "guest"])
def test_a_later_module_s_project_outside_the_scope_is_not_found_for_every_act(
    sign_in: Callable[..., Member], role: str
) -> None:
    mine, other = uuid.uuid4(), uuid.uuid4()
    member = api_as(sign_in(role=role, projects=[mine]))
    not_found = (404, {"code": "platform.auth.not_found", "params": {}})

    assert member.get(f"/api/later/{mine}").status_code == 200
    assert status(member.get(f"/api/later/{other}")) == not_found
    assert status(member.post(f"/api/later/{other}")) == not_found
    assert status(member.post("/api/later-body", {"project_id": str(other)})) == not_found


@pytest.mark.django_db
@pytest.mark.usefixtures("later_urls")
def test_a_refusal_raised_in_a_view_is_its_response_and_its_writes_roll_back(
    sign_in: Callable[..., Member],
) -> None:
    qs = api_as(sign_in(role="qs"))

    refused = qs.post(f"/api/later/{uuid.UUID(int=0)}")

    assert status(refused) == (409, {"code": "later.edit.clash", "params": {}})


@pytest.mark.django_db
@pytest.mark.usefixtures("later_urls")
def test_signed_out_or_without_a_developer_a_declared_act_is_refused(
    sign_in: Callable[..., Member],
) -> None:
    member = sign_in(role="qs")
    with member.acting():
        from vextrus.platform.models import Membership

        Membership.objects.filter(id=member.membership_id).update(revoked_at="2026-01-01T00:00Z")

    assert status(Api().get(f"/api/later/{uuid.uuid4()}")) == (401, SIGNED_OUT)
    assert status(api_as(member).get(f"/api/later/{uuid.uuid4()}")) == (
        403,
        {"code": "platform.auth.no_developer", "params": {}},
    )


@pytest.mark.django_db
@pytest.mark.usefixtures("later_urls")
def test_the_guard_checks_csrf_on_a_public_unsafe_operation_too(
    sign_in: Callable[..., Member],
) -> None:
    anyone = Api()

    assert status(anyone.post("/api/later-public", csrf=False)) == (
        403,
        {"code": "platform.auth.csrf_failed", "params": {}},
    )
    assert status(anyone.post("/api/later-public")) == (200, {"public": "yes"})


def test_declaring_a_project_parameter_the_view_lacks_fails_at_import() -> None:
    with pytest.raises(TypeError, match="no parameter 'project'"):

        @declare(OPEN, project="project")
        def view(request: HttpRequest, project_id: uuid.UUID) -> None: ...


def test_declaring_twice_or_an_async_view_fails_at_import() -> None:
    with pytest.raises(TypeError, match="twice"):

        @declare(OPEN)
        @public
        def twice(request: HttpRequest) -> None: ...

    with pytest.raises(TypeError, match="synchronous"):

        @declare(OPEN)
        async def later(request: HttpRequest) -> None: ...

    with pytest.raises(TypeError, match="takes an Act"):
        declare("later.open")  # type: ignore[arg-type]


def test_a_decorator_over_the_guard_is_not_a_declaration() -> None:
    """It could answer without calling the guard; `functools.wraps` copies the guard's attributes."""
    import functools

    @declare(OPEN)
    def view(request: HttpRequest) -> None: ...

    @functools.wraps(view)
    def outer(request: HttpRequest) -> None: ...

    assert declaration_of(view) is not None
    assert declaration_of(outer) is None


def test_an_account_act_names_no_project() -> None:
    with pytest.raises(TypeError, match="no Project"):

        @declare(auth.ACCOUNT, project="project_id")
        def view(request: HttpRequest, project_id: uuid.UUID) -> None: ...


@pytest.mark.django_db
def test_require_refuses_an_account_act_with_a_project(sign_in: Callable[..., Member]) -> None:
    guest = sign_in(role="guest", projects=[uuid.uuid4()])

    with guest.acting(), pytest.raises(TypeError, match="no Project"):
        auth.require(auth.ACCOUNT, uuid.uuid4())


# The walk over every operation --------------------------------------------------------------------


def test_the_walk_finds_platform_s_operations() -> None:
    found = {(served.route, served.method) for served in served_operations()}

    assert {
        ("api/me", "GET"),
        ("api/auth/sign-in", "POST"),
        ("api/members/<membership_id>/revoke", "POST"),
        ("api/activity", "GET"),
    } <= found


def test_every_served_view_outside_the_admin_is_a_ninja_operation() -> None:
    assert other_views() == []


def test_no_decorator_runs_before_an_operation_s_guard() -> None:
    """Ninja's `decorate_view` and a router's view decorators wrap `Operation.run`, before the guard."""
    wrapped = [
        f"{served.method} {served.route}"
        for served in served_operations()
        if getattr(served.operation.run, "__func__", None) is not type(served.operation).run
    ]

    assert wrapped == []


def test_every_served_operation_declares_its_act_or_public() -> None:
    undeclared = [
        f"{served.method} {served.route} ({served.operation.view_func.__module__})"
        for served in served_operations()
        if declaration_of(served.operation.view_func) is None
    ]

    assert undeclared == []


@pytest.mark.usefixtures("later_urls")
def test_the_walk_catches_a_later_module_s_undeclared_operation_with_no_edit_to_it() -> None:
    undeclared = [
        (served.method, served.route)
        for served in served_operations()
        if declaration_of(served.operation.view_func) is None
    ]

    assert undeclared == [("GET", "api/later-undeclared")]


def fill(route: str) -> str:
    """The route with every parameter filled by a fresh id."""
    import re

    return "/" + re.sub(r"<[^>]+>", lambda _: str(uuid.uuid4()), route)


@pytest.mark.django_db
def test_every_unsafe_operation_refuses_a_request_without_the_csrf_token(
    sign_in: Callable[..., Member],
) -> None:
    member = api_as(sign_in(role="md"))
    unsafe = [served for served in served_operations() if served.method not in SAFE_METHODS]
    assert unsafe

    for served in unsafe:
        response = member.send(served.method.lower(), fill(served.route), {}, csrf=False)
        declaration = declaration_of(served.operation.view_func)
        # Ninja reads a public operation's body before the guard runs: an empty body may be refused
        # as unreadable (422) first; the view never runs either way.
        allowed = {403, 422} if declaration is not None and declaration.public else {403}
        assert response.status_code in allowed, (served.method, served.route, response.content)
        if response.status_code == 403:  # the documented `Refusal`, whoever refused
            assert response.json() == CSRF_FAILED, (served.method, served.route)


CSRF_FAILED = {"code": "platform.auth.csrf_failed", "params": {}}
SIGNED_OUT = {"code": "platform.auth.signed_out", "params": {}}


@pytest.mark.django_db
def test_every_operation_refuses_the_signed_out_with_a_refusal() -> None:
    anyone = Api()
    guarded = [
        served
        for served in served_operations()
        if (found := declaration_of(served.operation.view_func)) is None or not found.public
    ]
    assert guarded

    for served in guarded:
        response = anyone.send(served.method.lower(), fill(served.route), {})
        assert (response.status_code, response.json()) == (401, SIGNED_OUT), (
            served.method,
            served.route,
        )


@pytest.mark.django_db
def test_every_refusal_documented_as_a_refusal_answers_as_one(
    sign_in: Callable[..., Member],
) -> None:
    """The statuses the schema documents as `Refusal` for each operation carry `{code, params}`."""
    schema = served_operations()[0].operation.api.get_openapi_schema()
    guest = api_as(sign_in(role="guest"))
    checked = 0
    for route, operations in schema["paths"].items():
        for method, documented in operations.items():
            for status, answer in documented["responses"].items():
                reference = str(answer.get("content", {}).get("application/json", {}).get("schema"))
                if "Refusal" not in reference or int(status) not in (401, 403):
                    continue
                client = Api() if int(status) == 401 else guest
                response = client.send(method, fill_schema(route), {}, csrf=int(status) != 403)
                if response.status_code == int(status):
                    assert set(response.json()) == {"code", "params"}, (method, route, status)
                    checked += 1
    assert checked


def fill_schema(route: str) -> str:
    """An OpenAPI path with every parameter filled by a fresh id."""
    import re

    return re.sub(r"\{[^}]+\}", lambda _: str(uuid.uuid4()), route)


# Ways an operation might escape the walk (the refuter's, 28 Sep 2026) ------------------------------


def evasive_module() -> tuple[Router, NinjaAPI]:
    import functools

    from ninja.decorators import decorate_view

    def answers_itself(view: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(view)
        def early(request: HttpRequest, *args: Any, **kwargs: Any) -> Any:
            return {"answered": "without the guard"}

        return early

    router = Router()

    @router.get("/evasive/around/{project_id}")
    @answers_itself
    @declare(OPEN, project="project_id")
    def around(request: HttpRequest, project_id: uuid.UUID) -> dict[str, str]:
        return {}

    @router.post("/evasive/before-run")
    @decorate_view(answers_itself)
    @declare(EDIT)
    def before_run(request: HttpRequest) -> dict[str, str]:
        return {}

    @router.post("/evasive/wrapped-at-the-url")
    @declare(EDIT)
    def at_the_url(request: HttpRequest) -> dict[str, str]:
        return {}

    api = NinjaAPI(auth=Session(), urls_namespace=f"evasive-{uuid.uuid4().hex}")
    install(api)
    api.add_router("", router)
    return router, api


@pytest.fixture
def evasive_urls(settings: Any) -> Iterator[None]:
    from django.http import HttpResponse
    from django.views.decorators.cache import never_cache

    _router, api = evasive_module()
    patterns, app_name, namespace = api.urls
    wrapped: list[Any] = []
    for pattern in patterns:
        if isinstance(pattern, URLPattern) and "wrapped-at-the-url" in str(pattern.pattern):
            pattern = path(str(pattern.pattern), never_cache(pattern.callback), name=pattern.name)
        wrapped.append(pattern)
    module = types.ModuleType("evasive_urls")
    module.urlpatterns = [  # type: ignore[attr-defined]
        path("api/", (wrapped, app_name, namespace)),
        path("api/plain", lambda request: HttpResponse("a plain Django view")),
        path("admin/", admin.site.urls),
    ]
    sys.modules["evasive_urls"] = module
    settings.ROOT_URLCONF = "evasive_urls"
    yield
    del sys.modules["evasive_urls"]


@pytest.mark.usefixtures("evasive_urls")
def test_the_walk_catches_every_way_around_the_guard() -> None:
    served = served_operations()

    assert sorted(s.route for s in served if declaration_of(s.operation.view_func) is None) == [
        "api/evasive/around/<project_id>"
    ]
    assert [
        s.route
        for s in served
        if getattr(s.operation.run, "__func__", None) is not type(s.operation).run
    ] == ["api/evasive/before-run"]
    assert sorted(other_views()) == ["api/evasive/wrapped-at-the-url", "api/plain"]
