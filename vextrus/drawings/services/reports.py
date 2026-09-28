"""A file's report panel (ticket 14; m0-screens 4.5, "The report panel for a DWG" and "for a PDF"):
its sections in order, each a list of messages (a section with nothing to say is empty, and hidden).

    report = drawings.services.report(file_id)
    report.readers, report.sheets, report.bangla, report.fonts, report.plot   # a DWG's
    report.made_by, report.pages                                            # a PDF's

The reading's own lines are the engine's codes, kept as they were read (the second reader's, the
fonts', a PDF's report, the Bangla-ANSI Check's); `drawings` adds the lines it can write from what it
holds: the readers agreeing, the sheets found, the Plot, the pages matched. Nothing here is shown
while a file is still being read but what it has already found.
"""

import uuid
from collections import Counter
from dataclasses import dataclass
from typing import Any

from django.db.models import Q, Sum

from engine.messages import Message
from vextrus.drawings.messages import reports as said
from vextrus.drawings.models import (
    DrawingFile,
    FileFormat,
    HeldAnswer,
    PlotNone,
    ReadStatus,
    SheetRevision,
)
from vextrus.drawings.services import _access, drawing_files


@dataclass(frozen=True)
class FontRow:
    asked: Message
    how_close: Message
    texts: int


@dataclass(frozen=True)
class Report:
    file: drawing_files.FileView
    readers: tuple[Message, ...] = ()
    sheets: tuple[Message, ...] = ()
    bangla: tuple[Message, ...] = ()
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
    return Report(
        shown,
        readers=tuple(_readers(row)),
        sheets=tuple(_sheets(row)),
        bangla=tuple(Message(code=m["code"], params=m["params"]) for m in row.bangla_lines or ()),
        fonts=_messages(fonts),
        font_rows=tuple(
            FontRow(use["asked_message"], use["how_close_message"], int(use.get("texts", 0)))
            for use in fonts.get("fonts", ())
            if "asked_message" in use and "how_close_message" in use
        ),
        plot=tuple(_plot(row)),
    )


def _messages(stored: dict[str, Any] | None) -> tuple[Message, ...]:
    return tuple(Message(code=m["code"], params=m["params"]) for m in (stored or {}).get("messages", ()))


def _readers(row: DrawingFile) -> list[Message]:
    finding = row.finding
    stopped = row.read_status in (ReadStatus.FAILED, ReadStatus.QUARANTINED)
    if finding and (stopped or str(finding.get("code", "")).startswith("engine.decoders_agree.")):
        return [Message(code=finding["code"], params=finding["params"])]
    check = row.cross_check or {}
    if check.get("outcome") == "passed":
        return [said.READERS_AGREE()]
    if check.get("finding"):
        return [Message(code=check["finding"]["code"], params=check["finding"]["params"])]
    return []


def _listed(row: DrawingFile) -> bool:
    return row.read_status == ReadStatus.READ or (
        row.read_status == ReadStatus.QUARANTINED and row.held_answer == HeldAnswer.READ_ANYWAY
    )


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
    return lines


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
        return [said.NO_DWG_FOR_PAGES()]
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
