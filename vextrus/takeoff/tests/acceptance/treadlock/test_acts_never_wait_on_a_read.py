"""Ticket readlock (session 11; the review of main on the real sets, D1): "confirming on Step 1 must
never wait on a read job". A QS's act on Step 1 (confirm, exclude, answer) waited about 8 minutes on
Step 1's progress row, held by the CAD worker while a later DWG's `finishing` step matched the set's
Plot inside the transaction that marks the file read.

Each test forces the overlap, never relies on timing: the Plot's pages are read through
`engine.read.pdf.page_text` (the seam 157's own tests patch), and here that read parks on an Event
while the DWG's read job runs in a thread with its own connection. The act runs in another thread,
with its own connection, through the API as the web sends it. The main thread then watches the act's
connection: it either finishes, or Postgres shows it blocked by another backend
(`pg_blocking_pids`), which is the defect. No wall-clock bound decides the outcome; the waits on
Events are fail-safes only.

Everything is invented (21c's hand-built sheets, 21a's readers given, an invented PDF whose page text
is given as none), no toolchain.

    uv run pytest -rf vextrus/takeoff/tests/acceptance/treadlock
"""

import threading
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest
from django.db import connection, connections

from engine.read import pdf as pdf_reader
from vextrus.drawings import services as drawings
from vextrus.drawings.messages import sheets as said
from vextrus.takeoff.models import StepProgress
from vextrus.takeoff.services import step1 as step1_services
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    exclude,
    jev_says,
    keys,
    of_number,
    open_questions,
    proposals,
    readers,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, drawing
from vextrus.testing.jev import Offline
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "owner"])

FIRST = "KR-STR-R0.dwg"
PLOT = "KR-STR-PLOT.pdf"
LATER = "KR-STR-R1.dwg"
SHEETS = {
    FIRST: [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
        Sheet("S-03", "GROUND FLOOR BEAM LAYOUT PLAN", ("GROUND FLOOR BEAM LAYOUT PLAN",)),
    ],
    LATER: [
        Sheet("S-04", "FIRST FLOOR BEAM LAYOUT PLAN", ("FIRST FLOOR BEAM LAYOUT PLAN",)),
        Sheet("S-05", "ROOF BEAM LAYOUT PLAN", ("ROOF BEAM LAYOUT PLAN",)),
    ],
}
"""Two structural DWGs of one set: the first read before the act (S-02 twice, so a same-number
Question is open to answer), the later one read while the QS acts. Both write Step 1's one structural
progress row: the act and the job's final write touch the same row."""
NUMBERED = ("S-01", "S-02", "S-03", "S-04", "S-05")
FAIL_SAFE = 60.0
"""Seconds an Event is waited on before a test gives up (a hung thread, never the verdict)."""


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    """Jev answers every sheet's kind surely (a stand-in), so the only Question is the one forced."""
    jev_says(jev_offline, "0.97")


class Parked:
    """The Plot's page reading (`engine.read.pdf.page_text`), parked on demand: once `armed`, the
    next call signals `reached` and waits for `released`. Every call answers no page text."""

    def __init__(self) -> None:
        self.armed = False
        self.reached = threading.Event()
        self.released = threading.Event()

    def __call__(self, path: Path, **_: Any) -> list[Any]:
        if self.armed and not self.reached.is_set():
            self.reached.set()
            assert self.released.wait(FAIL_SAFE), "the test never released the read job"
        return []


@pytest.fixture
def parked(monkeypatch: pytest.MonkeyPatch) -> Iterator[Parked]:
    plot_reading = Parked()
    monkeypatch.setattr(pdf_reader, "page_text", plot_reading)
    yield plot_reading
    plot_reading.released.set()


