"""The tenant middleware: the request's transaction, its three settings and its current Membership
(docs/data-model.md §2, Tenancy)."""

import json
import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore
from django.db import connection
from django.http import HttpRequest, HttpResponse, HttpResponseServerError, JsonResponse
from django.test import RequestFactory
from django.urls import set_script_prefix
from django.utils import timezone

from vextrus.platform.http.middleware import TenantMiddleware
from vextrus.platform.messages import tenancy as acts
from vextrus.platform.models import DomainEvent, Membership, User
from vextrus.platform.services import events, tenancy
from vextrus.platform.services.markets import MarketProfile
from vextrus.testing.tenancy import Member, add_member


def request_for(user: Any, session: dict[str, str], path: str = "/api/projects") -> HttpRequest:
    request = RequestFactory().get(path)
    request.user = user or AnonymousUser()
    request.session = SessionStore()
    request.session.update(session)
    return request


def what_the_view_sees(request: HttpRequest) -> HttpResponse:
    with connection.cursor() as cursor:
        cursor.execute(
            "select current_setting('app.user_id', true), current_setting('app.tenant_id', true), "
            "current_setting('app.library_id', true), "
            "(select count(*) from platform_developer)"
        )
        user, tenant, library, developers = cursor.fetchone()
    membership = tenancy.current_membership()
    return JsonResponse(
        {
            "user": user,
            "tenant": tenant,
            "library": library,
            "developers": developers,
            "role": membership.role if membership else None,
            "projects": sorted(str(p) for p in membership.project_ids) if membership else None,
        }
    )


def serve(request: HttpRequest, view: Callable[[HttpRequest], HttpResponse] = what_the_view_sees) -> Any:
    response = TenantMiddleware(view)(request)
    return json.loads(response.content) if isinstance(response, JsonResponse) else response


@pytest.mark.django_db
def test_signed_out_a_request_acts_in_no_tenant() -> None:
    seen = serve(request_for(None, {}))

    assert seen == {
        "user": "",
        "tenant": "",
        "library": "",
        "developers": 0,
        "role": None,
        "projects": None,
    }


@pytest.mark.django_db
def test_a_member_acts_in_the_developer_their_session_names(
    sign_in: Callable[..., Member], market: MarketProfile
) -> None:
    project = uuid.uuid4()
    member = sign_in(role="guest", projects=[project])

    seen = serve(request_for(member.user, {tenancy.SESSION_TENANT: str(member.developer_id)}))

    assert seen == {
        "user": str(member.user.pk),
        "tenant": str(member.developer_id),
        "library": str(market.library_id),
        "developers": 1,
        "role": "guest",
        "projects": [str(project)],
    }
    assert tenancy.current_membership() is None  # only for the request


@pytest.mark.django_db
def test_a_membership_with_no_projects_may_open_every_project(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="qs")

    with member.acting() as acting:
        assert acting.membership is not None
        assert acting.membership.project_ids == frozenset()
        assert acting.membership.may_open(uuid.uuid4())


@pytest.mark.django_db
@pytest.mark.parametrize("ending", ["revoked", "expired", "not started", "not theirs"])
def test_a_membership_that_is_not_current_sets_no_tenant_and_the_session_forgets_it(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID], ending: str
) -> None:
    member = sign_in(role="qs")
    now = timezone.now()
    change = {
        "revoked": {"revoked_at": now},
        "expired": {"expires_at": now - timedelta(days=1)},  # before the database's now()
        "not started": {"starts_at": now + timedelta(hours=1)},
        "not theirs": {},
    }[ending]
    tenant = make_developer() if ending == "not theirs" else member.developer_id
    with tenancy.acting_in(member.developer_id):
        Membership.objects.filter(id=member.membership_id).update(**change)
    request = request_for(member.user, {tenancy.SESSION_TENANT: str(tenant)})

    seen = serve(request)

    assert (seen["user"], seen["tenant"], seen["library"], seen["role"]) == (
        str(member.user.pk),
        "",
        "",
        None,
    )
    assert tenancy.SESSION_TENANT not in request.session


@pytest.mark.django_db
def test_in_the_admin_staff_act_in_the_developer_they_picked_without_a_membership(
    make_developer: Callable[..., uuid.UUID], staff: User
) -> None:
    developer = make_developer()
    picked = {tenancy.STAFF_SESSION_TENANT: str(developer)}

    in_admin = serve(request_for(staff, picked, "/admin/platform/membership/"))
    elsewhere = serve(request_for(staff, picked, "/api/projects"))

    assert (in_admin["tenant"], in_admin["developers"], in_admin["role"]) == (str(developer), 1, None)
    assert (elsewhere["tenant"], elsewhere["developers"]) == ("", 0)


