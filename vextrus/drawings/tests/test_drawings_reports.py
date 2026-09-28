"""A file's report panel (ticket 14; m0-screens 4.5): what `drawings` writes of the readers, the Plot
and a PDF's pages, as each file and its PDFs stand."""

from engine.messages import read as read_codes
from engine.read.pdf.types import Page
from engine.recognise.types import PlotMatch
from vextrus.drawings import services
from vextrus.drawings.messages import reports as said
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report, read_dwg, sheet_candidate


def page(sha256: str, number: int) -> Page:
    return Page(sha256, number, 1190.0, 842.0, 0, (0.0, 0.0, 1190.0, 842.0), False, ())


def a_pdf(qs_project: QsProject, name: str, pages: int, *, refused: bool = False) -> services.FileView:
    found = add(qs_project.member, qs_project.project_id, name, drawing("pdf")).file
    with qs_project.member.acting():
        services.record_reports(found.id, upload_report=pdf_report(found.sha256, pages, refused=refused))
        if not refused:
            services.mark_read(found.id)
    return found


def test_a_dwg_names_each_pdf_plotted_from_it_first_added_first(qs_project: QsProject) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    s1, s2 = read_dwg(member, dwg.id, ["S-01", "S-02"])
    with member.acting():
        alone = services.report(dwg.id).plot
    first = a_pdf(qs_project, "KR-STR-R0.pdf", 1)
    second = a_pdf(qs_project, "KR-STR-R0 part 2.pdf", 1)
    unmatched = a_pdf(qs_project, "KR-STR-R0 old.pdf", 3)
    scan = a_pdf(qs_project, "KR-STR-scan.pdf", 1, refused=True)
    a_pdf(qs_project, "site-photos.pdf", 2)  # of no Discipline, and named by no sheet: not its Plot
    with member.acting():
        services.record_plot(s1.id, PlotMatch(page(first.sha256, 1), sheet_candidate(0, dwg.group)))
        services.record_plot(s2.id, PlotMatch(page(second.sha256, 1), sheet_candidate(1, dwg.group)))
        plot = services.report(dwg.id).plot

    assert alone == (said.NO_PLOT(),)
    assert plot == (
        said.PLOT_OF_DWG(plot_file="KR-STR-R0.pdf", with_page=1, sheets=2),
        said.PLOT_PART(plot_file="KR-STR-R0 part 2.pdf", with_page=1, sheets=2),
        said.PLOT_NONE_MATCHED(plot_file="KR-STR-R0 old.pdf"),
        said.PLOT_REFUSED_UNUSED(plot_file="KR-STR-scan.pdf"),
    )
    assert (unmatched.discipline, scan.discipline) == ("structural", "structural")


def test_a_dwg_says_what_became_of_a_pdf_with_no_page_for_it(qs_project: QsProject) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["A-01"])
    a_pdf(qs_project, "KR-ARC-scan.pdf", 1, refused=True)
    failed = add(member, qs_project.project_id, "KR-ARC-R0.pdf", drawing("pdf")).file
    add(member, qs_project.project_id, "KR-ARC-R1.pdf", drawing("pdf"))
    with member.acting():
        services.mark_failed(failed.id, {"code": "engine.read.reader_failed", "params": {}})
        plot = services.report(dwg.id).plot

    assert plot == (
        said.PLOT_REFUSED_UNUSED(plot_file="KR-ARC-scan.pdf"),  # another is being read
        said.PLOT_UNREAD(plot_file="KR-ARC-R0.pdf"),
        said.PLOT_READING(plot_file="KR-ARC-R1.pdf"),
    )


def test_a_refused_pdf_with_nothing_beside_it_asks_for_one_plotted_from_autocad(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["A-01"])
    a_pdf(qs_project, "KR-ARC-scan.pdf", 1, refused=True)
    with member.acting():
        plot = services.report(dwg.id).plot

    assert plot == (said.PLOT_REFUSED(plot_file="KR-ARC-scan.pdf"),)


def test_a_pdf_waits_for_a_dwg_of_its_discipline_then_says_what_matched(qs_project: QsProject) -> None:
    member = qs_project.member
    pdf = a_pdf(qs_project, "KR-STR-R0.pdf", 3)
    with member.acting():
        waiting = services.report(pdf.id).pages
    other = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    read_dwg(member, other.id, ["A-01"])
    with member.acting():
        still = services.report(pdf.id).pages
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, dwg.id, ["S-01"])
    with member.acting():
        read = services.report(pdf.id).pages

    assert waiting == still == (said.NO_DWG_FOR_PAGES(),)
    assert read == (said.PAGES_MATCHED(matched=0, pages=3),)


def test_a_file_that_could_not_be_read_says_why_in_its_readers_section(qs_project: QsProject) -> None:
    member = qs_project.member
    failed = add(member, qs_project.project_id, "KR-PLB-R0.dwg", drawing()).file
    finding = read_codes.OBJECTS_MISSING(count=3)
    with member.acting():
        services.mark_failed(failed.id, finding, tries=3)
        readers = services.report(failed.id).readers
    assert readers == (finding,)
