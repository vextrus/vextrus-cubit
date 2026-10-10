"""The read job per file (ticket 21a): its steps through `drawings.services`, run here with readers a
test gives (the engine's own run in `test_read_file_toolchain.py`-style tests marked
`needs_toolchain`), its add that queues it, and the one API path two modules share."""

import io
import json
import resource
import uuid
import weakref
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings
from django.db import DatabaseError, connection

from engine.check.bangla_ansi import BanglaAnsi
from engine.messages import Message
from engine.messages import decoders_agree as agree_codes
from engine.messages import pdf_report as pdf_codes
from engine.messages import read as read_codes
from engine.read import ReadArtefact, ReadError
from engine.read.pdf.types import PdfReport
from engine.recognise.types import CheckOutcome, CheckResult
from engine.render import fonts
from vextrus.drawings import services as drawings
from vextrus.platform.services import auth, jobs, storage
from vextrus.takeoff.messages import read_file as said
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, artefact_for, drawing, pdf_report
from vextrus.testing.jobs import run_inline
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

AGREE = CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED)
DISAGREE = agree_codes.DISAGREE(items=3, only_first=2, only_second=1, kinds=0, layers=0, unread=0)


class Calls:
    """Which readers ran, in order: a skipped step reads nothing."""

    def __init__(self) -> None:
        self.names: list[str] = []


def readers(
    calls: Calls,
    *,
    dwg: Callable[[Path, str], ReadArtefact] | None = None,
    second: CheckResult | Exception = AGREE,
    pdf: Callable[[Path], PdfReport] | None = None,
) -> files.Readers:
    def first(path: Path, name: str) -> ReadArtefact:
        calls.names.append("dwg")
        if dwg is not None:
            return dwg(path, name)
        return artefact_for(sha(path), name, 2)

    def check(path: Path, artefact: ReadArtefact) -> CheckResult:
        calls.names.append("second")
        if isinstance(second, Exception):
            raise second
        return second

    def report(path: Path) -> PdfReport:
        calls.names.append("pdf")
        if pdf is not None:
            return pdf(path)
        return pdf_report(sha(path), 3)

    def font_report(artefact: ReadArtefact) -> fonts.FontReport:
        calls.names.append("fonts")
        return fonts.report(artefact)

    def bangla(artefact: ReadArtefact) -> BanglaAnsi:
        calls.names.append("bangla_ansi")
        return BanglaAnsi(())

    return files.Readers(dwg=first, second=check, fonts=font_report, bangla_ansi=bangla, pdf=report)


def sha(path: Path) -> str:
    import hashlib

    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_job(member: Member, file_id: uuid.UUID, use: files.Readers, monkeypatch: Any) -> None:
    monkeypatch.setattr(files, "READERS", use)
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        file_id=file_id,
    )


def added(qs: QsProject, name: str = "KR-STR-R0.dwg", kind: str = "dwg") -> uuid.UUID:
    return add(qs.member, qs.project_id, name, drawing(kind)).file.id


def view(member: Member, file_id: uuid.UUID) -> drawings.FileView:
    with member.acting():
        return drawings.file(file_id)


def report(member: Member, file_id: uuid.UUID) -> drawings.Report:
    with member.acting():
        return drawings.report(file_id)


# A DWG ------------------------------------------------------------------------------------------


