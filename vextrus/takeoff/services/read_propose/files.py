"""The read job's steps per file (ticket 21a; docs/plans/M0.md, 21a): each through `drawings.services`,
each in its own transaction, each kept once by `drawings`' StepStore.

    steps = read(run, file_id)          # inside the job (`takeoff.tasks.read_file`)

A DWG: `opening` (Vextrus's copy, checked against its sha256), `reading` (the first reader; its
ReadArtefact kept), `second_reader` (the second reader and the check that the two agree, kept as a
code; two readers that disagree hold the file through `drawings.services.quarantine`, and nothing
more is read: 21c's `held` step raises its `file_misread` Question, ADR 0029, unless the QS answered
it "read anyway", when the job, queued again by the answer, reads on), 21b's `sheets` and
`sheet_<n>` steps (`read_propose.sheets`), `finishing` (the font report and the Bangla-ANSI Check,
kept as codes, and the file marked read in the same transaction, with every limit that cut its sheets:
the first is its finding, `takeoff.read_file.not_read_in_full {limit}`; and with 21c's proposals: its
sheets and views proposed, the set's Questions asked and its Checks run, `read_propose.proposals`).

A PDF: `opening` (the copy checked, and the PDF report kept as codes; a scan is refused by it) and
`matching` (the file marked read, and its pages matched to the set's sheets in the same transaction:
`read_propose.plot`, ticket 157). A DWG's `finishing` matches the set's read PDFs' pages to its
sheets likewise, so the two are matched in whichever order they are read.

**A file that could not be read** (the reader raised its `ReadError`: a converter that failed, a
limit reached, the second reader not installed or not the pinned build; or the worker ran out of
memory at its cap, `engine.read.limit_reached {memory}`, which another try would too) ends failed
with that finding as its reason, by a step of its own, `not_read`, keyed by the job; then the job
ends failed at once (`FileNotRead`), never tried again by itself: the reason is the file's, and "Try
again" (a restart, a new job) reads it again. The step that raised rolled back, so it is not kept
and runs again on that restart; the steps kept before it are skipped. A DWG older than any the first
reader reads (its first bytes not `AC10…`) ends with `drawings.files.old_version`: nothing to try
again. Any other fault (the database, a bug) is raised as it is, and the job is tried again as 09's
runner decides. A kept `reading` whose artefact Vextrus has since lost (missing or damaged) is read
and kept again by the step that needs it, since the kept step itself is skipped.

The readers are the engine's (`READERS`); a test passes its own.
"""

import uuid
from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.db import transaction

from engine.check import bangla_ansi, decoders_agree
from engine.check.bangla_ansi import BanglaAnsi
from engine.messages import Message
from engine.messages import pdf_report as pdf_codes
from engine.messages import read as read_codes
from engine.read import ReadArtefact, ReadError
from engine.read import pdf as pdf_reader
from engine.read import read as read_dwg
from engine.read.pdf.types import PdfReport
from engine.recognise.types import CheckOutcome, CheckResult
from engine.render import fonts
from engine.render.fonts import FontReport
from vextrus.drawings import services as drawings
from vextrus.drawings.messages import files as file_words
from vextrus.platform.services import auth, jobs, storage
from vextrus.takeoff.services.read_propose import plot, proposals, sheets

OUT_OF_MEMORY = read_codes.LIMIT_REACHED(limit="memory")
"""The reason of a file whose reading reached the cad worker's cap in the worker itself (a PDF's is
its report's own `limit_reached {memory}`)."""
NOT_READ = "not_read"
"""The step that ends a file failed with its reason (see the module)."""
HELD = "held"
"""A held file's step: its `file_misread` Question raised (21c)."""

DWG_STEPS = (
    drawings.OPENING,
    drawings.READING,
    drawings.SECOND_READER,
    drawings.SHEETS,
    drawings.FINISHING,
)
"""A DWG's steps; after `sheets`, one `sheet_<n>` step per sheet it recorded (21b's `sheets`)."""
PDF_STEPS = (drawings.OPENING, drawings.MATCHING)


@dataclass(frozen=True)
class Readers:
    """What reads a file: the engine's (`READERS`), or a test's."""

    dwg: Callable[[Path, str], ReadArtefact]
    """The first reader: a DWG's path and its name as added, to its ReadArtefact."""
    second: Callable[[Path, ReadArtefact], CheckResult]
    """The second reader and the check that it agrees with the first."""
    fonts: Callable[[ReadArtefact], FontReport]
    bangla_ansi: Callable[[ReadArtefact], BanglaAnsi]
    pdf: Callable[[Path], PdfReport]


def _read_dwg(path: Path, name: str) -> ReadArtefact:
    return read_dwg(path, source_name=name)


def _second(path: Path, artefact: ReadArtefact) -> CheckResult:
    return decoders_agree.run(path, artefact)


def _pdf(path: Path) -> PdfReport:
    return pdf_reader.report(path)


READERS = Readers(
    dwg=_read_dwg, second=_second, fonts=fonts.report, bangla_ansi=bangla_ansi.run, pdf=_pdf
)


