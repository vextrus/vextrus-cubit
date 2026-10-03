"""What a read job keeps through `drawings` (ticket 14; for 21a and 21b; the M0 plan, "drawings.services
for takeoff"). Every function acts in the tenant the step acts in and checks the file's Project scope
itself; a refusal is an `auth.Refused` with a `drawings.reads.*` code, and keeps nothing.

    store = drawings.services.step_store()        # 09's StepStore over ReadStep
    steps = run.steps(store, subject_id=file_id, total=6)
    with drawings.services.original(file_id) as path:   # a private, checked copy of the upload
        artefact = engine.read.read(path, source_name=…)
    drawings.services.store_artefact(file_id, artefact)
    drawings.services.record_reports(file_id, cross_check=…, font_report=…, bangla_ansi=…)
    drawings.services.quarantine(file_id, finding)    # held: the two readers disagree
    drawings.services.mark_read(file_id, cut)         # in the last step's own transaction

- **The StepStore** keeps a step once, keyed by (tenant, file, step, input hash), and never changes or
  deletes it (vextrus_app may only insert); its progress writes the file's step and counts while the
  file is waiting or reading, and nothing once it is cancelled.
- **The artefact** is kept as a file, the JSON `ReadArtefact.to_json` gives written with sorted keys and
  no spaces, under a key naming its reader, reader version and artefact version (the one its own JSON
  names), so a retry writes the same bytes and another version keeps its own copy; whatever the
  version, it is loaded back by `ReadArtefact.from_json`. An entity's values may hold NaN (the reader
  keeps what the file holds), so it is never re-dumped with NaN refused and never kept in a jsonb
  column, which refuses NaN. Its source must be the file (its sha256).
- **A file's end** is written under the file's row lock and only while it is waiting or reading: a
  file cancelled meanwhile stays cancelled (the step then rolls back, since its job is cancelled).
  `mark_read` belongs in the last step's transaction; it is given every limit that cut the reading
  ("not read in full", each once, in the job's order): the first is the file's finding. The step
  that marks a DWG read (`FINISHING`) keeps them all in its result's `not_read_in_full`, and the
  report's sheets section says each from there. A file read in full has no finding and no limit.
  A file that could not be read ends failed with its finding (`mark_failed`); for "Try again" to
  read it again the job must end failed too (a succeeded job is never restarted: 09's `restart`).
"""

import json
import re
import uuid
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from django.db import transaction
from django.utils import timezone

from engine.check.bangla_ansi import BanglaAnsi
from engine.messages import Message
from engine.read.artefact import ReadArtefact
from engine.read.pdf.types import PdfReport
from engine.recognise.types import CheckResult
from engine.render.fonts import FontReport
from vextrus.drawings.messages import files as file_words
from vextrus.drawings.messages import reads as refusal
from vextrus.drawings.models import (
    Artefact,
    DrawingFile,
    DrawingSetState,
    FileFormat,
    HeldAnswer,
    ReadStatus,
    ReadStep,
)
from vextrus.drawings.services import _access, _text, drawing_files
from vextrus.platform.services import auth, jobs, storage

_UNIT_STEP = re.compile(r"(?:sheet|page)_([1-9][0-9]{0,5})")
_IN_FLIGHT = (ReadStatus.QUEUED, ReadStatus.READING)
ARTEFACT_MEDIA_TYPE = "application/json"
_READER_LENGTH = 64
"""A reader's name or version as a kept artefact and its StoredFile hold it (64 characters each)."""


# The StepStore -------------------------------------------------------------------------------------