def test_a_dwg_is_read_its_reading_kept_and_its_reports_kept_as_codes(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    calls = Calls()

    run_job(qs_project.member, file_id, readers(calls), monkeypatch)

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.READ
    assert shown.status == {"code": "drawings.files.read", "params": {}}
    assert calls.names == ["dwg", "second", "fonts", "bangla_ansi"]
    with qs_project.member.acting():
        kept = drawings.artefact(file_id)
    assert kept.summary.source_sha256 == shown.sha256
    kept_report = report(qs_project.member, file_id)
    assert kept_report.readers == ({"code": "drawings.reports.readers_agree", "params": {}},)
    assert kept_report.fonts == tuple(fonts.report(kept).messages())


def test_a_dwg_read_again_skips_every_step_kept(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, readers(Calls()), monkeypatch)
    calls = Calls()

    run_job(qs_project.member, file_id, readers(calls), monkeypatch)

    assert calls.names == []


def test_two_readers_that_disagree_hold_the_file_with_the_finding_and_read_no_further(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    calls = Calls()
    fired = CheckResult(code="decoders_agree", outcome=CheckOutcome.FIRED, finding=DISAGREE)

    run_job(qs_project.member, file_id, readers(calls, second=fired), monkeypatch)

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.HELD
    assert shown.finding == DISAGREE
    assert calls.names == ["dwg", "second"]
    assert report(qs_project.member, file_id).readers == (DISAGREE,)


def test_a_held_file_raises_one_file_misread_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ADR 0029: `drawings` holds the file; 21c's `held` step raises its one `file_misread`."""
    file_id = added(qs_project)
    fired = CheckResult(code="decoders_agree", outcome=CheckOutcome.FIRED, finding=DISAGREE)

    before = questions(qs_project.member, qs_project.project_id, file_id)

    run_job(qs_project.member, file_id, readers(Calls(), second=fired), monkeypatch)

    assert view(qs_project.member, file_id).state == drawings.FileState.HELD
    assert before == (0, 0)
    assert questions(qs_project.member, qs_project.project_id, file_id) == (1, 1)


def questions(member: Member, project_id: uuid.UUID, file_id: uuid.UUID) -> tuple[int, int]:
    """The Project's `file_misread` Questions, and any Question about the file, as the app sees
    them; none while `takeoff` has no Question table (before 19a)."""
    with member.acting(), connection.cursor() as cursor:
        cursor.execute("select to_regclass('takeoff_question') is not null")
        [exists] = cursor.fetchone() or (False,)
        if not exists:
            return 0, 0
        cursor.execute(
            "select count(*) filter (where kind = 'file_misread'),"
            " count(*) filter (where subject_id = %s)"
            " from takeoff_question where project_id = %s",
            [file_id, project_id],
        )
        row = cursor.fetchone()
    assert row is not None
    return int(row[0]), int(row[1])


# A file that could not be read ----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("where", "error"),
    [
        ("dwg", ReadError(read_codes.READER_FAILED())),
        ("dwg", ReadError(read_codes.LIMIT_REACHED(limit="wall"))),
        ("second", ReadError(agree_codes.NOT_INSTALLED())),
        ("second", ReadError(agree_codes.NOT_PINNED())),
    ],
    ids=["reader_failed", "limit_reached", "second_not_installed", "second_not_pinned"],
)
def test_a_file_a_reader_could_not_read_ends_failed_with_why_and_the_job_is_not_tried_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, where: str, error: ReadError
) -> None:
    file_id = added(qs_project)

    def raises(path: Path, name: str) -> ReadArtefact:
        raise error

    use = readers(Calls(), dwg=raises) if where == "dwg" else readers(Calls(), second=error)
    with pytest.raises(files.FileNotRead) as ended:
        run_job(qs_project.member, file_id, use, monkeypatch)

    assert isinstance(ended.value, jobs.JobRefused), "09's runner never tries a refused job again"
    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.FAILED
    assert shown.finding == error.message
    assert shown.status == {"code": "drawings.files.failed", "params": {"tries": 1}}


