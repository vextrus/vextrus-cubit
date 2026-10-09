"""Ticket S15-A2 (walk #337 `act_waits_on_read`; #227; G3 of docs/specs/factory.md, #251): "a read
job's transaction holds no network call and no act waits on it: Jev outside the transaction, a
lock_timeout". Check: "a two-connection test, an act during `finishing` returns <= 500 ms".

G3's test, as factory.md words it: "the job's finishing step paused inside its transaction; confirm,
answer, exclude and undo each return within 500 ms; `lock_timeout` on API connections as a
tripwire". Three promises, each pinned here:

1. **Jev is never asked inside a transaction of the read job.** Jev (TypeSafe over HTTP) is answered
   here by a stand-in transport that notes, at each request, whether the asking thread's database
   connection is inside a transaction. A DWG read to the end asks it, and asks it outside any.
2. **An act answers within 500 ms while a later file's `finishing` step is paused** in its long
   part: reading the Plot's pages to match them to the set's sheets (157; the seam 157's own tests
   patch, `engine.read.pdf.page_text`). (While it waits on Jev, promise 1 already puts the job
   outside any transaction.) The read job runs in a thread on its own connection;
   the act runs in another thread on its own, through the API as the web sends it, as `vextrus_app`
   on PostgreSQL 18. Postgres's `pg_blocking_pids` on the act's backend decides whether it waited on
   the job; the 500 ms is the ticket's bound on the act's whole request.
3. **An act blocked on a row lock is refused in words, never left waiting.** A second connection
   holds the row of the Proposal the act must change (`SELECT ... FOR UPDATE`, as a stuck job would);
   the act comes back refused (503) with a code the catalogue words, changes nothing, and goes through
   once the row is let go. The refusal's code is the builder's to name; the catalogue must word it.

Everything is invented (21c's hand-built sheets, 21a's readers given), no toolchain. Waits on Events
are fail-safes only; the time bounds are the ticket's 500 ms and a lock wait's tripwire.

    uv run pytest -rf vextrus/takeoff/tests/acceptance/ts15a2
"""

import json
import threading
import time
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any, Protocol

import httpx
import psycopg
import pytest
from django.conf import settings
from django.db import connection, connections, transaction

from engine.read import pdf as pdf_reader
from vextrus.drawings import services as drawings
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    english,
    exclude,
    keys,
    of_number,
    open_questions,
    proposals,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, drawing
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "owner"])

FIRST = "S15A2-STR-R0.dwg"
PLOT = "S15A2-STR-PLOT.pdf"
LATER = "S15A2-STR-R1.dwg"
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
"""Two structural DWGs of one invented set: the first read before the act (S-02 twice, so a
same-number Question is open to answer), the later one read while the QS acts. Both count on Step 1's
one structural progress row."""

ACT_BOUND = 0.5
"""The ticket's bound on an act's request while a read job is in `finishing` (seconds)."""
LOCK_TRIPWIRE = 5.0
"""How long an act blocked on a held row may take to come back refused (seconds): the lock_timeout
the act's transaction sets, with room for the request around it. Not a value the ticket fixes; an
act that waits longer is waiting with no bound."""
FAIL_SAFE = 60.0
"""Seconds an Event is waited on before a test gives up (a hung thread, never the verdict)."""


# Jev: a stand-in TypeSafe that notes where it was asked from ---------------------------------------


def in_a_transaction() -> bool:
    """Whether this thread's database connections are inside a transaction: a Django atomic block,
    or a transaction the driver has open (the connection not idle)."""
    for alias in connections:
        held = connections[alias]
        if held.in_atomic_block:
            return True
        raw = held.connection
        if raw is not None and raw.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
            return True
    return False


class StandInJev:
    """TypeSafe as a stand-in: every question answered surely with its first option (0.97, as 21c's
    `jev_says`). Each request notes whether it came from inside a transaction; once `armed`, the
    next request signals `reached` and waits for `released` (Jev slow to answer)."""

    def __init__(self) -> None:
        self.asked: list[bool] = []
        self.armed = False
        self.reached = threading.Event()
        self.released = threading.Event()

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.asked.append(in_a_transaction())
        if self.armed and not self.reached.is_set():
            self.reached.set()
            assert self.released.wait(FAIL_SAFE), "the test never let Jev answer"
        body = json.loads(request.content)
        answers = {}
        for node, asked in body["questions"].items():
            options = list(asked["criteria"])
            first = Decimal("0.97")
            rest = (Decimal(1) - first) / max(len(options) - 1, 1)
            answers[node] = {
                "type": "choice",
                "choice": options[0],
                "confidence": float(first),
                "probabilities": {o: float(rest) for o in options[1:]} | {options[0]: float(first)},
            }
        return httpx.Response(200, json={"model": body["model"], "answers": answers})


