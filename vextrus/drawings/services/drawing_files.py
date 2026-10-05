"""Drawing Sets and their files (ticket 14; docs/data-model.md §3.2; docs/design/m0-screens.md 4.5).

    added = drawings.services.add_file(project_id, name=upload.name, content=upload, actor_name=…)
    added.outcome          # "added", "already_here" or "replaced"; added.message: the toast's words
    drawings.services.files(set_id)          # each with its status in 4.5's words
    drawings.services.cancel(file_id, actor_name=…)   # the file's own read job, never a client's
    drawings.services.restart(file_id)                # only a failed or cancelled reading, once

**Adding a file** (`add_file`): a file is known by its contents. Its first bytes say what it is (a
DWG, a PDF, a zip), never its name or the type the browser gave; anything else is refused (an empty
file in words of its own), and so is a file over the limit (`VEXTRUS_UPLOAD_MAX_BYTES`); a refusal keeps
nothing, no row, no StoredFile and no file. Its name is the QS's label for it and nothing more: path
pieces, control and direction characters are taken out and it is never a path or a storage key (the
original's key names the contents' sha256). The same contents added to the set again add nothing
("already here", when and by whom), unless Vextrus's copy of them is missing or damaged: then the new
copy replaces it, and a reading that stopped is started again. A file with the same name and other
contents is added beside it. Two adds of one file at once wait for each other: one row.

**Its Discipline** comes from its name (`services.library_disciplines.from_name`), else from its sheets'
numbers when they are read (`record_sheets`), and the QS may change it; the QS's choice is never
overwritten. A file of a Discipline the set does not yet hold is that Discipline's first issue, never a
Revision of another, and touches no other Discipline's rows (the plan's review Q6). Changing it after
its sheets are read moves them with it, unless one is confirmed or left out in Step 1, or the chosen
Discipline already has a sheet of that number: then nothing changes (409).

**Its status** is 4.5's row, as `drawings.files.*` codes: the file's own columns, and its read job's
state over them while it has one (`jobs.state`), so a job that crashed reads "Could not be read" though
it never wrote so. "Waiting (2 files ahead)" counts the Developer's own files only.

**Cancel and restart** act on the file's own read job, under its row lock: a second cancel writes
nothing, and a cancel that lost the race to the last step (which marks the file read in its own
transaction) leaves the file read; only a failed or cancelled reading is started again, once however
many clicks. Until the read job exists (21a) a file waits with none, and cancelling it marks it
cancelled.
"""

import hashlib
import math
import re
import unicodedata
import uuid
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from pathlib import PurePosixPath
from typing import Any, BinaryIO, cast

from django.conf import settings
from django.core.files import File as DjangoFile
from django.db import transaction
from django.db.models import Exists, F, Max, OuterRef, Q
from django.utils import timezone

from engine.messages import Message, MessageCode
from vextrus.drawings.messages import files as said
from vextrus.drawings.messages import uploads as toasts
from vextrus.drawings.models import (
    Discipline,
    DisciplineSource,
    DrawingFile,
    DrawingSet,
    DrawingSetState,
    FileFormat,
    HeldAnswer,
    ReadStatus,
    Revision,
    RevisionKind,
    Sheet,
    SheetRevision,
    StateCause,
    StateStatus,
)
from vextrus.drawings.services import _access, library_disciplines
from vextrus.platform.services import auth, events, jobs, storage, tenancy
from vextrus.projects import services as projects

_CHUNK = 1 << 20
_HEAD = 512
_NAME_LIMIT = 255
_DWG = re.compile(rb"AC[0-9.]{4}")
_OFFICE_ENTRIES = (b"[Content_Types].xml", b"mimetype")
"""A zip whose first entry is one of these is an office document, not a zip of drawings."""
_STEP_UNIT = re.compile(r"(sheet|page)_([1-9][0-9]{0,5})")
_SITE_GROUP = "site"
_MEDIA_TYPES = {FileFormat.DWG: "image/vnd.dwg", FileFormat.PDF: "application/pdf"}

# The read job's step names these words know (21a, 21b name their steps from these) ------------------

OPENING = "opening"
READING = "reading"
SECOND_READER = "second_reader"
SHEETS = "sheets"
FINISHING = "finishing"
MATCHING = "matching"


def read_anyway(prefix: str = "") -> Q:
    """A held file read anyway whose read has ended: only then are its sheets listed, in the
    transaction that proposes them and asks their Questions (its `finishing` step, whose `mark_read`
    counts its sheets done), as a read file's are. Listed from the answer on, the real set's 28
    sheets showed for the whole 40 s re-read with no Question asked (#165). `prefix` reaches the
    file from the rows filtered."""
    return Q(
        **{
            f"{prefix}read_status": ReadStatus.QUARANTINED,
            f"{prefix}held_answer": HeldAnswer.READ_ANYWAY,
            f"{prefix}sheets_total__isnull": False,
            f"{prefix}sheets_done": F(f"{prefix}sheets_total"),
        }
    )


def reading_anyway(row: DrawingFile) -> bool:
    """A held file read anyway whose read has not ended (its job queued, reading or failed)."""
    return (
        row.read_status == ReadStatus.QUARANTINED
        and row.held_answer == HeldAnswer.READ_ANYWAY
        and not read_anyway_ended(row)
    )


