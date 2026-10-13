"""S24-A5's review (#703, round 2): where 18 takes one of two pages naming a sheet as its page, the
report keeps m0-screens 4.5's line, "Pages 4 and 5 both show S-04; page 5 is used.", naming the
page 18 used, never a reason that names neither.

A Structural DWG read (S-01, S-02, S-04, S-05) and its Plot of five pages, every page's lettering
kept as text, read last by the read job:

    page 1  "S-01"
    page 2  "S-02"
    page 3  "S-05", large      a mark referring to S-05: its place (S-02 to S-04) does not hold it
    page 4  "S-04"
    page 5  "S-05", small      S-05's own page: its place (from S-04) holds it

Page 5 is S-05's Plot, and page 3's line says both show S-05 and page 5 is used. On main the
larger text made page 3 its Plot.
"""

import pytest

from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from vextrus.drawings import services
from vextrus.drawings.messages import reports as said
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _reader_unsandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


def _plot() -> bytes:
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}

    def named(number: str, size: float = 10) -> Page:
        return Page(content=text(60, 60, number, size=size), fonts=fonts)

    pages = [named("S-01"), named("S-02"), named("S-05", 14), named("S-04"), named("S-05", 4)]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


def test_the_page_the_order_takes_is_used_and_the_report_says_both_show_the_sheet(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["S-01", "S-02", "S-04", "S-05"])
    pdf = add(member, qs_project.project_id, "KR-STR-PLOT.pdf", _plot()).file
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=lambda: None,
        file_id=pdf.id,
    )
    with member.acting():
        plotted = {
            s.number: s.plot.page
            for s in services.sheets(services.file(pdf.id).set_id)
            if s.plot.file_id == pdf.id
        }
        lines = services.report(pdf.id).pages

    assert plotted == {"S-01": 1, "S-02": 2, "S-04": 4, "S-05": 5}, plotted
    assert said.PAGES_SAME_SHEET(first_page=3, used_page=5, sheet="S-05") in lines, lines
    assert not any(line["code"] == "engine.plot.same_sheet_as_another_page" for line in lines)