@pytest.fixture(autouse=True)
def jev(jev_offline: Offline) -> Iterator[StandInJev]:
    """Every test's Jev is the stand-in (nothing leaves the machine)."""
    stand_in = StandInJev()
    jev_offline.use(httpx.MockTransport(stand_in))
    yield stand_in
    stand_in.released.set()


class ParkedPlot:
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


@pytest.fixture(autouse=True)
def plot_reading(monkeypatch: pytest.MonkeyPatch) -> Iterator[ParkedPlot]:
    """Every test's Plot reads as pages with no text (the invented PDF has none to read)."""
    parked = ParkedPlot()
    monkeypatch.setattr(pdf_reader, "page_text", parked)
    yield parked
    parked.released.set()


# Two connections: the read job's and the act's -------------------------------------------------------


@dataclass
class Outcome:
    done: threading.Event = field(default_factory=threading.Event)
    started: threading.Event = field(default_factory=threading.Event)
    pid: int | None = None
    role: str | None = None
    server_version: int | None = None
    seconds: float | None = None
    result: Any = None
    error: BaseException | None = None


def in_thread(work: Callable[[], Any]) -> tuple[threading.Thread, Outcome]:
    """`work` in a thread of its own, on its own database connection (its backend's pid, role and
    server kept); `seconds` is how long `work` itself took."""
    outcome = Outcome()

    def run() -> None:
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "select pg_backend_pid(), current_user, current_setting('server_version_num')::int"
                )
                outcome.pid, outcome.role, outcome.server_version = cursor.fetchone()
            outcome.started.set()
            began = time.monotonic()
            outcome.result = work()
            outcome.seconds = time.monotonic() - began
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


def watched(act: Outcome, job: Outcome) -> bool:
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
    """The act's answer, given while the later DWG's read job was parked in `finishing`."""

    response: Any
    waited_on_the_job: bool
    seconds: float | None
    role: str | None
    server_version: int | None


class Parked(Protocol):
    """What a read job can be parked on: Jev's answer, or the Plot's page reading."""

    armed: bool
    reached: threading.Event
    released: threading.Event


def act_while_the_later_file_finishes(
    qs: QsProject,
    later: uuid.UUID,
    monkeypatch: pytest.MonkeyPatch,
    parked: Parked,
    act: Callable[[], Any],
) -> Overlap:
    """Run the later file's read job in a thread until it parks, act through the API in another,
    then release the job and let both end. Raises the job's own error."""
    parked.armed = True
    job_thread, job = in_thread(lambda: run_job(qs.member, later, monkeypatch, readers(SHEETS)))
    act_thread: threading.Thread | None = None
    acted = Outcome()
    try:
        reached = parked.reached.wait(FAIL_SAFE)
        assert reached or job.done.is_set(), "the read job neither parked nor ended"
        assert reached, f"the later file's read job never reached the parked call: {job.error!r}"
        assert str(file_state(qs, later)) != str(drawings.FileState.READ), "parked after the read"
        act_thread, acted = in_thread(act)
        unblocked = watched(acted, job)
    finally:
        parked.released.set()
    if act_thread is not None:
        act_thread.join(FAIL_SAFE)
    job_thread.join(FAIL_SAFE)
    assert acted.done.is_set(), "the act's thread did not end"
    assert job.done.is_set(), "the read job's thread did not end"
    if acted.error is not None:
        raise acted.error
    if job.error is not None:
        raise job.error
    return Overlap(acted.result, not unblocked, acted.seconds, acted.role, acted.server_version)


def file_state(qs: QsProject, file_id: uuid.UUID) -> str:
    with qs.member.acting():
        return str(drawings.file(file_id).state)