def read_anyway_ended(row: DrawingFile) -> bool:
    """`read_anyway`, of one file (its report's sheets say what the sheet list lists)."""
    return (
        row.read_status == ReadStatus.QUARANTINED
        and row.held_answer == HeldAnswer.READ_ANYWAY
        and row.sheets_total is not None
        and row.sheets_done == row.sheets_total
    )


VEXTRUS_ENGINEER = "vextrus_engineer"
"""The Vextrus Engineer's role as a Membership holds it (platform's `Role`; its models are its own)."""


def sheet_step(position: int) -> str:
    """The step reading a DWG's sheet `position` of its `sheets_total` ("Reading sheet 12 of 38")."""
    return f"sheet_{position}"


def page_step(position: int) -> str:
    """The step reading a PDF's page `position` of its pages ("Reading page 12 of 57")."""
    return f"page_{position}"


class FileState(StrEnum):
    """Which of 4.5's rows a file is on, for the actions the web offers beside its words."""

    WAITING = "waiting"
    READING = "reading"
    STOPPING = "stopping"
    RETRYING = "retrying"
    CANCELLED = "cancelled"
    FAILED = "failed"
    UNREADABLE = "unreadable"
    """Saved by an AutoCAD too old to read: nothing to try again."""
    READ = "read"
    HELD = "held"
    REFUSED = "refused"


type Content = BinaryIO | DjangoFile[Any]
"""What a file is added from: a binary file (Django's uploaded file among them), readable
and seekable."""

IN_PROGRESS = frozenset({FileState.WAITING, FileState.READING, FileState.STOPPING, FileState.RETRYING})


@dataclass(frozen=True)
class SetView:
    id: uuid.UUID
    project_id: uuid.UUID
    name: str


@dataclass(frozen=True)
class FileView:
    id: uuid.UUID
    set_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    """The QS's label for it: never a path."""
    format: str
    size: int
    sha256: str
    discipline: str | None
    """Its Discipline's key, or None."""
    discipline_source: str | None
    building_id: uuid.UUID | None
    group: str
    """The group its sheets are stamped with (its Building's id; "site" for the Site's)."""
    added_at: datetime
    added_by_name: str
    added_by_vextrus: bool
    """Added by a Vextrus Engineer: shown with "(Vextrus)" after the name (m0-screens 1.4)."""
    state: FileState
    status: Message
    finding: Message | None
    sheets_found: int | None
    """Its printed sheets, once it is read (a DWG); None otherwise."""
    plot_for: tuple[uuid.UUID, ...]
    """For a PDF: the DWGs whose sheets its pages matched (4.5 shows it under them)."""
    read_job_id: int | None
    marked_for_vextrus: bool = False
    """A file that could not be read, marked for Vextrus to look at ("Mark for Vextrus")."""


@dataclass(frozen=True)
class Added:
    file: FileView
    outcome: str
    """`added`, `already_here` (nothing was added: `file` is the one already there) or `replaced`
    (Vextrus's missing or damaged copy was replaced)."""
    message: Message | None
    """The toast's words, when 4.5 has any."""


# Reading ------------------------------------------------------------------------------------------


def set_of(project_id: uuid.UUID) -> SetView | None:
    """The Project's Drawing Set, or None before its first file."""
    _access.in_scope(project_id)
    found = DrawingSet.objects.filter(tenant_id=_access.tenant_id(), project_id=project_id).first()
    return None if found is None else SetView(found.id, found.project_id, found.name)


def files(set_id: uuid.UUID) -> list[FileView]:
    """The set's files, in the order they were added, each with its status."""
    drawing_set = _access.drawing_set(set_id)
    rows = list(
        DrawingFile.objects.select_related("drawing_set", "discipline")
        .filter(drawing_set=drawing_set)
        .order_by("added_at", "id")
    )
    return _views(rows)


def file(file_id: uuid.UUID) -> FileView:
    return _views([_access.drawing_file(file_id)])[0]


def summary(views: Iterable[FileView]) -> Message:
    """The page's one-line summary ("7 files: 21 sheets read, 1 file reading, 1 held, 1 refused")."""
    shown = list(views)
    states = Counter(view.state for view in shown)
    return said.SUMMARY(
        files=len(shown),
        sheets=sum(view.sheets_found or 0 for view in shown),
        reading=states[FileState.READING],
        failed=states[FileState.FAILED] + states[FileState.UNREADABLE],
        held=states[FileState.HELD],
        refused=states[FileState.REFUSED],
    )


def group_of(row: DrawingFile) -> str:
    return _SITE_GROUP if row.building_id is None else str(row.building_id)


