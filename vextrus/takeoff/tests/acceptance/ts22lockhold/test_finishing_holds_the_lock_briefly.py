"""Ticket S22-LOCKHOLD (G1's walk of 51507b85: a Step 1 exclude refused 503 `platform.acts.busy`
after 3.1 s while a DWG's read job finished). A DWG's `finishing` step held Step 1's write lock
(`step1.lock_writes`) for 9-10 s on a 38-sheet, 278-view file: about 26 statements a view
(`step1.propose_view`'s scope, sheet and file read again per view, a get_or_create per Trace) and
`record_coverage`'s per-view writes. An act waits at most `LOCK_TIMEOUT_MS` (3000 ms) for that lock.

Promises pinned here:

1. **The statements run under Step 1's write lock do not grow with the views a sheet has.** The same
   number of sheets at 5 and at 50 views a sheet: the counts differ by at most `SLACK`, and each is at
   most `PER_SHEET` a sheet plus `CONSTANT`.
2. **The written result is unchanged.** The Proposals (keys, values, sources), Traces, Coverage rows
   and Coverage Steps the step writes are those the per-view writes on main write
   (`step1.propose_view`, `step1.record_coverage`), and the step run again on the same file updates
   every row in place, never duplicating one (these two are guards: green on main, kept green).
3. **An act is answered while a big file finishes.** An exclude issued the moment a 30-sheet,
   10-views-a-sheet file's `finishing` takes the lock is answered 200, never 503.

`PER_SHEET` = 60: the acceptance writer's sketch (a sheet's views' Proposals, Traces, Coverage rows and
Steps written in a few bulk statements, the sheet's own Proposal and Questions left as on main) runs
330 statements for 6 sheets at 5 and at 50 views a sheet (`_propose_sheet` alone about 45 a sheet on
main). 60 a sheet with `CONSTANT` 150 still refuses any write per view: at 50 views a sheet a single
statement a view adds 300 to the 6 sheets' 330, over the bound of 510. The per-view path on main runs
about 26 statements a view (1560 at 6 sheets of 5 views).

    uv run pytest -rf vextrus/takeoff/tests/acceptance/ts22lockhold
"""

import threading
import time
from typing import Any

import pytest
from django.db import connection, connections

from vextrus.takeoff.services import step1
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import exclude, proposals
from vextrus.takeoff.tests.acceptance.ts22lockhold import many_views
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "owner"])

SHEETS = 6
PER_SHEET = 60
"""Statements a sheet, at most, under the lock (see the module)."""
CONSTANT = 150
"""Statements a file, at most, under the lock whatever its size: the unread count, the drawing lists,
the set's Questions kept (S21-C1: found before the lock) and Step 1's progress."""
SLACK = 10
"""How far the counts at 5 and at 50 views a sheet may differ."""
BUSY = "platform.acts.busy"
FAIL_SAFE = 120.0


@pytest.fixture(autouse=True)
def jev(jev_offline: Any) -> None:
    import httpx

    from vextrus.takeoff.tests.acceptance.ts21c1.test_no_act_waits_on_finding_the_questions import (
        _jev_answers,
    )

    jev_offline.use(httpx.MockTransport(_jev_answers))


def under_the_lock(qs: QsProject, monkeypatch: pytest.MonkeyPatch, name: str, views: int) -> int:
    with many_views.statements_under_the_lock(monkeypatch) as seen:
        file_id = many_views.read(qs, monkeypatch, name, SHEETS, views)
    assert many_views.views_found(qs, file_id) >= SHEETS * views, "the invented views were not found"
    assert len(seen.counts) == 1, seen.counts
    return seen.counts[0]


