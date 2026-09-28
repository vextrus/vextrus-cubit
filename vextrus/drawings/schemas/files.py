"""A Drawing Set's files, their reports, and a printed sheet's Plot in the API (ticket 14; m0-screens
4.5). Every sentence is a message code and its parameters; a file's name is the QS's label; nothing
here names a storage key, a sha256 or a Building (m0-screens §1.1, §1.10)."""

import uuid
from datetime import datetime
from typing import Any

from ninja import Schema
from pydantic import ConfigDict

from engine.messages import Message
from vextrus.drawings.services import (
    DisciplineView,
    FileView,
    FontRow,
    PlotView,
    Report,
    SetView,
)


class DisciplineOut(Schema):
    """One of the Market's Disciplines: its key, and its one name per language (Library data)."""

    key: str
    labels: dict[str, str]

    @classmethod
    def from_view(cls, view: DisciplineView) -> DisciplineOut:
        return cls(key=view.key, labels=view.labels)


class FileOut(Schema):
    id: uuid.UUID
    name: str
    """The QS's label for it (the name it was added with, cleaned): never a path."""
    format: str
    size: int
    discipline: str | None
    """Its Discipline's key, or none."""
    state: str
    """Which of 4.5's rows it is on: waiting, reading, stopping, retrying, cancelled, failed,
    unreadable, read, held or refused (for the actions beside its words)."""
    status: Message
    finding: Message | None
    sheets_found: int | None
    plot_for: list[uuid.UUID]
    """For a PDF: the DWGs whose sheets its pages matched (4.5 shows it under them)."""
    added_at: datetime
    added_by_name: str

    @classmethod
    def from_view(cls, view: FileView) -> FileOut:
        return cls(
            id=view.id,
            name=view.name,
            format=view.format,
            size=view.size,
            discipline=view.discipline,
            state=str(view.state),
            status=view.status,
            finding=view.finding,
            sheets_found=view.sheets_found,
            plot_for=list(view.plot_for),
            added_at=view.added_at,
            added_by_name=view.added_by_name,
        )


class FilesOut(Schema):
    set_id: uuid.UUID | None
    """The Project's Drawing Set, or none before its first file."""
    summary: Message
    files: list[FileOut]

    @classmethod
    def from_views(
        cls, drawing_set: SetView | None, views: list[FileView], summary: Message
    ) -> FilesOut:
        return cls(
            set_id=drawing_set.id if drawing_set else None,
            summary=summary,
            files=[FileOut.from_view(view) for view in views],
        )


class DisciplineIn(Schema):
    model_config = ConfigDict(extra="forbid")

    discipline: str
    """A Discipline's key, one of the Market's."""


class FontRowOut(Schema):
    asked: Message
    how_close: Message
    texts: int

    @classmethod
    def from_row(cls, row: FontRow) -> FontRowOut:
        return cls(asked=row.asked, how_close=row.how_close, texts=row.texts)


class ReportOut(Schema):
    """A file's report panel, section by section (each hidden when empty)."""

    file: FileOut
    readers: list[Message]
    sheets: list[Message]
    bangla: list[Message]
    fonts: list[Message]
    font_rows: list[FontRowOut]
    plot: list[Message]
    made_by: list[Message]
    pages: list[Message]

    @classmethod
    def from_report(cls, report: Report) -> ReportOut:
        return cls(
            file=FileOut.from_view(report.file),
            readers=list(report.readers),
            sheets=list(report.sheets),
            bangla=list(report.bangla),
            fonts=list(report.fonts),
            font_rows=[FontRowOut.from_row(row) for row in report.font_rows],
            plot=list(report.plot),
            made_by=list(report.made_by),
            pages=list(report.pages),
        )


class PlotOut(Schema):
    """A printed sheet's Plot: its PDF's page and the sheet-to-page transform, or why it has none."""

    file_id: uuid.UUID | None
    page: int | None
    transform: dict[str, Any] | None
    residual: str | None
    none: Message | None

    @classmethod
    def from_view(cls, view: PlotView) -> PlotOut:
        return cls(
            file_id=view.file_id if view.page is not None else None,
            page=view.page,
            transform=view.transform,
            residual=view.residual,
            none=view.none,
        )