def _views(rows: list[DrawingFile]) -> list[FileView]:
    ids = [row.id for row in rows]
    marked = _marked(rows)
    found = dict(
        Counter(
            SheetRevision.objects.filter(source_file_id__in=ids).values_list("source_file_id", flat=True)
        )
    )
    plotted = SheetRevision.objects.filter(plot_file_id__in=ids, plot_page__isnull=False)
    matched_pages: dict[uuid.UUID, set[int]] = {}
    plot_for: dict[uuid.UUID, list[uuid.UUID]] = {}
    for pdf_id, page, dwg_id in plotted.order_by("source_file__added_at").values_list(
        "plot_file_id", "plot_page", "source_file_id"
    ):
        assert pdf_id is not None
        assert page is not None
        matched_pages.setdefault(pdf_id, set()).add(page)
        if dwg_id not in plot_for.setdefault(pdf_id, []):
            plot_for[pdf_id].append(dwg_id)
    now = timezone.now()
    read_dwgs = _read_dwgs({row.drawing_set_id for row in rows if row.format == FileFormat.PDF})
    shown = []
    for row in rows:
        job = jobs.state(row.read_job_id) if row.read_job_id is not None else None
        dwg_read = _dwg_read(row, read_dwgs)
        state, status = _status(row, job, now, len(matched_pages.get(row.id, ())), dwg_read)
        readable = state == FileState.READ or read_anyway_ended(row)
        shown.append(
            FileView(
                id=row.id,
                set_id=row.drawing_set_id,
                project_id=row.drawing_set.project_id,
                name=row.original_name,
                format=row.format,
                size=row.size,
                sha256=row.sha256,
                discipline=row.discipline.key if row.discipline else None,
                discipline_source=row.discipline_source or None,
                building_id=row.building_id,
                group=group_of(row),
                added_at=row.added_at,
                added_by_name=row.added_by_name,
                added_by_vextrus=row.added_by_vextrus,
                state=state,
                status=status,
                finding=row.finding,
                sheets_found=found.get(row.id, 0) if readable and row.format == FileFormat.DWG else None,
                plot_for=tuple(plot_for.get(row.id, ())),
                read_job_id=row.read_job_id,
                marked_for_vextrus=row.id in marked,
            )
        )
    return shown


def _read_dwgs(set_ids: set[uuid.UUID]) -> set[tuple[uuid.UUID, uuid.UUID | None]]:
    """(set, Discipline) of each DWG read in these sets: a held file read anyway among them once its
    read has ended with sheets to match (with none, its PDFs still wait for a DWG, #131)."""
    if not set_ids:
        return set()
    with_sheets = SheetRevision.objects.filter(source_file_id=OuterRef("pk"))
    listed = Q(read_status=ReadStatus.READ) | (Q(Exists(with_sheets)) & read_anyway())
    return set(
        DrawingFile.objects.filter(
            listed, drawing_set_id__in=set_ids, format=FileFormat.DWG
        ).values_list("drawing_set_id", "discipline_id")
    )


def _dwg_read(row: DrawingFile, read_dwgs: set[tuple[uuid.UUID, uuid.UUID | None]]) -> bool:
    """Whether a DWG a PDF may plot is read: one of its Discipline, or, with none, any of its set."""
    if row.discipline_id is None:
        return any(set_id == row.drawing_set_id for set_id, _ in read_dwgs)
    return (row.drawing_set_id, row.discipline_id) in read_dwgs


def dwg_read_for(row: DrawingFile) -> bool:
    return _dwg_read(row, _read_dwgs({row.drawing_set_id}))


def dwg_added_for(row: DrawingFile) -> bool:
    """Whether a DWG a PDF may plot has been added at all, whatever its reading: one of its
    Discipline, or, with none, any of its set."""
    dwgs = DrawingFile.objects.filter(drawing_set_id=row.drawing_set_id, format=FileFormat.DWG)
    if row.discipline_id is not None:
        dwgs = dwgs.filter(discipline_id=row.discipline_id)
    return dwgs.exists()


def _status(
    row: DrawingFile,
    job: jobs.JobState | None,
    now: datetime,
    pages_matched: int,
    dwg_read: bool = False,
) -> tuple[FileState, Message]:
    """4.5's row: the file's columns, with its job's state over them while it is in flight."""
    status = row.read_status
    if status == ReadStatus.REFUSED:
        return FileState.REFUSED, said.REFUSED_SCAN()
    if status == ReadStatus.QUARANTINED:
        answer = HeldAnswer(row.held_answer) if row.held_answer else None
        reading = job is not None and job.status != "done" and not read_anyway_ended(row)
        if answer == HeldAnswer.READ_ANYWAY and reading:
            # Read anyway, its job still reading it again (or failed at it): shown as any read is,
            # so the row says what is happening and the list refreshes until its sheets join (#165).
            assert job is not None
            return _in_flight(row, job, now)
        return FileState.HELD, _HELD[answer]()
    if status == ReadStatus.READ:
        return FileState.READ, _read(row, pages_matched, dwg_read)
    if status == ReadStatus.FAILED:
        if unreadable(row):
            return FileState.UNREADABLE, said.OLD_VERSION()
        tries = job.attempt if job is not None and job.status == "failed" else row.read_tries
        return FileState.FAILED, said.FAILED(tries=max(tries, 1))
    if status == ReadStatus.CANCELLED:
        if job is not None and job.status == "stopping":
            return FileState.STOPPING, said.STOPPING()
        return FileState.CANCELLED, _cancelled(row)
    if job is not None:
        return _in_flight(row, job, now)
    if status == ReadStatus.QUEUED:
        return FileState.WAITING, said.WAITING(ahead=_ahead(row))
    return FileState.READING, _step(row, now)


