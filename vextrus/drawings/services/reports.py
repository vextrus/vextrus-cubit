"""A file's report panel (ticket 14; m0-screens 4.5, "The report panel for a DWG" and "for a PDF"):
its sections in order, each a list of messages (a section with nothing to say is empty, and hidden).

    report = drawings.services.report(file_id)
    report.readers, report.sheets, report.bangla, report.fonts, report.plot   # a DWG's
    report.bangla_sheets; report.font_rows[n].sheets                         # its sheets (21c)
    report.made_by, report.pages                                            # a PDF's

The reading's own lines are the engine's codes, kept as they were read (the second reader's, the
fonts', a PDF's report, the Bangla-ANSI Check's); `drawings` adds the lines it can write from what it
holds: the readers agreeing, the sheets found, the Plot, the pages matched. Nothing here is shown
while a file is still being read but what it has already found.

**Its sheets** (21c): the sheets the Bangla-ANSI texts are on, and how many of the file's sheets each
font's texts are on, are worked out when the report is asked for, from the kept ReadArtefact and each
printed sheet's location (`_on_sheets`), for a file whose sheets are listed (read, or held and read
anyway). With no kept artefact (or its copy missing) there are none, and every font is on none.
"""

import uuid
from collections import Counter
from dataclasses import dataclass
from typing import Any

from django.db.models import Q, Sum

from engine.check.bangla_ansi import BanglaAnsi, Flagged, FoundBy
from engine.messages import Message
from engine.messages.decoders_agree import DISAGREE
from engine.read.artefact import ReadArtefact
from vextrus.drawings.messages import reports as said
from vextrus.drawings.models import (
    DrawingFile,
    FileFormat,
    HeldAnswer,
    PlotNone,
    ReadStatus,
    ReadStep,
    SheetRevision,
)
from vextrus.drawings.services import _access, _on_sheets, drawing_files, reads
from vextrus.platform.services import auth, storage


@dataclass(frozen=True)
class FontRow:
    asked: Message
    how_close: Message
    texts: int
    sheets: int = 0
    """How many of the file's sheets its texts are on (the Fonts table's "Sheets" column)."""


@dataclass(frozen=True)
class BanglaSheet:
    """A sheet with Bangla-ANSI texts on it ("A-02: 5 texts"), a link into Step 1."""

    sheet_id: uuid.UUID
    """The printed sheet's (SheetRevision's) id."""
    number: str | None
    texts: int


@dataclass(frozen=True)
class Report:
    file: drawing_files.FileView
    readers: tuple[Message, ...] = ()
    sheets: tuple[Message, ...] = ()
    bangla: tuple[Message, ...] = ()
    bangla_sheets: tuple[BanglaSheet, ...] = ()
    """The sheets the Bangla-ANSI texts are on, in sheet order, each with how many."""
    fonts: tuple[Message, ...] = ()
    font_rows: tuple[FontRow, ...] = ()
    plot: tuple[Message, ...] = ()
    made_by: tuple[Message, ...] = ()
    """A PDF's report, as 12 wrote it (made by, pages, lettering, layers, pictures, refusal)."""
    pages: tuple[Message, ...] = ()


def report(file_id: uuid.UUID) -> Report:
    row = _access.drawing_file(file_id)
    shown = drawing_files.file(row.id)
    if row.format == FileFormat.PDF:
        return Report(shown, made_by=_messages(row.upload_report), pages=tuple(_pages(row)))
    fonts = row.font_report or {}
    uses = [u for u in fonts.get("fonts", ()) if "asked_message" in u and "how_close_message" in u]
    flagged = {str(t["handle"]) for t in (row.bangla_ansi or {}).get("texts", ()) if t.get("handle")}
    on = _SheetTexts.of(row) if uses or flagged else _NO_SHEETS
    return Report(
        shown,
        readers=tuple(_readers(row, shown.state)),
        sheets=tuple(_sheets(row)),
        bangla=_bangla(row, on),
        bangla_sheets=on.bangla(flagged),
        fonts=_messages(fonts),
        font_rows=tuple(
            FontRow(
                use["asked_message"],
                use["how_close_message"],
                int(use.get("texts", 0)),
                on.sheets_in((str(use.get("asked", "")).casefold(), str(use.get("kind", "")))),
            )
            for use in uses
        ),
        plot=tuple(_plot(row)),
    )


