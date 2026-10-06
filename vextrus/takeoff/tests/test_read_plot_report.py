"""S15-A5's review round: a PDF's report line for a page is read from the sheets' kept Plots, never
from a fresh ranking. Cases: a DWG read after the PDF, two Plots of one sheet, an earlier PDF that
holds the sheet. Every sheet and page here is invented."""

import uuid

import pytest
from django.db import transaction

from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from vextrus.drawings import services
from vextrus.drawings.messages import reports as said
from vextrus.takeoff.services.read_propose import plot
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _reader_unsandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


def _pdf(pages: list[tuple[str, float]]) -> bytes:
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}
    made = [Page(content=text(60, 60, number, size=size), fonts=fonts) for number, size in pages]
    return document(pdf, made, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


def _read_pdf(project: QsProject, name: str, content: bytes) -> uuid.UUID:
    member = project.member
    pdf = add(member, project.project_id, name, content).file
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=lambda: None,
        file_id=pdf.id,
    )
    return pdf.id


def _lines(project: QsProject, pdf: uuid.UUID) -> list:
    """The report's lines but the first (the count) and the sheets' lines: the pages' own."""
    with project.member.acting():
        return [
            line
            for line in services.report(pdf).pages[1:]
            if line["code"] != said.SHEET_WITHOUT_PAGE.code
            and line["code"] != said.SHEET_REVISION_WITHOUT_PAGE.code
        ]


def test_a_dwg_read_after_the_plot_leaves_the_report_naming_the_kept_page(qs_project: QsProject) -> None:
    member = qs_project.member
    first = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, first.id, ["S-01"])
    pdf = _read_pdf(qs_project, "KR-STR-PLOT.pdf", _pdf([("S-01", 4), ("S-01", 12)]))
    expected = [said.PAGES_SAME_SHEET(first_page=1, used_page=2, sheet="S-01")]
    assert _lines(qs_project, pdf) == expected

    second = add(member, qs_project.project_id, "KR-STR-R1.dwg", drawing()).file
    read_dwg(member, second.id, ["S-02"])
    with member.acting(), transaction.atomic():
        plot.match(second.id)

    assert _lines(qs_project, pdf) == expected
    with member.acting():
        s01 = next(s for s in services.sheets(services.file(pdf).set_id) if s.number == "S-01")
    assert (s01.plot.file_id, s01.plot.page) == (pdf, 2)


def test_two_plots_of_one_sheet_say_nothing_false_of_the_later_pdf(qs_project: QsProject) -> None:
    """The sheet keeps the first PDF's page; the later PDF's pages for it are not used, and its report
    must not say one is."""
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["S-01"])
    early = _read_pdf(qs_project, "KR-STR-PLOT-A.pdf", _pdf([("S-01", 10)]))
    late = _read_pdf(qs_project, "KR-STR-PLOT-B.pdf", _pdf([("S-01", 4), ("S-01", 12)]))

    assert _lines(qs_project, early) == []
    later = _lines(qs_project, late)
    assert not [line for line in later if line["code"] == said.PAGES_SAME_SHEET.code]
    with member.acting():
        s01 = services.sheets(services.file(late).set_id)[0]
    assert (s01.plot.file_id, s01.plot.page) == (early, 1)
