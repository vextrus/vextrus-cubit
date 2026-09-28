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
    if finding and str(finding.get("code", "")).startswith("engine.decoders_agree."):
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
    return lines


def _plot(row: DrawingFile) -> list[Message]:
    if not _listed(row):
        return []
    printed = list(
        SheetRevision.objects.filter(source_file=row).values_list("plot_file_id", "plot_page")
    )
    if not printed:
        return []
    with_page = Counter(pdf for pdf, page in printed if pdf is not None and page is not None)
    if not with_page:
        return [said.NO_PLOT()]
    names = dict(DrawingFile.objects.filter(id__in=list(with_page)).values_list("id", "original_name"))
    return [
        said.PLOT_OF_DWG(plot_file=names[pdf], with_page=count, sheets=len(printed))
        for pdf, count in with_page.items()
        if pdf in names
    ]


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
    if matched == 0:
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