def _in_flight(row: DrawingFile, job: jobs.JobState, now: datetime) -> tuple[FileState, Message]:
    """A file's row while its job is queued, running or ended, by the job's state."""
    match job.status:
        case "waiting":
            return FileState.WAITING, said.WAITING(ahead=_ahead(row))
        case "retrying":
            return FileState.RETRYING, said.RETRYING(attempt=job.attempt, tries=job.tries)
        case "stopping":
            return FileState.STOPPING, said.STOPPING()
        case "cancelled":
            return FileState.CANCELLED, _cancelled(row)
        case "failed":
            return FileState.FAILED, said.FAILED(tries=max(job.attempt, 1))
        case "done":  # its last step committed; its row ends in a moment
            pdf = row.format == FileFormat.PDF
            return FileState.READING, said.MATCHING_PAGES() if pdf else said.FINISHING()
    return FileState.READING, _step(row, now)


_HELD = {
    None: said.HELD,
    HeldAnswer.READ_ANYWAY: said.HELD_READ_ANYWAY,
    HeldAnswer.AWAIT_RESAVED: said.AWAIT_RESAVED,
    HeldAnswer.SENT_TO_VEXTRUS: said.SENT_TO_VEXTRUS,
}


def unreadable(row: DrawingFile) -> bool:
    """Saved by an AutoCAD too old to read: nothing to try again."""
    finding = row.finding
    return isinstance(finding, dict) and finding.get("code") == said.OLD_VERSION.code


def _read(row: DrawingFile, pages_matched: int, dwg_read: bool) -> Message:
    if row.format == FileFormat.PDF:
        pages = row.sheets_total or 0
        if pages_matched == 0 and not dwg_read:
            return said.PLOT_WAITING()
        report = row.upload_report or {}
        lines = any(page.get("lettering") == "lines" for page in report.get("pages", ()))
        code = said.PLOT_MATCHED_LINES if lines else said.PLOT_MATCHED
        return code(matched=pages_matched, pages=max(pages, pages_matched))
    counts = (row.bangla_ansi or {}).get("counts", {})
    return said.READ_BANGLA() if counts.get("texts", 0) else said.READ()


def _cancelled(row: DrawingFile) -> Message:
    if row.cancelled_by_name and row.cancelled_at is not None:
        return said.CANCELLED(
            actor=row.cancelled_by_name,
            vextrus=yes_no(row.cancelled_by_vextrus),
            cancelled_date=row.cancelled_at.isoformat(),
        )
    return said.CANCELLED_UNNAMED()


def _step(row: DrawingFile, now: datetime) -> Message:
    """The step's words: 4.5's "Reading a DWG" and "Reading a PDF" rows; an empty or unknown step
    reads "Reading the drawing" for a DWG, "Opening the PDF" for a PDF."""
    pdf = row.format == FileFormat.PDF
    step = row.read_step
    unit = _STEP_UNIT.fullmatch(step)
    total = row.sheets_total or 0
    if unit is not None and (unit[1] == "page") == pdf and 0 < int(unit[2]) <= total:
        position = int(unit[2])
        minutes = _minutes_left(row, now, total)
        if minutes is not None:
            left = said.READING_PAGE_LEFT if pdf else said.READING_SHEET_LEFT
            return left(position=position, total=total, minutes=minutes)
        return (said.READING_PAGE if pdf else said.READING_SHEET)(position=position, total=total)
    if step == OPENING:
        return said.OPENING_PDF() if pdf else said.OPENING_FILE()
    if pdf and step == MATCHING:
        return said.MATCHING_PAGES()
    if not pdf and step in _DWG_STEPS:
        return _DWG_STEPS[step]()
    return said.OPENING_PDF() if pdf else said.READING_DRAWING()


_DWG_STEPS = {
    READING: said.READING_DRAWING,
    SECOND_READER: said.SECOND_READER,
    SHEETS: said.FINDING_SHEETS,
    FINISHING: said.FINISHING,
}


STEADY = 3
"""A read whose current sheet has taken this many times its sheets' mean so far is not steady."""


def _minutes_left(row: DrawingFile, now: datetime, total: int) -> int | None:
    """Once 3 sheets (or pages) are read and the rate is steady: the minutes left at the rate so far,
    rounded up. The rate is the mean time of the sheets read; it is steady while the sheet reading
    now has taken at most `STEADY` times that (a stalled read shows no time left)."""
    done = row.sheets_done
    if done < 3 or done >= total or row.sheets_started_at is None or row.progress_at is None:
        return None
    per_sheet = (row.progress_at - row.sheets_started_at).total_seconds() / done
    current = (now - row.progress_at).total_seconds()
    if per_sheet <= 0 or current > STEADY * per_sheet:
        return None
    left = per_sheet * (total - done) - current
    return max(1, math.ceil(left / 60))


def _ahead(row: DrawingFile) -> int:
    """How many of the Developer's own files are read before this one (never another's)."""
    active = DrawingFile.objects.filter(read_status__in=(ReadStatus.QUEUED, ReadStatus.READING)).exclude(
        id=row.id
    )
    membership = tenancy.current_membership()
    if membership is not None and membership.project_ids:
        active = active.filter(drawing_set__project_id__in=membership.project_ids)
    if row.read_job_id is None:
        earlier = Q(added_at__lt=row.added_at) | Q(added_at=row.added_at, id__lt=row.id)
        return active.filter(earlier, read_job_id__isnull=True).count()
    ahead = 0
    for job_id in active.filter(read_job_id__lt=row.read_job_id).values_list("read_job_id", flat=True):
        found = jobs.state(job_id) if job_id is not None else None
        if found is not None and found.status in ("waiting", "running", "retrying", "stopping"):
            ahead += 1
    return ahead