class FileNotRead(jobs.JobRefused):
    """The file ended failed with its reason: the job ends failed at once, and is never tried again
    by itself (the QS's "Try again" restarts it)."""


class _Unread(Exception):
    """Raised inside a step whose reader could not read the file: the step rolls back, and the
    file's reason is kept by the `not_read` step."""

    def __init__(self, finding: Message) -> None:
        super().__init__(finding["code"])
        self.finding = finding


@dataclass(frozen=True)
class Read:
    """How a file's per-file steps ended: `read`, `held` or `refused` (a PDF that is a scan)."""

    file_id: uuid.UUID
    format: str
    outcome: str


def read(run: jobs.Run, file_id: uuid.UUID, readers: Readers | None = None) -> Read:
    """Run the file's steps (see the module); raises `FileNotRead` when the file ended failed."""
    use = readers or READERS
    steps = run.steps(drawings.step_store(), subject_id=file_id, total=len(DWG_STEPS))
    try:
        try:
            return _steps(steps, file_id, use, lambda: _held_answer(run, file_id))
        except MemoryError:
            # The cad worker's cap, reached in this process: the same try would reach it again.
            # Leave the handler before anything else runs: the error's traceback holds the frames
            # that filled memory, and they are let go only when the handler ends (24's review).
            pass
        raise _Unread(OUT_OF_MEMORY)
    except _Unread as unread:
        # The step that raised has rolled back; the file's reason is kept once per job.
        finding = unread.finding
        steps.run(
            NOT_READ,
            lambda: _fail(file_id, finding),
            inputs={"job": run.job_id, "finding": finding["code"]},
        )
        raise FileNotRead(f"file {file_id} was not read: {finding['code']}") from unread


def _steps(
    steps: jobs.Steps, file_id: uuid.UUID, use: Readers, held_answer: Callable[[], object]
) -> Read:
    opened = steps.run(drawings.OPENING, lambda: _open(file_id, use), inputs={"file": file_id})
    sha256 = str(opened["sha256"])
    if opened["format"] == "pdf":
        steps.expect(len(PDF_STEPS))
        if opened.get("refused"):
            return Read(file_id, "pdf", "refused")  # a scan: refused by its report, nothing to match
        steps.run(drawings.MATCHING, lambda: _match(file_id), inputs={"sha256": sha256})
        return Read(file_id, "pdf", "read")
    kept = steps.run(drawings.READING, lambda: _first(file_id, use), inputs={"sha256": sha256})
    reader = {"reader": kept["reader"], "reader_version": kept["reader_version"]}
    checked = steps.run(
        drawings.SECOND_READER, lambda: _check(file_id, use, kept), inputs={"sha256": sha256, **reader}
    )
    read_anyway = False
    if checked["held"]:
        answer = held_answer()
        steps.run(HELD, lambda: proposals.ask_held(file_id), inputs={"sha256": sha256, **reader})
        if answer != drawings.HeldAnswer.READ_ANYWAY:
            return Read(file_id, "dwg", "held")
        read_anyway = True
    load = sheets.once(lambda: _kept_artefact(file_id, use, kept))
    found = sheets.read(
        steps,
        file_id,
        load,
        {"sha256": sha256, **reader},
        done_before=DWG_STEPS.index(drawings.SHEETS),
        after=len(DWG_STEPS) - DWG_STEPS.index(drawings.FINISHING),
    )
    steps.run(
        drawings.FINISHING,
        lambda: _finish(
            file_id,
            use,
            kept,
            found.not_read_in_full,
            lambda: _propose(file_id, load, found.unread),
        ),
        inputs={"sha256": sha256, **reader, **({"read_anyway": True} if read_anyway else {})},
    )
    return Read(file_id, "dwg", "held" if read_anyway else "read")


def _held_answer(run: jobs.Run, file_id: uuid.UUID) -> object:
    """What the QS answered about the held file, read as it stands (never kept by a step)."""
    with run.acting(), transaction.atomic():
        return drawings.held_answer(file_id)


# The steps' bodies: each runs inside its step's transaction, acting in the file's tenant -----------


def _open(file_id: uuid.UUID, use: Readers) -> jobs.StepResult:
    """Vextrus's copy of the file, checked; a PDF's report kept."""
    view = drawings.file(file_id)
    result: jobs.StepResult = {"format": view.format, "sha256": view.sha256}
    with _copy(file_id) as path:
        if view.format == "pdf":
            report = _reading(lambda: use.pdf(path))
            kept = drawings.record_reports(file_id, upload_report=report)
            result["refused"] = report.refused is not None
            result["pages"] = len(report.pages)
            result["kept_as"] = str(kept.state)
    return result


def _first(file_id: uuid.UUID, use: Readers) -> jobs.StepResult:
    ref = drawings.store_artefact(file_id, _read_first(file_id, use))
    return {
        "reader": ref.reader,
        "reader_version": ref.reader_version,
        "schema_version": ref.schema_version,
    }


