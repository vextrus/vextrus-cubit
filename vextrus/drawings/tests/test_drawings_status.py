"""A file's status in m0-screens 4.5's words, from its own columns (ticket 14): every row a file with
no read job can be on. The rows a read job's state gives (retrying, stopping, a crashed job's
failure) are `test_drawings_jobs.py`'s, on a real worker."""

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

import pytest
from django.db import connection
from django.utils import timezone

from engine.check.bangla_ansi import BanglaAnsi, Flagged, FoundBy
from engine.read.pdf.types import Lettering, MadeBy, PdfReport
from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.drawings.services.reads import ReadStepStore
from vextrus.platform.services import auth, jobs
from vextrus.projects import services as projects
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report, read_dwg, sheet_candidate
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def status(member: Member, file_id: uuid.UUID) -> tuple[str, dict[str, Any]]:
    with member.acting():
        shown = services.file(file_id)
    return str(shown.state), dict(shown.status)


def test_a_file_waits_behind_the_developers_own_files_only(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code="TH-5", name="Theirs")
    add(stranger, theirs.id, "T.dwg", drawing())
    first = add(qs_project.member, qs_project.project_id, "A.dwg", drawing()).file
    with qs_project.member.acting():
        other = projects.create(code="OT-4", name="Other project")
    add(qs_project.member, other.id, "B.dwg", drawing())
    third = add(qs_project.member, qs_project.project_id, "C.dwg", drawing()).file

    assert status(qs_project.member, first.id) == ("waiting", said.WAITING(ahead=0))
    assert status(qs_project.member, third.id) == ("waiting", said.WAITING(ahead=2))


def test_a_member_of_some_projects_counts_only_their_files_ahead(
    qs_project: QsProject, sign_in: Callable[..., Member]
) -> None:
    member = qs_project.member
    with member.acting():
        other = projects.create(code="OT-7", name="Other project")
    add(member, other.id, "B.dwg", drawing())
    add(member, qs_project.project_id, "A.dwg", drawing())
    third = add(member, qs_project.project_id, "C.dwg", drawing()).file
    scoped = sign_in(
        role="vextrus_engineer", developer_id=member.developer_id, projects=[qs_project.project_id]
    )

    assert status(member, third.id) == ("waiting", said.WAITING(ahead=2))
    assert status(scoped, third.id) == ("waiting", said.WAITING(ahead=1))


def test_the_summary_counts_what_could_not_be_read_and_every_listed_sheet(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    held = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, held.id, ["S-01", "S-02"], mark_read=False)
    failed = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    old = add(member, qs_project.project_id, "KR-LIFT-R12.dwg", drawing()).file
    with member.acting():
        services.quarantine(held.id, {"code": "engine.decoders_agree.disagree", "params": {}})
        services.answer_held(held.id, "read_anyway")
        services.mark_read(held.id)  # its re-read ended (#165: its sheets listed from here)
        services.mark_failed(failed.id, {"code": "engine.read.reader_failed", "params": {}}, tries=3)
        services.mark_failed(old.id, said.OLD_VERSION())
        shown = services.files(held.set_id)

    assert services.summary(shown) == said.SUMMARY(
        files=3, sheets=2, held_sheets=2, held_files_read=1, reading=0, failed=2, held=1, refused=0
    )
    assert status(member, failed.id) == ("failed", said.FAILED(tries=3))