def test_the_statements_under_step1s_write_lock_do_not_grow_with_the_views_a_sheet_has(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """At 5 and at 50 views a sheet, the same sheets: the `finishing` step's statements under Step 1's
    write lock differ by at most SLACK (one Project each, so neither reads the other's rows)."""
    few = under_the_lock(qs_project, monkeypatch, "S22LH-FEW.dwg", 5)
    other = many_views.another_project(qs_project)
    many = under_the_lock(other, monkeypatch, "S22LH-MANY.dwg", 50)
    assert abs(many - few) <= SLACK, (
        f"{many} statements under the lock at 50 views a sheet, {few} at 5 ({SHEETS} sheets each)"
    )


@pytest.mark.parametrize("views", [5, 50])
def test_the_statements_under_step1s_write_lock_are_bounded_by_the_sheets(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, views: int
) -> None:
    """At most PER_SHEET statements a sheet plus CONSTANT under the lock, at 5 and at 50 views."""
    count = under_the_lock(qs_project, monkeypatch, f"S22LH-{views}.dwg", views)
    bound = PER_SHEET * SHEETS + CONSTANT
    assert count <= bound, (
        f"{count} statements under the lock, over {bound} ({SHEETS} sheets, {views} views a sheet)"
    )


# (2) An act is answered while a big file finishes ------------------------------------------------


def test_an_exclude_issued_while_a_30_sheet_file_finishes_is_answered_not_busy(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """G1's exclude refused 503: a first file read, then a 30-sheet file of 10 views a sheet read in
    a thread; the moment its `finishing` takes Step 1's write lock, the QS excludes a sheet of the
    first file through the API on another connection. The answer is 200, not `platform.acts.busy`;
    the file still ends READ and the exclusion stands."""
    many_views.read(qs_project, monkeypatch, "S22LH-FIRST.dwg", 2, 2)
    api = api_as(qs_project.member)
    [s01] = [p for p in proposals(api, qs_project.project_id) if p["number"] == "S-01"]
    later = many_views.uploaded_only(qs_project, "S22LH-BIG.dwg")

    taken = threading.Event()
    real_lock = step1.lock_writes

    def lock_writes(project_id: Any) -> None:
        real_lock(project_id)
        taken.set()

    monkeypatch.setattr(step1, "lock_writes", lock_writes)
    failed: list[BaseException] = []

    def job() -> None:
        try:
            many_views.run(qs_project, monkeypatch, later, "S22LH-BIG.dwg", 30, 10)
        except BaseException as error:  # handed to the test's thread
            failed.append(error)
        finally:
            connections.close_all()

    thread = threading.Thread(target=job, daemon=True)
    thread.start()
    deadline = time.monotonic() + FAIL_SAFE
    while not taken.wait(0.05):
        assert thread.is_alive(), f"the job ended without taking the lock: {failed!r}"
        assert time.monotonic() < deadline, "the job never took the lock"
    answered = exclude(api, qs_project.project_id, [s01["id"]], "superseded")
    thread.join(FAIL_SAFE)
    assert not thread.is_alive(), "the read job did not end"
    assert not failed, failed
    body = answered.json() if answered.content else {}
    assert body.get("code") != BUSY, body
    assert answered.status_code == 200, (answered.status_code, answered.content)
    assert connection.vendor == "postgresql"
    many_views.assert_read(qs_project, later)
    [after] = [p for p in proposals(api, qs_project.project_id) if p["id"] == s01["id"]]
    assert after["decision"] == "excluded", after


# The written result unchanged (guards: green on main) ---------------------------------------------

ROW_SHEETS = 3
ROW_VIEWS = 7


def test_each_view_has_its_proposal_traces_coverage_and_steps_as_before(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """One view Proposal per view keyed `view:<id>` with the view's values, its Traces (its anchors,
    or its place), one Coverage row and a CoverageStep per Takeoff Step: as the per-view writes."""
    file_id = many_views.read(qs_project, monkeypatch, "S22LH-SAME.dwg", ROW_SHEETS, ROW_VIEWS)
    assert many_views.views_found(qs_project, file_id) >= ROW_SHEETS * ROW_VIEWS
    expected = many_views.expected_from_the_views(qs_project, file_id)
    assert many_views.written_for_the_views(qs_project) == expected


def test_the_finishing_step_run_again_updates_every_row_in_place(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The step run again on the same file (a retried step): every Proposal, Trace, Coverage row and
    Coverage Step is the same row with the same values, none added, none lost."""
    file_id = many_views.read(qs_project, monkeypatch, "S22LH-AGAIN.dwg", ROW_SHEETS, ROW_VIEWS)
    first = many_views.written(qs_project)
    assert first["proposals"], first
    assert first["traces"], first
    assert first["coverage"], first
    many_views.finishing_again(qs_project, file_id, ROW_SHEETS, ROW_VIEWS)()
    assert many_views.written(qs_project) == first
    expected = many_views.expected_from_the_views(qs_project, file_id)
    assert many_views.written_for_the_views(qs_project) == expected
