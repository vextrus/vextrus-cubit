"""S24-A5, #712's review (round 1): a sheet whose kept Plot is a page of a PDF the set cannot read
again now is left as it was. Its page is not matched in this read, so a later-added PDF's page
naming the same sheet never takes it: the first added PDF stays the sheet's Plot.

A Structural DWG read (S-01). PLOT-1, added first, plots S-01 on its page 1; PLOT-2, added later,
names S-01 too. PLOT-2 is read while PLOT-1's stored copy cannot be read again: S-01 keeps PLOT-1's
page 1.
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest

from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from vextrus.drawings import services
from vextrus.platform.services import storage
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _reader_unsandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


def _plot(number: str, note: str) -> bytes:
    """One page naming the sheet, with a note that makes each PDF's bytes its own."""
    pdf = Pdf()
    content = text(60, 60, number, size=10) + text(60, 200, note, size=6)
    page = Page(content=content, fonts={"F1": truetype_font(pdf)})
    return document(pdf, [page], info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


def _read(qs_project: QsProject, file_id: uuid.UUID) -> None:
    member = qs_project.member
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=lambda: None,
        file_id=file_id,
    )


def test_a_sheet_on_a_pdf_that_cannot_be_read_again_keeps_its_page(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["S-01"])
    first = add(member, qs_project.project_id, "KR-STR-PLOT-1.pdf", _plot("S-01", "ISSUE ONE")).file
    _read(qs_project, first.id)
    with member.acting():
        [sheet] = services.sheets(services.file(dwg.id).set_id)
    assert (sheet.plot.file_id, sheet.plot.page) == (first.id, 1)

    original = services.original

    @contextmanager
    def unreadable(file_id: uuid.UUID) -> Iterator[Path]:
        if file_id == first.id:
            raise storage.StorageError("the stored copy is gone")
        with original(file_id) as path:
            yield path

    monkeypatch.setattr(services, "original", unreadable)
    second = add(member, qs_project.project_id, "KR-STR-PLOT-2.pdf", _plot("S-01", "ISSUE TWO")).file
    _read(qs_project, second.id)

    with member.acting():
        [sheet] = services.sheets(services.file(dwg.id).set_id)
    assert (sheet.plot.file_id, sheet.plot.page) == (first.id, 1), sheet.plot