def read_first_and_plot(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    """The first DWG and its Plot uploaded and read; the later DWG uploaded, not yet read."""
    use = readers(SHEETS)
    first = uploaded(qs.member, qs.project_id, FIRST)
    run_job(qs.member, first, monkeypatch, use)
    plot = uploaded(qs.member, qs.project_id, PLOT, drawing("pdf", f"{PLOT} {uuid.uuid4()}"))
    run_job(qs.member, plot, monkeypatch, use)
    return uploaded(qs.member, qs.project_id, LATER)


@dataclass
class Outcome:
    done: threading.Event = field(default_factory=threading.Event)
    started: threading.Event = field(default_factory=threading.Event)
    pid: int | None = None
    result: Any = None
    error: BaseException | None = None


def in_thread(work: Callable[[], Any]) -> tuple[threading.Thread, Outcome]:
    """`work` in a thread of its own, on its own database connection (its backend's pid kept)."""
    outcome = Outcome()

    def run() -> None:
        try:
            with connection.cursor() as cursor:
                cursor.execute("select pg_backend_pid()")
                outcome.pid = cursor.fetchone()[0]
            outcome.started.set()
            outcome.result = work()
        except BaseException as error:  # handed to the test's thread
            outcome.error = error
        finally:
            outcome.started.set()
            outcome.done.set()
            connections.close_all()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread, outcome


def blocked_by(pid: int) -> list[int]:
    with connection.cursor() as cursor:
        cursor.execute("select pg_blocking_pids(%s)", [pid])
        return list(cursor.fetchone()[0])


def finishes_unblocked(act: Outcome, job: Outcome) -> bool:
    """Watch the act until it finishes (True) or Postgres shows it waiting on another backend
    (False). While the read job is parked, a wait can only be on the job."""
    assert act.started.wait(FAIL_SAFE), "the act's thread never started"
    assert act.pid is not None, act.error
    while not act.done.wait(0.02):
        if blocked_by(act.pid):
            return False
        assert not job.done.is_set(), "the read job ended while it should be parked"
    return True


@dataclass
class Overlap:
    """The act's answer, given while the later DWG's read job was parked mid-matching."""

    response: Any
    waited_on_the_job: bool


def act_while_the_later_file_reads(
    qs: QsProject,
    later: uuid.UUID,
    monkeypatch: pytest.MonkeyPatch,
    parked: Parked,
    act: Callable[[], Any],
) -> Overlap:
    """Run the later file's read job in a thread until it parks in the Plot's matching, act through
    the API in another, then release the job and let both end. Raises the job's own error."""
    monkeypatch.setattr("vextrus.takeoff.services.read_propose.files.READERS", readers(SHEETS))
    parked.armed = True
    job_thread, job = in_thread(lambda: run_job(qs.member, later, monkeypatch, readers(SHEETS)))
    try:
        reached = parked.reached.wait(FAIL_SAFE)
        assert reached or job.done.is_set(), "the read job neither matched the Plot nor ended"
        assert reached, f"the later file's read job never read the Plot's pages: {job.error!r}"
        act_thread, acted = in_thread(act)
        unblocked = finishes_unblocked(acted, job)
    finally:
        parked.released.set()
    act_thread.join(FAIL_SAFE)
    job_thread.join(FAIL_SAFE)
    assert acted.done.is_set(), "the act's thread did not end"
    assert job.done.is_set(), "the read job's thread did not end"
    if acted.error is not None:
        raise acted.error
    if job.error is not None:
        raise job.error
    return Overlap(acted.result, waited_on_the_job=not unblocked)


# What is compared before and after ----------------------------------------------------------------


def plots_of(member: Member, file_id: uuid.UUID) -> dict[str, tuple[Any, ...]]:
    """Each sheet of the file's set, by number and revision mark, with its Plot as the read jobs
    left it: (file, page, none's code, its params)."""
    with member.acting():
        set_id = drawings.file(file_id).set_id
        found = {}
        for s in drawings.sheets(set_id):
            none = s.plot.none
            found[f"{s.number} {s.revision_mark}"] = (
                s.plot.file_id,
                s.plot.page,
                None if none is None else none["code"],
                None if none is None else dict(none["params"]),
            )
    return found


def kept_progress(member: Member, project_id: uuid.UUID) -> dict[str, tuple[Any, ...]]:
    """Step 1's progress rows as kept."""
    with member.acting():
        rows = StepProgress.objects.filter(project_id=project_id, step="sheets", building_id=None)
        return {r.discipline: (r.status, r.placed, r.total, r.open_questions) for r in rows}


def counted_progress(member: Member, project_id: uuid.UUID) -> dict[str, tuple[Any, ...]]:
    """Step 1's progress as counted now from what is decided and asked."""
    with member.acting():
        rows = step1_services.progress(project_id).disciplines
        return {
            (r.discipline or ""): (str(r.status), r.confirmed, r.total, r.open_questions) for r in rows
        }


def file_state(member: Member, file_id: uuid.UUID) -> str:
    with member.acting():
        return str(drawings.file(file_id).state)


# (1) An act on Step 1 never waits on a read job ------------------------------------------------------


def _confirm_s01(api: Any, project_id: uuid.UUID) -> Callable[[], Any]:
    [s01] = of_number(proposals(api, project_id), "S-01")
    return lambda: confirm(api, project_id, [s01["id"]])


def _exclude_s03(api: Any, project_id: uuid.UUID) -> Callable[[], Any]:
    [s03] = of_number(proposals(api, project_id), "S-03")
    return lambda: exclude(api, project_id, [s03["id"]], "superseded")


def _answer_s02(api: Any, project_id: uuid.UUID) -> Callable[[], Any]:
    [q] = open_questions(api, project_id, "conflict")
    return lambda: answer(api, project_id, q["id"], keys(q)[0])


ACTS = {"confirm": _confirm_s01, "exclude": _exclude_s03, "answer": _answer_s02}


def recorded(act: str, api: Any, project_id: uuid.UUID) -> None:
    """The act's decision, as the QS's API lists it."""
    listed = proposals(api, project_id)
    if act == "confirm":
        assert the(listed, "S-01")["decision"] == "confirmed"
    elif act == "exclude":
        s03 = the(listed, "S-03")
        assert (s03["decision"], s03["excluded_reason"]) == ("excluded", "superseded")
    else:
        copies = {p["revision_mark"]: p for p in of_number(listed, "S-02")}
        assert copies["R1"]["decision"] == "confirmed"
        assert (copies["R0"]["decision"], copies["R0"]["excluded_reason"]) == ("excluded", "superseded")
        assert not open_questions(api, project_id, "conflict")


@pytest.mark.parametrize("act", list(ACTS))
def test_an_act_on_step_1_completes_while_a_later_file_is_matched_to_the_plot(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked, act: str
) -> None:
    """D1: "Make confirmation never wait on a read job." The QS confirms, excludes or answers while
    the later DWG's `finishing` is mid-way through the Plot's matching: the act is answered and
    recorded without waiting on the job's transaction."""
    later = read_first_and_plot(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    do_it = ACTS[act](api, qs_project.project_id)

    overlap = act_while_the_later_file_reads(qs_project, later, monkeypatch, parked, do_it)

    assert not overlap.waited_on_the_job, f"the {act} waited on the read job's transaction"
    assert overlap.response.status_code == 200, overlap.response.content
    recorded(act, api, qs_project.project_id)


# (2) With no act overlapping, the read job ends as it does today -----------------------------------


def test_with_no_act_the_later_files_read_ends_read_with_every_sheet_tried_against_the_plot(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    """The regression: the later DWG ends read, every numbered sheet of the set tried against the
    Plot (its page text here gives none, so each is kept as "no page of" the Plot, 157's rule), and
    Step 1's progress rows as Step 1 counts them."""
    later = read_first_and_plot(qs_project, monkeypatch)
    run_job(qs_project.member, later, monkeypatch, readers(SHEETS))

    member, project_id = qs_project.member, qs_project.project_id
    assert file_state(member, later) == str(drawings.FileState.READ)
    plots = plots_of(member, later)
    numbered = sorted(k for k in plots if k.split()[0] in NUMBERED)
    assert [k.split()[0] for k in numbered] == ["S-01", "S-02", "S-02", "S-03", "S-04", "S-05"]
    no_page = (said.PLOT_NO_PAGE.code, {"plot_file": PLOT})
    assert {k: plots[k][2:] for k in numbered} == dict.fromkeys(numbered, no_page)
    kept = kept_progress(member, project_id)
    assert kept == counted_progress(member, project_id)
    _status, placed, total, open_questions_ = kept["structural"]
    assert (placed, total, open_questions_) == (0, 6, 1)


# (3) An act and the job's final write on one progress row: neither is lost --------------------------


@pytest.mark.parametrize("act", list(ACTS))
def test_the_act_and_the_read_jobs_result_both_stand_on_step_1s_progress_row(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked, act: str
) -> None:
    """The act commits while the job is parked; the job then ends. The act's decision stands, the
    job's sheets and Plot matches stand, and Step 1's kept progress rows count both."""
    later = read_first_and_plot(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    do_it = ACTS[act](api, qs_project.project_id)

    overlap = act_while_the_later_file_reads(qs_project, later, monkeypatch, parked, do_it)
    assert overlap.response.status_code == 200, overlap.response.content

    member, project_id = qs_project.member, qs_project.project_id
    # The act's decision stands after the job's final write.
    recorded(act, api, project_id)
    # The job's result stands: the later file read, its sheets listed and tried against the Plot.
    assert file_state(member, later) == str(drawings.FileState.READ)
    listed = proposals(api, project_id)
    assert {"S-04", "S-05"} <= {p["number"] for p in listed}
    plots = plots_of(member, later)
    no_page = (said.PLOT_NO_PAGE.code, {"plot_file": PLOT})
    for number in ("S-04", "S-05"):
        [key] = [k for k in plots if k.split()[0] == number]
        assert plots[key][2:] == no_page, number
    # Step 1's kept progress counts both: the act's decision and the later file's sheets.
    kept = kept_progress(member, project_id)
    assert kept == counted_progress(member, project_id)
    _status, placed, total, _open = kept["structural"]
    assert total == 6
    assert placed == {"confirm": 1, "exclude": 1, "answer": 2}[act]


SECOND_PLOT = "KR-STR-PLOT-R1.pdf"


@pytest.mark.parametrize("act", list(ACTS))
def test_an_act_on_step_1_completes_while_a_later_plot_is_matched(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked, act: str
) -> None:
    """The same for a PDF: plot.py matches a PDF's pages in its `matching` step, in the
    transaction that marks it read. The QS acts while a later Plot is mid-way through it."""
    later_dwg = read_first_and_plot(qs_project, monkeypatch)
    run_job(qs_project.member, later_dwg, monkeypatch, readers(SHEETS))
    content = drawing("pdf", f"{SECOND_PLOT} {uuid.uuid4()}")
    later = uploaded(qs_project.member, qs_project.project_id, SECOND_PLOT, content)
    api = api_as(qs_project.member)
    do_it = ACTS[act](api, qs_project.project_id)

    overlap = act_while_the_later_file_reads(qs_project, later, monkeypatch, parked, do_it)

    assert not overlap.waited_on_the_job, f"the {act} waited on the read job's transaction"
    assert overlap.response.status_code == 200, overlap.response.content
    recorded(act, api, qs_project.project_id)
    assert file_state(qs_project.member, later) == str(drawings.FileState.READ)