class ReadStepStore:
    """09's `StepStore` over ReadStep. `clock` is when a step starts (the seed's demo reads pass one
    that runs in the past, so a read seeded as going on has a rate to show)."""

    def __init__(self, clock: Any = timezone.now) -> None:
        self._clock = clock

    def completed(self, key: jobs.StepKey) -> jobs.StepResult | None:
        _access.drawing_file(key.subject_id)
        found = (
            ReadStep.objects.filter(file_id=key.subject_id, step=key.step, input_hash=key.input_hash)
            .values_list("result", flat=True)
            .first()
        )
        return None if found is None else dict(found)

    def record(self, key: jobs.StepKey, result: jobs.StepResult) -> None:
        row = _access.drawing_file(key.subject_id)
        ReadStep.objects.create(
            tenant_id=row.tenant_id,
            file=row,
            step=key.step,
            input_hash=key.input_hash,
            result=result,
        )

    def progress(self, subject_id: uuid.UUID, progress: jobs.Progress) -> None:
        now: datetime = self._clock()
        row = _access.drawing_file(subject_id, lock=True)
        if drawing_files.reading_anyway(row):
            # A held file read anyway, read again: its step shown (it stays held), never its sheets
            # counted done, which would list them before their Questions (#165).
            row.read_step = progress.step or ""
            row.progress_at = now
            row.save(update_fields=["read_step", "progress_at"])
            return
        if row.read_status not in _IN_FLIGHT:
            return
        step = progress.step or ""
        row.read_status = ReadStatus.READING
        row.read_step = step
        row.progress_at = now
        unit = _UNIT_STEP.fullmatch(step)
        if unit is not None:
            row.sheets_done = int(unit[1]) - 1
            if row.sheets_started_at is None:
                row.sheets_started_at = now
        row.save(
            update_fields=[
                "read_status",
                "read_step",
                "progress_at",
                "sheets_done",
                "sheets_started_at",
            ]
        )


def step_store() -> jobs.StepStore:
    """The ReadStep StepStore a read job runs its steps on (`run.steps(step_store(), file_id, …)`)."""
    return ReadStepStore()


# The upload and its artefact ------------------------------------------------------------------------


@contextmanager
def original(file_id: uuid.UUID) -> Iterator[Path]:
    """A private copy of the file as uploaded, checked against its sha256, removed on leaving (for a
    reader that takes a path). Raises storage's `FileMissing` or `FileChanged` when Vextrus's copy is
    gone or damaged (adding the file again replaces it)."""
    row = _access.drawing_file(file_id)
    key = storage.key(row.drawing_set.project_id, "drawings", row.sha256, f"original.{row.format}")
    with storage.local_copy(key) as path:
        yield path


@dataclass(frozen=True)
class ArtefactRef:
    file_id: uuid.UUID
    reader: str
    reader_version: str
    schema_version: int
    key: str


def store_artefact(file_id: uuid.UUID, artefact: ReadArtefact) -> ArtefactRef:
    """Keep a DWG's ReadArtefact (see the module); the same artefact again changes nothing."""
    row = _access.drawing_file(file_id)
    if row.format != FileFormat.DWG:
        raise auth.Refused(refusal.WRONG_KIND(file=row.original_name), status=400)
    summary = artefact.summary
    if summary.source_sha256 != row.sha256:
        raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
    # The reader's name and version are kept as they are (the anchors carry them), never cleaned.
    for said_by in (summary.reader, summary.reader_version):
        if not said_by or _text.read(said_by) != said_by or len(said_by) > _READER_LENGTH:
            raise auth.Refused(refusal.BAD_READER(file=row.original_name), status=400)
    data = artefact.to_json()
    schema_version = int(data["version"])
    content = artefact_bytes(data)
    project_id = row.drawing_set.project_id
    name = (
        f"artefact@{_access.key_name(summary.reader)}@{_access.key_name(summary.reader_version)}"
        f"@v{schema_version}.json"
    )
    key = storage.key(project_id, "drawings", row.sha256, name)
    with transaction.atomic():
        try:
            stored = storage.put(
                key,
                content,
                kind="derived",
                media_type=ARTEFACT_MEDIA_TYPE,
                producer=summary.reader,
                producer_version=summary.reader_version,
                source_sha256=row.sha256,
            )
        except storage.KeyTaken:
            raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=409) from None
        Artefact.objects.get_or_create(
            tenant_id=row.tenant_id,
            file=row,
            reader=summary.reader,
            reader_version=summary.reader_version,
            schema_version=schema_version,
            defaults={"stored_file_id": stored.id, "insunits": summary.insunits},
        )
        DrawingSetState.objects.filter(
            id=row.drawing_set.current_state_id or uuid.UUID(int=0), reader=""
        ).update(reader=summary.reader[:64], reader_version=summary.reader_version[:64])
    return ArtefactRef(row.id, summary.reader, summary.reader_version, schema_version, key)


def canonical(data: Any) -> bytes:
    """JSON as one text only: sorted keys, no spaces, no NaN (a key or a jsonb value)."""
    return json.dumps(
        data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    ).encode()


