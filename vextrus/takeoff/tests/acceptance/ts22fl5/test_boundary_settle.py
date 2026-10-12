"""S22-FL5's acceptance, defect 2's guard in Train B (`read_propose`'s boundary-storey settle): the Dhaka
column-change convention (S19-B2: two column or shear-wall plans whose ranges share an end are settled as
`excludes_storey`) keys on column and shear-wall plans, not on every plan read floor to floor. m0-screens
6.8: architectural plans are "floor to floor"; so two architectural plans whose ranges meet now read
floor to floor and still raise no boundary storey, while two structural column plans whose ranges meet
are still settled.

The seam: a synthetic DWG read by 21c's read job (`acceptance/t21c/step1_whole`'s invented sheets and
readers), then the API `GET /api/projects/{id}/takeoff/step1/questions` and `.../proposals` as the QS.
Every number and title is invented.

    uv run pytest vextrus/takeoff/tests/acceptance/ts22fl5 -rf
"""

from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    jev_says,
    proposals,
    questions,
    readers,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

BOUNDARY = "takeoff.proposals.boundary_storey"
EXCLUDES = "excludes_storey"

ARCHITECTURAL = [
    ("A-11", "2ND TO 4TH FLOOR DOOR & WINDOW PLAN"),
    ("A-12", "4TH TO 6TH FLOOR DOOR & WINDOW PLAN"),
]
COLUMNS = [
    ("S-13", "COLUMN SETTING-OUT PLAN GRD TO 3RD FLOOR"),
    ("S-14", "COLUMN SETTING-OUT PLAN 3RD TO 6TH FLOOR"),
]

AT_FLOOR = "takeoff read an architectural plan at floor level, not floor to floor (m0-screens 6.8)"


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(
    qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[tuple[str, str]], name: str
) -> None:
    drawn = [Sheet(number, title, (title,)) for number, title in sheets]
    file_id = uploaded(qs.member, qs.project_id, name)
    run_job(qs.member, file_id, monkeypatch, readers({name: drawn}))


def boundary(qs: QsProject) -> list[dict[str, Any]]:
    """Every boundary storey Question of the project, open, answered or withdrawn."""
    return [q for q in questions(api_as(qs.member), qs.project_id) if q["code"] == BOUNDARY]


def meanings(qs: QsProject, numbers: list[str]) -> list[Any]:
    listed = proposals(api_as(qs.member), qs.project_id)
    return [
        v["storeys_meaning"] for n in numbers for v in the(listed, n)["views"] if v["kind"] == "plan"
    ]


def test_two_architectural_plans_whose_ranges_meet_raise_no_boundary_storey(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, ARCHITECTURAL, "KR-ARC-R0.dwg")

    assert meanings(qs_project, ["A-11", "A-12"]) == ["floor_to_floor"] * 2, AT_FLOOR
    assert boundary(qs_project) == [], "an architectural plans' meeting was settled as a column change"


def test_two_structural_column_plans_whose_ranges_meet_are_still_settled(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, COLUMNS, "KR-STR-R0.dwg")

    assert meanings(qs_project, ["S-13", "S-14"]) == ["floor_to_floor"] * 2
    settled = {
        (q["params"]["sheet"], q["params"]["storey"], q["params"]["next_sheet"], q["answer"]["option"])
        for q in boundary(qs_project)
        if q["status"] == "answered"
    }
    assert settled == {("S-13", "floor_3", "S-14", EXCLUDES)}
