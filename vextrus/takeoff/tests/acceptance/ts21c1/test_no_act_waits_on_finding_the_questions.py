"""Ticket S21-C1 (G1's script layer on Train B's head 61afc0a3: an `undo` refused 503 while a read
job finished; ts15a2's G3 parks only in the Plot's page reading, never in the write phase). A read
job's `finishing` step held Step 1's write lock through `set_questions` over the whole set (seconds on
a real set), so a QS's act landing in it waited out its lock timeout and was refused. The fix's
direction: the set's Questions are **found** before the lock is taken, and only **kept** (written)
under it; the keep step re-checks the set and finds them again if it moved between the two.

Three promises, each pinned here:

1. **The set's Questions are found with Step 1's write lock free.** Every call the read job makes
   to the set's three recognisers (19b's `engine.recognise.conflicts.compare`, the register Check
   `engine.check.register.check`, the storey-titles Check `engine.check.storey_titles.check`) is
   made while its backend holds no `step1-write:<project>` advisory lock (`step1.lock_writes`), as
   `pg_locks` shows it.
2. **An act answers within its lock timeout while the read job finds the set's Questions.** The
   later DWG's read job runs in a thread on its own connection and is parked inside one of the three
   recognisers; confirm, exclude, answer and undo each go through the API on another connection, as
   `vextrus_app` on PostgreSQL 18. The act comes back 200, never waiting on the job's backend
   (`pg_blocking_pids`), within the act's lock timeout (`LOCK_TIMEOUT_MS`, 3000 ms); then the job
   ends READ with its own Question kept and the act's Question not asked again.
3. **The Questions kept are today's, though the set moved between finding and keeping.** While the
   job is parked in the conflicts' compare, the QS types a number for a sheet that has none: the
   later file's own number (`type_number`, a correcting answer). The open Questions the job leaves
   are those a project gets when the same answer lands before the read: no Question lost (the two
   copies of the typed number are a conflict) and none stale.

Everything is invented (21c's hand-built sheets and readers), no toolchain, no network (Jev answers
from a stand-in). Waits on Events are fail-safes only; the time bound is the act's lock timeout.

    uv run pytest -rf vextrus/takeoff/tests/acceptance/ts21c1
"""

import json
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

import httpx
import pytest
from django.conf import settings
from django.db import connection, connections

from engine.check import register as register_check
from engine.check import storey_titles
from engine.recognise import conflicts as conflict_finder
from vextrus.drawings import services as drawings
from vextrus.projects.services import projects
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    Sheet,
    answer,
    confirm,
    exclude,
    open_questions,
    proposals,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "owner"])

FIRST = "S21C1-STR-R0.dwg"
LATER = "S21C1-STR-R1.dwg"
UNNUMBERED = "LIFT CORE DETAILS"
SHEETS = {
    FIRST: [
        Sheet("S-01", "PILE LAYOUT PLAN", ("PILE LAYOUT PLAN",)),
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R1", date="14.09.2026"),
        Sheet("S-02", "COLUMN SCHEDULE", ("COLUMN SCHEDULE",), rev="R0", date="02.08.2026"),
        Sheet("S-03", "GROUND FLOOR BEAM LAYOUT PLAN", ("GROUND FLOOR BEAM LAYOUT PLAN",)),
        Sheet(None, UNNUMBERED, (UNNUMBERED,)),
    ],
    LATER: [
        Sheet("S-04", "FIRST FLOOR BEAM LAYOUT PLAN", ("FIRST FLOOR BEAM LAYOUT PLAN",)),
        Sheet("S-05", "ROOF BEAM LAYOUT PLAN", ("ROOF BEAM LAYOUT PLAN",), rev="R1", date="14.09.2026"),
        Sheet("S-05", "ROOF BEAM LAYOUT PLAN", ("ROOF BEAM LAYOUT PLAN",), rev="R0", date="02.08.2026"),
    ],
}
"""Two structural DWGs of one invented set. The first is read before the act: S-02 twice (a
same-number Question open to answer) and a sheet with no number (a `missing` Question, answered by a
typed number). The later one is read while the QS acts; its own S-05 twice is a Question only its
read asks."""

SAME_NUMBER = "engine.conflicts.same_number"
"""19b's same-number Conflict's code, as the Questions' API gives it."""
WRITE_LOCK = "step1-write:{project}"
"""Step 1's write lock (`step1.lock_writes`): a transaction-scoped advisory lock on
`hashtextextended(<this>, 0)`."""
LOCK_TIMEOUT = 3.0
"""An act's lock timeout (`platform.services.deadlocks.LOCK_TIMEOUT_MS`, 3000 ms), seconds: G1's
`act_max_ms` is the same, so an act that waits on the job's write phase cannot pass the walk."""
FAIL_SAFE = 60.0
"""Seconds an Event is waited on before a test gives up (a hung thread, never the verdict)."""


