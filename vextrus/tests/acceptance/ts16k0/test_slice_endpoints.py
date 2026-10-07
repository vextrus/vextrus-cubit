"""S16-K0: every endpoint of session 16's slice is in the API, stubbed (the session-16 contract, which
wins over M1.md's `/api/p/{code}/...`: "M0's convention holds: every endpoint is under
`/api/projects/{project_id}/...` (project UUID), like `vextrus/takeoff/http/step1.py`").

The finish check: "OpenAPI lists every slice endpoint"; "stub http modules returning 501". Each route
declares its act through 07's guard, which answers first, as step1 does: signed out 401; a Project
outside the Membership's scope (a member of the Developer kept to another Project) 404
(`platform.auth.not_found`), before the route answers. The slice's own tickets replace the stub's
501 with the contract's reply, so a member of the Project is asked only to pass the guard.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest

from vextrus.api import api as vextrus_api
from vextrus.projects import services as projects
from vextrus.testing.auth import Api, api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

BASE = "/api/projects/{project_id}"

ENDPOINTS: tuple[tuple[str, str], ...] = (
    ("get", "/takeoff/steps"),
    ("post", "/takeoff/steps/{step}/read"),
    ("get", "/takeoff/steps/{step}/proposals"),
    ("get", "/takeoff/storeys"),
    ("put", "/takeoff/storeys/levels"),
    ("put", "/takeoff/view-placements/{view_id}"),
    ("post", "/takeoff/confirmations"),
    ("get", "/takeoff/model/primitives"),
    ("get", "/model/elements/{element_id}"),
    ("get", "/prices"),
    ("put", "/prices/{resource_code}"),
    ("get", "/rates/{item_code}"),
    ("put", "/buildings/{building_id}/gross-floor-area"),
    ("get", "/boq"),
    ("get", "/boq/items/{item_code}/lines"),
)
"""(method, path under BASE), as the session-16 contract names them."""

IDS = [f"{method.upper()} {path}" for method, path in ENDPOINTS]

STOREY = uuid.UUID("00000000-0000-4000-8000-000000000001")
VIEW = uuid.UUID("00000000-0000-4000-8000-000000000002")
ELEMENT = uuid.UUID("00000000-0000-4000-8000-000000000003")
BUILDING = uuid.UUID("00000000-0000-4000-8000-000000000004")
PROPOSAL = uuid.UUID("00000000-0000-4000-8000-000000000005")

PARAMS = {
    "step": "columns",
    "view_id": str(VIEW),
    "element_id": str(ELEMENT),
    "resource_code": "cement-opc",
    "item_code": "RCC-COL-1:1.5:3",
    "building_id": str(BUILDING),
}

QUERY = {
    "/takeoff/steps/{step}/proposals": "?group=mark",
    "/takeoff/model/primitives": "?seq=1",
}

BODIES: dict[str, dict[str, Any]] = {
    "/takeoff/storeys/levels": {"levels": [{"storey_id": str(STOREY), "level_m": "3.000"}]},
    "/takeoff/view-placements/{view_id}": {"storey_ids": [str(STOREY)]},
    "/takeoff/confirmations": {"act": "confirm", "step": "columns", "proposal_ids": [str(PROPOSAL)]},
    "/prices/{resource_code}": {"amount": "8.50"},
    "/buildings/{building_id}/gross-floor-area": {"value": "12000", "unit": "sft"},
}
"""A body in the contract's shape for each operation that takes one (Ninja reads the body before the
guard answers, so the body must be one the contract allows)."""


def url(project_id: uuid.UUID, path: str) -> str:
    filled = (BASE + path).replace("{project_id}", str(project_id))
    for name, value in PARAMS.items():
        filled = filled.replace("{" + name + "}", value)
    return filled + QUERY.get(path, "")


def call(client: Api, method: str, project_id: uuid.UUID, path: str) -> Any:
    target = url(project_id, path)
    if method == "get":
        return client.client.get(target)
    return client.send(method, target, BODIES.get(path, {}))


@pytest.mark.parametrize(("method", "path"), ENDPOINTS, ids=IDS)
def test_the_openapi_document_lists_the_endpoint(method: str, path: str) -> None:
    paths = vextrus_api.get_openapi_schema()["paths"]

    assert BASE + path in paths, f"{BASE + path} is not in the OpenAPI document"
    assert method in paths[BASE + path], f"{BASE + path} has no {method.upper()}"


@pytest.mark.parametrize(("method", "path"), ENDPOINTS, ids=IDS)
def test_a_member_of_the_project_is_not_refused_by_the_guard(
    qs_project: QsProject, method: str, path: str
) -> None:
    """The Project's QS passes the guard: never 401 or 403. The route answers in its own words: K0's
    stub 501, a slice ticket's real reply, a 400 or 422 for the test's body, or a 404 of its own
    (`{code, params}`) for an id the test invented; never Django's page for a route that is not there."""
    response = call(api_as(qs_project.member), method, qs_project.project_id, path)

    assert response.status_code not in (401, 403), (response.status_code, response.content[:300])
    assert response.status_code != 404 or response["Content-Type"].startswith("application/json"), (
        response.status_code,
        response.content[:300],
    )


@pytest.mark.parametrize(("method", "path"), ENDPOINTS, ids=IDS)
def test_signed_out_the_endpoint_answers_401(qs_project: QsProject, method: str, path: str) -> None:
    response = call(Api(), method, qs_project.project_id, path)

    assert response.status_code == 401, (response.status_code, response.content[:300])


@pytest.mark.parametrize(("method", "path"), ENDPOINTS, ids=IDS)
def test_a_member_whose_scope_is_another_project_gets_not_found(
    qs_project: QsProject, sign_in: Callable[..., Member], method: str, path: str
) -> None:
    owner = qs_project.member
    with owner.acting():
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project")
    outsider = sign_in(role="qs", developer_id=owner.developer_id, projects=[other.id])

    response = call(api_as(outsider), method, qs_project.project_id, path)

    assert response.status_code == 404, (response.status_code, response.content[:300])
    assert response["Content-Type"].startswith("application/json"), response.content[:300]
    assert response.json() == {"code": "platform.auth.not_found", "params": {}}
