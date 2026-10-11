"""The API's shapes for a Project (the operations arrive with 07's decorator)."""

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from vextrus.projects import schemas
from vextrus.projects.messages import projects as said
from vextrus.projects.services import ProjectView, Refused


@pytest.mark.parametrize("field", ["currency", "market_id", "tenant_id", "currency_code"])
def test_a_create_body_naming_a_market_currency_or_tenant_is_refused(field: str) -> None:
    body = {"code": "KR-01", "name": "Kadam Residence", field: "anything"}

    with pytest.raises(ValidationError, match=field):
        schemas.ProjectIn.model_validate(body)


def test_a_create_body_needs_only_a_code_and_a_name() -> None:
    body = schemas.ProjectIn.model_validate({"code": "KR-01", "name": "Kadam Residence"})

    assert (body.address, body.unit_system) == ("", None)


def test_a_project_goes_out_with_its_currency_and_display_units() -> None:
    project_id, market_id = uuid.uuid4(), uuid.uuid4()
    view = ProjectView(
        id=project_id,
        code="KR-01",
        name="Kadam Residence",
        address="Plot 14",
        market_id=market_id,
        currency="XTS",
        unit_system="u",
        created_at=datetime(2026, 9, 28, tzinfo=UTC),
        updated_at=datetime(2026, 9, 30, tzinfo=UTC),
    )

    out = schemas.ProjectOut.from_view(view).model_dump(mode="json")

    assert out == {
        "id": str(project_id),
        "code": "KR-01",
        "name": "Kadam Residence",
        "address": "Plot 14",
        "market_id": str(market_id),
        "currency": "XTS",
        "unit_system": "u",
        "created_at": "2026-09-28T00:00:00Z",
        "updated_at": "2026-09-30T00:00:00Z",
    }


def test_a_refusal_goes_out_as_its_field_and_message() -> None:
    refused = Refused("code", said.CODE_TAKEN(code="KR-01", name="Kadam Residence"))

    out = schemas.ProjectRefusedOut.from_refused(refused).model_dump(mode="json")

    assert out == {
        "field": "code",
        "message": {
            "code": "projects.projects.code_taken",
            "params": {"code": "KR-01", "name": "Kadam Residence"},
        },
    }
