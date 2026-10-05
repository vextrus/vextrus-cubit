"""Ticket 236 (#236), the seam: `read_propose.files.Readers` gains `pages` (a PDF's page text, the
engine's `pdf_reader.page_text` by default) and `ink` (whether a page may be placed by its ink, true by
default), last and with defaults, so every `Readers(...)` built today stays valid and reads as today;
`plot.match(file_id, readers=None)` reads the set's PDFs' pages through them (None: `READERS`), and with
`ink=False` places a page by its text and sizes alone.

A unit test of the seam, no seed: a Drawing Set of one sheet (`vextrus.testing.drawings.read_dwg`) and
a one-page PDF drawn here by the repo's writer, invented, read in this process.
"""

import dataclasses
import uuid
from pathlib import Path
from typing import Any, NoReturn

import pytest
from django.db import transaction

from engine.fixtures.pdf._writer import Page, Pdf, document, strokes, text, truetype_font
from engine.read import pdf as pdf_reader
from vextrus.drawings import services
from vextrus.takeoff.services.read_propose import files, plot
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg

from ..t182.test_seed_without_the_toolchain import no_toolchain  # noqa: F401 (a fixture)
from .test_kr01_pdfs import read_in_process

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

PT_PER_MM = 72 / 25.4
PAPER_MM = (210.0, 148.0)
"""`read_dwg`'s sheet frame: its paper, in millimetres."""
NUMBER = "S-03"
"""The one sheet's number, as `read_dwg` lists it, and as its page prints it."""


class NoSandbox(Exception):
    """The sandbox the engine reads a PDF in, refused (as in CI, which has no bubblewrap)."""


@pytest.fixture
def no_sandbox(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """The engine's PDF reader may start no sandboxed child: each it tries is kept, then refused.
    (`no_toolchain` refuses `subprocess.Popen`; the sandbox starts its child by `os.posix_spawn`.)"""
    started: list[str] = []

    def refuse(argv: list[str], **kwargs: object) -> NoReturn:
        started.append(" ".join(argv))
        raise NoSandbox

    monkeypatch.setattr(pdf_reader, "run", refuse)
    return started


def match(file_id: uuid.UUID, readers: object) -> None:
    """`plot.match(file_id, readers)`, 236's (it takes the file alone until it is built)."""
    seam: Any = plot.match
    seam(file_id, readers)


def five_fields() -> Any:
    """`Readers` built as every caller builds it today: its five original fields only."""
    engine = files.READERS
    return files.Readers(
        dwg=engine.dwg,
        second=engine.second,
        fonts=engine.fonts,
        bangla_ansi=engine.bangla_ansi,
        pdf=engine.pdf,
    )


def one_page(number: str) -> bytes:
    """A page of the sheet's paper at 1:1 printing its number in the lower right, and some ink."""
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}
    width, height = (side * PT_PER_MM for side in PAPER_MM)
    content = strokes(6, x=40, y=40, length=200) + text(width - 90, 20, number, size=14)
    page = Page(content=content, size=(width, height), fonts=fonts)
    return document(pdf, [page], info={"Producer": "Invented Plot Driver 1.0"})


def a_set_and_its_plot(project: QsProject, folder: Path) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """A read DWG of one sheet numbered `NUMBER` and a read PDF of one page printing it, not yet
    matched: the sheet's id, the PDF's id and the set's."""
    member = project.member
    dwg_id = add(member, project.project_id, "QX-STR-R2.dwg", drawing("dwg", "t236 seam")).file.id
    [sheet] = read_dwg(member, dwg_id, [NUMBER])
    content = one_page(NUMBER)
    added = add(member, project.project_id, "QX-STR-R2.pdf", content).file
    report, _ = read_in_process(content, folder)
    with member.acting():
        services.record_reports(added.id, upload_report=report)
        services.mark_read(added.id)
    return sheet.id, added.id, added.set_id


def test_the_readers_seam_keeps_todays_readers_by_default() -> None:
    """Case 7: `Readers` with its five original fields reads a PDF's pages with the engine's
    `page_text` and may place by ink; `READERS`, the engine's, is that."""
    five = five_fields()

    assert five.pages is pdf_reader.page_text
    assert five.ink is True
    assert five == files.READERS


def test_the_readers_seam_matches_a_page_read_by_the_given_pages_without_ink(
    qs_project: QsProject,
    tmp_path: Path,
    no_toolchain: None,  # noqa: F811 (t182's fixture)
    no_sandbox: list[str],
) -> None:
    """Case 7: `plot.match` with `pages` given and `ink=False` reads the PDF's page through `pages`
    (with no process) and keeps the sheet the page names."""
    sheet_id, pdf_id, set_id = a_set_and_its_plot(qs_project, tmp_path)
    read: list[str] = []

    def pages(path: Path) -> list[pdf_reader.Page]:
        content = path.read_bytes()
        read.append(content.decode("latin-1")[:8])
        return read_in_process(content, tmp_path)[1]

    given = dataclasses.replace(five_fields(), pages=pages, ink=False)
    with qs_project.member.acting(), transaction.atomic():
        match(pdf_id, given)
    with qs_project.member.acting():
        [kept] = [s for s in services.sheets(set_id) if s.id == sheet_id]

    assert read == ["%PDF-1.7"]
    assert no_sandbox == []
    assert (kept.plot.file_id, kept.plot.page, kept.plot.none) == (pdf_id, 1, None)
    assert kept.plot.transform is not None
    assert int(kept.plot.transform["rotation"]) == 0


def test_the_readers_seam_takes_the_engines_reading_when_not_given(
    qs_project: QsProject, tmp_path: Path, no_sandbox: list[str]
) -> None:
    """Case 7: with `Readers` of five fields (`ink` true), the PDF is read by the engine's own
    reader, in its sandboxed child (refused here), so no replay is used unless a caller gives one."""
    sheet_id, pdf_id, set_id = a_set_and_its_plot(qs_project, tmp_path)

    with qs_project.member.acting(), pytest.raises(NoSandbox), transaction.atomic():
        match(pdf_id, five_fields())
    with qs_project.member.acting():
        [kept] = [s for s in services.sheets(set_id) if s.id == sheet_id]

    [started] = no_sandbox
    assert "engine.read.pdf.child" in started
    assert kept.plot.page is None
