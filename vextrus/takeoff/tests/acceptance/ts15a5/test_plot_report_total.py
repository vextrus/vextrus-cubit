"""S15-A5 (#540, walk #326, G1 M0-FL4): the Plot report's total is right.

m0-screens 4.5, "The report panel for a PDF", Pages: "Then "11 of 12 pages matched to a sheet." and
each unmatched page with its reason: … "Pages 4 and 5 both show S-04; page 5 is used." … Then sheets
with no page: "S-07 (rev A) has no page in this PDF."" The Drawing Set row: "Plot: 11 of 12 pages
matched".

What the walk found (#326, report_missing, delta 1): a PDF's report said "53 of 57 pages matched to a
sheet." and gave a reason for 3 pages: one page was in neither count. Such a page is one whose text
names a sheet that another page of the same PDF names more surely (that page is the sheet's Plot):
the page is not matched, and its report gives it no line.

The set is synthetic, every name invented: a Structural DWG read (S-01, S-02, S-03), a Structural DWG
held and read anyway (S-05, S-06: its sheets are listed, each marked "held"), a Structural DWG held
and not answered (S-07: nothing from it is in the sheet list), all three taken to their states through
`drawings`' services; and a Structural PDF of 8 pages built by the repo's PDF writer, read by the read
job itself (its pages matched to the listed sheets in the job's matching step):

    page 1  "S-01"                 matched
    page 2  "S-02"                 matched
    page 3  "S-03", small          S-03 is named more surely by page 4: not matched
    page 4  "S-03", large          matched (S-03's Plot)
    page 5  "S-13"                 no DWG has S-13: not matched
    page 6  "S-05"                 matched (a sheet of the held file read anyway)
    page 7  "S-07"                 the held file's sheet is not listed: not matched
    page 8  nothing on it          not matched

So 4 of 8 pages matched, and pages 3, 5, 7 and 8 each have their reason; S-06 has no page.
"""

import uuid
from pathlib import Path

import pytest

from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from engine.messages import Message
from engine.messages.decoders_agree import DISAGREE
from vextrus.drawings import services
from vextrus.drawings.messages import files as row_words
from vextrus.drawings.messages import reports as said
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db

PAGES = 8
MATCHED = (1, 2, 4, 6)
NOT_MATCHED = (3, 5, 7, 8)


def _plot() -> bytes:
    """The Structural Plot of the module's docstring, every page's lettering kept as text."""
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}

    def named(number: str, size: float = 10) -> Page:
        return Page(content=text(60, 60, number, size=size), fonts=fonts)

    pages = [
        named("S-01"),
        named("S-02"),
        named("S-03", size=4),
        named("S-03", size=12),
        named("S-13"),
        named("S-05"),
        named("S-07"),
        Page(content=b""),
    ]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


@pytest.fixture(autouse=True)
def _reader_unsandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    """The PDF reader's child run directly (`VEXTRUS_SANDBOX=off`, allowed only inside a test), as the
    reader's own tests not marked `needs_bwrap` run it."""
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


def _held(project: QsProject, name: str, numbers: list[str], *, read_anyway: bool) -> None:
    member = project.member
    held = add(member, project.project_id, name, drawing()).file
    read_dwg(member, held.id, numbers, mark_read=False)
    disagree = DISAGREE(items=12, only_first=10, only_second=2, kinds=1, layers=1, unread=0)
    with member.acting():
        services.quarantine(held.id, disagree)
        if read_anyway:
            services.answer_held(held.id, "read_anyway")
            services.mark_read(held.id)  # its re-read ended: its sheets are listed, marked held


def _read_plot(project: QsProject, tmp_path: Path) -> uuid.UUID:
    """The set of the module's docstring, its PDF read last by the read job; the PDF's id."""
    member = project.member
    dwg = add(member, project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["S-01", "S-02", "S-03"])
    _held(project, "KR-STR-B.dwg", ["S-05", "S-06"], read_anyway=True)
    _held(project, "KR-STR-C.dwg", ["S-07"], read_anyway=False)
    content = _plot()
    (tmp_path / "KR-STR-PLOT.pdf").write_bytes(content)  # kept beside the test's output, for a look
    pdf = add(member, project.project_id, "KR-STR-PLOT.pdf", content).file
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=lambda: None,
        file_id=pdf.id,
    )
    with member.acting():
        assert services.file(pdf.id).state == services.FileState.READ
        plotted = {
            s.number: s.plot.page
            for s in services.sheets(services.file(pdf.id).set_id)
            if s.plot.file_id == pdf.id and s.plot.page is not None
        }
    assert plotted == {"S-01": 1, "S-02": 2, "S-03": 4, "S-05": 6}, plotted
    return pdf.id


def _names_page(line: Message, page: int) -> bool:
    """Whether a report line is about this page: the catalogue's page reasons name it as `page`
    ("Page 12 shows sheet S-13, …"), "Pages 4 and 5 both show S-04; page 5 is used." as `first_page`."""
    params = line["params"]
    return params.get("page") == page or params.get("first_page") == page


def test_every_page_of_the_plot_is_counted_matched_or_has_its_reason(
    qs_project: QsProject, tmp_path: Path
) -> None:
    """ "11 of 12 pages matched to a sheet." and each unmatched page with its reason: the matched
    count and the pages given a reason add up to the PDF's pages, each page once."""
    pdf = _read_plot(qs_project, tmp_path)
    with qs_project.member.acting():
        lines = services.report(pdf).pages
        row = services.file(pdf).status

    assert lines[0] == said.PAGES_MATCHED(matched=len(MATCHED), pages=PAGES)
    assert row == row_words.PLOT_MATCHED(matched=len(MATCHED), pages=PAGES)
    reasons = {
        page: [line for line in lines[1:] if _names_page(line, page)] for page in range(1, PAGES + 1)
    }
    assert {page: len(said_of) for page, said_of in reasons.items()} == {
        page: (0 if page in MATCHED else 1) for page in range(1, PAGES + 1)
    }, lines


def test_a_page_whose_sheet_has_another_page_says_which_page_is_used(
    qs_project: QsProject, tmp_path: Path
) -> None:
    """ "Pages 4 and 5 both show S-04; page 5 is used.": page 3 names S-03, whose Plot is page 4."""
    pdf = _read_plot(qs_project, tmp_path)
    with qs_project.member.acting():
        lines = services.report(pdf).pages

    assert said.PAGES_SAME_SHEET(first_page=3, used_page=4, sheet="S-03") in lines, lines
