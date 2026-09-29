"""A sheet's issue date in the Step 1 API (ticket 22; the design gate's M1): the title block's date as
drawn ("12.09.2026") is sent as an ISO date (2026-09-12), its day and month read in the order the
Project's Market writes them (the Market's `date_order`, data), or null where it is no date. The web
formats ISO dates only, so no screen reads "12.09.2026" as 9 Dec 2026."""

from typing import Any

import pytest

from vextrus.takeoff.services.step1 import iso_date
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg


@pytest.mark.parametrize(
    ("drawn", "order", "iso"),
    [
        ("12.09.2026", "DMY", "2026-09-12"),
        ("12/09/2026", "DMY", "2026-09-12"),
        ("12-09-26", "DMY", "2026-09-12"),
        (" 1.9.2026 ", "DMY", "2026-09-01"),
        ("12.09.2026", "MDY", "2026-12-09"),
        ("2026.09.12", "DMY", "2026-09-12"),
        ("2026-09-12", "MDY", "2026-09-12"),
        ("12 Sep 2026", "DMY", "2026-09-12"),
        ("12 SEPT. 2026", "MDY", "2026-09-12"),
        ("Sep 12, 2026", "DMY", "2026-09-12"),
        ("12-AUG-2026", "DMY", "2026-08-12"),
        # The refuter's (ticket 22): a two-figure year is never put in the future, and a word month
        # with two two-figure numbers is read in the Market's order.
        ("01.01.95", "DMY", "1995-01-01"),
        ("12.09.99", "DMY", "1999-09-12"),
        ("12-Sep-26", "DMY", "2026-09-12"),
        ("12 Sep 26", "YMD", "2012-09-26"),
        ("26-Sep-12", "YMD", "2026-09-12"),
    ],
)
def test_a_drawn_date_is_read_in_the_markets_order(drawn: str, order: str, iso: str) -> None:
    assert iso_date(drawn, order) == iso


@pytest.mark.parametrize(
    ("drawn", "order"),
    [
        ("", "DMY"),
        ("31.02.2026", "DMY"),  # no such day
        ("13.13.2026", "DMY"),
        ("12.09.2026", ""),  # a Market whose order is unknown: no guess
        ("As built", "DMY"),
        ("R1", "DMY"),
        ("12.09", "DMY"),
        ("12.09.2026 14.10.2026", "DMY"),
        ("12.09.0026", "DMY"),  # no year before 1900
        ("0001.01.01", ""),
        ("12.09.2999", "DMY"),  # nor after next year
        ("12 Sep 26", ""),  # two two-figure numbers and no known order
    ],
)
def test_what_is_not_one_date_is_none(drawn: str, order: str) -> None:
    assert iso_date(drawn, order) is None


@pytest.mark.django_db
def test_the_api_sends_the_title_blocks_date_as_iso(qs_project: QsProject) -> None:
    member = qs_project.member
    structural = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, structural.id, ["S-01", "S-02", "S-03"], issue_dates=["12.09.2026", "", "as built"])
    with member.acting():
        from vextrus.drawings import services as drawings
        from vextrus.takeoff.services import step1

        drawing_set = drawings.set_of(qs_project.project_id)
        assert drawing_set is not None
        for sheet in drawings.sheets(drawing_set.id):
            step1.propose_sheet(sheet.id)

    body: dict[str, Any] = (
        api_as(member).get(f"/api/projects/{qs_project.project_id}/takeoff/step1/proposals").json()
    )

    assert {p["number"]: p["issue_date"] for p in body["proposals"]} == {
        "S-01": "2026-09-12",
        "S-02": None,
        "S-03": None,
    }


def test_the_schema_says_iso_or_null() -> None:
    from vextrus.takeoff.schemas.step1 import Step1ProposalOut

    assert Step1ProposalOut.model_fields["issue_date"].annotation == str | None