# Adding a file ------------------------------------------------------------------------------------


def add_file(project_id: uuid.UUID, *, name: str, content: Content, actor_name: str = "") -> Added:
    """Add one file to the Project's Drawing Set (made with its first file), inside the caller's
    transaction. `content` is readable and seekable (Django's uploaded file is); `actor_name` the
    acting person's name, shown as who added it. Refused as `auth.Refused`, keeping nothing."""
    _access.in_scope(project_id)
    tenant_id = _access.tenant_id()
    label = clean_name(name)
    if not label:
        raise auth.Refused(toasts.NO_NAME(), status=400)
    sha256, size, head = _measure(content, label)
    if size == 0:
        raise auth.Refused(toasts.EMPTY(file=label), status=400)
    kind = _kind(head, label)
    with transaction.atomic():
        drawing_set = _set_for(tenant_id, project_id)
        _access.lock("file", drawing_set.id, sha256)
        existing = (
            DrawingFile.objects.select_related("drawing_set", "discipline")
            .filter(drawing_set=drawing_set, sha256=sha256)
            .first()
        )
        key = _original_key(project_id, sha256, kind)
        if existing is not None:
            return _again(existing, key, content, label)
        stored = storage.put(
            key,
            cast(BinaryIO, content),
            kind="original",
            media_type=_MEDIA_TYPES[kind],
            producer="upload",
        )
        market = library_disciplines.market()
        discipline = library_disciplines.from_name(label, market)
        buildings = projects.buildings(project_id)
        building_id = buildings[0].id if len(buildings) == 1 else None
        acting = tenancy.current()
        row = DrawingFile.objects.create(
            tenant_id=tenant_id,
            drawing_set=drawing_set,
            revision=_first_issue(drawing_set, discipline, acting.user_id) if discipline else None,
            sha256=sha256,
            format=kind,
            original_name=label,
            size=size,
            stored_file_id=stored.id,
            discipline=discipline,
            discipline_source=DisciplineSource.FILE_NAME if discipline else "",
            building_id=building_id,
            added_by=acting.user_id,
            added_by_name=actor_name[:200],
            added_by_vextrus=is_vextrus(),
        )
        _record(said.ADDED, row)
        same_name = (
            DrawingFile.objects.filter(drawing_set=drawing_set, original_name__iexact=label)
            .exclude(id=row.id)
            .exists()
        )
    return Added(file(row.id), "added", toasts.SAME_NAME_KEPT() if same_name else None)


def clean_name(name: str) -> str:
    """A file's name as its label: the last part of any path, without control, format (direction)
    or unassigned characters, trimmed, at most 255 characters with its extension kept."""
    if not isinstance(name, str):
        return ""
    text = unicodedata.normalize("NFC", name)
    text = re.split(r"[/\\]", text)[-1]
    text = "".join(ch for ch in text if unicodedata.category(ch)[0] not in "CZ" or ch == " ")
    text = " ".join(text.split())
    if text in ("", ".", ".."):
        return ""
    if len(text) > _NAME_LIMIT:
        suffix = PurePosixPath(text).suffix[:16]
        text = text[: _NAME_LIMIT - len(suffix)] + suffix
    return text


def _measure(content: Content, label: str) -> tuple[str, int, bytes]:
    """The contents' sha256, size and first bytes, read in chunks; refused as soon as they pass the
    limit, before anything is written."""
    limit = settings.VEXTRUS_UPLOAD_MAX_BYTES
    content.seek(0)
    digest = hashlib.sha256()
    size = 0
    head = b""
    while chunk := content.read(_CHUNK):
        size += len(chunk)
        if size > limit:
            raise auth.Refused(toasts.TOO_LARGE(file=label, megabytes=megabytes(limit)), status=413)
        if len(head) < _HEAD:
            head += chunk[: _HEAD - len(head)]
        digest.update(chunk)
    content.seek(0)
    return digest.hexdigest(), size, head


def megabytes(limit: int) -> int:
    return limit // (1024 * 1024)


