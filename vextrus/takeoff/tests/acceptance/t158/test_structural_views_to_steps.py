"""Ticket 158: Structural views map to their Takeoff Steps by kind and subject, so a Structural Part
with every sheet decided and every view accounted reaches `confirmed`, and progress names what keeps
it from `confirmed`.

#158, "Acceptance to pin": "Table test: beam and slab sections, column and shear-wall schedules and
pile details map to their Steps by kind and subject"; "A Discipline with all sheets decided and all
views accounted reaches `confirmed`"; "The screen names what keeps a Discipline from `confirmed`".
m0-screens §5: "Steps 5-10 (foundations to tanks) are proposed for Structural views only"; "A Part's
Step 1 is confirmed when none of its files is reading, every sheet of it is confirmed or excluded,
none of its Questions is open or kept open, and none of its views is unaccounted." 6.11: a view is
"unaccounted when it has no step, no Part and no exclusion". The Step keys are the Library's
(`vextrus/takeoff/library.py`); the subjects the engine's (`STRUCTURAL_STEPS`, view-default.json).

Each sheet is confirmed with the kind its title names (Structural's sheet kinds, sheet-default.json),
so its subject is told the same way by its title and by its confirmed kind.
"""

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
    coverage,
    english,
    jev_says,
    progress,
    proposals,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

from .structural_views import NO_SUBJECT, NO_SUBJECT_KIND, VIEWS_UNACCOUNTED, read

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


# (its name, the sheet, the kind the QS confirms it as, the Step its view is read by). Each view's
# own title names its kind (section, schedule, detail) and no subject; its sheet's title names the
# subject.
ROWS: list[tuple[str, Sheet, str, str]] = [
    ("a beam section: Beams",
     Sheet("S-02", "BEAM DETAILS", ("SECTION 1-1",)), "beam_details", "beams"),
    ("a slab section: Slabs",
     Sheet("S-03", "SLAB LAYOUT", ("SECTION A-A",)), "slab_layout", "slabs"),
    ("a column schedule: Columns, shear walls and the lift core",
     Sheet("S-04", "COLUMN SCHEDULE", ("SCHEDULE 1",)), "column_schedule", "columns"),
    ("a shear-wall schedule: Columns, shear walls and the lift core",
     Sheet("S-05", "SHEAR WALL DETAILS", ("SCHEDULE 2",)), "shear_wall_details", "columns"),
    ("a pile detail: Foundations and substructure",
     Sheet("S-06", "PILE DETAILS", ("DETAIL 1",)), "pile_details", "foundations"),
]  # fmt: skip
TABLE = [pytest.param(sheet, kind, step, id=name) for name, sheet, kind, step in ROWS]
SET = [sheet for _, sheet, _, _ in ROWS]
KINDS = {sheet.number: kind for _, sheet, kind, _ in ROWS}


@pytest.mark.parametrize(("sheet", "kind", "step"), TABLE)
def test_a_structural_view_is_accounted_to_its_step_by_its_kind_and_subject(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, sheet: Sheet, kind: str, step: str
) -> None:
    read(qs_project, monkeypatch, [sheet])
    api = api_as(qs_project.member)
    [proposal] = proposals(api, qs_project.project_id)

    response = confirm(api, qs_project.project_id, [proposal["id"]], kind=kind)

    assert response.status_code == 200, response.content
    shown = coverage(api, qs_project.project_id)
    assert (shown["unaccounted"], shown["unaccounted_views"]) == (0, [])
    assert shown["by_step"] == {step: 1}
    # The drawn view and the sheet's title block (a View, proposed out for information).
    assert (shown["views"], shown["assigned"], shown["excluded"]) == (2, 1, 1)


def test_structural_with_every_sheet_decided_and_every_view_accounted_reaches_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, SET)
    api = api_as(qs_project.member)
    assert progress(api, qs_project.project_id)["structural"]["status"] == "in_review"

    for proposal in proposals(api, qs_project.project_id):
        response = confirm(api, qs_project.project_id, [proposal["id"]], kind=KINDS[proposal["number"]])
        assert response.status_code == 200, response.content

    assert coverage(api, qs_project.project_id)["unaccounted"] == 0
    row = progress(api, qs_project.project_id)["structural"]
    assert (row["confirmed"], row["open_questions"]) == (5, 0)
    assert row["status"] == "confirmed"
    assert row["outstanding"] == []


def test_progress_names_the_unaccounted_views_that_keep_structural_from_confirmed(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [*SET, NO_SUBJECT])
    api = api_as(qs_project.member)
    kinds = KINDS | {NO_SUBJECT.number: NO_SUBJECT_KIND}

    for proposal in proposals(api, qs_project.project_id):
        confirm(api, qs_project.project_id, [proposal["id"]], kind=kinds[proposal["number"]])

    row = progress(api, qs_project.project_id)["structural"]
    assert (row["confirmed"], row["open_questions"], row["status"]) == (6, 0, "in_review")
    assert row["outstanding"] == [{"code": VIEWS_UNACCOUNTED, "params": {"count": 1}}]


def test_the_unaccounted_views_code_has_its_english_with_the_count() -> None:
    """The screen words what keeps a Discipline from `confirmed` (#158); the code's English is in the
    catalogue (`web/src/messages/takeoff/step1/en.po`), with its count and the domain's word
    "unaccounted" (m0-screens 6.11; the words themselves are the builder's, reviewed by ux-critic)."""
    words = english(VIEWS_UNACCOUNTED)

    assert words is not None
    assert "{count" in words
    assert "unaccounted" in words
