"""Ticket W320, end to end: an invented Electrical file read by the read job (stand-in readers, Jev
offline), with no drawing list and no Plot, is confirmed in bulk on its title blocks; with a sheet
missing from its numbering, the Sheets beside the gap join once the gap is answered.

The authority: the ticket's section 2 ("A gap holds only the Sheets beside it until the QS answers it;
the QS answers once ... and every Sheet that gap held joins together") and section 3, case 8. The
finish line it serves: `docs/specs/M0.md` FL8, "confirms the rest in bulk". Every Sheet, title and
file name is invented. The gap Question is found and answered as `test_one_source_bulk.py` says.
"""

from typing import Any

import pytest

from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
    jev_says,
    progress,
    proposals,
    readers,
    run_job,
    uploaded,
)
from vextrus.takeoff.tests.acceptance.w320.test_one_source_bulk import answer_gaps
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

NAME = "VB-ELE-R4.dwg"
DRAWN = [
    Sheet("E-01", "DEVICE KEY AND NOTES", ("DEVICE KEY AND NOTES",)),
    Sheet("E-02", "PODIUM LUMINAIRE PLAN", ("PODIUM LUMINAIRE PLAN",)),
    Sheet("E-03", "PODIUM SOCKET PLAN", ("PODIUM SOCKET PLAN",)),
    Sheet("E-04", "TOWER SOCKET PLAN", ("TOWER SOCKET PLAN",)),
    Sheet("E-05", "FEEDER RISER", ("FEEDER RISER",)),
]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, sheets: list[Sheet]) -> None:
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers({NAME: sheets}))


def in_the_bulk_act(listed: list[dict[str, Any]]) -> list[str]:
    """What the bar offers: the undecided Sheets that agree (`bulkConfirm` reads `agrees`)."""
    return sorted(p["number"] for p in listed if p["agrees"] and p["decision"] is None)


def test_a_read_file_numbered_without_a_gap_is_confirmed_in_one_bulk_act(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, DRAWN)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    assert [p.get("agrees_on") for p in listed] == ["title_block"] * 5
    offered = in_the_bulk_act(listed)
    assert offered == ["E-01", "E-02", "E-03", "E-04", "E-05"]

    done = confirm(api, qs_project.project_id, [p["id"] for p in listed])

    assert done.status_code == 200, done.content
    assert done.json()["sheets"] == 5
    row = progress(api, qs_project.project_id)["electrical"]
    assert (row["confirmed"], row["found"]) == (5, 5)


def test_a_read_file_with_a_gap_offers_the_sheets_away_from_it_then_all_once_answered(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, [s for s in DRAWN if s.number != "E-03"])
    api = api_as(qs_project.member)

    assert in_the_bulk_act(proposals(api, qs_project.project_id)) == ["E-01", "E-05"]

    answer_gaps(qs_project, "electrical")

    listed = proposals(api, qs_project.project_id)
    assert in_the_bulk_act(listed) == ["E-01", "E-02", "E-04", "E-05"]
    assert {p.get("agrees_on") for p in listed} == {"title_block"}
    done = confirm(api, qs_project.project_id, [p["id"] for p in listed])
    assert done.status_code == 200, done.content
    row = progress(api, qs_project.project_id)["electrical"]
    assert (row["confirmed"], row["found"]) == (4, 4)