@dataclass(frozen=True)
class _SheetTexts:
    """A listed file's printed sheets in order, each with its texts' handles, and their font rows."""

    sheets: tuple[tuple[uuid.UUID, str | None, frozenset[str]], ...] = ()
    fonts: tuple[frozenset[tuple[str, str]], ...] = ()
    """Per sheet, the Font report's rows (name asked, casefolded; kind) its texts are drawn in."""

    @classmethod
    def of(cls, row: DrawingFile) -> _SheetTexts:
        if not _listed(row):
            return _NO_SHEETS
        printed = list(
            SheetRevision.objects.filter(source_file=row)
            .order_by("ordinal", "id")
            .values_list("id", "sheet__number", "location")
        )
        if not printed:
            return _NO_SHEETS
        read = _artefact(row)
        if read is None:
            return _NO_SHEETS
        on = _on_sheets.texts_on(read, [(sr_id, location) for sr_id, _, location in printed])
        sheets = tuple((sr_id, number or None, frozenset(on[sr_id])) for sr_id, number, _ in printed)
        fonts = tuple(frozenset(_on_sheets.font_rows_of(read, handles)) for *_, handles in sheets)
        return cls(sheets, fonts)

    def sheet_of(self, handle: str) -> str | None:
        """The printed sheet a text lies on (its id), or None."""
        return next((str(sr_id) for sr_id, _n, handles in self.sheets if handle in handles), None)

    def bangla(self, flagged: set[str]) -> tuple[BanglaSheet, ...]:
        found = []
        for sr_id, number, handles in self.sheets:
            if texts := len(handles & flagged):
                found.append(BanglaSheet(sr_id, number, texts))
        return tuple(found)

    def sheets_in(self, font: tuple[str, str]) -> int:
        return sum(font in rows for rows in self.fonts)


_NO_SHEETS = _SheetTexts()


def _bangla(row: DrawingFile, on: _SheetTexts) -> tuple[Message, ...]:
    """The Bangla section's header lines (`BanglaAnsi.findings`), counted from the same
    texts-on-sheets as its sheet links: a text on several sheets (in a block inserted on each)
    counts on each, as its links do (`sheets`: the links; `on_sheets`: their texts added up;
    `outside`: texts on no sheet; `texts`: the two together, which the verb follows). With no
    sheet, every text is outside. Lines kept on the file
    (`record_bangla_lines`, the seed's) only where no flagged text is kept to count from."""
    texts = [t for t in (row.bangla_ansi or {}).get("texts", ()) if t.get("handle")]
    if not texts:
        return tuple(Message(code=m["code"], params=m["params"]) for m in row.bangla_lines or ())
    flagged = BanglaAnsi(
        tuple(Flagged(str(t["handle"]), FoundBy(t["by"]), t.get("font")) for t in texts)
    )
    kinds = [k for k in (FoundBy.FONT, FoundBy.PATTERN) if any(t.by is k for t in flagged.texts)]
    lines = []
    for line, kind in zip(flagged.findings(on.sheet_of), kinds, strict=True):
        handles = {t.handle for t in flagged.texts if t.by is kind}
        placed = [(sr_id, h) for sr_id, _n, on_it in on.sheets for h in on_it & handles]
        params = {
            **line["params"],
            "on_sheets": len(placed),
            "sheets": len({sr_id for sr_id, _h in placed}),
            "outside": len(handles - {h for _s, h in placed}),
        }
        # Every count, the verb's included, is of what the links count: each placement once.
        params["texts"] = len(placed) + int(params["outside"])
        lines.append(Message(code=line["code"], params=params))
    return tuple(lines)


