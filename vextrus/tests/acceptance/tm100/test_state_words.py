"""M1-00, the contract freeze: the state words are enums in the OpenAPI schema, the ones the web's
generated types carry (docs/plans/M1.md C9, A12: "`ProposalState = open | held | blocked | confirmed |
excluded | superseded` and `StepStatus = not_started | reading | in_review | confirmed |
closed_with_questions | reopened` are `Literal`s in the OpenAPI schema; the web imports the generated
unions"). Test: "the OpenAPI enums equal the web's unions".

The web imports a union by its name, so each is a named component of the schema. The fields that carry
them: a step's `status` (C9 `GET steps`), a Proposal's `state` (C9 `GET steps/{step}/proposals`), the
3D's `state`, `open | held | confirmed` (C17), and a Trace's `kind`, one enum `sheet_entity | question
| qs_typed | derived | best_candidate` (C7), as the Element inspector sends it (C17).
"""

import re
from typing import Any

from vextrus.api import api as vextrus_api

BASE = "/api/projects/{project_id}"
PROPOSAL_STATE = {"open", "held", "blocked", "confirmed", "excluded", "superseded"}
STEP_STATUS = {"not_started", "reading", "in_review", "confirmed", "closed_with_questions", "reopened"}
MODEL_STATE = {"open", "held", "confirmed"}
TRACE_KINDS = {"sheet_entity", "question", "qs_typed", "derived", "best_candidate"}
PARAM = re.compile(r"\{[^}]+\}")


def schema() -> dict[str, Any]:
    found: dict[str, Any] = vextrus_api.get_openapi_schema()
    return found


def deref(document: dict[str, Any], node: Any) -> Any:
    """`node` with its `$ref` chain followed, and a single-member `allOf` or an `anyOf` with null
    unwrapped (an Optional field)."""
    seen = 0
    while isinstance(node, dict) and seen < 20:
        seen += 1
        if "$ref" in node:
            target: Any = document
            for part in node["$ref"][2:].split("/"):
                target = target[part]
            node = target
        elif len(node.get("allOf", [])) == 1:
            node = node["allOf"][0]
        elif "anyOf" in node:
            options = [option for option in node["anyOf"] if option.get("type") != "null"]
            if len(options) != 1:
                return node
            node = options[0]
        else:
            return node
    return node


def words(document: dict[str, Any], node: Any) -> set[str]:
    return set(deref(document, node).get("enum", []))


def reply(method: str, path: str) -> Any:
    """The success reply's schema of an operation, its path params by any name."""
    document = schema()
    for template, operations in document["paths"].items():
        pattern = "[^/]+".join(re.escape(part) for part in PARAM.split(template))
        if re.fullmatch(pattern, BASE + path) and method in operations:
            responses = operations[method]["responses"]
            [success] = [code for code in responses if str(code).startswith("2")]
            return responses[success]["content"]["application/json"]["schema"]
    raise AssertionError(f"{method.upper()} {BASE}{path} is not in the OpenAPI document")


def properties_named(document: dict[str, Any], node: Any, name: str, depth: int = 0) -> list[Any]:
    """Every property called `name` anywhere inside `node` (objects and arrays, through `$ref`s)."""
    node = deref(document, node)
    if not isinstance(node, dict) or depth > 8:
        return []
    found = []
    for key, value in node.get("properties", {}).items():
        if key == name:
            found.append(value)
        found += properties_named(document, value, name, depth + 1)
    if "items" in node:
        found += properties_named(document, node["items"], name, depth + 1)
    return found


def test_proposal_state_is_a_named_enum_of_the_six_words() -> None:
    document = schema()

    assert "ProposalState" in document["components"]["schemas"], "no ProposalState in the OpenAPI schema"
    assert set(document["components"]["schemas"]["ProposalState"]["enum"]) == PROPOSAL_STATE


def test_step_status_is_a_named_enum_of_the_six_words() -> None:
    document = schema()

    assert "StepStatus" in document["components"]["schemas"], "no StepStatus in the OpenAPI schema"
    assert set(document["components"]["schemas"]["StepStatus"]["enum"]) == STEP_STATUS


def test_a_steps_status_is_a_step_status() -> None:
    document = schema()

    [status] = properties_named(document, reply("get", "/takeoff/steps"), "status")

    assert words(document, status) == STEP_STATUS


def test_a_proposals_state_is_a_proposal_state() -> None:
    document = schema()

    states = properties_named(document, reply("get", "/takeoff/steps/columns/proposals"), "state")

    assert states, "the proposals reply carries no state"
    assert all(words(document, state) == PROPOSAL_STATE for state in states)


def test_the_3ds_state_is_open_held_or_confirmed() -> None:
    document = schema()

    [state] = properties_named(document, reply("get", "/takeoff/model/primitives"), "state")

    assert words(document, state) == MODEL_STATE


def test_a_traces_kind_is_one_of_the_five_trace_kinds() -> None:
    document = schema()
    element = "/takeoff/model/elements/00000000-0000-4000-8000-000000000001"

    [trace] = properties_named(document, reply("get", element), "trace")
    kinds = properties_named(document, trace, "kind")

    assert kinds, "the inspector's trace carries no kind"
    assert all(words(document, kind) == TRACE_KINDS for kind in kinds)