@pytest.mark.parametrize(
    ("kind", "step", "words"),
    [
        ("dwg", services.OPENING, said.OPENING_FILE()),
        ("dwg", services.READING, said.READING_DRAWING()),
        ("dwg", services.SECOND_READER, said.SECOND_READER()),
        ("dwg", services.SHEETS, said.FINDING_SHEETS()),
        ("dwg", services.sheet_step(2), said.READING_SHEET(position=2, total=3)),
        ("dwg", services.FINISHING, said.FINISHING()),
        ("dwg", "an_unknown_step", said.READING_DRAWING()),
        ("dwg", services.sheet_step(9), said.READING_DRAWING()),
        ("dwg", services.page_step(1), said.READING_DRAWING()),
        ("pdf", services.OPENING, said.OPENING_PDF()),
        ("pdf", services.page_step(2), said.READING_PAGE(position=2, total=3)),
        ("pdf", services.MATCHING, said.MATCHING_PAGES()),
        ("pdf", services.SHEETS, said.OPENING_PDF()),  # a PDF's unknown step: its first
        ("pdf", "", said.OPENING_PDF()),
    ],
)
def test_a_file_reading_says_its_step(qs_project: QsProject, kind: str, step: str, words: Any) -> None:
    found = add(qs_project.member, qs_project.project_id, f"S.{kind}", drawing(kind)).file
    with qs_project.member.acting():
        if kind == "dwg":
            read_dwg(qs_project.member, found.id, ["S-01", "S-02", "S-03"], mark_read=False)
        else:
            services.record_reports(found.id, upload_report=pdf_report(found.sha256, 3))
        services.step_store().progress(found.id, jobs.Progress(0, 9, step))

    assert status(qs_project.member, found.id) == ("reading", words)


