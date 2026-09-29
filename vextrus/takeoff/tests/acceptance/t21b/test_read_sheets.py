"""Ticket 21b, the read job per sheet: the file's `sheets` step (docs/plans/M0.md, 21b; the rulings,
"21a The read job, per file"), run through 21a's read job with readers a test gives.

Pinned: the `sheets` step runs between `second_reader` and `finishing` (21a's `files.py`: "21b's sheet
steps go between `second_reader` and `finishing`"); it keeps the finder's budget report as
`sheet_report` in its `ReadStep.result` (the ruling: "`sheet_report` goes in `ReadStep.result`"), each
of `LIMITS` given even at zero; it fills `takeoff.read_file.not_read_in_full {limit}` once per limit
above 0; a held file reads no sheets; a kept step is skipped on a restart and after a stop; what it
writes is its file's tenant's alone.

Chosen here (the smallest name; see the report): the filled messages are the `sheets` step's result's
`not_read_in_full`, a list of `{code, params}`.
"""

import hashlib
import uuid
from pathlib import Path
from typing import Any

import pytest
from procrastinate.job_context import AbortReason

from engine.check.bangla_ansi import BanglaAnsi
from engine.messages import decoders_agree as agree_codes
from engine.read import ReadArtefact
from engine.read.pdf.types import PdfReport
from engine.recognise import sheets as finder
from engine.recognise.types import CheckOutcome, CheckResult
from engine.render import fonts
from vextrus.drawings import services as drawings
from vextrus.drawings.models import ReadStep
from vextrus.platform.services import auth, jobs
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, artefact_for, drawing, pdf_report
from vextrus.testing.jobs import run_inline
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

NOT_READ_IN_FULL = "takeoff.read_file.not_read_in_full"
AGREE = CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED)
DISAGREE = CheckResult(
    code="decoders_agree",
    outcome=CheckOutcome.FIRED,
    finding=agree_codes.DISAGREE(items=3, only_first=2, only_second=1, kinds=0, layers=0, unread=0),
)


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def readers(*, second: CheckResult = AGREE) -> files.Readers:
    """21a's readers, given: the first reader gives 11's synthetic drawing of three frames."""

    def first(path: Path, name: str) -> ReadArtefact:
        return artefact_for(_sha(path), name, 3)

    def check(path: Path, artefact: ReadArtefact) -> CheckResult:
        return second

    def pdf(path: Path) -> PdfReport:
        return pdf_report(_sha(path), 1)

    return files.Readers(
        dwg=first,
        second=check,
        fonts=fonts.report,
        bangla_ansi=lambda artefact: BanglaAnsi(()),
        pdf=pdf,
    )


def run_job(
    member: Member,
    file_id: uuid.UUID,
    monkeypatch: pytest.MonkeyPatch,
    *,
    use: files.Readers | None = None,
    abort_reason: Any = lambda: None,
) -> None:
    monkeypatch.setattr(files, "READERS", use or readers())
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=abort_reason,
        file_id=file_id,
    )


def added(qs: QsProject) -> uuid.UUID:
    return add(qs.member, qs.project_id, "KR-STR-R0.dwg", drawing("dwg")).file.id


def kept_steps(member: Member, file_id: uuid.UUID) -> list[ReadStep]:
    """The file's kept steps, in the order they were kept, as its tenant sees them."""
    with member.acting():
        return list(ReadStep.objects.filter(file_id=file_id).order_by("created_at", "id"))


def sheets_step(member: Member, file_id: uuid.UUID) -> ReadStep:
    [step] = [s for s in kept_steps(member, file_id) if s.step == drawings.SHEETS]
    return step


