"""M1-00, the contract freeze: the OpenAPI schema declares each M1 route's reply with the contract's
fields, so the generated TypeScript types carry them and "every acceptance writer after it writes
against fields, not names" (docs/plans/M1.md, M1-00 "Sees"). The fields are each contract's, word for
word: C9 (`GET steps`, `GET steps/{step}/questions`, `POST steps/{step}/read`, `POST confirmations`),
C12 (`GET prices`, `GET rates/{item_code}`), C13 (`GET boq`), C17 (the 3D's data and the Element
inspector) and C19 (`GET storeys`). A reply may carry more; it carries at least these.
"""

import re
from typing import Any

import pytest

from vextrus.api import api as vextrus_api

BASE = "/api/projects/{project_id}"
ONE = "00000000-0000-4000-8000-000000000001"
PARAM = re.compile(r"\{[^}]+\}")

REPLIES: tuple[tuple[str, str, str, str, set[str]], ...] = (
    # (contract, method, path, the success status, the fields of the reply, or of each row of a list)
    (
        "C9",
        "get",
        "/takeoff/steps",
        "200",
        {"step", "status", "n", "N", "open_questions", "awaiting_answer", "basis"},
    ),
    (
        "C9",
        "get",
        "/takeoff/steps/columns/questions",
        "200",
        {"id", "code", "params", "kind", "options", "blocks", "group_key"},
    ),
    ("C9", "post", "/takeoff/steps/columns/read", "202", {"step", "enqueued"}),
    (
        "C9",
        "post",
        "/takeoff/confirmations",
        "200",
        {"confirmation_id", "model_version_seq", "figures_changed"},
    ),
    (
        "C12",
        "get",
        "/prices",
        "200",
        {"resource_code", "name", "unit", "price", "changed_at", "changed_by", "source"},
    ),
    (
        "C12",
        "get",
        "/rates/RCC-COL-1:1.5:3",
        "200",
        {"item_code", "per_unit", "rate", "lines", "sources"},
    ),
    ("C13", "get", "/boq", "200", {"building_id", "strip", "measured_share", "sections", "allowances"}),
    (
        "C17",
        "get",
        "/takeoff/model/primitives",
        "200",
        {"element_id", "family", "storey", "part", "state", "primitives"},
    ),
    (
        "C17",
        "get",
        f"/takeoff/model/elements/{ONE}",
        "200",
        {
            "element_id",
            "family",
            "mark",
            "storey",
            "grid_ref",
            "ifc_class",
            "classification",
            "attrs",
            "trace",
        },
    ),
    ("C19", "get", "/takeoff/storeys", "200", {"storeys", "view_placements"}),
)
IDS = [f"{contract} {method.upper()} {path}" for contract, method, path, _, _ in REPLIES]


def deref(document: dict[str, Any], node: Any) -> Any:
    for _ in range(20):
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            target: Any = document
            for part in node["$ref"][2:].split("/"):
                target = target[part]
            node = target
        elif len(node.get("allOf", [])) == 1:
            node = node["allOf"][0]
        else:
            return node
    return node


def operation(document: dict[str, Any], method: str, path: str) -> dict[str, Any]:
    for template, operations in document["paths"].items():
        pattern = "[^/]+".join(re.escape(part) for part in PARAM.split(template))
        if re.fullmatch(pattern, BASE + path) and method in operations:
            found: dict[str, Any] = operations[method]
            return found
    raise AssertionError(f"{method.upper()} {BASE}{path} is not in the OpenAPI document")


def fields(document: dict[str, Any], node: Any) -> set[str]:
    node = deref(document, node)
    if node.get("type") == "array":
        node = deref(document, node["items"])
    return set(node.get("properties", {}))


@pytest.mark.parametrize(("contract", "method", "path", "status", "wanted"), REPLIES, ids=IDS)
def test_the_routes_reply_declares_the_contracts_fields(
    contract: str, method: str, path: str, status: str, wanted: set[str]
) -> None:
    document: dict[str, Any] = vextrus_api.get_openapi_schema()
    responses = operation(document, method, path)["responses"]

    assert status in {str(code) for code in responses}, (contract, sorted(map(str, responses)))
    reply = {str(code): value for code, value in responses.items()}[status]
    declared = fields(document, reply["content"]["application/json"]["schema"])
    assert wanted <= declared, f"{contract}: the reply lacks {sorted(wanted - declared)}"


def test_a_storey_row_and_a_view_placement_carry_c19s_fields() -> None:
    document: dict[str, Any] = vextrus_api.get_openapi_schema()
    reply = operation(document, "get", "/takeoff/storeys")["responses"]
    body = deref(
        document,
        {str(code): value for code, value in reply.items()}["200"]["content"]["application/json"][
            "schema"
        ],
    )

    storey = fields(document, body["properties"]["storeys"])
    placement = fields(document, body["properties"]["view_placements"])

    assert storey >= {
        "id",
        "key",
        "name",
        "order",
        "slab_level_m",
        "finished_level_m",
        "height_m",
        "basis",
    }
    assert placement >= {"view_id", "sheet", "meaning", "storeys"}