def _kind(head: bytes, label: str) -> FileFormat:
    """What the first bytes say the file is; anything but a DWG or a PDF is refused."""
    if _DWG.match(head[:6]) and len(head) >= 6:
        return FileFormat.DWG
    if head.startswith(b"%PDF-"):
        return FileFormat.PDF
    if head[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
        if head[:4] == b"PK\x03\x04" and len(head) >= 30:
            length = int.from_bytes(head[26:28], "little")
            if head[30 : 30 + length] in _OFFICE_ENTRIES:
                raise auth.Refused(toasts.NOT_A_DRAWING(file=label), status=415)
        raise auth.Refused(toasts.ZIP(file=label), status=415)
    raise auth.Refused(toasts.NOT_A_DRAWING(file=label), status=415)


def _original_key(project_id: uuid.UUID, sha256: str, kind: str) -> str:
    return storage.key(project_id, "drawings", sha256, f"original.{kind}")


def _again(existing: DrawingFile, key: str, content: Content, label: str) -> Added:
    """The same contents again: nothing is added, unless Vextrus's copy is missing or damaged, when
    this one replaces it and a reading that stopped starts again."""
    if _intact(key):
        when, who = existing.added_at.isoformat(), existing.added_by_name
        vextrus = yes_no(existing.added_by_vextrus)
        if label.casefold() == existing.original_name.casefold():
            said_here = toasts.ALREADY_HERE(file=label, added_date=when, actor=who, vextrus=vextrus)
        else:
            said_here = toasts.ALREADY_HERE_AS(
                file=label,
                existing_file=existing.original_name,
                added_date=when,
                actor=who,
                vextrus=vextrus,
            )
        return Added(file(existing.id), "already_here", said_here)
    content.seek(0)
    storage.put(
        key,
        cast(BinaryIO, content),
        kind="original",
        media_type=_MEDIA_TYPES[FileFormat(existing.format)],
        producer="upload",
    )
    row = (
        DrawingFile.objects.select_related("drawing_set")
        .select_for_update(of=("self",))
        .get(id=existing.id)
    )
    job = jobs.state(row.read_job_id) if row.read_job_id is not None else None
    stopped = row.read_status == ReadStatus.FAILED or (job is not None and job.status == "failed")
    if stopped and not unreadable(row):
        _start_again(row, job)
        return Added(file(existing.id), "replaced", toasts.REPLACED_READING(file=label))
    return Added(file(existing.id), "replaced", toasts.REPLACED(file=label))


def _intact(key: str) -> bool:
    try:
        with storage.local_copy(key):
            return True
    except storage.FileMissing, storage.FileChanged, storage.UnsafePath:
        return False


def _set_for(tenant_id: uuid.UUID, project_id: uuid.UUID) -> DrawingSet:
    """The Project's Drawing Set, made with its first state when its first file comes."""
    found = DrawingSet.objects.filter(tenant_id=tenant_id, project_id=project_id).first()
    if found is not None:
        return found
    _access.lock("set", tenant_id, project_id)
    found = DrawingSet.objects.filter(tenant_id=tenant_id, project_id=project_id).first()
    if found is not None:
        return found
    drawing_set = DrawingSet.objects.create(tenant_id=tenant_id, project_id=project_id)
    state = DrawingSetState.objects.create(
        tenant_id=tenant_id,
        drawing_set=drawing_set,
        seq=1,
        cause=StateCause.REVISION,
        status=StateStatus.CURRENT,
    )
    drawing_set.current_state = state
    drawing_set.save(update_fields=["current_state"])
    return drawing_set


def _first_issue(drawing_set: DrawingSet, discipline: Discipline, by: uuid.UUID | None) -> Revision:
    """The Discipline's first issue in the set, made when its first file comes (the review Q6)."""
    _access.lock("revisions", drawing_set.id)
    found = Revision.objects.filter(
        drawing_set=drawing_set, discipline=discipline, kind=RevisionKind.FIRST_ISSUE
    ).first()
    if found is not None:
        return found
    seq = Revision.objects.filter(drawing_set=drawing_set).aggregate(last=Max("seq"))["last"] or 0
    return Revision.objects.create(
        tenant_id=drawing_set.tenant_id,
        drawing_set=drawing_set,
        seq=seq + 1,
        discipline=discipline,
        kind=RevisionKind.FIRST_ISSUE,
        received_by=by,
    )


def is_vextrus() -> bool:
    """Whether the acting person is a Vextrus Engineer (their acts show "(Vextrus)")."""
    membership = tenancy.current_membership()
    return membership is not None and membership.role == VEXTRUS_ENGINEER


def yes_no(value: bool) -> str:
    return "yes" if value else "no"


def _record(kind: MessageCode, row: DrawingFile) -> None:
    events.record(
        kind,
        subject_type="drawing_file",
        subject_id=row.id,
        actor_user_id=tenancy.current().user_id,
        project_id=row.drawing_set.project_id,
        building_id=row.building_id,
    )


# The Discipline ------------------------------------------------------------------------------------


DISCIPLINE_CHANGED: list[Callable[[uuid.UUID, str], None]] = []
"""What follows a file's Discipline changed by the QS, each called with the file's id and the QS's
name in the change's own transaction: a module above `drawings` registers here
(`on_discipline_changed`; takeoff's Step 1 answers the sheets' `missing_discipline` Questions with
it and asks the set's Questions again, #159)."""


def on_discipline_changed(follow: Callable[[uuid.UUID, str], None]) -> None:
    """Register `follow` once (see `DISCIPLINE_CHANGED`)."""
    if follow not in DISCIPLINE_CHANGED:
        DISCIPLINE_CHANGED.append(follow)


DISCIPLINE_CHANGING: list[Callable[[uuid.UUID], None]] = []
"""What a file's Discipline change takes first, each called with the file's Project in the change's
transaction before any row is locked: takeoff's Step 1 takes its write lock here (#227), as every
act on Step 1 does, so the change and a read job never wait on each other in a cycle. The change
first waits, holding nothing, for a read job finishing the file (`_wait_for_row`)."""


def before_discipline_change(lock: Callable[[uuid.UUID], None]) -> None:
    """Register `lock` once (see `DISCIPLINE_CHANGING`)."""
    if lock not in DISCIPLINE_CHANGING:
        DISCIPLINE_CHANGING.append(lock)


def set_discipline(file_id: uuid.UUID, key: str, *, actor_name: str = "") -> FileView:
    """The QS's choice of the file's Discipline: its sheets move with it (see the module)."""
    with transaction.atomic():
        project_id = _access.drawing_file(file_id).drawing_set.project_id
        _wait_for_row(file_id)
        for lock in DISCIPLINE_CHANGING:
            lock(project_id)
        row = _access.drawing_file(file_id, lock=True)
        discipline = library_disciplines.by_key(key)
        if discipline is None:
            raise auth.Refused(said.DISCIPLINE_UNKNOWN(), status=400)
        if row.discipline_id == discipline.id:
            if row.discipline_source != DisciplineSource.QS:
                row.discipline_source = DisciplineSource.QS
                row.save(update_fields=["discipline_source"])
            return file(row.id)
        _access.lock("revisions", row.drawing_set_id)
        _move_sheets(row, discipline)
        row.discipline = discipline
        row.discipline_source = DisciplineSource.QS
        row.revision = _first_issue(row.drawing_set, discipline, tenancy.current().user_id)
        fields = ["discipline", "discipline_source", "revision"]
        if (
            isinstance(row.finding, dict)
            and row.finding.get("code") == said.DISCIPLINE_CHOICE_UNDONE.code
        ):
            row.finding = None  # an earlier choice refused while the file read: answered by this one
            fields.append("finding")
        row.save(update_fields=fields)
        # A first issue left with no file stays (a Revision is never deleted), and is found again
        # by its Discipline's next file.
        SheetRevision.objects.filter(source_file=row).update(revision=row.revision)
        _record(said.DISCIPLINE_CHANGED, row)
        for follow in DISCIPLINE_CHANGED:
            follow(row.id, actor_name)
    return file(row.id)


def _wait_for_row(file_id: uuid.UUID) -> None:
    """Wait for the file's row, then let it go: a read job finishing the file holds it from
    `mark_read` to its commit (its long reading among it). Locked in a savepoint rolled back, so the
    change holds nothing while it waits, and takes Step 1's write lock only once the job is done."""
    savepoint = transaction.savepoint_create()
    _access.drawing_file(file_id, lock=True)
    transaction.savepoint_rollback(savepoint)


def _move_sheets(row: DrawingFile, discipline: Discipline) -> None:
    printed = list(SheetRevision.objects.select_related("sheet").filter(source_file=row))
    for sheet_revision in printed:
        if sheet_revision.decision:
            number = sheet_revision.sheet.number
            if not number:
                raise auth.Refused(said.DISCIPLINE_UNNUMBERED_DECIDED(), status=409)
            raise auth.Refused(said.DISCIPLINE_SHEET_DECIDED(sheet=number), status=409)
    sheets = {sr.sheet_id: sr.sheet for sr in printed}
    for sheet in sheets.values():
        if not sheet.number:
            continue
        taken = (
            Sheet.objects.filter(
                drawing_set_id=sheet.drawing_set_id,
                building_id=sheet.building_id,
                discipline=discipline,
                number=sheet.number,
            )
            .exclude(id=sheet.id)
            .exists()
        )
        if taken:
            name = library_disciplines.name(discipline.labels)
            raise auth.Refused(
                said.DISCIPLINE_SHEET_TAKEN(sheet=sheet.number, discipline=name), status=409
            )
    for sheet in sheets.values():
        shared = SheetRevision.objects.filter(sheet=sheet).exclude(source_file=row).exists()
        if not shared:
            Sheet.objects.filter(id=sheet.id).update(discipline=discipline)
            continue
        moved = Sheet.objects.create(
            tenant_id=sheet.tenant_id,
            drawing_set_id=sheet.drawing_set_id,
            building_id=sheet.building_id,
            discipline=discipline,
            number=sheet.number,
            title=sheet.title,
            storeys_as_stated=sheet.storeys_as_stated,
        )
        SheetRevision.objects.filter(sheet=sheet, source_file=row).update(sheet=moved)


# Cancel and restart --------------------------------------------------------------------------------


def cancel(file_id: uuid.UUID, *, actor_name: str = "") -> FileView:
    """Cancel the file's reading: a waiting read never runs, a running one stops at its next step and
    its current step rolls back. A file whose reading has ended (read, held, failed, refused or
    cancelled already) is left as it is, and nothing is written."""
    with transaction.atomic():
        row = _access.drawing_file(file_id, lock=True)
        held = reading_anyway(row)  # a held file read anyway, read again: it stays held (#165)
        if row.read_status not in (ReadStatus.QUEUED, ReadStatus.READING) and not held:
            return file(row.id)
        if held and row.read_job_id is None:
            return file(row.id)
        if row.read_job_id is not None:
            job = jobs.state(row.read_job_id)
            if job is None or job.status not in ("waiting", "running", "retrying"):
                return file(row.id)
            if not jobs.cancel(row.read_job_id):
                return file(row.id)
        if not held:
            row.read_status = ReadStatus.CANCELLED
        row.cancelled_by = tenancy.current().user_id
        row.cancelled_by_name = actor_name[:200]
        row.cancelled_by_vextrus = is_vextrus()
        row.cancelled_at = timezone.now()
        row.save(
            update_fields=[
                "read_status",
                "cancelled_by",
                "cancelled_by_name",
                "cancelled_by_vextrus",
                "cancelled_at",
            ]
        )
        _record(said.READ_CANCELLED, row)
    return file(row.id)


def restart(file_id: uuid.UUID) -> FileView:
    """Read a file again whose reading failed or was cancelled: its read job is started again with
    the same ids, its completed steps skipped. Anything else is 409, and two clicks start it once."""
    with transaction.atomic():
        row = _access.drawing_file(file_id, lock=True)
        job = jobs.state(row.read_job_id) if row.read_job_id is not None else None
        stopped = (
            job.status in ("failed", "cancelled")
            if job is not None
            else (row.read_status in (ReadStatus.FAILED, ReadStatus.CANCELLED))
        )
        if unreadable(row):
            raise auth.Refused(said.OLD_VERSION(), status=409)
        if _reading_anyway_failed(row, job):
            # Read anyway, and reading it again failed (#165): its job runs again, its kept steps
            # skipped; the file stays held, as its answer left it.
            assert job is not None
            row.read_job_id = jobs.restart(job.id)
            row.read_step = ""
            row.read_tries = 0
            disagreement = (row.cross_check or {}).get("finding")
            if disagreement:  # its reading-again reason gives way to its readers' disagreement
                row.finding = disagreement
            row.cancelled_by = None
            row.cancelled_by_name = ""
            row.cancelled_by_vextrus = False
            row.cancelled_at = None
            row.save(
                update_fields=[
                    "read_job_id",
                    "read_step",
                    "read_tries",
                    "finding",
                    "cancelled_by",
                    "cancelled_by_name",
                    "cancelled_by_vextrus",
                    "cancelled_at",
                ]
            )
            _record(said.READ_RESTARTED, row)
            return file(row.id)
        if row.read_status in _ENDED_FOR_GOOD:
            raise auth.Refused(said.ALREADY_ENDED(), status=409)
        if not stopped:
            raise auth.Refused(said.NOT_STOPPED(), status=409)
        _start_again(row, job)
        _record(said.READ_RESTARTED, row)
    return file(row.id)


def _reading_anyway_failed(row: DrawingFile, job: jobs.JobState | None) -> bool:
    """A held file read anyway whose job, reading it again, ended failed or cancelled."""
    return reading_anyway(row) and job is not None and job.status in ("failed", "cancelled")


def _marked(rows: Sequence[DrawingFile]) -> set[uuid.UUID]:
    """The files marked for Vextrus: those whose latest mark (an event,
    `drawings.files.marked_for_vextrus`) is newer than their latest restart (the mark was for the
    reading it asked about; reading again clears it). Kept as events, so `drawings` adds no column."""
    failed = [r.id for r in rows]
    if not failed:
        return set()
    latest = events.latest(
        (said.MARKED_FOR_VEXTRUS, said.READ_RESTARTED), subject_type="drawing_file", subject_ids=failed
    )
    marks = {
        subject: at for (kind, subject), at in latest.items() if kind == said.MARKED_FOR_VEXTRUS.code
    }
    restarts = {s: at for (kind, s), at in latest.items() if kind == said.READ_RESTARTED.code}
    return {s for s, at in marks.items() if s not in restarts or at > restarts[s]}


def mark_for_vextrus(file_id: uuid.UUID) -> FileView:
    """Mark a file for Vextrus to look at ("Mark for Vextrus"), where its row or report asks for it
    (`reports.asks_to_mark`); a file already marked is left as it is. Any other file is 409."""
    from vextrus.drawings.services import reports  # the report's own facts (it imports this module)

    with transaction.atomic():
        row = _access.drawing_file(file_id, lock=True)
        if not reports.asks_to_mark(row, file(row.id)):
            raise auth.Refused(said.NOT_FAILED(), status=409)
        if row.id not in _marked([row]):
            _record(said.MARKED_FOR_VEXTRUS, row)
    return file(row.id)


_ENDED_FOR_GOOD = frozenset({ReadStatus.READ, ReadStatus.QUARANTINED, ReadStatus.REFUSED})


def _start_again(row: DrawingFile, job: jobs.JobState | None) -> None:
    if job is not None and job.status in ("failed", "cancelled"):
        row.read_job_id = jobs.restart(job.id)
    row.read_status = ReadStatus.QUEUED
    row.read_step = ""
    row.sheets_done = 0
    row.progress_at = None
    row.sheets_started_at = None
    row.finding = None
    row.read_tries = 0
    row.cancelled_by = None
    row.cancelled_by_name = ""
    row.cancelled_by_vextrus = False
    row.cancelled_at = None
    row.save(
        update_fields=[
            "read_job_id",
            "read_status",
            "read_step",
            "sheets_done",
            "progress_at",
            "sheets_started_at",
            "finding",
            "read_tries",
            "cancelled_by",
            "cancelled_by_name",
            "cancelled_by_vextrus",
            "cancelled_at",
        ]
    )