def artefact_bytes(data: Any) -> bytes:
    """An artefact's JSON as one text only (sorted keys, no spaces), its NaN kept as JSON's `NaN`
    token and every character past ASCII as a `\\u` escape, which `json.loads` reads back as it was
    (an entity's values are the file's, whatever they hold: a lone surrogate too, which the
    LibreDWG DXF path keeps from bytes it could not decode)."""
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode()


def artefact(file_id: uuid.UUID, reader_version: str | None = None) -> ReadArtefact:
    """The file's kept ReadArtefact: of `reader_version` when given, else the latest kept."""
    row = _access.drawing_file(file_id)
    found = _artefact_row(row, reader_version=reader_version)
    if found is None:
        raise auth.NotFound
    return _load(row, found)


def _artefact_row(
    row: DrawingFile, *, reader: str | None = None, reader_version: str | None = None
) -> Artefact | None:
    rows = Artefact.objects.filter(file=row)
    if reader is not None:
        rows = rows.filter(reader=reader)
    if reader_version is not None:
        rows = rows.filter(reader_version=reader_version)
    return rows.order_by("-created_at", "-schema_version", "-id").first()


def _load(row: DrawingFile, found: Artefact) -> ReadArtefact:
    name = (
        f"artefact@{_access.key_name(found.reader)}@{_access.key_name(found.reader_version)}"
        f"@v{found.schema_version}.json"
    )
    key = storage.key(row.drawing_set.project_id, "drawings", row.sha256, name)
    return ReadArtefact.from_json(json.loads(storage.get(key)))


# Reports and ends ------------------------------------------------------------------------------------


def record_reports(
    file_id: uuid.UUID,
    *,
    cross_check: CheckResult | None = None,
    upload_report: PdfReport | None = None,
    font_report: FontReport | None = None,
    bangla_ansi: BanglaAnsi | None = None,
) -> drawing_files.FileView:
    """Keep a file's reports as codes and parameters: a DWG's second-reader check, fonts and
    Bangla-ANSI Check; a PDF's upload report (whose pages count its pages). A PDF the report refuses
    (a scan) is refused, with its reason as the finding."""
    with transaction.atomic():
        row = _access.drawing_file(file_id, lock=True)
        pdf = row.format == FileFormat.PDF
        if (upload_report is not None) != pdf or (pdf and (cross_check or font_report or bangla_ansi)):
            raise auth.Refused(refusal.WRONG_KIND(file=row.original_name), status=400)
        fields = []
        if upload_report is not None:
            if upload_report.source_sha256 != row.sha256:
                raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
            row.upload_report = _text.read_json(upload_report.to_json())
            row.sheets_total = len(upload_report.pages)
            fields += ["upload_report", "sheets_total"]
            if upload_report.refused is not None and row.read_status in _IN_FLIGHT:
                row.read_status = ReadStatus.REFUSED
                row.finding = _text.read_json(dict(upload_report.refused))
                fields += ["read_status", "finding"]
        if cross_check is not None:
            row.cross_check = _text.read_json(
                {
                    "code": cross_check.code,
                    "outcome": str(cross_check.outcome),
                    "finding": cross_check.finding,
                }
            )
            fields.append("cross_check")
        if font_report is not None:
            row.font_report = _text.read_json(font_report.to_json())
            fields.append("font_report")
        if bangla_ansi is not None:
            row.bangla_ansi = _text.read_json(bangla_ansi.to_json())
            fields.append("bangla_ansi")
        row.save(update_fields=fields)
    return drawing_files.file(row.id)


def record_bangla_lines(file_id: uuid.UUID, lines: Sequence[Message]) -> None:
    """The Bangla-ANSI Check's lines for the report, once its texts' sheets are known (21b:
    `BanglaAnsi.findings(sheet_of)`)."""
    row = _access.drawing_file(file_id)
    kept = [_text.read_json(dict(line)) for line in lines]
    DrawingFile.objects.filter(id=row.id).update(bangla_lines=kept)


def record_page_reasons(file_id: uuid.UUID, lines: Sequence[Message]) -> None:
    """A PDF's report lines on the pages that matched no sheet (21b; 4.5's "Page 12 shows sheet S-13,
    which is not in any DWG added so far.")."""
    row = _access.drawing_file(file_id)
    if row.format != FileFormat.PDF:
        raise auth.Refused(refusal.WRONG_KIND(file=row.original_name), status=400)
    kept = [_text.read_json(dict(line)) for line in lines]
    DrawingFile.objects.filter(id=row.id).update(unmatched_pages=kept)


