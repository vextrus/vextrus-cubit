"""A sheet with no Discipline (#102; the ruling: "19a decides how it is compared; 21c raises its
Questions"). The acceptance writer's choice, the minimal one: **a sheet with no Discipline is never
left out of Step 1**. It is listed among the proposals with `discipline` null, after every Discipline's
sheets; it is counted in progress on a row of its own (`discipline` null); and it holds Step 1 open
until it is confirmed or excluded. How it is compared with the Disciplines' numbers (every
Discipline's, per #102) is 21c's Question and is not pinned here."""

import pytest

from vextrus.drawings import services as drawings
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg

from .step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from .step1 import proposals, step1

pytestmark = pytest.mark.django_db


@pytest.fixture
def mixed(qs_project: QsProject) -> QsProject:
    """A structural file numbering 01 and 02, and a general-notes file of no Discipline numbering 01."""
    member = qs_project.member
    structural = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, structural.id, ["01", "02"])
    notes = add(member, qs_project.project_id, "GENERAL NOTES.dwg", drawing()).file
    read_dwg(member, notes.id, ["01"], titles=["GENERAL NOTES"])
    with member.acting():
        drawing_set = drawings.set_of(qs_project.project_id)
        assert drawing_set is not None
        found = drawings.sheets(drawing_set.id)
    # The premise: the notes sheet has no Discipline, the others are structural.
    assert sorted((s.discipline or "", s.number or "") for s in found) == [
        ("", "01"),
        ("structural", "01"),
        ("structural", "02"),
    ]
    return qs_project


def test_a_sheet_with_no_discipline_is_listed_after_every_disciplines_sheets(mixed: QsProject) -> None:
    listed = proposals(api_as(mixed.member), mixed.project_id)

    assert [(p["discipline"], p["number"]) for p in listed] == [
        ("structural", "01"),
        ("structural", "02"),
        (None, "01"),
    ]


def test_a_sheet_with_no_discipline_is_counted_in_progress_on_its_own_row(mixed: QsProject) -> None:
    body = api_as(mixed.member).get(f"{step1(mixed.project_id)}/progress").json()

    assert [(d["discipline"], d["confirmed"], d["found"]) for d in body["disciplines"]] == [
        ("structural", 0, 2),
        (None, 0, 1),
    ]


def test_confirming_every_disciplines_sheets_leaves_the_one_with_none_to_confirm(
    mixed: QsProject,
) -> None:
    client = api_as(mixed.member)
    listed = proposals(client, mixed.project_id)
    structural = [p["id"] for p in listed if p["discipline"] == "structural"]

    # One by one: its sheets have one source each, never in a bulk act (m0-screens 6.4; ticket 166).
    for proposal in structural:
        client.post(f"{step1(mixed.project_id)}/confirm", {"proposals": [proposal]})

    body = client.get(f"{step1(mixed.project_id)}/progress").json()
    assert [(d["discipline"], d["confirmed"], d["found"]) for d in body["disciplines"]] == [
        ("structural", 2, 2),
        (None, 0, 1),
    ]