def _artefact(row: DrawingFile) -> ReadArtefact | None:
    """The file's kept ReadArtefact, or None when none is kept or its copy is missing or damaged."""
    try:
        return reads.artefact(row.id)
    except auth.NotFound, storage.StorageError:
        return None


def _messages(stored: dict[str, Any] | None) -> tuple[Message, ...]:
    return tuple(Message(code=m["code"], params=m["params"]) for m in (stored or {}).get("messages", ()))


def _readers(row: DrawingFile, state: str) -> list[Message]:
    finding = row.finding
    stopped = row.read_status in (ReadStatus.FAILED, ReadStatus.QUARANTINED)
    if (
        finding
        and row.read_status == ReadStatus.QUARANTINED
        and row.held_answer == HeldAnswer.READ_ANYWAY
        and finding.get("code") == DISAGREE.code
    ):
        if drawing_files.read_anyway_ended(row):
            return [said.READ_ANYWAY(**finding["params"])]
        # Stopping is not yet stopped: it is still being read until its job ends.
        stopped_again = state in (drawing_files.FileState.FAILED, drawing_files.FileState.CANCELLED)
        pending = said.READ_ANYWAY_STOPPED if stopped_again else said.READ_ANYWAY_PENDING
        return [pending(**finding["params"])]
    if finding and (stopped or str(finding.get("code", "")).startswith("engine.decoders_agree.")):
        return [Message(code=finding["code"], params=finding["params"])]
    check = row.cross_check or {}
    if check.get("outcome") == "passed":
        return [said.READERS_AGREE()]
    if check.get("finding"):
        return [Message(code=check["finding"]["code"], params=check["finding"]["params"])]
    return []


def asks_to_mark(row: DrawingFile, view: drawing_files.FileView) -> bool:
    """Whether the file's row or report tells the QS to mark it for Vextrus (from the facts the report
    words them from): its reading failed (an old AutoCAD's file among them), or it is listed (read, or
    held and read anyway) and a DWG with no sheet, sheets or views not kept, or a limit that cut it."""
    if view.state in (drawing_files.FileState.FAILED, drawing_files.FileState.UNREADABLE):
        return True
    if not _listed(row) or row.format != FileFormat.DWG:
        return False
    printed = SheetRevision.objects.filter(source_file=row)
    return (
        not printed.exists()
        or bool(row.sheets_refused)
        or printed.filter(views_refused__gt=0).exists()
        or bool(_not_read_in_full(row))
    )


def _listed(row: DrawingFile) -> bool:
    return row.read_status == ReadStatus.READ or drawing_files.read_anyway_ended(row)


def _sheets(row: DrawingFile) -> list[Message]:
    if not _listed(row):
        return []
    places = Counter(
        "layout" if "layout" in location else "drawn"
        for location in SheetRevision.objects.filter(source_file=row).values_list("location", flat=True)
    )
    total = sum(places.values())
    lines = []
    if total == 0:
        if not row.sheets_refused:  # found, and none kept: its own line says so
            lines.append(said.NO_SHEETS())
    elif places["layout"] and places["drawn"]:
        lines.append(said.SHEETS_FOUND(sheets=total, drawn=places["drawn"], layouts=places["layout"]))
    elif places["layout"]:
        lines.append(said.SHEETS_FOUND_LAYOUTS(sheets=total))
    else:
        lines.append(said.SHEETS_FOUND_DRAWN(sheets=total))
    if row.empty_layouts:
        lines.append(said.EMPTY_LAYOUTS(layouts=row.empty_layouts))
    if row.sheets_refused:
        lines.append(said.SHEETS_NOT_KEPT(sheets=row.sheets_refused))
    views = SheetRevision.objects.filter(source_file=row).aggregate(n=Sum("views_refused"))["n"]
    if views:
        lines.append(said.VIEWS_NOT_KEPT(views=views))
    # Every limit that cut the reading, each once: "no sheets" is never said without its reason.
    lines += _not_read_in_full(row)
    return lines


