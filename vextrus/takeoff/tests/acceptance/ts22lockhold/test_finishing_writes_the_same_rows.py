"""Ticket S22-LOCKHOLD, the written result unchanged: whatever the `finishing` step's write phase
becomes (the file's scope read once, the rows written in bulk), the Proposals (keys, values,
sources), Traces, Coverage rows and Coverage Steps it writes for a file are the ones the per-view
writes on main write (`step1.propose_view`, `step1.record_coverage`), and the step run again on the
same file updates them in place, never duplicating one.

    uv run pytest -rf vextrus/takeoff/tests/acceptance/ts22lockhold
"""

from typing import Any

import httpx
import pytest

from vextrus.takeoff.tests.acceptance.ts21c1.test_no_act_waits_on_finding_the_questions import (
    _jev_answers,
)
from vextrus.takeoff.tests.acceptance.ts22lockhold import many_views
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "owner"])

SHEETS = 3
VIEWS = 7


@pytest.fixture(autouse=True)
def jev(jev_offline: Any) -> None:
    jev_offline.use(httpx.MockTransport(_jev_answers))


def test_each_view_has_its_proposal_traces_coverage_and_steps_as_before(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """One view Proposal per view keyed `view:<id>` with the view's values, its Traces (its anchors,
    or its place), one Coverage row and a CoverageStep per Takeoff Step: as the per-view writes."""
    file_id = many_views.read(qs_project, monkeypatch, "S22LH-SAME.dwg", SHEETS, VIEWS)
    assert many_views.views_found(qs_project, file_id) >= SHEETS * VIEWS
    expected = many_views.expected_from_the_views(qs_project, file_id)
    assert many_views.written_for_the_views(qs_project) == expected


def test_the_finishing_step_run_again_updates_every_row_in_place(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The step run again on the same file (a retried step): every Proposal, Trace, Coverage row and
    Coverage Step is the same row with the same values, none added, none lost."""
    file_id = many_views.read(qs_project, monkeypatch, "S22LH-AGAIN.dwg", SHEETS, VIEWS)
    first = many_views.written(qs_project)
    assert first["proposals"], first
    assert first["traces"], first
    assert first["coverage"], first
    many_views.finishing_again(qs_project, file_id, SHEETS, VIEWS)()
    assert many_views.written(qs_project) == first
    expected = many_views.expected_from_the_views(qs_project, file_id)
    assert many_views.written_for_the_views(qs_project) == expected
