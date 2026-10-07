"""A Building's Gross Floor Area (S16-B; M1.md C15): converted exactly, stored once, one event."""

import json
import uuid
from collections.abc import Callable
from decimal import Decimal

import pytest

from vextrus.platform.services import events
from vextrus.platform.services.auth import Refused
from vextrus.projects import services as projects
from vextrus.projects.messages import gfa as said
from vextrus.projects.services import gfa
from vextrus.testing.drawings import QsProject
from vextrus.testing.tenancy import Member


@pytest.mark.parametrize(
    ("value", "unit", "m2"),
    [
        ("100", "m2", "100.0000"),
        ("1076.391041670972", "sft", "100.0000"),
        ("12000", "sft", "1114.8365"),  # 12000 x 0.09290304 = 1114.83648
        (" 1 ", "sft", "0.0929"),
        (3840, "sft", "356.7477"),
    ],
)
def test_an_area_is_converted_exactly_and_rounded_once(value: str, unit: str, m2: str) -> None:
    assert gfa.to_m2(value, unit) == Decimal(m2)


@pytest.mark.parametrize(
    ("value", "unit"),
    [
        ("100", "acre"),
        ("100", "SFT"),
        ("0", "m2"),
        ("0.0004", "sft"),  # rounds to 0.0000 m2
        ("-1", "sft"),
        ("NaN", "m2"),
        ("Infinity", "sft"),
        ("1e3x", "sft"),
        ("", "m2"),
        ("10000000000", "m2"),  # past dec(14,4)
    ],
)
def test_anything_but_a_positive_area_is_refused_as_not_an_area(value: str, unit: str) -> None:
    with pytest.raises(Refused) as refused:
        gfa.to_m2(value, unit)
    assert refused.value.status == 400
    assert refused.value.message["code"] == said.NOT_AN_AREA.code


@pytest.mark.django_db
def test_entering_the_area_stores_it_and_writes_one_event(qs_project: QsProject) -> None:
    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
        assert gfa.gross_floor_area(building.id) is None
        entered = gfa.set_gross_floor_area(building.id, "12000", "sft", project_id=qs_project.project_id)
        read = gfa.gross_floor_area(building.id, project_id=qs_project.project_id)
        happened = events.latest([said.ENTERED], subject_type="building", subject_ids=[building.id])
    assert read is not None
    assert read.m2 == entered.m2 == Decimal("1114.8365")
    assert read.entered_by == qs_project.member.user.pk
    assert list(happened) == [(said.ENTERED.code, building.id)]


@pytest.mark.django_db
def test_a_building_of_another_project_is_not_found(qs_project: QsProject) -> None:
    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
        other = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="Another")
        with pytest.raises(projects.ProjectNotFound):
            gfa.set_gross_floor_area(building.id, "100", "m2", project_id=other.id)
        with pytest.raises(projects.ProjectNotFound):
            gfa.gross_floor_area(uuid.uuid4())


@pytest.mark.django_db
def test_the_md_reads_but_cannot_enter_the_area(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    md = sign_in(role="md", developer_id=qs_project.member.developer_id)
    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
    response = md.client.put(
        f"/api/projects/{qs_project.project_id}/buildings/{building.id}/gross-floor-area",
        data=json.dumps({"value": "100", "unit": "m2"}),
        content_type="application/json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("body", [{}, {"value": None, "unit": "m2"}, {"value": [1], "unit": "m2"}])
def test_a_malformed_body_is_a_refusal_never_a_422(qs_project: QsProject, body: object) -> None:
    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
    response = qs_project.member.client.put(
        f"/api/projects/{qs_project.project_id}/buildings/{building.id}/gross-floor-area",
        data=json.dumps(body),
        content_type="application/json",
    )
    assert 400 <= response.status_code < 500
    assert response.status_code != 422
    assert set(response.json()) == {"code", "params"}
