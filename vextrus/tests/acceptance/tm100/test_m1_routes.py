"""M1-00, the contract freeze: "the OpenAPI schema with every M1 route of C9, C12, C13, C15, C17 and
C19, each stubbed to 501 `{code, params}`" (docs/plans/M1.md, M1-00). Test: "every stub answers 501
with `{code, params}`".

Each route is taken from its contract, under M0's base `/api/projects/{project_id}/` (A15), and sent
a body in the contract's shape (Ninja reads a body before the route answers). A stub sits behind 07's
guard like every route: signed out it answers 401, and to a member kept to another Project 404
`platform.auth.not_found`. The 501's code is not named by the plan, so only its shape is pinned:
exactly `code` and `params`, the code one the machine declares (`MessageCode`).
"""

import re
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
ONE = "00000000-0000-4000-8000-000000000001"
TWO = "00000000-0000-4000-8000-000000000002"

ROUTES: tuple[tuple[str, str, str, str, dict[str, Any] | None], ...] = (
    # (contract, method, path under BASE with its params filled, query, body)
    # C9, `takeoff` (M1-11a, M1-11b, M1-11c)
    ("C9", "get", "/takeoff/steps", "", None),
    ("C9", "get", "/takeoff/steps/columns/proposals", "?group=storey", None),
    ("C9", "get", "/takeoff/steps/columns/questions", "?status=open", None),
    ("C9", "post", "/takeoff/steps/columns/read", "", None),
    (
        "C9",
        "post",
        "/takeoff/confirmations",
        "",
        {"act": "confirm", "step": "columns", "proposal_ids": [ONE]},
    ),
    ("C9", "post", f"/takeoff/questions/{ONE}/answer", "", {"option_key": "yes"}),
    ("C9", "post", "/takeoff/steps/columns/close", "", {"with_questions": False}),
    ("C9", "post", "/takeoff/steps/columns/reopen", "", None),
    ("C9", "get", "/takeoff/profile/structural", "", None),
    (
        "C9",
        "post",
        "/takeoff/profile/structural/confirm",
        "",
        {"part": "grid", "convention_keys": ["grid.layers"]},
    ),
    ("C9", "post", "/takeoff/steps/columns/active", "", {"seconds": 30}),
    # C12, `rates` (M1-14)
    ("C12", "get", "/prices", "", None),
    ("C12", "put", "/prices/cement_opc", "", {"price": {"amount": "8.50", "currency": "XXX"}}),
    ("C12", "get", "/rates/RCC-COL-1:1.5:3", "", None),
    # C13, `boq` (M1-15a, M1-15b)
    ("C13", "get", "/boq", "", None),
    ("C13", "get", "/boq/items/RCC-COL-1:1.5:3/lines", "", None),
    ("C13", "get", "/boq/preview", f"?proposal_ids={ONE}", None),
    # C15, `projects` (M1-44)
    ("C15", "put", f"/buildings/{TWO}/gross-floor-area", "", {"value": "12000", "unit": "sft"}),
    ("C15", "put", "/display-units", "", {"unit_system": "metric"}),
    # C17, the 3D's data and the Element inspector (M1-25)
    ("C17", "get", "/takeoff/model/primitives", "?seq=1", None),
    ("C17", "get", f"/takeoff/model/elements/{ONE}", "", None),
    # C19, storeys and View Placements (M1-32a)
    ("C19", "get", "/takeoff/storeys", "", None),
    ("C19", "put", "/takeoff/storeys/floor_1/level", "", {"value": "3.048", "unit": "m"}),
    ("C19", "put", f"/takeoff/view-placements/{TWO}", "", {"storeys": [ONE]}),
)

IDS = [f"{contract} {method.upper()} {path}" for contract, method, path, _, _ in ROUTES]
PARAM = re.compile(r"\{[^}]+\}")


def _regex(template: str) -> re.Pattern[str]:
    """An OpenAPI path template (its params by any name) as a pattern for a filled path."""
    return re.compile("[^/]+".join(re.escape(part) for part in PARAM.split(template)))


def _operation(method: str, path: str) -> dict[str, Any] | None:
    paths: dict[str, Any] = vextrus_api.get_openapi_schema()["paths"]
    for template, operations in paths.items():
        if _regex(template).fullmatch(BASE + path) and method in operations:
            found: dict[str, Any] = operations[method]
            return found
    return None


def _call(client: Api, method: str, project_id: uuid.UUID, path: str, query: str, body: Any) -> Any:
    target = BASE.replace("{project_id}", str(project_id)) + path + query
    if method == "get":
        return client.client.get(target)
    return client.send(method, target, body if body is not None else {})


@pytest.mark.parametrize(("contract", "method", "path", "query", "body"), ROUTES, ids=IDS)
def test_the_openapi_document_lists_the_route(
    contract: str, method: str, path: str, query: str, body: Any
) -> None:
    assert _operation(method, path) is not None, (
        f"{contract}: {method.upper()} {BASE}{path} is not in the OpenAPI document"
    )


@pytest.mark.parametrize(("contract", "method", "path", "query", "body"), ROUTES, ids=IDS)
def test_the_stub_answers_501_with_a_code_and_its_params(
    qs_project: QsProject, contract: str, method: str, path: str, query: str, body: Any
) -> None:
    response = _call(api_as(qs_project.member), method, qs_project.project_id, path, query, body)

    assert response.status_code == 501, (contract, response.status_code, response.content[:300])
    assert response["Content-Type"].startswith("application/json"), response.content[:300]
    reply = response.json()
    assert set(reply) == {"code", "params"}, reply
    assert isinstance(reply["code"], str), reply
    assert isinstance(reply["params"], dict), reply
    codes = vextrus_api.get_openapi_schema()["components"]["schemas"]["MessageCode"]["enum"]
    assert reply["code"] in codes, f"{reply['code']} is not a code the machine declares (MessageCode)"


@pytest.mark.parametrize(("contract", "method", "path", "query", "body"), ROUTES, ids=IDS)
def test_signed_out_the_route_answers_401(
    qs_project: QsProject, contract: str, method: str, path: str, query: str, body: Any
) -> None:
    response = _call(Api(), method, qs_project.project_id, path, query, body)

    assert response.status_code == 401, (contract, response.status_code, response.content[:300])


@pytest.mark.parametrize(("contract", "method", "path", "query", "body"), ROUTES, ids=IDS)
def test_a_member_kept_to_another_project_gets_not_found(
    qs_project: QsProject,
    sign_in: Callable[..., Member],
    contract: str,
    method: str,
    path: str,
    query: str,
    body: Any,
) -> None:
    owner = qs_project.member
    with owner.acting():
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another project")
    outsider = sign_in(role="qs", developer_id=owner.developer_id, projects=[other.id])

    response = _call(api_as(outsider), method, qs_project.project_id, path, query, body)

    assert response.status_code == 404, (contract, response.status_code, response.content[:300])
    assert response.json() == {"code": "platform.auth.not_found", "params": {}}