def test_a_dwg_older_than_any_the_reader_reads_is_unreadable(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = add(qs_project.member, qs_project.project_id, "OLD.dwg", b"AC2.10" + b"\x00" * 200).file.id

    def old(path: Path, name: str) -> ReadArtefact:
        raise ReadError(read_codes.UNSUPPORTED_FORMAT(format="unknown"))

    with pytest.raises(files.FileNotRead):
        run_job(qs_project.member, file_id, readers(Calls(), dwg=old), monkeypatch)

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.UNREADABLE
    assert shown.finding == {"code": "drawings.files.old_version", "params": {}}


def test_try_again_reads_the_step_that_failed_again_and_skips_those_kept(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    with pytest.raises(files.FileNotRead):
        run_job(
            qs_project.member,
            file_id,
            readers(Calls(), second=ReadError(agree_codes.STOPPED())),
            monkeypatch,
        )
    with qs_project.member.acting():
        drawings.restart(file_id)  # the QS's "Try again"
    calls = Calls()

    run_job(qs_project.member, file_id, readers(calls), monkeypatch)

    assert calls.names == ["second", "fonts", "bangla_ansi"]
    assert view(qs_project.member, file_id).state == drawings.FileState.READ


@pytest.mark.parametrize("damage", ["missing", "damaged"])
def test_a_lost_reading_is_read_again_though_its_step_was_kept(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, damage: str
) -> None:
    """The refuter's 21a finding (score 40): the `reading` step is kept and skipped, so when Vextrus's
    copy of its artefact was lost the file could never be read again."""
    file_id = added(qs_project)
    with pytest.raises(files.FileNotRead):
        run_job(
            qs_project.member,
            file_id,
            readers(Calls(), second=ReadError(agree_codes.STOPPED())),
            monkeypatch,
        )
    base = Path(settings.VEXTRUS_STORAGE_ROOT) / str(qs_project.member.developer_id)
    [kept] = list((base / str(qs_project.project_id)).rglob("artefact@*"))
    if damage == "missing":
        kept.unlink()
    else:
        kept.write_bytes(b"{}")
    with qs_project.member.acting():
        drawings.restart(file_id)
    calls = Calls()

    run_job(qs_project.member, file_id, readers(calls), monkeypatch)

    assert calls.names == ["dwg", "second", "fonts", "bangla_ansi"]
    assert view(qs_project.member, file_id).state == drawings.FileState.READ
    with qs_project.member.acting():
        assert (
            drawings.artefact(file_id).summary.source_sha256 == view(qs_project.member, file_id).sha256
        )


def test_a_reading_kept_in_an_older_artefact_version_is_read_again_though_its_step_was_kept(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review 1 of #638: S15-E2 raised the artefact's VERSION, so a file whose `reading` step was kept
    before it holds an artefact `from_json` refuses. A job restarted after that step reads the file
    again (as a missing copy is) and finishes, rather than failing on every try."""
    from engine.read import artefact as artefact_shape

    file_id = added(qs_project)
    with pytest.raises(files.FileNotRead):
        run_job(
            qs_project.member,
            file_id,
            readers(Calls(), second=ReadError(agree_codes.STOPPED())),
            monkeypatch,
        )
    monkeypatch.setattr(artefact_shape, "VERSION", artefact_shape.VERSION + 1)  # the kept one is older
    with qs_project.member.acting():
        drawings.restart(file_id)
    calls = Calls()

    run_job(qs_project.member, file_id, readers(calls), monkeypatch)

    assert calls.names == ["dwg", "second", "fonts", "bangla_ansi"]
    assert view(qs_project.member, file_id).state == drawings.FileState.READ
    with qs_project.member.acting():
        assert (
            drawings.artefact(file_id).summary.source_sha256 == view(qs_project.member, file_id).sha256
        )


def test_a_missing_copy_ends_the_file_failed_with_why(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    base = Path(settings.VEXTRUS_STORAGE_ROOT) / str(qs_project.member.developer_id)
    [original] = list((base / str(qs_project.project_id)).rglob("original.dwg"))
    original.unlink()

    with pytest.raises(files.FileNotRead):
        run_job(qs_project.member, file_id, readers(Calls()), monkeypatch)

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.FAILED
    assert shown.finding == storage.FileMissing.message


def test_a_fault_that_is_not_the_files_is_raised_and_tried_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    def broken(path: Path, name: str) -> ReadArtefact:
        raise RuntimeError("a bug, not the file")

    with pytest.raises(RuntimeError):
        run_job(qs_project.member, file_id, readers(Calls(), dwg=broken), monkeypatch)

    shown = view(qs_project.member, file_id)
    assert shown.state != drawings.FileState.FAILED
    assert shown.finding is None


def test_a_reader_out_of_memory_fails_the_file_with_the_memory_words_and_no_retry(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The cad worker's cap (24): the same try would reach it again, so the file's reason says so.
    file_id = added(qs_project)

    def hungry(path: Path, name: str) -> ReadArtefact:
        raise MemoryError

    with pytest.raises(files.FileNotRead):
        run_job(qs_project.member, file_id, readers(Calls(), dwg=hungry), monkeypatch)

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.FAILED
    assert shown.finding == read_codes.LIMIT_REACHED(limit="memory")


class _Hoard(list[object]):
    """What a reader filled memory with (a list, so it can be watched by a weak reference)."""


def test_what_filled_memory_is_let_go_before_the_files_reason_is_kept(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 24's review: raised inside `except MemoryError`, the reason carried the error as its context,
    # whose traceback kept the reader's frames, so memory was still full while `not_read` wrote.
    file_id = added(qs_project)
    watched: list[weakref.ref[_Hoard]] = []
    alive_when_kept: list[bool] = []

    def hungry(path: Path, name: str) -> ReadArtefact:
        hoard = _Hoard([0.0] * 1000)
        watched.append(weakref.ref(hoard))
        raise MemoryError

    fail = files._fail

    def watching(file_id: uuid.UUID, finding: Message) -> jobs.StepResult:
        alive_when_kept.append(watched[0]() is not None)
        return fail(file_id, finding)

    monkeypatch.setattr(files, "_fail", watching)
    with pytest.raises(files.FileNotRead):
        run_job(qs_project.member, file_id, readers(Calls(), dwg=hungry), monkeypatch)

    assert alive_when_kept == [False]


def _vm_size() -> int:
    for line in Path("/proc/self/status").read_text().splitlines():
        if line.startswith("VmSize:"):
            return int(line.split()[1]) * 1024
    raise AssertionError("no VmSize")


def _tuples() -> None:
    hoard: list[object] = []
    while True:
        hoard.append((len(hoard), 1.5))


def _dicts() -> None:
    hoard: list[object] = []
    while True:
        hoard.append({"x": 1.0, "y": 2.0, "n": len(hoard)})


def _float_lists() -> None:
    hoard: list[object] = []
    while True:
        hoard.append([0.0] * 64)


@pytest.mark.parametrize("fill", [_tuples, _dicts, _float_lists] * 2)
def test_a_reader_that_fills_memory_under_a_real_cap_fails_the_file_with_the_memory_words(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, fill: Callable[[], None]
) -> None:
    # A real address-space cap (a soft RLIMIT_AS 400 MB above this process), reached by small
    # objects, as the cad worker's is: the reason is kept, with no database error and no retry.
    file_id = added(qs_project)
    soft, hard = resource.getrlimit(resource.RLIMIT_AS)

    def capped(path: Path, name: str) -> ReadArtefact:
        resource.setrlimit(resource.RLIMIT_AS, (_vm_size() + 400 * 2**20, hard))
        fill()
        raise AssertionError("unreachable: the cap stops it")

    try:
        with pytest.raises(files.FileNotRead):
            run_job(qs_project.member, file_id, readers(Calls(), dwg=capped), monkeypatch)
    finally:
        resource.setrlimit(resource.RLIMIT_AS, (soft, hard))

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.FAILED
    assert shown.finding == read_codes.LIMIT_REACHED(limit="memory")


def test_a_pdf_out_of_memory_in_the_worker_gets_the_pdfs_own_memory_words(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project, "KR-ARC-R0.pdf", "pdf")

    def hungry(path: Path) -> PdfReport:
        raise MemoryError

    with pytest.raises(files.FileNotRead):
        run_job(qs_project.member, file_id, readers(Calls(), pdf=hungry), monkeypatch)

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.FAILED
    assert shown.finding == pdf_codes.LIMIT_REACHED(limit="memory")


# A PDF ------------------------------------------------------------------------------------------


def test_a_pdf_is_read_with_its_report_kept(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project, "KR-ARC-R0.pdf", "pdf")
    calls = Calls()

    run_job(qs_project.member, file_id, readers(calls), monkeypatch)

    assert calls.names == ["pdf"]
    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.READ
    assert report(qs_project.member, file_id).made_by == tuple(pdf_report(shown.sha256, 3).messages)


def test_a_scanned_pdf_is_refused_by_its_report(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project, "SCAN.pdf", "pdf")

    def scan(path: Path) -> PdfReport:
        return pdf_report(sha(path), 2, refused=True)

    run_job(qs_project.member, file_id, readers(Calls(), pdf=scan), monkeypatch)

    assert view(qs_project.member, file_id).state == drawings.FileState.REFUSED


# The add that queues it --------------------------------------------------------------------------


def job_args(job_id: int) -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute("select queue_name, args from procrastinate_jobs where id = %s", [job_id])
        row = cursor.fetchone()
    assert row is not None
    queue, args = row
    assert queue == settings.VEXTRUS_CAD_QUEUE
    return json.loads(args) if isinstance(args, str) else dict(args)


def test_the_add_queues_the_files_read_job_with_its_ids_only(qs_project: QsProject) -> None:
    with qs_project.member.acting():
        done = read_file.add(
            qs_project.project_id, name="KR-STR-R0.dwg", content=io.BytesIO(drawing("dwg"))
        )
        assert done.file.read_job_id is not None
        args = job_args(done.file.read_job_id)

    assert args == {
        "tenant_id": str(qs_project.member.developer_id),
        "user_id": str(qs_project.member.user.pk),
        "file_id": str(done.file.id),
    }


def test_a_file_waiting_with_no_read_job_gets_one_when_added_again(qs_project: QsProject) -> None:
    content = drawing("dwg")
    before = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content).file
    assert before.read_job_id is None

    with qs_project.member.acting():
        again = read_file.add(qs_project.project_id, name="KR-STR-R0.dwg", content=io.BytesIO(content))

    assert again.outcome == "already_here"
    assert again.file.id == before.id
    assert again.file.read_job_id is not None
    # Nothing was added, but its reading started: 4.5's "Nothing was added" alone would mislead.
    assert again.message == said.READING_STARTED(file="KR-STR-R0.dwg")


def test_a_waiting_file_added_again_under_another_name_is_named_as_it_is_here(
    qs_project: QsProject,
) -> None:
    content = drawing("dwg")
    add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content)

    with qs_project.member.acting():
        again = read_file.add(qs_project.project_id, name="copy of it.dwg", content=io.BytesIO(content))

    assert again.message == said.READING_STARTED(file="KR-STR-R0.dwg")


def test_a_job_that_cannot_be_queued_keeps_nothing_and_names_the_file(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    def refuse(self: jobs.Job, **ids: uuid.UUID) -> int:
        raise jobs.JobRefused("refused for the test")

    monkeypatch.setattr(jobs.Job, "defer", refuse)

    with qs_project.member.acting(), pytest.raises(auth.Refused) as refused:
        read_file.add(qs_project.project_id, name="a/b/KR-STR-R0.dwg", content=io.BytesIO(drawing()))

    assert refused.value.status == 503
    assert refused.value.message == said.NOT_STARTED(file="KR-STR-R0.dwg")
    with qs_project.member.acting():
        assert drawings.set_of(qs_project.project_id) is None


def test_a_file_already_here_whose_job_cannot_be_queued_stays_and_is_worded_so(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    content = drawing("dwg")
    before = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content).file

    def refuse(self: jobs.Job, **ids: uuid.UUID) -> int:
        raise jobs.JobRefused("refused for the test")

    monkeypatch.setattr(jobs.Job, "defer", refuse)

    with qs_project.member.acting(), pytest.raises(auth.Refused) as refused:
        read_file.add(qs_project.project_id, name="KR-STR-R0.dwg", content=io.BytesIO(content))

    assert refused.value.message == said.NOT_STARTED_WAITING(file="KR-STR-R0.dwg")
    assert view(qs_project.member, before.id).state == drawings.FileState.WAITING


def csrf_post(member: Member, project_id: uuid.UUID, name: str, content: bytes) -> Any:
    from django.conf import settings as django_settings
    from django.test import Client
    from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

    part = io.BytesIO(content)
    part.name = name
    client = Client(enforce_csrf_checks=True)
    client.cookies = member.client.cookies
    client.cookies[django_settings.CSRF_COOKIE_NAME] = "a" * 32
    return client.generic(
        "POST",
        f"/api/projects/{project_id}/drawings/files",
        encode_multipart(BOUNDARY, {"file": part}),
        content_type=MULTIPART_CONTENT,
        headers={"X-CSRFToken": "a" * 32},
    )


def test_a_replaced_copy_whose_reading_cannot_be_started_again_is_refused_in_words(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The refuter's 21a finding (score 30): `drawings` restarts a failed file's job when its missing
    copy is replaced; a deferral that failed there answered a 500 page, not `{code, params}`."""
    content = drawing("dwg")
    first = csrf_post(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content)
    file_id = uuid.UUID(first.json()["file"]["id"])
    with qs_project.member.acting():
        drawings.mark_failed(file_id, read_codes.READER_FAILED())
        job_id = drawings.file(file_id).read_job_id
    own = jobs._own_job
    monkeypatch.setattr(
        jobs,
        "_own_job",
        lambda asked: (read_file.read_file.name, "failed", 1, False) if asked == job_id else own(asked),
    )
    base = Path(settings.VEXTRUS_STORAGE_ROOT) / str(qs_project.member.developer_id)
    [original] = list((base / str(qs_project.project_id)).rglob("original.dwg"))
    original.unlink()

    def fail(self: jobs.Job, **ids: uuid.UUID) -> int:
        raise DatabaseError("the queue could not be written")

    monkeypatch.setattr(jobs.Job, "defer", fail)

    response = csrf_post(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", content)

    assert (response.status_code, response.json()) == (
        503,
        {"code": "takeoff.read_file.not_started_again", "params": {"file": "KR-STR-R0.dwg"}},
    )
    shown = view(qs_project.member, file_id)
    assert (shown.state, shown.read_job_id) == (drawings.FileState.FAILED, job_id)


def test_the_read_jobs_own_deferral_outside_an_add_raises_as_it_is(qs_project: QsProject) -> None:
    file_id = added(qs_project)

    with pytest.raises(jobs.NotInTransaction):
        read_file.read_file.defer(file_id=file_id)


def test_a_fault_in_the_add_itself_is_not_worded_as_a_job_not_queued(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(*args: Any, **kwargs: Any) -> Any:
        raise DatabaseError("the add itself failed")

    monkeypatch.setattr(drawings, "add_file", broken)

    with qs_project.member.acting(), pytest.raises(DatabaseError):
        read_file.add(qs_project.project_id, name="KR-STR-R0.dwg", content=io.BytesIO(drawing()))


def test_the_read_job_runs_on_the_cad_queue() -> None:
    assert read_file.read_file.queue == settings.VEXTRUS_CAD_QUEUE == "cad"


# Words -------------------------------------------------------------------------------------------


def test_not_started_names_the_file_and_what_to_do() -> None:
    message: Message = said.NOT_STARTED(file="KR-STR-R0.dwg")
    assert message == {"code": "takeoff.read_file.not_started", "params": {"file": "KR-STR-R0.dwg"}}


def test_not_read_in_full_words_every_limit_the_finder_reports() -> None:
    from engine.recognise.sheets import LIMITS

    po = Path(settings.BASE_DIR) / "web/src/messages/takeoff/read_file/en.po"
    [entry] = [e for e in po.read_text().split("\n\n") if "takeoff.read_file.not_read_in_full" in e]
    for limit in LIMITS:
        assert f" {limit} {{" in entry, f"{limit} has no words of its own"


def not_read_in_full_branches() -> dict[str, str]:
    import re

    po = Path(settings.BASE_DIR) / "web/src/messages/takeoff/read_file/en.po"
    [entry] = [e for e in po.read_text().split("\n\n") if "takeoff.read_file.not_read_in_full" in e]
    return dict(re.findall(r"(\w+) \{([^{}]*)\}", entry.split("msgstr", 1)[1]))


def test_not_read_in_full_never_shows_a_limits_key() -> None:
    """The review's round-1 must: the `other` branch printed the engine's key in a QS sentence. The
    argument appears once, as the select's selector, and never as text."""
    po = Path(settings.BASE_DIR) / "web/src/messages/takeoff/read_file/en.po"
    [entry] = [e for e in po.read_text().split("\n\n") if "takeoff.read_file.not_read_in_full" in e]
    msgstr = entry.split("msgstr", 1)[1]
    assert msgstr.count("{limit") == msgstr.count("{limit, select,") == 1


def test_each_limit_is_worded_apart_so_two_limits_never_repeat_a_sentence() -> None:
    worded = not_read_in_full_branches()
    worded.pop("other")
    assert len(set(worded.values())) == len(worded), "two limits share their words"


# The engine's own readers, on a synthetic DWG (the toolchain and bwrap) -------------------------------


@pytest.fixture(scope="module")
def entity_kinds(tmp_path_factory: pytest.TempPathFactory) -> bytes:
    """The engine's `entity_kinds` fixture, saved as a DWG by its own writer."""
    from engine.fixtures import dwg

    folder = tmp_path_factory.mktemp("read-file-dwg")
    return dwg.build("entity_kinds", folder, dwg.build_writer(folder)).read_bytes()


@pytest.fixture(scope="module")
def dumper(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """The second reader, built from the tree and pinned (10's build)."""
    from engine.read.acadsharp.tests.build import build_dumper

    return build_dumper(tmp_path_factory.mktemp("read-file-dumper"))


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_the_engines_readers_read_a_dwg_through_the_job(
    qs_project: QsProject, entity_kinds: bytes, dumper: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper))
    file_id = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", entity_kinds).file.id

    run_inline(
        read_file.read_file,
        tenant_id=qs_project.member.developer_id,
        user_id=qs_project.member.user.pk,
        file_id=file_id,
    )

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.READ, shown.finding
    assert report(qs_project.member, file_id).readers == (
        {"code": "drawings.reports.readers_agree", "params": {}},
    )


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_without_the_second_reader_a_dwg_ends_failed_saying_so(
    qs_project: QsProject, entity_kinds: bytes, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(tmp_path / "none-here"))
    file_id = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", entity_kinds).file.id

    with pytest.raises(files.FileNotRead):
        run_inline(
            read_file.read_file,
            tenant_id=qs_project.member.developer_id,
            user_id=qs_project.member.user.pk,
            file_id=file_id,
        )

    shown = view(qs_project.member, file_id)
    assert shown.state == drawings.FileState.FAILED
    assert shown.finding == {"code": "engine.decoders_agree.not_installed", "params": {}}


@pytest.fixture
def empty_cad_queue(job_tables: None, django_db_blocker: Any) -> Any:
    """No job waits on the `cad` queue (the test database outlives a run)."""
    from vextrus.platform.database import OWNER_ALIAS

    def empty() -> None:
        from django.db import connections

        with django_db_blocker.unblock(), connections[OWNER_ALIAS].cursor() as cursor:
            cursor.execute(
                "delete from procrastinate_jobs where queue_name = %s", [settings.VEXTRUS_CAD_QUEUE]
            )

    empty()
    yield
    empty()


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_the_cad_worker_reads_an_uploaded_dwg_to_the_end(
    sign_in: Callable[..., Member],
    entity_kinds: bytes,
    dumper: Path,
    monkeypatch: pytest.MonkeyPatch,
    empty_cad_queue: None,
) -> None:
    """The whole way, as it runs: added and queued in one transaction, then read by the `cad` queue's
    own worker in its own process (its fork guard, its readers' sandboxes)."""
    from vextrus.projects import services as projects
    from vextrus.testing.drawings import start_worker
    from vextrus.testing.jobs import finish

    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper))
    member = sign_in(role="qs")
    with member.acting():
        project = projects.create(code=f"W-{uuid.uuid4().hex[:6]}", name="The worker")
        done = read_file.add(project.id, name="KR-STR-R0.dwg", content=io.BytesIO(entity_kinds))

    output = finish(start_worker([settings.VEXTRUS_CAD_QUEUE]), timeout=600)

    shown = view(member, done.file.id)
    assert shown.state == drawings.FileState.READ, (shown.finding, output[-3000:])


@pytest.mark.needs_bwrap
@pytest.mark.parametrize(("fixture", "state"), [("plot", "read"), ("scan", "refused")])
def test_the_engines_pdf_report_reads_a_pdf_through_the_job(
    qs_project: QsProject, tmp_path: Path, fixture: str, state: str
) -> None:
    from engine.fixtures import pdf

    content = pdf.build(fixture, tmp_path).read_bytes()
    file_id = add(qs_project.member, qs_project.project_id, f"{fixture}.pdf", content).file.id

    run_inline(
        read_file.read_file,
        tenant_id=qs_project.member.developer_id,
        user_id=qs_project.member.user.pk,
        file_id=file_id,
    )

    assert view(qs_project.member, file_id).state == state