class ReportCalls:
    """How many times the finder's budget report was taken (a skipped `sheets` step takes none)."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.count = 0
        original = finder.FileBudget.report

        def counted(budget: finder.FileBudget) -> dict[str, int]:
            self.count += 1
            return original(budget)

        monkeypatch.setattr(finder.FileBudget, "report", counted)


# The step and where it runs ----------------------------------------------------------------------


def test_the_sheets_step_runs_between_the_second_reader_and_finishing(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    names = [s.step for s in kept_steps(qs_project.member, file_id)]
    assert names[:4] == [drawings.OPENING, drawings.READING, drawings.SECOND_READER, drawings.SHEETS]
    assert names[-1] == drawings.FINISHING
    with qs_project.member.acting():
        assert drawings.file(file_id).state == drawings.FileState.READ


def test_a_held_file_reads_no_sheets(qs_project: QsProject, monkeypatch: pytest.MonkeyPatch) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch, use=readers(second=DISAGREE))

    names = {s.step for s in kept_steps(qs_project.member, file_id)}
    assert drawings.SHEETS not in names
    assert not any(name.startswith("sheet_") for name in names)
    with qs_project.member.acting():
        assert drawings.file(file_id).state == drawings.FileState.HELD


# The finder's report and "Not read in full" ------------------------------------------------------


def test_the_sheets_step_keeps_the_finders_report_with_every_limit(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    report = sheets_step(qs_project.member, file_id).result["sheet_report"]
    assert set(finder.LIMITS) <= set(report)
    assert all(isinstance(report[limit], int) for limit in finder.LIMITS)


def test_a_file_no_limit_cut_is_never_said_not_read_in_full(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    result = sheets_step(qs_project.member, file_id).result
    assert all(result["sheet_report"][limit] == 0 for limit in finder.LIMITS)
    assert result["not_read_in_full"] == []


def test_each_limit_above_0_is_said_once_as_not_read_in_full_with_its_limit(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Three frames and their texts against caps of one: the finder reports `texts_capped` and
    `frames_capped` above 0 (and a count that is not a limit, which is never said)."""
    monkeypatch.setattr(finder, "MAX_TEXTS", 1)
    monkeypatch.setattr(finder, "MAX_FRAMES", 1)
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    result = sheets_step(qs_project.member, file_id).result
    above = {limit for limit in finder.LIMITS if result["sheet_report"][limit] > 0}
    assert above == {"texts_capped", "frames_capped"}
    said = result["not_read_in_full"]
    assert all(m["code"] == NOT_READ_IN_FULL and set(m["params"]) == {"limit"} for m in said)
    assert sorted(m["params"]["limit"] for m in said) == sorted(above)


# Kept once: a restart and a stop ------------------------------------------------------------------


def test_reading_the_file_again_skips_the_kept_sheets_step(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    before = sheets_step(qs_project.member, file_id)
    calls = ReportCalls(monkeypatch)

    run_job(qs_project.member, file_id, monkeypatch)

    assert calls.count == 0
    after = sheets_step(qs_project.member, file_id)
    assert (after.id, after.result) == (before.id, before.result)


def test_a_stop_after_the_sheets_step_resumes_without_finding_the_sheets_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    calls = ReportCalls(monkeypatch)
    stopping = {"now": False}

    def stop_once_the_finder_ran() -> AbortReason | None:
        # The worker stops between steps once the sheets were found: the job stops after that step.
        if calls.count and not stopping["now"]:
            stopping["now"] = True
        return AbortReason.SHUTDOWN if stopping["now"] else None

    with pytest.raises(jobs.Stopped):
        run_job(qs_project.member, file_id, monkeypatch, abort_reason=stop_once_the_finder_ran)
    kept = sheets_step(qs_project.member, file_id)
    with qs_project.member.acting():
        assert drawings.file(file_id).state != drawings.FileState.READ
    found = calls.count

    run_job(qs_project.member, file_id, monkeypatch)

    assert calls.count == found
    assert sheets_step(qs_project.member, file_id).id == kept.id
    names = [s.step for s in kept_steps(qs_project.member, file_id)]
    assert len(names) == len(set(names))
    with qs_project.member.acting():
        assert drawings.file(file_id).state == drawings.FileState.READ


# Tenancy ------------------------------------------------------------------------------------------


def test_the_sheets_step_is_kept_in_its_files_tenant(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    assert sheets_step(qs_project.member, file_id).tenant_id == qs_project.member.developer_id


def test_a_second_tenant_sees_none_of_the_files_sheet_steps(
    qs_project: QsProject, sign_in: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    other = sign_in(role="qs")
    assert other.developer_id != qs_project.member.developer_id

    assert kept_steps(other, file_id) == []
    with other.acting(), pytest.raises(auth.NotFound):
        drawings.file(file_id)


def test_a_second_tenants_job_cannot_read_the_files_sheets(
    qs_project: QsProject, sign_in: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A job naming another Developer's file, as that other Developer's member, keeps nothing."""
    file_id = added(qs_project)
    other = sign_in(role="qs")

    with pytest.raises((auth.NotFound, jobs.JobRefused)):
        run_job(other, file_id, monkeypatch)

    assert kept_steps(qs_project.member, file_id) == []
