"""A decided sheet's views show the steps their Coverage rows stand at (S24-C2, M0-FL7) for a constant
number of statements: the Coverage rows of every decided sheet in one query and their standing steps
once, never one query per sheet (the Step 1 screen of a 218-sheet set already takes 7 s, #319). Every
sheet here is invented (t158's no-subject Structural sheet, numbered)."""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.db import connection

from vextrus.takeoff.services import step1
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    confirm,
    jev_says,
    proposals,
)
from vextrus.takeoff.tests.acceptance.t158.structural_views import read
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

BEAMS_KIND = "beam_details"
SHEETS = [Sheet(f"S-{n:02d}", "TYPICAL DETAILS", (f"SECTION {n}-{n}",)) for n in range(1, 6)]


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def _statements(call: Callable[[], object]) -> list[str]:
    seen: list[str] = []

    def keep(execute: Callable[..., Any], sql: str, params: Any, many: bool, context: Any) -> Any:
        seen.append(sql)
        return execute(sql, params, many, context)

    with connection.execute_wrapper(keep):
        call()
    return seen


def _reads(qs_project: QsProject) -> tuple[int, int]:
    """How many statements one Step 1 reply runs on Coverage, and on Coverage Steps."""
    with qs_project.member.acting():
        seen = _statements(lambda: step1.proposals(qs_project.project_id))
    return (
        sum('FROM "takeoff_coverage"' in sql for sql in seen),
        sum('FROM "takeoff_coveragestep"' in sql for sql in seen),
    )


def test_the_reads_do_not_grow_with_the_decided_sheets(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, SHEETS)
    api = api_as(qs_project.member)
    pid: uuid.UUID = qs_project.project_id
    listed = proposals(api, pid)
    assert len(listed) == len(SHEETS)
    undecided = _reads(qs_project)

    assert confirm(api, pid, [listed[0]["id"]], kind=BEAMS_KIND).status_code == 200
    one_decided = _reads(qs_project)
    for proposal in listed[1:]:
        assert confirm(api, pid, [proposal["id"]], kind=BEAMS_KIND).status_code == 200
    all_decided = _reads(qs_project)

    assert all_decided == one_decided  # not one more for each sheet decided
    # The Coverage rows of all the decided sheets, then their Coverage Steps: once each.
    assert [after - before for after, before in zip(all_decided, undecided, strict=True)] == [1, 1]
    with qs_project.member.acting():
        shown = [v for p in step1.proposals(pid) for v in p.views if v.title.startswith("SECTION")]
    assert [v.steps for v in shown] == [["beams"]] * len(SHEETS)