def attach_read_job(file_id: uuid.UUID, job_id: int) -> None:
    """Name the file's read job (21a defers it in the upload's transaction): cancel and restart act
    on this job, never on one a client names. It must be the acting tenant's job."""
    row = _access.drawing_file(file_id, lock=True)
    if type(job_id) is not int or jobs.state(job_id) is None:
        raise auth.NotFound
    DrawingFile.objects.filter(id=row.id).update(read_job_id=job_id)


def mark_read(file_id: uuid.UUID, cut: Sequence[Message] = ()) -> drawing_files.FileView:
    """The file is read (in the last step's transaction). A file cancelled meanwhile stays so.
    `cut`: every limit that cut its reading, in the job's order (see the module)."""
    return _end(file_id, ReadStatus.READ, cut[0] if cut else None)


def quarantine(file_id: uuid.UUID, finding: Message) -> drawing_files.FileView:
    """Hold the file with its finding: its two readers disagree (ADR 0029). 21c raises its Question."""
    return _end(file_id, ReadStatus.QUARANTINED, finding)


def mark_failed(file_id: uuid.UUID, finding: Message, *, tries: int = 1) -> drawing_files.FileView:
    """The file could not be read, with why: read by one reader only (engine.decoders_agree's
    `not_installed` and the like), or saved by an AutoCAD too old (`drawings.files.old_version`).
    `tries`: how many times its reading was tried (the read job's attempt), shown "after N tries"."""
    return _end(file_id, ReadStatus.FAILED, finding, tries=max(1, tries))


def answer_held(file_id: uuid.UUID, answer: HeldAnswer | str) -> drawing_files.FileView:
    """What the QS decided about a held file (21c, answering its Question): read anyway (its sheets
    are used, marked) or set aside."""
    try:
        chosen = HeldAnswer(answer)
    except ValueError:
        raise auth.NotFound from None
    with transaction.atomic():
        row = _access.drawing_file(file_id, lock=True)
        if row.read_status != ReadStatus.QUARANTINED:
            raise auth.NotFound
        row.held_answer = chosen
        row.save(update_fields=["held_answer"])
    return drawing_files.file(row.id)


def _refused_choice(finding: object) -> bool:
    return isinstance(finding, dict) and finding.get("code") == file_words.DISCIPLINE_CHOICE_UNDONE.code


def _end(
    file_id: uuid.UUID, status: ReadStatus, finding: Message | None, *, tries: int = 0
) -> drawing_files.FileView:
    with transaction.atomic():
        row = _access.drawing_file(file_id, lock=True)
        if row.read_status in _IN_FLIGHT:
            row.read_status = status
            row.read_step = ""
            # A read file keeps a Discipline choice refused while it read (`sheet_list`, #159) as its
            # finding, ahead of a limit that cut its reading: the limit is said in the report's Sheets
            # section too (`reports._not_read_in_full`, from the finishing step's result).
            if not (status == ReadStatus.READ and _refused_choice(row.finding)):
                row.finding = None if finding is None else _text.read_json(dict(finding))
            row.read_tries = tries
            if status == ReadStatus.READ and row.sheets_total is not None:
                row.sheets_done = row.sheets_total
            row.save(update_fields=["read_status", "read_step", "finding", "read_tries", "sheets_done"])
        elif status == ReadStatus.FAILED and drawing_files.reading_anyway(row):
            # A held file read anyway whose reading again failed for good: it stays held, its
            # reason kept as its finding (a memory limit is said as such, never only "after 1 try";
            # #165). The readers' disagreement stays in its cross-check; restart puts it back.
            row.finding = _text.read_json(dict(finding)) if finding is not None else row.finding
            row.read_tries = max(1, tries)
            row.save(update_fields=["finding", "read_tries"])
        elif status == ReadStatus.READ and row.held_answer == HeldAnswer.READ_ANYWAY:
            # A held file read anyway stays held; its sheets counted done list them from here, in
            # the last step's transaction with their Questions (`drawing_files.read_anyway`, #165).
            if row.read_status == ReadStatus.QUARANTINED and row.sheets_total is not None:
                row.sheets_done = row.sheets_total
                row.read_step = ""
                row.save(update_fields=["sheets_done", "read_step"])
    return drawing_files.file(row.id)