def test_the_time_left_shows_once_three_sheets_are_read_and_the_rate_is_steady(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    found = add(qs_project.member, qs_project.project_id, "S.dwg", drawing()).file
    read_dwg(qs_project.member, found.id, [f"S-{n:02d}" for n in range(1, 13)], mark_read=False)
    start = timezone.now() - timedelta(minutes=12)
    # "Now" is fixed, so the words never depend on how long the test takes.
    fixed = start + timedelta(minutes=12)
    monkeypatch.setattr(timezone, "now", lambda: fixed)

    def at(minutes: float) -> Callable[[], datetime]:
        return lambda: start + timedelta(minutes=minutes)

    with qs_project.member.acting():
        for position in (1, 2, 3):
            ReadStepStore(clock=at(2 * (position - 1))).progress(
                found.id, jobs.Progress(position, 20, services.sheet_step(position))
            )
    assert status(qs_project.member, found.id) == ("reading", said.READING_SHEET(position=3, total=12))
    with qs_project.member.acting():
        ReadStepStore(clock=at(11)).progress(found.id, jobs.Progress(4, 20, services.sheet_step(4)))
    # 3 sheets in 11 minutes, the 4th a minute in: 9 left at 3⅔ min each, less that minute.
    assert status(qs_project.member, found.id) == (
        "reading",
        said.READING_SHEET_LEFT(position=4, total=12, minutes=32),
    )


def test_a_stalled_read_shows_no_time_left(qs_project: QsProject) -> None:
    found = add(qs_project.member, qs_project.project_id, "S.dwg", drawing()).file
    read_dwg(qs_project.member, found.id, [f"S-{n:02d}" for n in range(1, 13)], mark_read=False)
    start = timezone.now() - timedelta(hours=5)
    with qs_project.member.acting():
        for position in range(1, 8):
            ReadStepStore(clock=lambda p=position: start + timedelta(minutes=p)).progress(
                found.id, jobs.Progress(position, 20, services.sheet_step(position))
            )
    assert status(qs_project.member, found.id) == ("reading", said.READING_SHEET(position=7, total=12))


def test_a_file_cancelled_says_by_whom_and_when(qs_project: QsProject) -> None:
    found = add(qs_project.member, qs_project.project_id, "S.dwg", drawing()).file
    with qs_project.member.acting():
        services.cancel(found.id, actor_name="Nusrat Jahan")
        again = services.cancel(found.id, actor_name="Someone Else")
    state, words = status(qs_project.member, found.id)
    assert state == "cancelled"
    assert words["code"] == "drawings.files.cancelled"
    assert words["params"]["actor"] == "Nusrat Jahan"
    assert datetime.fromisoformat(str(words["params"]["cancelled_date"])).tzinfo is not None
    assert again.status == words


def test_the_rows_a_files_end_gives(qs_project: QsProject) -> None:
    member = qs_project.member
    cases: dict[str, Any] = {}
    read = add(member, qs_project.project_id, "read.dwg", drawing()).file
    read_dwg(member, read.id, ["S-01"])
    cases["read"] = (read.id, ("read", said.READ()))
    bangla = add(member, qs_project.project_id, "bangla.dwg", drawing()).file
    read_dwg(member, bangla.id, ["A-02"])
    with member.acting():
        services.record_reports(
            bangla.id, bangla_ansi=BanglaAnsi((Flagged("2A", FoundBy.FONT, "SutonnyMJ"),))
        )
    cases["bangla"] = (bangla.id, ("read", said.READ_BANGLA()))
    once = add(member, qs_project.project_id, "once.dwg", drawing()).file
    held = add(member, qs_project.project_id, "held.dwg", drawing()).file
    scan = add(member, qs_project.project_id, "scan.pdf", drawing("pdf")).file
    with member.acting():
        services.mark_failed(once.id, {"code": "engine.decoders_agree.not_installed", "params": {}})
        services.quarantine(held.id, {"code": "engine.decoders_agree.disagree", "params": {}})
        services.record_reports(scan.id, upload_report=PdfReport(
            scan.sha256, None, None, MadeBy.UNKNOWN, (), (), (), {},
            {"code": "engine.pdf_report.refused_scan", "params": {}}, (),
        ))  # fmt: skip
    cases["once"] = (once.id, ("failed", said.FAILED(tries=1)))
    cases["held"] = (held.id, ("held", said.HELD()))
    cases["scan"] = (scan.id, ("refused", said.REFUSED_SCAN()))

    for name, (file_id, expected) in cases.items():
        assert status(member, file_id) == expected, name


@pytest.mark.parametrize(
    ("answer", "words"),
    [
        ("read_anyway", said.HELD_READ_ANYWAY()),
        ("await_resaved", said.AWAIT_RESAVED()),
        ("sent_to_vextrus", said.SENT_TO_VEXTRUS()),
    ],
)
def test_a_held_file_answered_says_what_was_decided(
    qs_project: QsProject, answer: str, words: Any
) -> None:
    found = add(qs_project.member, qs_project.project_id, "held.dwg", drawing()).file
    with qs_project.member.acting():
        services.quarantine(found.id, {"code": "engine.decoders_agree.disagree", "params": {}})
        services.answer_held(found.id, answer)
    assert status(qs_project.member, found.id) == ("held", words)


def test_a_pdf_says_its_plot_and_sits_under_its_dwg(qs_project: QsProject) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    printed = read_dwg(member, dwg.id, ["A-01", "A-02"])
    lines = add(member, qs_project.project_id, "KR-ARC-R0.pdf", drawing("pdf")).file
    early = add(member, qs_project.project_id, "KR-STR-R0.pdf", drawing("pdf")).file
    later = add(member, qs_project.project_id, "KR-ARC-R1.pdf", drawing("pdf")).file
    loose = add(member, qs_project.project_id, "misc.pdf", drawing("pdf")).file
    with member.acting():
        services.record_reports(
            lines.id, upload_report=pdf_report(lines.sha256, 3, lettering=Lettering.LINES)
        )
        services.record_reports(early.id, upload_report=pdf_report(early.sha256, 12))
        services.record_reports(later.id, upload_report=pdf_report(later.sha256, 4))
        services.record_reports(loose.id, upload_report=pdf_report(loose.sha256, 2))
        for pdf in (lines, early, later, loose):
            services.mark_read(pdf.id)
        from engine.read.pdf.types import Page
        from engine.recognise.types import PlotMatch

        for i, sheet in enumerate(printed, start=1):
            page = Page(lines.sha256, i, 1190.0, 842.0, 0, (0.0, 0.0, 1190.0, 842.0), False, ())
            services.record_plot(sheet.id, PlotMatch(page, sheet_candidate(0, dwg.group, number="A")))
        shown = {f.id: f for f in services.files(dwg.set_id)}

    assert (shown[lines.id].state, shown[lines.id].status) == (
        "read",
        said.PLOT_MATCHED_LINES(matched=2, pages=3),
    )
    assert shown[lines.id].plot_for == (dwg.id,)
    # No Structural DWG is read: its PDF waits. An Architectural one is: its other PDF, and one of
    # no Discipline, matched none of its sheets.
    assert shown[early.id].status == said.PLOT_WAITING()
    assert shown[later.id].status == said.PLOT_MATCHED(matched=0, pages=4)
    assert shown[loose.id].status == said.PLOT_MATCHED(matched=0, pages=2)
    assert shown[dwg.id].sheets_found == 2
    assert services.summary(shown.values()) == said.SUMMARY(
        files=5, sheets=2, held_sheets=0, held_files_read=0, reading=0, failed=0, held=0, refused=0
    )


@pytest.mark.parametrize(("kind", "words"), [("dwg", said.FINISHING()), ("pdf", said.MATCHING_PAGES())])
def test_a_file_whose_job_is_done_before_its_row_ends_says_its_last_step(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, kind: str, words: Any
) -> None:
    found = add(qs_project.member, qs_project.project_id, f"KR-STR-R0.{kind}", drawing(kind)).file
    with qs_project.member.acting(), connection.cursor() as cursor:
        cursor.execute(
            "update drawings_drawingfile set read_job_id = 1, read_status = 'reading' where id = %s",
            [found.id],
        )
    monkeypatch.setattr(
        jobs, "state", lambda job_id: jobs.JobState(job_id, "read", "done", 1, 3, said.READ())
    )
    assert status(qs_project.member, found.id) == ("reading", words)


def test_the_summary_counts_as_reading_only_the_files_being_read(qs_project: QsProject) -> None:
    member = qs_project.member
    waiting = add(member, qs_project.project_id, "A.dwg", drawing()).file
    reading = add(member, qs_project.project_id, "B.dwg", drawing()).file
    with member.acting():
        services.step_store().progress(reading.id, jobs.Progress(0, 9, services.OPENING))
        shown = services.files(waiting.set_id)
    assert [f.state for f in shown] == ["waiting", "reading"]
    assert services.summary(shown) == said.SUMMARY(
        files=2, sheets=0, held_sheets=0, held_files_read=0, reading=1, failed=0, held=0, refused=0
    )


@pytest.mark.parametrize("ending", ["read", "held", "refused"])
def test_a_file_whose_reading_has_ended_is_not_started_again_and_says_so(
    qs_project: QsProject, ending: str
) -> None:
    kind = "pdf" if ending == "refused" else "dwg"
    found = add(qs_project.member, qs_project.project_id, f"KR-STR-R0.{kind}", drawing(kind)).file
    with qs_project.member.acting():
        if ending == "read":
            services.mark_read(found.id)
        elif ending == "held":
            services.quarantine(found.id, {"code": "engine.decoders_agree.disagree", "params": {}})
        else:
            services.record_reports(found.id, upload_report=pdf_report(found.sha256, 1, refused=True))
        with pytest.raises(auth.Refused) as again:
            services.restart(found.id)
        with pytest.raises(auth.Refused) as waiting:
            services.restart(add(qs_project.member, qs_project.project_id, "W.dwg", drawing()).file.id)
    assert (again.value.status, again.value.message) == (409, said.ALREADY_ENDED())
    assert (waiting.value.status, waiting.value.message) == (409, said.NOT_STOPPED())


def test_a_held_dwg_read_anyway_with_no_sheets_leaves_its_pdf_waiting(qs_project: QsProject) -> None:
    """#131: a held DWG read anyway counts as read for its Discipline's PDFs only once it has sheets
    to match; with none, the PDF says 4.5's "PDF before its DWG", never "0 of N pages matched"."""
    member = qs_project.member
    held = add(member, qs_project.project_id, "BP-ARC-old.dwg", drawing()).file
    early = add(member, qs_project.project_id, "BP-ARC-R0.pdf", drawing("pdf")).file
    with member.acting():
        services.quarantine(held.id, {"code": "engine.decoders_agree.disagree", "params": {}})
        services.answer_held(held.id, "read_anyway")
        services.record_reports(early.id, upload_report=pdf_report(early.sha256, 6))
        services.mark_read(early.id)
    assert status(member, early.id) == ("read", said.PLOT_WAITING())

    # Once it has sheets, its PDF is matched against them (none of its pages matched here).
    read_dwg(member, held.id, ["A-01", "A-02"])  # its re-read ended (#165)
    assert status(member, early.id) == ("read", said.PLOT_MATCHED(matched=0, pages=6))