def read_first_and_plot(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    """The first DWG and its Plot uploaded and read; the later DWG uploaded, not yet read."""
    use = readers(SHEETS)
    first = uploaded(qs.member, qs.project_id, FIRST)
    run_job(qs.member, first, monkeypatch, use)
    plot = uploaded(qs.member, qs.project_id, PLOT, drawing("pdf", f"{PLOT} {uuid.uuid4()}"))
    run_job(qs.member, plot, monkeypatch, use)
    return uploaded(qs.member, qs.project_id, LATER)


# The four acts G3 names ------------------------------------------------------------------------------


def undo(api: Any, project_id: uuid.UUID) -> Any:
    return api.post(f"{step1(project_id)}/undo", {})


@dataclass(frozen=True)
class Act:
    """One of G3's acts, made ready before the job parks: `do` makes it through the API, `row` is
    the Proposal it must change, `landed` checks it stands, `not_landed` that it does not."""

    do: Callable[[], Any]
    row: str
    landed: Callable[[], None]
    not_landed: Callable[[], None]


def ready(name: str, api: Any, project_id: uuid.UUID) -> Act:
    listed = proposals(api, project_id)
    if name == "confirm":
        s01 = the(listed, "S-01")
        return Act(
            lambda: confirm(api, project_id, [s01["id"]]),
            s01["id"],
            lambda: _decided(api, project_id, "S-01", "confirmed"),
            lambda: _decided(api, project_id, "S-01", None),
        )
    if name == "exclude":
        s03 = the(listed, "S-03")
        return Act(
            lambda: exclude(api, project_id, [s03["id"]], "superseded"),
            s03["id"],
            lambda: _decided(api, project_id, "S-03", "excluded"),
            lambda: _decided(api, project_id, "S-03", None),
        )
    if name == "answer":
        [question] = open_questions(api, project_id, "conflict")
        copies = {p["revision_mark"]: p for p in of_number(listed, "S-02")}

        def answered() -> None:
            now = {
                p["revision_mark"]: p["decision"] for p in of_number(proposals(api, project_id), "S-02")
            }
            assert now == {"R1": "confirmed", "R0": "excluded"}, now
            assert not open_questions(api, project_id, "conflict")

        def unanswered() -> None:
            now = {
                p["revision_mark"]: p["decision"] for p in of_number(proposals(api, project_id), "S-02")
            }
            assert now == {"R1": None, "R0": None}, now
            assert open_questions(api, project_id, "conflict")

        return Act(
            lambda: answer(api, project_id, question["id"], keys(question)[0]),
            copies["R1"]["id"],
            answered,
            unanswered,
        )
    assert name == "undo"
    s01 = the(listed, "S-01")
    done = confirm(api, project_id, [s01["id"]])
    assert done.status_code == 200, done.content
    return Act(
        lambda: undo(api, project_id),
        s01["id"],
        lambda: _decided(api, project_id, "S-01", None),
        lambda: _decided(api, project_id, "S-01", "confirmed"),
    )


def _decided(api: Any, project_id: uuid.UUID, number: str, decision: str | None) -> None:
    found = the(proposals(api, project_id), number)["decision"]
    assert found == decision, (number, found)


ACTS = ("confirm", "exclude", "answer", "undo")


# (1) Jev is never asked inside a transaction of the read job ---------------------------------------


def test_a_read_job_asks_jev_outside_any_transaction(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev: StandInJev
) -> None:
    """ "A read job's transaction holds no network call: Jev outside the transaction." Two DWGs and a
    Plot read to the end: Jev was asked about the sheets, and never from inside a transaction."""
    later = read_first_and_plot(qs_project, monkeypatch)
    run_job(qs_project.member, later, monkeypatch, readers(SHEETS))

    assert file_state(qs_project, later) == str(drawings.FileState.READ)
    assert jev.asked, "the read jobs never asked Jev about a sheet"
    inside = sum(jev.asked)
    assert inside == 0, (
        f"Jev was asked inside a transaction of the read job {inside} of {len(jev.asked)} times"
    )


def test_the_sheets_jev_answered_are_proposed_as_it_answered(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev: StandInJev
) -> None:
    """Asking Jev outside the transaction keeps 21c's result: each sheet of the later file is listed
    with a kind proposed (Jev sure), its decision still the QS's, and Jev was asked from outside."""
    later = read_first_and_plot(qs_project, monkeypatch)
    jev.asked.clear()
    run_job(qs_project.member, later, monkeypatch, readers(SHEETS))

    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)
    for number in ("S-04", "S-05"):
        sheet = the(listed, number)
        assert sheet["kind"], (number, sheet)
        assert sheet["decision"] is None, (number, sheet)
    assert len(jev.asked) >= 2, jev.asked
    assert not any(jev.asked), f"Jev was asked inside a transaction of the read job: {jev.asked}"