def waited(event: threading.Event, seconds: float) -> bool:
    """Whether `event` is set within `seconds` by the monotonic clock (ts15a2's `waited`: a timed
    wait can end early on a wall-clock jump)."""
    deadline = time.monotonic() + seconds
    while not event.wait(max(deadline - time.monotonic(), 0.0)):
        if time.monotonic() >= deadline:
            return False
    return True


def joined(thread: threading.Thread, seconds: float) -> None:
    deadline = time.monotonic() + seconds
    while thread.is_alive() and (left := deadline - time.monotonic()) > 0:
        thread.join(left)


# Jev: a stand-in that answers every sheet's kind surely ---------------------------------------------


def _jev_answers(request: httpx.Request) -> httpx.Response:
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
def jev(jev_offline: Offline) -> None:
    """Every test's Jev is the stand-in (nothing leaves the machine)."""
    jev_offline.use(httpx.MockTransport(_jev_answers))


# The set's recognisers, watched and parked ---------------------------------------------------------

SEAMS: dict[str, tuple[Any, str]] = {
    "conflicts": (conflict_finder, "compare"),
    "register": (register_check, "check"),
    "storey_titles": (storey_titles, "check"),
}
"""The three recognisers `set_questions` runs over the whole set (the O(set) work found before the
lock): 19b's conflicts' compare, the register Check and the storey-titles Check."""


def holds_write_lock(project_id: uuid.UUID) -> bool:
    """Whether this thread's backend holds Step 1's write lock on the Project, by `pg_locks`: an
    advisory lock on a bigint key is held as (classid, objid) = its high and low 32 bits, objsubid 1."""
    with connection.cursor() as cursor:
        cursor.execute("select hashtextextended(%s, 0)", [WRITE_LOCK.format(project=project_id)])
        key = int(cursor.fetchone()[0]) & 0xFFFFFFFFFFFFFFFF
        cursor.execute(
            "select exists(select 1 from pg_locks where locktype = 'advisory' and granted"
            " and pid = pg_backend_pid() and classid::bigint = %s and objid::bigint = %s"
            " and objsubid = 1)",
            [key >> 32, key & 0xFFFFFFFF],
        )
        return bool(cursor.fetchone()[0])


class Recogniser:
    """One recogniser of the set, the real one called through. `watching` a thread: each of its calls
    notes whether its backend held Step 1's write lock. Once `armed`, the next call (from any thread)
    signals `reached` and waits for `released` (the job parked in it)."""

    def __init__(self, real: Callable[..., Any], project_id: uuid.UUID) -> None:
        self.real = real
        self.project_id = project_id
        self.watching: int | None = None
        self.held: list[bool] = []
        self.armed = False
        self.reached = threading.Event()
        self.released = threading.Event()

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        if self.watching == threading.get_ident():
            self.held.append(holds_write_lock(self.project_id))
        if self.armed and not self.reached.is_set():
            self.reached.set()
            assert waited(self.released, FAIL_SAFE), "the test never released the read job"
        return self.real(*args, **kwargs)


def recogniser(seam: str, project_id: uuid.UUID, monkeypatch: pytest.MonkeyPatch) -> Recogniser:
    module, name = SEAMS[seam]
    watched = Recogniser(getattr(module, name), project_id)
    monkeypatch.setattr(module, name, watched)
    return watched


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
    assert waited(act.started, FAIL_SAFE), "the act's thread never started"
    assert act.pid is not None, act.error
    while not act.done.wait(0.02):
        if blocked_by(act.pid):
            return False
        assert not job.done.is_set(), "the read job ended while it should be parked"
    return True


@dataclass
class Overlap:
    """The act's answer, given while the later DWG's read job was parked in a set recogniser."""

    response: Any
    waited_on_the_job: bool
    seconds: float | None
    role: str | None
    server_version: int | None


def act_while_the_set_is_compared(
    qs: QsProject,
    later: uuid.UUID,
    monkeypatch: pytest.MonkeyPatch,
    parked: Recogniser,
    act: Callable[[], Any],
) -> Overlap:
    """Run the later file's read job in a thread until it parks in the recogniser, act through the
    API in another, then release the job and let both end. Raises the job's own error."""
    parked.armed = True
    job_thread, job = in_thread(lambda: run_job(qs.member, later, monkeypatch, readers(SHEETS)))
    act_thread: threading.Thread | None = None
    acted = Outcome()
    try:
        reached = waited(parked.reached, FAIL_SAFE)
        assert reached or job.done.is_set(), "the read job neither parked nor ended"
        assert reached, f"the later file's read job never reached the set's recogniser: {job.error!r}"
        assert file_state(qs, later) != str(drawings.FileState.READ), "parked after the read"
        act_thread, acted = in_thread(act)
        unblocked = watched(acted, job)
    finally:
        parked.released.set()
    if act_thread is not None:
        joined(act_thread, FAIL_SAFE)
    joined(job_thread, FAIL_SAFE)
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