def _not_read_in_full(row: DrawingFile) -> list[Message]:
    """What the step that marked the file read kept of the limits that cut it (`reads.mark_read`):
    the latest such step's, since a file is marked read once per reading."""
    result = (
        ReadStep.objects.filter(file=row, step=drawing_files.FINISHING)
        .order_by("-created_at", "-id")
        .values_list("result", flat=True)
        .first()
    )
    said_cut = (result or {}).get("not_read_in_full", ())
    return [Message(code=m["code"], params=m["params"]) for m in said_cut]


def _plot(row: DrawingFile) -> list[Message]:
    """The PDFs plotted from this file, first added first: the first with pages for its sheets is
    its Plot, each later one a part of it; one with none says why (refused, or no page matched).
    A PDF counts when a sheet names it, or when it is of this file's Discipline."""
    if not _listed(row):
        return []
    printed = list(
        SheetRevision.objects.filter(source_file=row).values_list("plot_file_id", "plot_page")
    )
    if not printed:
        return []
    with_page = Counter(pdf for pdf, page in printed if pdf is not None and page is not None)
    named = {pdf for pdf, _ in printed if pdf is not None}
    pdfs = DrawingFile.objects.filter(drawing_set_id=row.drawing_set_id, format=FileFormat.PDF)
    if row.discipline_id is not None:
        pdfs = pdfs.filter(Q(id__in=named) | Q(discipline_id=row.discipline_id))
    else:
        pdfs = pdfs.filter(id__in=named)
    lines: list[Message] = []
    plotted = False
    found = list(pdfs.order_by("added_at", "id").values_list("id", "original_name", "read_status"))
    reading = {ReadStatus.QUEUED, ReadStatus.READING}
    used = any(with_page.values()) or any(status in reading for *_, status in found)
    for pdf, name, status in found:
        if with_page[pdf]:
            said_plot = said.PLOT_PART if plotted else said.PLOT_OF_DWG
            lines.append(said_plot(plot_file=name, with_page=with_page[pdf], sheets=len(printed)))
            plotted = True
        elif status == ReadStatus.REFUSED:
            refused = said.PLOT_REFUSED_UNUSED if used else said.PLOT_REFUSED
            lines.append(refused(plot_file=name))
        elif status == ReadStatus.READ:
            lines.append(said.PLOT_NONE_MATCHED(plot_file=name))
        elif status in reading:
            lines.append(said.PLOT_READING(plot_file=name))
        else:
            lines.append(said.PLOT_UNREAD(plot_file=name))
    if not pdfs.exists():
        lines.append(said.NO_PLOT())
    return lines


def _pages(row: DrawingFile) -> list[Message]:
    if row.read_status != ReadStatus.READ:
        return []
    pages = row.sheets_total or 0
    matched = (
        SheetRevision.objects.filter(plot_file=row, plot_page__isnull=False)
        .values_list("plot_page", flat=True)
        .distinct()
        .count()
    )
    if matched == 0 and not drawing_files.dwg_read_for(row):
        added = drawing_files.dwg_added_for(row)
        return [said.DWG_NOT_READ() if added else said.NO_DWG_FOR_PAGES()]
    lines = [said.PAGES_MATCHED(matched=matched, pages=max(pages, matched))]
    lines += [Message(code=m["code"], params=m["params"]) for m in row.unmatched_pages or ()]
    for number, mark in SheetRevision.objects.filter(
        plot_file=row, plot_none_reason=PlotNone.NO_PAGE
    ).values_list("sheet__number", "revision_mark"):
        if not number:
            continue
        if mark:
            lines.append(said.SHEET_REVISION_WITHOUT_PAGE(sheet=number, revision=mark))
        else:
            lines.append(said.SHEET_WITHOUT_PAGE(sheet=number))
    return lines