@pytest.mark.django_db
def test_the_admin_is_found_under_a_script_prefix(
    make_developer: Callable[..., uuid.UUID], staff: User
) -> None:
    developer = make_developer()
    request = RequestFactory().get("/admin/", SCRIPT_NAME="/app")
    request.user = staff
    request.session = SessionStore()
    request.session[tenancy.STAFF_SESSION_TENANT] = str(developer)
    set_script_prefix("/app/")
    try:
        seen = serve(request)
    finally:
        set_script_prefix("/")

    assert (request.path, request.path_info) == ("/app/admin/", "/admin/")
    assert seen["tenant"] == str(developer)


@pytest.mark.django_db
def test_a_staff_pick_means_nothing_to_anyone_not_staff(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    member = sign_in(role="md")
    other = make_developer()

    seen = serve(request_for(member.user, {tenancy.STAFF_SESSION_TENANT: str(other)}, "/admin/"))

    assert (seen["tenant"], seen["developers"]) == ("", 0)


def record_then(status: int) -> Callable[[HttpRequest], HttpResponse]:
    def view(request: HttpRequest) -> HttpResponse:
        events.record(acts.STAFF_OPENED, subject_type="developer")
        if status >= 500:
            return HttpResponseServerError()
        return HttpResponse(status=status)

    return view


def raising(request: HttpRequest) -> HttpResponse:
    events.record(acts.STAFF_OPENED, subject_type="developer")
    raise RuntimeError("the view failed")


def recorded(member: Member) -> int:
    with member.acting():
        return DomainEvent.objects.filter(kind=acts.STAFF_OPENED.code).count()


@pytest.mark.django_db
def test_a_request_s_writes_are_kept_unless_it_fails(sign_in: Callable[..., Member]) -> None:
    member = sign_in(role="md")
    session = {tenancy.SESSION_TENANT: str(member.developer_id)}

    serve(request_for(member.user, session), record_then(200))
    serve(request_for(member.user, session), record_then(302))
    # An error the API's framework turned into a response inside the view: only its status is left.
    serve(request_for(member.user, session), record_then(404))
    serve(request_for(member.user, session), record_then(409))
    serve(request_for(member.user, session), record_then(500))
    with pytest.raises(RuntimeError):
        serve(request_for(member.user, session), raising)

    assert recorded(member) == 2


@pytest.mark.django_db
def test_process_exception_marks_the_request_s_transaction_for_rollback(
    sign_in: Callable[..., Member],
) -> None:
    member = sign_in(role="md")
    request = request_for(member.user, {tenancy.SESSION_TENANT: str(member.developer_id)})

    def view(request: HttpRequest) -> HttpResponse:
        events.record(acts.STAFF_OPENED, subject_type="developer")
        middleware.process_exception(request, RuntimeError("a view's error, turned into a 404"))
        return HttpResponse(status=404)

    middleware = TenantMiddleware(view)
    middleware(request)

    assert recorded(member) == 0


@pytest.mark.django_db
def test_the_signed_in_fixture_names_the_developer_in_its_client_s_session(
    sign_in: Callable[..., Member],
) -> None:
    member = sign_in(role="vextrus_engineer")

    session = member.client.session

    assert session[tenancy.SESSION_TENANT] == str(member.developer_id)
    assert session["_auth_user_id"] == str(member.user.pk)
    add_member(member.developer_id, role="qs")
    with member.acting() as acting:
        assert acting.membership is not None
        assert acting.membership.role == "vextrus_engineer"
        assert acting.membership.expires_at is not None


@pytest.mark.django_db
def test_choosing_a_developer_needs_a_current_membership_in_it(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    member = sign_in(role="qs")
    other = make_developer()
    request = request_for(member.user, {})

    def view(request: HttpRequest) -> HttpResponse:
        with pytest.raises(tenancy.NotYours):
            tenancy.choose_developer(request, other)
        chosen = tenancy.choose_developer(request, member.developer_id)
        assert chosen.tenant_id == member.developer_id
        return HttpResponse()

    serve(request, view)

    assert request.session[tenancy.SESSION_TENANT] == str(member.developer_id)