def read_first(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    """The first DWG uploaded and read; the later DWG uploaded, not yet read."""
    first = uploaded(qs.member, qs.project_id, FIRST)
    run_job(qs.member, first, monkeypatch, readers(SHEETS))
    return uploaded(qs.member, qs.project_id, LATER)


# The Questions, as the API gives them ----------------------------------------------------------------


def held_numbers(api: Any, project_id: uuid.UUID, question: dict[str, Any]) -> list[str | None]:
    numbers = {p["id"]: p["number"] for p in proposals(api, project_id)}
    return sorted((numbers.get(i) for i in question["proposals"]), key=str)


def same_number(api: Any, project_id: uuid.UUID, number: str) -> list[dict[str, Any]]:
    """The open same-number Questions about `number`."""
    return [
        q
        for q in open_questions(api, project_id, "conflict")
        if q["code"] == SAME_NUMBER and q["params"].get("number") == number
    ]


def open_set(api: Any, project_id: uuid.UUID) -> list[tuple[str, str, str, list[str | None]]]:
    """Every open Question, as a QS reads it: its kind, code, words' values and the numbers of the
    sheets it holds (ids differ between two Projects; nothing else may)."""
    return sorted(
        (
            q["kind"],
            q["code"],
            json.dumps(q["params"], sort_keys=True),
            held_numbers(api, project_id, q),
        )
        for q in open_questions(api, project_id)
    )


def kept_the_later_files_question(api: Any, project_id: uuid.UUID) -> None:
    """The Question only the later file's read asks (its S-05 twice) is open, holding both copies."""
    [question] = same_number(api, project_id, "S-05")
    assert held_numbers(api, project_id, question) == ["S-05", "S-05"], question


# The four acts G3 names ------------------------------------------------------------------------------


def undo(api: Any, project_id: uuid.UUID) -> Any:
    return api.post(f"{step1(project_id)}/undo", {})


@dataclass(frozen=True)
class Act:
    """One of G3's acts, made ready before the job parks: `do` makes it through the API, `landed`
    checks it stands once the read job has ended (its Questions kept)."""

    do: Callable[[], Any]
    landed: Callable[[], None]


def _decided(api: Any, project_id: uuid.UUID, number: str, decision: str | None) -> None:
    found = the(proposals(api, project_id), number)["decision"]
    assert found == decision, (number, found)


def ready(name: str, api: Any, project_id: uuid.UUID) -> Act:
    listed = proposals(api, project_id)
    if name == "confirm":
        s01 = the(listed, "S-01")
        return Act(
            lambda: confirm(api, project_id, [s01["id"]]),
            lambda: _decided(api, project_id, "S-01", "confirmed"),
        )
    if name == "exclude":
        s03 = the(listed, "S-03")
        return Act(
            lambda: exclude(api, project_id, [s03["id"]], "superseded"),
            lambda: _decided(api, project_id, "S-03", "excluded"),
        )
    if name == "answer":
        [question] = same_number(api, project_id, "S-02")
        assert "keep_latest" in [o["key"] for o in question["options"]], question

        def answered() -> None:
            now = {
                p["revision_mark"]: p["decision"]
                for p in proposals(api, project_id)
                if p["number"] == "S-02"
            }
            assert now == {"R1": "confirmed", "R0": "excluded"}, now
            assert not same_number(api, project_id, "S-02"), "the answered Question was asked again"

        return Act(lambda: answer(api, project_id, question["id"], "keep_latest"), answered)
    assert name == "undo"
    s01 = the(listed, "S-01")
    done = confirm(api, project_id, [s01["id"]])
    assert done.status_code == 200, done.content
    return Act(lambda: undo(api, project_id), lambda: _decided(api, project_id, "S-01", None))


ACTS = ("confirm", "exclude", "answer", "undo")


# (1) The set's Questions are found with Step 1's write lock free ------------------------------------


@pytest.mark.parametrize("seam", sorted(SEAMS))
def test_the_read_job_runs_the_sets_recogniser_without_step1s_write_lock(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, seam: str
) -> None:
    """ "Find the Questions before taking the lock, keep them under it": with nothing changed by a
    QS meanwhile, every call the later file's read job makes to the set's recogniser is made while
    its backend holds no Step 1 write lock, and the job ends READ with its Questions kept."""
    later = read_first(qs_project, monkeypatch)
    watched_seam = recogniser(seam, qs_project.project_id, monkeypatch)
    watched_seam.watching = threading.get_ident()
    run_job(qs_project.member, later, monkeypatch, readers(SHEETS))
    watched_seam.watching = None

    assert file_state(qs_project, later) == str(drawings.FileState.READ)
    assert watched_seam.held, f"the read job never ran the set's {seam} recogniser"
    under = sum(watched_seam.held)
    assert under == 0, (
        f"the read job ran the set's {seam} recogniser under Step 1's write lock"
        f" {under} of {len(watched_seam.held)} times"
    )
    kept_the_later_files_question(api_as(qs_project.member), qs_project.project_id)


# (2) An act answers within its lock timeout while the job finds the set's Questions ---------------


@pytest.mark.parametrize("seam", sorted(SEAMS))
@pytest.mark.parametrize("act", ACTS)
def test_an_act_answers_within_its_lock_timeout_while_the_read_job_finds_the_sets_questions(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, act: str, seam: str
) -> None:
    """G1's undo refused 503: confirm, exclude, answer and undo each come back 200, never waiting on
    the read job, within the act's lock timeout, while the later DWG's `finishing` runs the set's
    recogniser; then the job ends READ, its own Question kept and the act's standing."""
    later = read_first(qs_project, monkeypatch)
    api = api_as(qs_project.member)
    made = ready(act, api, qs_project.project_id)
    parked = recogniser(seam, qs_project.project_id, monkeypatch)

    overlap = act_while_the_set_is_compared(qs_project, later, monkeypatch, parked, made.do)

    assert overlap.role == settings.VEXTRUS_APP_ROLE, overlap.role
    assert overlap.server_version is not None
    assert overlap.server_version >= 180000, overlap.server_version
    assert not overlap.waited_on_the_job, (
        f"the {act} waited on the read job while it ran the set's {seam} recogniser"
    )
    assert overlap.response.status_code == 200, (overlap.response.status_code, overlap.response.content)
    assert overlap.seconds is not None
    assert overlap.seconds <= LOCK_TIMEOUT, (
        f"the {act} took {overlap.seconds:.3f} s, over its lock timeout, while a file was finishing"
    )
    assert file_state(qs_project, later) == str(drawings.FileState.READ)
    made.landed()
    kept_the_later_files_question(api, qs_project.project_id)


# (3) The Questions kept are today's, though the set moved between finding and keeping -------------


def type_the_later_number(api: Any, project_id: uuid.UUID) -> Any:
    """The QS answers the unnumbered sheet's `missing` Question with the later file's own number."""
    [missing] = open_questions(api, project_id, "missing")
    assert "type_number" in [o["key"] for o in missing["options"]], missing
    return answer(api, project_id, missing["id"], "type_number", "S-04")


def test_a_number_typed_while_the_set_is_compared_is_a_conflict_the_read_job_keeps(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "No lost or stale Question when the set changed between finding and keeping": a number typed
    while the later file's read job compares the set (the later file's own S-04) goes through
    unblocked, and the Questions the job keeps are the ones a Project gets when the same answer lands
    before the read: the two S-04s a same-number Question, nothing more and nothing less."""
    # Today's Questions: a second Project of the same QS, the number typed before the later read.
    with qs_project.member.acting():
        before = projects.create(code=f"T-{uuid.uuid4().hex[:6]}", name="A test project").id
    beforehand = QsProject(qs_project.member, before)
    api = api_as(qs_project.member)
    later_there = read_first(beforehand, monkeypatch)
    typed = type_the_later_number(api, before)
    assert typed.status_code == 200, typed.content
    run_job(qs_project.member, later_there, monkeypatch, readers(SHEETS))
    todays = open_set(api, before)

    later = read_first(qs_project, monkeypatch)
    parked = recogniser("conflicts", qs_project.project_id, monkeypatch)
    overlap = act_while_the_set_is_compared(
        qs_project,
        later,
        monkeypatch,
        parked,
        lambda: type_the_later_number(api, qs_project.project_id),
    )

    assert not overlap.waited_on_the_job, "the typed number waited on the read job"
    assert overlap.response.status_code == 200, (overlap.response.status_code, overlap.response.content)
    assert file_state(qs_project, later) == str(drawings.FileState.READ)
    [conflict] = same_number(api, qs_project.project_id, "S-04")
    assert held_numbers(api, qs_project.project_id, conflict) == ["S-04", "S-04"], conflict
    assert not open_questions(api, qs_project.project_id, "missing"), "the answered Question is open"
    assert open_set(api, qs_project.project_id) == todays
