"""Ticket 157's words (#157, B2: "A never-tried state is never worded 'no page matched'"): a sheet
whose Plot was never tried against a PDF that is read does not say "no page of that PDF matched it"
(`drawings.sheets.plot_no_page`); only a match that was tried and found no page says so. At the
service boundary the sheet list's `plot.none` is a code, never English (its English is the
catalogue's, `web/src/messages/drawings/sheets/en.po`).

What the never-tried state says instead is the builder's (a code of `vextrus/drawings/messages/sheets.py`
worded in the catalogue); these tests pin only that it is a code and not the false one.
"""

import pytest

from vextrus.drawings import services
from vextrus.drawings.messages import sheets as said
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report, read_dwg

pytestmark = pytest.mark.django_db

NO_PAGE = said.PLOT_NO_PAGE.code
"""`drawings.sheets.plot_no_page`: "No Plot for this sheet: no page of {plot_file} matched it." """


def _read_pdf(project: QsProject, name: str) -> services.FileView:
    """A PDF of the sheet's Discipline, read (its report kept, the file marked read), with no match
    recorded against any sheet: the state every real upload was left in (#157's cause)."""
    member = project.member
    pdf = add(member, project.project_id, name, drawing("pdf")).file
    with member.acting():
        services.record_reports(pdf.id, upload_report=pdf_report(pdf.sha256, 2))
        services.mark_read(pdf.id)
        return services.file(pdf.id)


def test_a_sheet_never_tried_against_a_read_plot_is_not_worded_no_page_matched(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    [sheet] = read_dwg(member, dwg.id, ["S-01"])
    _read_pdf(qs_project, "KR-STR-PLOT.pdf")

    with member.acting():
        plot = services.sheet(sheet.id).plot

    assert plot.page is None
    assert plot.none is not None, "a sheet with no Plot says why"
    assert set(plot.none) == {"code", "params"}, "at the boundary the why is a code, not English"
    assert plot.none["code"] != NO_PAGE, plot.none


def test_a_sheet_the_plot_was_tried_against_and_matched_no_page_names_that_plot(
    qs_project: QsProject,
) -> None:
    """The honest "no page matched" stays: a match that ran and found none names the PDF it tried."""
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    [sheet] = read_dwg(member, dwg.id, ["S-01"])
    pdf = _read_pdf(qs_project, "KR-STR-PLOT.pdf")

    with member.acting():
        services.record_plot(sheet.id, services.PlotNone.NO_PAGE, pdf_file_id=pdf.id)
        plot = services.sheet(sheet.id).plot

    assert plot.page is None
    assert plot.none == {"code": NO_PAGE, "params": {"plot_file": "KR-STR-PLOT.pdf"}}


def test_the_sheet_list_words_no_never_tried_sheet_no_page_matched(qs_project: QsProject) -> None:
    """Every sheet of the set, as the sheet list gives them (the screen's source), not one alone."""
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["S-01", "S-02", "S-03"])
    pdf = _read_pdf(qs_project, "KR-STR-PLOT.pdf")

    with member.acting():
        listed = services.sheets(pdf.set_id)

    assert len(listed) == 3
    for sheet in listed:
        assert sheet.plot.none is not None
        assert sheet.plot.none["code"] != NO_PAGE, (sheet.number, sheet.plot.none)
