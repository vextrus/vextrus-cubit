"""Review 1 of #648 (65): a boundary storey the convention settled is asked again when a later file
brings a third plan claiming the storey, so the ruling ("it asks only when a third plan of the same
subject also claims that storey", session 19) holds whichever file is read first. The seam is
ts19b2's: invented column plans read by 21c's read job, the Questions read through the API as the QS.
Every number and title is invented.
"""

import pytest

from vextrus.takeoff.tests.acceptance.ts19b2.test_boundary_convention import (
    EXCLUDES,
    boundary,
    plan,
    read,
)
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db

TWO = [
    plan("S-21", "COLUMN SETTING-OUT PLAN GRD TO 3RD FLOOR"),
    plan("S-22", "COLUMN SETTING-OUT PLAN 3RD TO 5TH FLOOR"),
]
THIRD = [plan("S-23", "COLUMN SETTING-OUT PLAN AT 3RD FLOOR")]


@pytest.mark.parametrize("third_first", [False, True], ids=["two-then-third", "third-then-two"])
def test_a_third_plan_in_another_file_asks_the_boundary_storey_in_either_order(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, third_first: bool
) -> None:
    files = [("KR-STR-COL-R0.dwg", TWO), ("KR-STR-SETOUT-R0.dwg", THIRD)]
    if third_first:
        files.reverse()
    name, sheets = files[0]
    read(qs_project, monkeypatch, sheets, name)
    if not third_first:
        [settled] = boundary(qs_project)
        assert (settled["status"], settled["answer"]["option"]) == ("answered", EXCLUDES)
    name, sheets = files[1]
    read(qs_project, monkeypatch, sheets, name)

    [q] = boundary(qs_project)
    assert (q["status"], q["kind"]) == ("open", "convention")
    assert not q.get("answer")
    assert (q["params"]["sheet"], q["params"]["storey"], q["params"]["next_sheet"]) == (
        "S-21",
        "floor_3",
        "S-22",
    )