def _read_first(file_id: uuid.UUID, use: Readers) -> ReadArtefact:
    view = drawings.file(file_id)
    with _copy(file_id) as path:
        return _reading(lambda: use.dwg(path, view.name), dwg=True)


def _kept_artefact(file_id: uuid.UUID, use: Readers, kept: jobs.StepResult) -> ReadArtefact:
    """The artefact the `reading` step kept; read again and kept again when Vextrus's copy of it is
    missing or damaged (the `reading` step is kept, and skipped, so it would never be read again)."""
    try:
        return drawings.artefact(file_id, str(kept["reader_version"]))
    except storage.StorageError, auth.NotFound:
        artefact = _read_first(file_id, use)
        drawings.store_artefact(file_id, artefact)
        return artefact


def _check(file_id: uuid.UUID, use: Readers, kept: jobs.StepResult) -> jobs.StepResult:
    artefact = _kept_artefact(file_id, use, kept)
    with _copy(file_id) as path:
        checked = _reading(lambda: use.second(path, artefact))
    drawings.record_reports(file_id, cross_check=checked)
    if checked.outcome == CheckOutcome.FIRED:
        assert checked.finding is not None, "a fired check carries its finding"
        drawings.quarantine(file_id, checked.finding)
        return {"held": True, "finding": checked.finding["code"]}
    return {"held": False}


def _finish(
    file_id: uuid.UUID,
    use: Readers,
    kept: jobs.StepResult,
    not_read_in_full: Sequence[Message],
    propose: Callable[[], jobs.StepResult],
) -> jobs.StepResult:
    artefact = _kept_artefact(file_id, use, kept)
    font_report = use.fonts(artefact)
    flagged = use.bangla_ansi(artefact)
    drawings.record_reports(file_id, font_report=font_report, bangla_ansi=flagged)
    view = drawings.mark_read(file_id, not_read_in_full)
    # 21c: once the file is read (its sheets in the sheet list), in the same transaction: Step 1's
    # proposals, Questions and Checks, so a read file is never listed without them.
    proposed = propose()
    # 157: the set's read PDFs' pages matched to its sheets, in the same transaction, so a read
    # sheet is never listed beside a read PDF it was not matched against.
    matched = plot.match(file_id)
    result: dict[str, Any] = {
        "fonts": len(font_report.fonts),
        "bangla_ansi_texts": len(flagged.texts),
        "state": str(view.state),
        # Every limit that cut the reading: the report's sheets section says each from here.
        "not_read_in_full": list(not_read_in_full),
        "proposals": proposed,
        "plot": matched,
    }
    return result


def _propose(file_id: uuid.UUID, load: Callable[[], ReadArtefact], unread: int) -> jobs.StepResult:
    return proposals.propose(file_id, load, sheets.conventions(file_id)[0], unread=unread)


def _match(file_id: uuid.UUID) -> jobs.StepResult:
    """A PDF marked read and its pages matched to the set's sheets, in one transaction (157)."""
    state = str(drawings.mark_read(file_id).state)
    try:
        matched = plot.match(file_id)
    except ReadError as error:
        raise _Unread(error.message) from error
    except storage.FileMissing as missing:
        raise _Unread(missing.message) from None
    except storage.StorageError:  # damaged, or something planted where the file goes
        raise _Unread(storage.FileChanged.message) from None
    return {"state": state, "plot": matched}


def _fail(file_id: uuid.UUID, finding: Message) -> jobs.StepResult:
    if finding == OUT_OF_MEMORY and drawings.file(file_id).format == "pdf":
        finding = pdf_codes.LIMIT_REACHED(limit="memory")  # the PDF's own words for it
    return {"state": str(drawings.mark_failed(file_id, finding).state), "finding": finding["code"]}


@contextmanager
def _copy(file_id: uuid.UUID) -> Iterator[Path]:
    """Vextrus's copy, checked: a copy missing or damaged is the file's reason (adding the file
    again replaces the copy)."""
    try:
        with drawings.original(file_id) as path:
            yield path
    except storage.FileMissing as missing:
        raise _Unread(missing.message) from None
    except storage.StorageError:  # damaged, or something planted where the file goes
        raise _Unread(storage.FileChanged.message) from None


def _reading[T](read_it: Callable[[], T], *, dwg: bool = False) -> T:
    """The reader's result, or its finding as the file's reason. A DWG whose first bytes name no
    version the first reader reads was saved by an AutoCAD older than any it reads."""
    try:
        return read_it()
    except ReadError as error:
        if dwg and error.message["code"] == read_codes.UNSUPPORTED_FORMAT.code:
            raise _Unread(file_words.OLD_VERSION()) from error
        raise _Unread(error.message) from error
    except MemoryError:
        # The cad worker's cap, reached by the reader. Leave the handler first, here beside the
        # reader: its frames, which filled memory, are let go before the step's transaction rolls
        # back (a rollback with memory still full fails too; 24's review).
        pass
    raise _Unread(OUT_OF_MEMORY)
