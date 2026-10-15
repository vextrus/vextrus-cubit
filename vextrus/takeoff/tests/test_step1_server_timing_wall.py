"""Step 1's act timing stops at the tenant wall (S29-M0b, fix round 1 of #885): an act refused at the
Project's scope (another Developer's Project, a Project the member is not given: the 404 that hides
existence) answers with no `Server-Timing` header, so the header never tells an outsider how long, or
when, this Project's write lock is held (the refusal's own latency still waits on it, as on main: the
lock is taken before the scope check). A refusal on the caller's own Project, and every success, keep
it."""

import uuid
from collections.abc import Callable

import pytest

from vextrus.projects import services as projects
from vextrus.testing.auth import api_as
from vextrus.testing.takeoff import Step1Project
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

HEADER = "Server-Timing"


def base(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1/"


def acts(project: Step1Project) -> list[tuple[str, dict[str, object]]]:
    """Every act G1's timer measures, as the outsider posts it, and a bulk act naming nothing."""
    return [
        ("confirm", {"proposals": [str(project.proposals[0])]}),
        ("confirm", {"proposals": []}),
        ("exclude", {"proposals": [str(project.proposals[1])], "reason": "other", "text": "a test"}),
        ("undo", {}),
        (f"questions/{uuid.uuid4()}/answer", {"option": "keep_open"}),
    ]


@pytest.fixture
def stranger(sign_in: Callable[..., Member]) -> Member:
    """A QS of another Developer, given every Project of their own."""
    return sign_in(role="qs")


@pytest.fixture
def not_given(sign_in: Callable[..., Member], step1_project: Step1Project) -> Member:
    """A QS of this Developer given only another Project."""
    with step1_project.member.acting():
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project")
    return sign_in(role="qs", developer_id=step1_project.member.developer_id, projects=[other.id])


@pytest.mark.parametrize("who", ["stranger", "not_given"])
def test_an_act_refused_at_the_projects_scope_carries_no_server_timing(
    step1_project: Step1Project, who: str, request: pytest.FixtureRequest
) -> None:
    outsider: Member = request.getfixturevalue(who)
    api = api_as(outsider)
    for path, body in acts(step1_project):
        r = api.post(base(step1_project.project_id) + path, body)
        assert r.status_code == 404, (path, r.status_code, r.content)
        assert HEADER not in r.headers, (path, r.headers.get(HEADER))


def test_a_refusal_on_ones_own_project_keeps_server_timing(step1_project: Step1Project) -> None:
    """After the wall: a bulk act naming nothing (400), a missing Question (404), nothing to undo
    (409) are all timed."""
    api = api_as(step1_project.member)
    path = base(step1_project.project_id)
    for act, body, status in [
        ("confirm", {"proposals": []}, 400),
        (f"questions/{uuid.uuid4()}/answer", {"option": "keep_open"}, 404),
        ("undo", {}, 409),
    ]:
        r = api.post(path + act, body)
        assert r.status_code == status, (act, r.status_code, r.content)
        assert "lock;dur=" in r.headers.get(HEADER, ""), (act, r.headers.get(HEADER))
