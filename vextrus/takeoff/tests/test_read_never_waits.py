"""#227: Step 1's acts never wait on a read job. The acceptance tests (`acceptance/treadlock`) pin
confirm, exclude and answer; here the same harness runs undo (the orchestrator's ruling), and
`step1.progress_at_end`, which keeps a read job's progress write to the moment before it commits.
Fix round 2's rule, that Step 1's progress lock is the last lock any transaction takes, is pinned
twice: by every act run while the job is parked inside `keep()` holding rows the act locks too (no
deadlock), and by what each act and each read job's step runs after taking the lock (nothing but
the progress rows).

    uv run pytest -rf vextrus/takeoff/tests/test_read_never_waits.py
"""

import contextlib
import threading
import uuid
from collections.abc import Iterator, Sequence
from pathlib import Path
from typing import Any

import pytest
from django.db import connection, transaction

from engine.read import pdf as pdf_reader
from vextrus.drawings import services as drawings
from vextrus.takeoff.models import StepProgress
from vextrus.takeoff.services import step1 as step1_services
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.services.read_propose import plot as plot_matching
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    answer,
    confirm,
    exclude,
    jev_says,
    of_number,
    open_questions,
    proposals,
    readers,
    run_job,
    step1,
    the,
    uploaded,
)
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import (
    dumper,  # noqa: F401 (the fixture engine_readers needs)
    engine_readers,  # noqa: F401
    plot,  # noqa: F401
    set_a,  # noqa: F401
    sheets_of,
)
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import (
    run_job as read_by_engine,
)
from vextrus.takeoff.tests.acceptance.treadlock.test_acts_never_wait_on_a_read import (
    FAIL_SAFE,
    FIRST,
    PLOT,
    SECOND_PLOT,
    SHEETS,
    Parked,
    act_while_the_later_file_reads,
    counted_progress,
    file_state,
    kept_progress,
    read_first_and_plot,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db(transaction=True, databases=["default", "owner"])


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    """Jev answers every sheet's kind surely, as in the acceptance tests."""
    jev_says(jev_offline, "0.97")


@pytest.fixture
def parked(monkeypatch: pytest.MonkeyPatch) -> Iterator[Parked]:
    """The Plot's page reading, parked on demand (the acceptance tests' `Parked`)."""
    plot_reading = Parked()
    monkeypatch.setattr(pdf_reader, "page_text", plot_reading)
    yield plot_reading
    plot_reading.released.set()


def _later_plot(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    """Both DWGs and the first Plot read; a second Plot uploaded, not yet read."""
    later_dwg = read_first_and_plot(qs, monkeypatch)
    run_job(qs.member, later_dwg, monkeypatch, readers(SHEETS))
    content = drawing("pdf", f"{SECOND_PLOT} {uuid.uuid4()}")
    return uploaded(qs.member, qs.project_id, SECOND_PLOT, content)


def _later_dwg(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    return read_first_and_plot(qs, monkeypatch)


LATER = {"dwg": _later_dwg, "pdf": _later_plot}


@pytest.mark.parametrize("later_file", list(LATER))
def test_undo_on_step_1_completes_while_a_later_file_is_matched_to_the_plot(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked, later_file: str
) -> None:
    """The QS confirmed S-01, then a later file is read; mid-way through its Plot's matching, the QS
    undoes the confirmation: it is answered and taken back without waiting on the job, and Step 1's
    kept progress counts it once the job ends."""
    later = LATER[later_file](qs_project, monkeypatch)
    api = api_as(qs_project.member)
    project_id = qs_project.project_id
    [s01] = of_number(proposals(api, project_id), "S-01")
    assert confirm(api, project_id, [s01["id"]]).status_code == 200

    overlap = act_while_the_later_file_reads(
        qs_project, later, monkeypatch, parked, lambda: api.post(f"{step1(project_id)}/undo", {})
    )

    assert not overlap.waited_on_the_job, "the undo waited on the read job's transaction"
    assert overlap.response.status_code == 200, overlap.response.content
    assert the(proposals(api, project_id), "S-01")["decision"] in (None, "", "proposed")
    member = qs_project.member
    assert kept_progress(member, project_id) == counted_progress(member, project_id)
    assert kept_progress(member, project_id)["structural"][1] == 0


def _kept(project_id: uuid.UUID) -> dict[str, Any]:
    rows = StepProgress.objects.filter(project_id=project_id, step="sheets", building_id=None)
    return {r.discipline: (r.placed, r.total, r.updated_at) for r in rows}


def test_progress_at_end_writes_the_rows_once_as_the_block_ends(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    """Inside the block, recording progress writes nothing (so the rows are not held while the
    block works); as it ends, they are written once, as counted then."""
    read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    written: list[uuid.UUID] = []
    real = StepProgress.objects.update_or_create

    def counted(*args: Any, **kwargs: Any) -> Any:
        written.append(kwargs["project_id"])
        return real(*args, **kwargs)

    monkeypatch.setattr(StepProgress.objects, "update_or_create", counted)
    with qs_project.member.acting(), transaction.atomic():
        before = _kept(project_id)
        with step1_services.progress_at_end():
            step1_services.record_progress(project_id)
            step1_services.record_progress(project_id)
            assert not written, "a progress row was written inside the block"
            assert _kept(project_id) == before
        rows = len(step1_services.progress(project_id).disciplines)
        assert written == [project_id] * rows


def test_progress_at_end_writes_nothing_when_its_block_raises(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    with qs_project.member.acting():
        before = _kept(project_id)

        def failing_step() -> None:
            with transaction.atomic(), step1_services.progress_at_end():
                step1_services.record_progress(project_id)
                raise RuntimeError("the step failed")

        with pytest.raises(RuntimeError, match="the step failed"):
            failing_step()
        assert _kept(project_id) == before
        # And outside a block, it writes at once again.
        with transaction.atomic():
            step1_services.record_progress(project_id)
        assert _kept(project_id) != before


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
@pytest.mark.django_db
def test_a_later_dwg_read_after_the_plot_keeps_the_first_dwgs_matches(
    qs_project: QsProject,
    set_a: bytes,  # noqa: F811 (the t157 acceptance fixtures)
    plot: bytes,  # noqa: F811
    engine_readers: None,  # noqa: F811
    tmp_path: Path,
) -> None:
    """#230's walk saw a set's matched Plot drop to "no page" when a DWG was added (the demo seed's
    stub PDFs, whose matches the seed writes and no reading can find again). On a set whose Plot was
    matched by reading, a later DWG's `finishing` matches the Plot again (now before its proposals)
    and the first DWG's sheets keep their pages."""
    from engine.fixtures import dwg as dwg_fixtures

    member = qs_project.member
    first = add(member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id
    plot_id = add(member, qs_project.project_id, "KR-STR-PLOT.pdf", plot).file.id
    for file_id in (first, plot_id):
        read_by_engine(member, file_id)
    before = {n: (s.plot.file_id, s.plot.page) for n, s in sheets_of(member, first).items()}
    assert before == {"S-101": (plot_id, 2), "S-102": (plot_id, 1), "S-103": (plot_id, 3)}

    set_b = dwg_fixtures.build(
        "sheet_set_model", tmp_path, dwg_fixtures.build_writer(tmp_path)
    ).read_bytes()
    later = add(member, qs_project.project_id, "KR-STR-B.dwg", set_b).file.id
    read_by_engine(member, later)

    with member.acting():
        assert drawings.file(later).state == drawings.FileState.READ
    after = {n: (s.plot.file_id, s.plot.page) for n, s in sheets_of(member, first).items()}
    assert after == before


def test_a_dwgs_plot_match_that_runs_out_of_memory_leaves_the_file_failed_never_read_unmatched(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    """The refuter's case (#227's first build matched after `finishing` committed): the match and
    the marking stay one transaction, so a match that reaches the cad worker's cap rolls the
    marking back. The file ends failed with the memory reason (restartable), never read with its
    sheets listed and never matched."""
    later = read_first_and_plot(qs_project, monkeypatch)
    real = plot_matching.find

    def out_of_memory(file_id: uuid.UUID) -> Any:
        if file_id == later:
            raise MemoryError
        return real(file_id)

    # `finishing` finds the match through `plot.find` (`plot.match` is `find(file_id)()`).
    monkeypatch.setattr(plot_matching, "find", out_of_memory)
    with contextlib.suppress(Exception):  # the job ends failed, as its worker sees it
        run_job(qs_project.member, later, monkeypatch, readers(SHEETS))

    with qs_project.member.acting():
        view = drawings.file(later)
        listed = [s for s in drawings.sheets(view.set_id) if s.file_id == later]
    assert view.state == drawings.FileState.FAILED
    assert view.finding is not None
    assert view.finding["code"] == files.OUT_OF_MEMORY["code"]
    assert listed == []


class ParkedAt:
    """The harness's park (`Parked`'s interface) on any call: once `armed`, the first call signals
    `reached` and waits for `released`, before the call runs (or, `after`, once it has run)."""

    def __init__(self, call: Any, when: Any = lambda: True, *, after: bool = False) -> None:
        self.call = call
        self.when = when
        self.after = after
        self.armed = False
        self.reached = threading.Event()
        self.released = threading.Event()

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        park = self.armed and not self.reached.is_set() and self.when()
        if park and not self.after:
            self._park()
        result = self.call(*args, **kwargs)
        if park and self.after:
            self._park()
        return result

    def _park(self) -> None:
        self.reached.set()
        assert self.released.wait(FAIL_SAFE), "the test never released the read job"


def test_a_confirm_of_a_sheet_the_match_lets_go_never_waits_on_the_proposals(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    """#227's review, finding 1: a later file's match that lets go an earlier sheet's page locks
    that sheet's row (`drawings.record_plot`), as a confirm of it does. Kept after the proposals
    (and their Jev calls), the lock is held only for the moment before `finishing` commits: a
    confirm of that sheet while the job proposes does not wait."""
    later = read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    with qs_project.member.acting():
        set_id = drawings.file(later).set_id
        [s01] = [s for s in drawings.sheets(set_id) if s.number == "S-01"]
        [plot_pdf] = [f for f in drawings.files(set_id) if f.name == PLOT]
    api = api_as(qs_project.member)
    [p01] = of_number(proposals(api, project_id), "S-01")
    keep = plot_matching._keep

    def keep_and_let_go(*args: Any) -> Any:
        # What `_release` does to a sheet whose page now names another sheet, or none.
        drawings.record_plot(s01.id, drawings.PlotNone.NO_PAGE, pdf_file_id=plot_pdf.id)
        return keep(*args)

    monkeypatch.setattr(plot_matching, "_keep", keep_and_let_go)
    in_proposals = ParkedAt(step1_services.propose_sheet)
    monkeypatch.setattr(step1_services, "propose_sheet", in_proposals)

    overlap = act_while_the_later_file_reads(
        qs_project,
        later,
        monkeypatch,
        in_proposals,  # type: ignore[arg-type]
        lambda: confirm(api, project_id, [p01["id"]]),
    )

    assert not overlap.waited_on_the_job, "the confirm waited on the read job's proposals"
    assert overlap.response.status_code == 200, overlap.response.content
    assert the(proposals(api, project_id), "S-01")["decision"] == "confirmed"


def test_an_act_between_the_jobs_count_and_its_write_is_never_lost_from_the_progress_row(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    """#227's review, finding 2: the job's progress rows are counted, then written. A confirm that
    commits in between must not be lost from them: the two are serialised by `record_progress`'s
    lock, so the confirm waits (briefly, at the job's end) and counts the job's sheets too."""
    later = read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    api = api_as(qs_project.member)
    [p01] = of_number(proposals(api, project_id), "S-01")
    recording = threading.local()
    record = step1_services.record_progress

    def flagged_record(project: uuid.UUID) -> None:
        recording.on = True
        try:
            record(project)
        finally:
            recording.on = False

    monkeypatch.setattr(step1_services, "record_progress", flagged_record)
    counted = ParkedAt(step1_services.progress, lambda: getattr(recording, "on", False), after=True)
    monkeypatch.setattr(step1_services, "progress", counted)

    overlap = act_while_the_later_file_reads(
        qs_project,
        later,
        monkeypatch,
        counted,  # type: ignore[arg-type]
        lambda: confirm(api, project_id, [p01["id"]]),
    )

    assert overlap.response.status_code == 200, overlap.response.content
    member = qs_project.member
    kept = kept_progress(member, project_id)
    assert kept == counted_progress(member, project_id)
    assert kept["structural"][1:3] == (1, 6)


# Fix round 2: the progress lock is the last lock any transaction takes ------------------------------


def _letting_go_in_keep(
    qs: QsProject, monkeypatch: pytest.MonkeyPatch, later: uuid.UUID, numbers: dict[str, str]
) -> ParkedAt:
    """The later DWG's match lets go the named earlier sheets' pages (`_release`, the #230 case) as
    `keep()` starts, locking their rows, and parks there once armed: after its proposals (and their
    Questions), before its progress rows are written."""
    with qs.member.acting():
        set_id = drawings.file(later).set_id
        listed = drawings.sheets(set_id)
        [plot_pdf] = [f for f in drawings.files(set_id) if f.name == PLOT]
    let_go = [s.id for s in listed if (s.number, s.revision_mark) in numbers.items()]
    assert len(let_go) == len(numbers)

    def release() -> None:
        for sheet_id in let_go:
            drawings.record_plot(sheet_id, drawings.PlotNone.NO_PAGE, pdf_file_id=plot_pdf.id)

    in_keep = ParkedAt(release, after=True)
    keep = plot_matching._keep

    def keep_letting_go(*args: Any) -> Any:
        in_keep()
        return keep(*args)

    monkeypatch.setattr(plot_matching, "_keep", keep_letting_go)
    return in_keep


def _same_number(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    [q] = open_questions(api, project_id, "conflict")
    return q


def test_a_keep_latest_answer_while_the_jobs_match_lets_go_the_earlier_copy_never_deadlocks(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked
) -> None:
    """#227's review round 2: the later DWG's `keep()` lets go S-02 R0's page (its row locked), then
    writes Step 1's progress rows under the per-Project lock. A `keep_latest` answer confirms R1 and
    leaves R0 out. Taking the progress lock at R1's confirm, then R0's row, it deadlocked with the
    job (Postgres aborted the answer: 500). The answer now takes it last: it may wait for the job's
    commit, then is answered, and the job ends read."""
    later = read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    api = api_as(qs_project.member)
    q = _same_number(api, project_id)
    in_keep = _letting_go_in_keep(qs_project, monkeypatch, later, {"S-02": "R0"})

    overlap = act_while_the_later_file_reads(
        qs_project,
        later,
        monkeypatch,
        in_keep,  # type: ignore[arg-type]
        lambda: answer(api, project_id, q["id"], "keep_latest"),
    )

    assert overlap.response.status_code == 200, overlap.response.content
    copies = {p["revision_mark"]: p for p in of_number(proposals(api, project_id), "S-02")}
    assert copies["R1"]["decision"] == "confirmed"
    assert (copies["R0"]["decision"], copies["R0"]["excluded_reason"]) == ("excluded", "superseded")
    member = qs_project.member
    assert file_state(member, later) == str(drawings.FileState.READ)
    assert kept_progress(member, project_id) == counted_progress(member, project_id)


def _act_answer(option: str) -> Any:
    def given(api: Any, project_id: uuid.UUID) -> Any:
        q = _same_number(api, project_id)
        return lambda: answer(api, project_id, q["id"], option)

    return given


def _act_confirm(numbers: Sequence[str]) -> Any:
    def given(api: Any, project_id: uuid.UUID) -> Any:
        ids = [the(proposals(api, project_id), n)["id"] for n in numbers]
        return lambda: confirm(api, project_id, ids)

    return given


def _act_exclude(numbers: Sequence[str]) -> Any:
    def given(api: Any, project_id: uuid.UUID) -> Any:
        ids = [the(proposals(api, project_id), n)["id"] for n in numbers]
        return lambda: exclude(api, project_id, ids, "superseded")

    return given


def _act_undo(api: Any, project_id: uuid.UUID) -> Any:
    assert confirm(api, project_id, [the(proposals(api, project_id), "S-03")["id"]]).status_code == 200
    return lambda: api.post(f"{step1(project_id)}/undo", {})


def _act_set_list(api: Any, project_id: uuid.UUID) -> Any:
    body = {"discipline": "structural", "text": "S-01 to S-05"}
    return lambda: api.post(f"{step1(project_id)}/drawing-list", body)


EVERY_ACT = {
    "answer_keep_latest": _act_answer("keep_latest"),
    "answer_keep_all": _act_answer("keep_all"),
    "answer_keep_open": _act_answer("keep_open"),
    "confirm_let_go": _act_confirm(["S-01"]),
    "confirm_other": _act_confirm(["S-03"]),
    "exclude_let_go": _act_exclude(["S-01"]),
    "exclude_other": _act_exclude(["S-03"]),
    "exclude_bulk": _act_exclude(["S-01", "S-03"]),
    "undo": _act_undo,
    "set_list": _act_set_list,
}


@pytest.mark.parametrize("act", list(EVERY_ACT))
def test_no_act_takes_the_progress_lock_before_a_row_the_jobs_keep_holds(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked, act: str
) -> None:
    """The guard on fix round 2's rule (the progress lock is the last lock any transaction takes):
    the later DWG's job parks inside `keep()` holding rows a QS's act also locks (S-01 and S-02 R0
    let go, and the set's Questions its proposals wrote) and wants the progress lock next. Each act
    kind run over them neither errors nor deadlocks: it finishes, without waiting or once the job
    commits, and the job ends read with both counted in the progress rows."""
    later = read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    api = api_as(qs_project.member)
    do_it = EVERY_ACT[act](api, project_id)
    in_keep = _letting_go_in_keep(qs_project, monkeypatch, later, {"S-01": "R0", "S-02": "R0"})

    overlap = act_while_the_later_file_reads(
        qs_project,
        later,
        monkeypatch,
        in_keep,  # type: ignore[arg-type]
        do_it,
    )

    assert overlap.response.status_code == 200, overlap.response.content
    member = qs_project.member
    assert file_state(member, later) == str(drawings.FileState.READ)
    assert kept_progress(member, project_id) == counted_progress(member, project_id)


def _late(sql: str, params: Any) -> bool:
    """A statement that locks or writes a row (or takes another lock), but the progress rows'."""
    said_ = " ".join(sql.split()).upper()
    if said_.startswith(("SAVEPOINT", "RELEASE SAVEPOINT", "ROLLBACK TO SAVEPOINT")):
        return False
    if "PG_ADVISORY" in said_:
        return not (params and str(params[0]).startswith("step1-progress:"))
    if f'"{StepProgress._meta.db_table.upper()}"' in said_:
        return False
    if said_.startswith('INSERT INTO "DRAWINGS_READSTEP"'):
        return False  # the job's own step kept, on its file's row it holds since `mark_read`
    return not said_.startswith("SELECT") or " FOR UPDATE" in said_ or " FOR SHARE" in said_


def _after_the_progress_lock(do_it: Any) -> tuple[Any, list[str]]:
    """The act run once; each statement it ran, in a transaction, after that transaction took Step
    1's progress lock that locks or writes a row other than the progress rows."""
    late: list[str] = []
    locked = False

    def watch(execute: Any, sql: str, params: Any, many: bool, context: Any) -> Any:
        nonlocal locked
        if not connection.in_atomic_block:
            locked = False
        elif locked and _late(sql, params):
            late.append(" ".join(sql.split())[:160])
        result = execute(sql, params, many, context)
        if "pg_advisory_xact_lock" in sql and params and str(params[0]).startswith("step1-progress:"):
            locked = connection.in_atomic_block
        return result

    with connection.execute_wrapper(watch):
        response = do_it()
    return response, late


def _act_discipline(api: Any, project_id: uuid.UUID) -> Any:
    with transaction.atomic():
        [first] = [f for f in drawings.files(drawings.set_of(project_id).id) if f.name == FIRST]  # type: ignore[union-attr]
    path = f"/api/projects/{project_id}/drawings/files/{first.id}/discipline"
    return lambda: api.send("put", path, {"discipline": "architectural"})


@pytest.mark.parametrize("act", [*EVERY_ACT, "discipline"])
def test_every_act_takes_the_progress_lock_after_its_last_row_lock(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked, act: str
) -> None:
    """Fix round 2's rule, by what each act runs (no read job needed): in each transaction, once
    Step 1's progress lock is taken, nothing but the progress rows is locked or written. A read
    job's step keeps it so too (`progress_at_end`), so an act and a job never wait on each other
    in a cycle, whatever rows they share."""
    read_first_and_plot(qs_project, monkeypatch)
    project_id = qs_project.project_id
    api = api_as(qs_project.member)
    with qs_project.member.acting():
        do_it = (
            _act_discipline(api, project_id) if act == "discipline" else EVERY_ACT[act](api, project_id)
        )

    response, late = _after_the_progress_lock(do_it)

    assert response.status_code == 200, response.content
    assert late == [], f"the {act} locked or wrote these after the progress lock"
    member = qs_project.member
    counted = counted_progress(member, project_id)
    # A Discipline the sheets moved away from keeps its old row (`record_progress` writes the
    # Disciplines it counts, and deletes none): not this rule's.
    assert {k: v for k, v in kept_progress(member, project_id).items() if k in counted} == counted


@pytest.mark.parametrize("later_file", list(LATER))
def test_a_read_jobs_step_takes_the_progress_lock_after_its_last_row_lock(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, parked: Parked, later_file: str
) -> None:
    """The same rule on the job's side: a later DWG's `finishing` (and a Plot's `matching`) lock or
    write nothing but the progress rows once they take the progress lock."""
    later = LATER[later_file](qs_project, monkeypatch)
    run, late = _after_the_progress_lock(
        lambda: run_job(qs_project.member, later, monkeypatch, readers(SHEETS))
    )
    del run
    assert late == [], "the read job locked or wrote these after the progress lock"