# (2) An act answers within 500 ms while a later file's `finishing` is paused ------------------------


def _within_bound(act: str, overlap: Overlap) -> None:
    assert overlap.role == settings.VEXTRUS_APP_ROLE, overlap.role
    assert overlap.server_version is not None
    assert overlap.server_version >= 180000, overlap.server_version
    assert not overlap.waited_on_the_job, f"the {act} waited on the read job's transaction"
    assert overlap.response.status_code == 200, overlap.response.content
    assert overlap.seconds is not None
    assert overlap.seconds <= ACT_BOUND, (
        f"the {act} took {overlap.seconds:.3f} s, over {ACT_BOUND} s, while a file was finishing"
    )


@pytest.mark.parametrize("act", ACTS)
def test_an_act_returns_within_500_ms_while_finishing_matches_the_plot(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, plot_reading: ParkedPlot, act: str
) -> None:
    """G3: confirm, exclude, answer and undo each return within 500 ms while the later DWG's
    `finishing` reads the Plot's pages to match them to the set's sheets (157)."""
    later = read_first_and_plot(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    made = ready(act, api, qs_project.project_id)

    overlap = act_while_the_later_file_finishes(qs_project, later, monkeypatch, plot_reading, made.do)

    _within_bound(act, overlap)
    made.landed()
    assert file_state(qs_project, later) == str(drawings.FileState.READ)


# (3) An act blocked on a held row is refused in words, never left waiting -------------------------


@dataclass
class Holder:
    """A second connection (the schema's owner, as a stuck writer would) holding one Proposal's row
    until `released`."""

    holding: threading.Event = field(default_factory=threading.Event)
    released: threading.Event = field(default_factory=threading.Event)
    found: bool = False
    error: BaseException | None = None


def hold_row(proposal_id: str) -> tuple[threading.Thread, Holder]:
    holder = Holder()

    def run() -> None:
        try:
            with transaction.atomic(using="owner"), connections["owner"].cursor() as cursor:
                cursor.execute("select id from takeoff_proposal where id = %s for update", [proposal_id])
                holder.found = cursor.fetchone() is not None
                holder.holding.set()
                holder.released.wait(FAIL_SAFE)
        except BaseException as error:
            holder.error = error
        finally:
            holder.holding.set()
            connections.close_all()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread, holder


@pytest.mark.parametrize("act", ACTS)
def test_an_act_blocked_on_a_held_row_is_refused_in_words_and_changes_nothing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, jev: StandInJev, act: str
) -> None:
    """ "A lock_timeout": an act whose Proposal's row another transaction holds comes back within
    the tripwire, refused (503) with a code the catalogue words, and nothing of it is kept; once
    the row is let go, the same act goes through."""
    read_first_and_plot(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    made = ready(act, api, qs_project.project_id)

    holder_thread, holder = hold_row(made.row)
    try:
        assert holder.holding.wait(FAIL_SAFE), "the row was never held"
        assert holder.error is None, holder.error
        assert holder.found, "the Proposal's row was not found to hold"
        act_thread, acted = in_thread(made.do)
        came_back = acted.done.wait(LOCK_TRIPWIRE)
    finally:
        holder.released.set()
    act_thread.join(FAIL_SAFE)
    holder_thread.join(FAIL_SAFE)
    assert came_back, f"the {act} waited on a held row for over {LOCK_TRIPWIRE} s: no lock_timeout"
    if acted.error is not None:
        raise acted.error
    refused = acted.result
    assert refused.status_code == 503, (refused.status_code, refused.content)
    body = refused.json()
    assert set(body) == {"code", "params"}, body
    assert english(body["code"]), f"{body['code']} has no English in the catalogue"
    made.not_landed()

    again = made.do()
    assert again.status_code == 200, again.content
    made.landed()
