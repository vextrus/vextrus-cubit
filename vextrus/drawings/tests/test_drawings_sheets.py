"""Sheets and views (ticket 14; for 21b, 19a and 21c): one row per printed sheet, what a reading
keeps, the sheet list, the QS's decisions, and a file's Discipline changed after its sheets."""

import uuid
from typing import Any

import pytest
from django.db import connection

from engine.messages import Message
from engine.read.anchor import DwgAnchor
from engine.read.pdf.types import Page
from engine.recognise.types import (
    Box,
    ExclusionReason,
    PlotMatch,
    PlotTransform,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from engine.render.fixtures import make
from vextrus.drawings import services
from vextrus.drawings.messages import sheets as said
from vextrus.platform.services import auth
from vextrus.testing.drawings import (
    QsProject,
    add,
    artefact_for,
    drawing,
    frame,
    pdf_report,
    read_dwg,
    sheet_candidate,
)

pytestmark = pytest.mark.django_db


def one(statement: str, params: list[Any] | None = None) -> Any:
    with connection.cursor() as cursor:
        cursor.execute(statement, params or [])
        [(value,)] = cursor.fetchall()
    return value


def kept_dwg(project: QsProject, name: str = "KR-STR-R0.dwg", frames: int = 3) -> services.FileView:
    found = add(project.member, project.project_id, name, drawing()).file
    with project.member.acting():
        services.store_artefact(found.id, artefact_for(found.sha256, name, frames))
    return found


def page(sha256: str, number: int) -> Page:
    return Page(sha256, number, 1190.0, 842.0, 0, (0.0, 0.0, 1190.0, 842.0), False, ())


# One row per printed sheet ---------------------------------------------------------------------------


def test_two_issues_of_one_sheet_in_one_file_are_one_sheet_and_two_printed_sheets(
    qs_project: QsProject,
) -> None:
    found = kept_dwg(qs_project)
    candidates = [
        sheet_candidate(
            0, found.group, number="S-07", title="TYPICAL FLOOR SLAB LAYOUT", revision_mark="A"
        ),
        sheet_candidate(
            1, found.group, number="S-07", title="TYPICAL FLOOR SLAB LAYOUT", revision_mark="B"
        ),
        sheet_candidate(2, found.group, title="DOOR AND WINDOW SCHEDULE"),
    ]
    with qs_project.member.acting():
        rev_a, rev_b, schedule = services.record_sheets(found.id, candidates)
        services.mark_read(found.id)
        listed = services.sheets(found.set_id)

    assert rev_a.sheet_id == rev_b.sheet_id != schedule.sheet_id
    assert (rev_a.revision_mark, rev_b.revision_mark) == ("A", "B")
    assert (schedule.number, schedule.discipline) == (None, "structural")
    assert rev_a.discipline == "structural"
    assert rev_a.building_id == found.building_id
    assert [s.id for s in listed] == [rev_a.id, rev_b.id, schedule.id]


def test_reading_a_file_again_keeps_each_printed_sheet_and_drops_what_is_gone(
    qs_project: QsProject,
) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        first = services.record_sheets(
            found.id, [sheet_candidate(i, found.group, number=f"S-0{i + 1}") for i in range(3)]
        )
        again = services.record_sheets(
            found.id,
            [
                sheet_candidate(0, found.group, number="S-01", title="GENERAL NOTES"),
                sheet_candidate(1, found.group, number="S-02"),
            ],
        )
        sheets_left = one("select count(*) from drawings_sheet")
    assert [s.id for s in again] == [s.id for s in first[:2]]
    assert again[0].title == "GENERAL NOTES"
    assert sheets_left == 2


def test_a_reading_never_changes_or_drops_a_decided_printed_sheet(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        [s1, _s2] = services.record_sheets(
            found.id, [sheet_candidate(i, found.group, number=f"S-0{i + 1}") for i in range(2)]
        )
        services.mark_read(found.id)
        services.confirm_sheet(s1.id, confirmation_id=uuid.uuid4())
        with pytest.raises(auth.Refused) as changed:
            services.record_sheets(
                found.id,
                [
                    sheet_candidate(0, found.group, number="S-01", title="NEW"),
                    sheet_candidate(1, found.group, number="S-02"),
                ],
            )
        with pytest.raises(auth.Refused) as dropped:
            services.record_sheets(found.id, [sheet_candidate(1, found.group, number="S-02")])
    assert (changed.value.status, changed.value.message["code"]) == (409, "drawings.reads.decided")
    assert dropped.value.message == {"code": "drawings.reads.decided", "params": {"file": found.name}}


@pytest.mark.parametrize(
    ("change", "code"),
    [
        ({"group": "another building"}, "drawings.reads.wrong_group"),
        ({"discipline": Sourced("zz_only", ValueSource.FILE)}, "drawings.reads.unknown_discipline"),
        ({"title": Sourced("%%C12 BEAM", ValueSource.TITLE_BLOCK_TEXT)}, "drawings.reads.raw_codes"),
        ({"title": Sourced("GROUND\\PFLOOR", ValueSource.TITLE_BLOCK_TEXT)}, "drawings.reads.raw_codes"),
        (
            {"number": Sourced("{\\fArial;S-01}", ValueSource.TITLE_BLOCK_TEXT)},
            "drawings.reads.raw_codes",
        ),
        ({"title": Sourced("A^JB", ValueSource.TITLE_BLOCK_TEXT)}, "drawings.reads.raw_codes"),
        (
            {"anchors": (DwgAnchor("0" * 64, "synthetic", "1", "model/1", (), "1F0"),)},
            "drawings.reads.not_its_reading",
        ),
    ],
)
def test_a_sheet_that_is_not_this_files_reading_is_refused(
    qs_project: QsProject, change: dict[str, Any], code: str
) -> None:
    found = kept_dwg(qs_project)
    good = sheet_candidate(0, found.group, number="S-01", title="PLAN")
    bad = SheetCandidate(**{**good.__dict__, **change})
    with qs_project.member.acting():
        with pytest.raises(auth.Refused) as refused:
            services.record_sheets(found.id, [good, bad])
        assert one("select count(*) from drawings_sheetrevision") == 0
    assert refused.value.message == {"code": code, "params": {"file": found.name}}


def test_a_file_with_no_discipline_takes_its_sheets_one_and_the_qs_choice_stays(
    qs_project: QsProject,
) -> None:
    found = kept_dwg(qs_project, name="KR-R0.dwg")
    arch = Sourced("architectural", ValueSource.TITLE_BLOCK_TEXT)
    candidates = [
        SheetCandidate(SheetLocation(box=frame(i)),
                       number=Sourced(f"A-0{i + 1}", ValueSource.TITLE_BLOCK_TEXT),
                       discipline=arch, group=found.group)
        for i in range(2)
    ]  # fmt: skip
    with qs_project.member.acting():
        services.record_sheets(found.id, candidates)
        taken = services.file(found.id)
        services.set_discipline(found.id, "electrical")
        services.record_sheets(found.id, candidates)
        kept = services.file(found.id)
    assert (taken.discipline, taken.discipline_source) == ("architectural", "sheet_numbers")
    assert (kept.discipline, kept.discipline_source) == ("electrical", "qs")


# Views, render and Plot -----------------------------------------------------------------------------


def test_views_are_kept_in_reading_order_and_read_again_replace_the_undecided(
    qs_project: QsProject,
) -> None:
    found = kept_dwg(qs_project, frames=1)
    view = ViewCandidate(box=Box(10, 10, 100, 100), kind=ViewKind.PLAN, title="GROUND FLOOR BEAM LAYOUT")
    legend = ViewCandidate(box=Box(110, 10, 150, 60), kind=ViewKind.LEGEND, part="structural")
    with qs_project.member.acting():
        [printed] = services.record_sheets(found.id, [sheet_candidate(0, found.group, number="S-04")])
        services.mark_read(found.id)
        first = services.record_views(printed.id, [view, legend])
        again = services.record_views(printed.id, [legend])
    assert [(v.ordinal, v.kind, v.part) for v in first] == [
        (1, "plan", None),
        (2, "legend", "structural"),
    ]
    assert first[0].box == ("10.0", "10.0", "100.0", "100.0")
    assert first[0].drawing_unit == "mm"
    assert [(v.ordinal, v.kind) for v in again] == [(1, "legend")]


def test_a_view_of_another_sheet_or_part_or_with_codes_is_refused(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project, frames=1)
    anchored = (DwgAnchor(found.sha256, "synthetic", "1", "model/1", (), "1F0"),)
    elsewhere = (DwgAnchor(found.sha256, "synthetic", "1", "model/2", (), "1F0"),)
    with qs_project.member.acting():
        [printed] = services.record_sheets(
            found.id, [sheet_candidate(0, found.group, number="S-01", anchors=anchored)]
        )
        box = Box(1, 1, 2, 2)
        for candidate, code in (
            (
                ViewCandidate(box=box, kind=ViewKind.PLAN, anchors=elsewhere),
                "drawings.reads.not_its_reading",
            ),
            (
                ViewCandidate(box=box, kind=ViewKind.LEGEND, part="zz_only"),
                "drawings.reads.unknown_discipline",
            ),
            (ViewCandidate(box=box, kind=ViewKind.PLAN, title="1%%D"), "drawings.reads.raw_codes"),
        ):
            with pytest.raises(auth.Refused) as refused:
                services.record_views(printed.id, [candidate])
            assert refused.value.message == {"code": code, "params": {"file": found.name}}
    assert printed.sheet_key == "model/1"


def test_a_render_must_be_a_sheet_buffer_and_is_given_back_checked(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project, frames=1)
    good = make.make("tiny-sheet").to_bytes()
    with qs_project.member.acting():
        [printed] = services.record_sheets(found.id, [sheet_candidate(0, found.group, number="S-01")])
        services.mark_read(found.id)
        for bad in (b"", b"VXSB" + b"\x00" * 60, good[:-8], good[:12] + b"\xff" + good[13:]):
            with pytest.raises(auth.Refused) as refused:
                services.record_render(printed.id, bad)
            assert refused.value.message == {
                "code": "drawings.reads.bad_render",
                "params": {"file": found.name},
            }
        shown = services.record_render(printed.id, good)
        again = services.record_render(printed.id, make.make("tiny-sheet"))
        assert services.render(printed.id) == good
    assert shown.has_render
    assert again.has_render


def test_a_plot_page_must_be_of_a_pdf_of_the_same_set(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project, frames=1)
    pdf = add(qs_project.member, qs_project.project_id, "KR-STR-R0.pdf", drawing("pdf")).file
    with qs_project.member.acting():
        from vextrus.projects import services as projects

        other = projects.create(code="OT-3", name="Other")
    elsewhere = add(qs_project.member, other.id, "KR-STR-R0.pdf", drawing("pdf")).file
    with qs_project.member.acting():
        [printed] = services.record_sheets(found.id, [sheet_candidate(0, found.group, number="S-01")])
        services.mark_read(found.id)
        candidate = sheet_candidate(0, found.group, number="S-01")
        transform = PlotTransform(2.5, 90, (10.0, 20.0))
        matched = services.record_plot(
            printed.id, PlotMatch(page(pdf.sha256, 3), candidate, transform, 0.25)
        )
        with pytest.raises(auth.Refused) as other_set:
            services.record_plot(
                printed.id, PlotMatch(page(elsewhere.sha256, 1), candidate, transform, 0.1)
            )
        none = services.record_plot(printed.id, services.PlotNone.NO_PDF)
        no_page = services.record_plot(printed.id, services.PlotNone.NO_PAGE, pdf_file_id=pdf.id)
        with pytest.raises(auth.Refused):
            services.record_plot(printed.id, services.PlotNone.NO_PAGE, pdf_file_id=elsewhere.id)
    assert (matched.plot.file_id, matched.plot.page, matched.plot.none) == (pdf.id, 3, None)
    assert matched.plot.transform == {"scale": "2.5", "rotation": 90, "offset": ["10.0", "20.0"]}
    assert other_set.value.message["code"] == "drawings.reads.not_its_reading"
    # "No PDF" is about the set's PDFs, which change: read as they stand (a Structural one waits).
    assert none.plot.none == said.PLOT_NOT_YET()
    assert no_page.plot.none == said.PLOT_NO_PAGE(plot_file="KR-STR-R0.pdf")


def test_a_sheet_with_no_plot_recorded_says_whether_a_pdf_is_there_to_match(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    [s1] = read_dwg(member, found.id, ["S-01"])
    loose = add(member, qs_project.project_id, "plans.dwg", drawing()).file
    [unfiled] = read_dwg(member, loose.id, ["X-01"])

    def plots() -> tuple[Any, Any]:
        with member.acting():
            return services.sheet(s1.id).plot.none, services.sheet(unfiled.id).plot.none

    before = plots()
    add(member, qs_project.project_id, "KR-ARC-R0.pdf", drawing("pdf"))  # another Discipline's
    other_discipline = plots()
    scan = add(member, qs_project.project_id, "KR-STR-scan.pdf", drawing("pdf")).file
    with member.acting():
        services.record_reports(scan.id, upload_report=pdf_report(scan.sha256, 1, refused=True))
    refused = plots()
    waiting = add(member, qs_project.project_id, "KR-STR-R0.pdf", drawing("pdf")).file
    added = plots()

    with member.acting():
        services.mark_failed(waiting.id, {"code": "engine.read.reader_failed", "params": {}})
        services.record_plot(s1.id, services.PlotNone.NO_PDF)  # recorded before the PDF came
    unread = plots()
    later = add(member, qs_project.project_id, "KR-STR-R0 again.pdf", drawing("pdf")).file
    with member.acting():
        services.record_reports(later.id, upload_report=pdf_report(later.sha256, 1))
        services.mark_read(later.id)
    read = plots()

    assert before == (said.PLOT_NO_PDF(discipline="Structural"), said.PLOT_NO_PDF_ANY())
    assert other_discipline == (said.PLOT_NO_PDF(discipline="Structural"), said.PLOT_NOT_YET())
    assert refused == (said.PLOT_PDF_REFUSED(), said.PLOT_NOT_YET())
    assert added == (said.PLOT_NOT_YET(), said.PLOT_NOT_YET())
    assert unread[0] == said.PLOT_PDF_UNREAD()  # failed and refused: none that could be read
    # Read, with no match kept for the sheet: never "no page of it matched", nor "still being read"
    # (#157: only a match that ran says no page matched; the PDF is read).
    assert read[0] == said.PLOT_NOT_MATCHED(plot_file="KR-STR-R0 again.pdf")


# The sheet list --------------------------------------------------------------------------------------


def test_nothing_from_a_cancelled_failed_held_or_refused_file_is_in_the_sheet_list(
    qs_project: QsProject,
) -> None:
    member = qs_project.member
    ended = {}
    for end in ("read", "cancelled", "failed", "held", "held_read_anyway", "held_reading_anyway"):
        found = add(member, qs_project.project_id, f"{end}-STR.dwg", drawing()).file
        read_dwg(member, found.id, [f"S-{end}"], mark_read=False)
        with member.acting():
            if end == "read":
                services.mark_read(found.id)
            elif end == "cancelled":
                services.cancel(found.id, actor_name="N")
            elif end == "failed":
                services.mark_failed(found.id, {"code": "engine.decoders_agree.stopped", "params": {}})
            else:
                services.quarantine(found.id, {"code": "engine.decoders_agree.disagree", "params": {}})
                if end != "held":
                    services.answer_held(found.id, "read_anyway")
                if end == "held_read_anyway":  # its re-read ended (#165: not listed before)
                    services.mark_read(found.id)
        ended[end] = found
    with member.acting():
        listed = services.sheets(ended["read"].set_id)
        steps_kept = one("select count(*) from drawings_readstep")
        printed_kept = one("select count(*) from drawings_sheetrevision")
    assert [(s.number, s.held) for s in listed] == [("S-held_read_anyway", True), ("S-read", False)]
    assert printed_kept == 6
    assert steps_kept == 0


def test_the_sheet_list_is_by_discipline_then_number_naturally(qs_project: QsProject) -> None:
    member = qs_project.member
    arch = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    struct = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, arch.id, ["A-10", "A-2"])
    read_dwg(member, struct.id, ["S-10", "S-9", "S-01"])
    with member.acting():
        everything = [s.number for s in services.sheets(arch.set_id)]
        architectural = [s.number for s in services.sheets(arch.set_id, "architectural")]
    assert everything == ["S-01", "S-9", "S-10", "A-2", "A-10"]
    assert architectural == ["A-2", "A-10"]


# Decisions ---------------------------------------------------------------------------------------------


def test_the_qs_confirms_leaves_out_and_undoes_by_confirmation(qs_project: QsProject) -> None:
    found = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    [s1, s2] = read_dwg(qs_project.member, found.id, ["S-01", "S-02"])
    c1, c2 = uuid.uuid4(), uuid.uuid4()
    with qs_project.member.acting():
        confirmed = services.confirm_sheet(s1.id, confirmation_id=c1, kind="general_notes")
        [view] = services.views(s2.id)
        left_out = services.exclude(
            view.id, ExclusionReason.OTHER, "  part of the title block ", confirmation_id=c1
        )
        sheet_out = services.exclude(s2.id, "superseded", confirmation_id=c2)
        assert services.undo(c1) == 2
        after = {s.id: s for s in services.sheets(found.set_id)}
        [view_after] = services.views(s2.id)
    assert (confirmed.decision, confirmed.confirmed_kind, confirmed.confirmation_id) == (
        "confirmed",
        "general_notes",
        c1,
    )
    assert (left_out.decision, left_out.excluded_reason, left_out.excluded_text) == (
        "excluded",
        "other",
        "part of the title block",
    )
    assert (sheet_out.decision, sheet_out.excluded_reason) == ("excluded", "superseded")
    assert after[s1.id].decision is None
    assert after[s2.id].decision == "excluded"
    assert view_after.decision is None


@pytest.mark.parametrize(
    ("reason", "text", "code"),
    [
        ("other", "  ", "drawings.sheets.other_needs_text"),
        ("superseded", "because", "drawings.sheets.text_only_for_other"),
        ("mep", "", "drawings.sheets.reason_unknown"),
    ],
)
def test_leaving_out_takes_one_of_the_seven_and_words_only_for_other(
    qs_project: QsProject, reason: str, text: str, code: str
) -> None:
    found = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    [s1] = read_dwg(qs_project.member, found.id, ["S-01"])
    with qs_project.member.acting(), pytest.raises(auth.Refused) as refused:
        services.exclude(s1.id, reason, text, confirmation_id=uuid.uuid4())
    assert (refused.value.status, refused.value.message) == (400, {"code": code, "params": {}})


def test_a_sheet_kind_is_a_key_and_a_view_kind_one_of_the_ten(qs_project: QsProject) -> None:
    found = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    [s1] = read_dwg(qs_project.member, found.id, ["S-01"])
    with qs_project.member.acting():
        [view] = services.views(s1.id)
        for call in (
            lambda: services.confirm_sheet(s1.id, confirmation_id=uuid.uuid4(), kind="Beam Layout"),
            lambda: services.confirm_view(view.id, confirmation_id=uuid.uuid4(), kind="bird_view"),
        ):
            with pytest.raises(auth.Refused) as refused:
                call()
            assert refused.value.message == {"code": "drawings.sheets.kind_unknown", "params": {}}


def test_a_sheet_of_a_file_not_in_the_list_is_not_found_for_a_decision(qs_project: QsProject) -> None:
    found = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    [s1] = read_dwg(qs_project.member, found.id, ["S-01"], mark_read=False)
    with qs_project.member.acting():
        services.cancel(found.id, actor_name="N")
        with pytest.raises(auth.NotFound):
            services.confirm_sheet(s1.id, confirmation_id=uuid.uuid4())
        with pytest.raises(auth.NotFound):
            services.views(s1.id)


# A file's Discipline changed after its sheets ----------------------------------------------------------


def test_a_files_unconfirmed_sheets_move_with_its_discipline(qs_project: QsProject) -> None:
    member = qs_project.member
    found = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, found.id, ["E-01", "E-02"])
    with member.acting():
        moved = services.set_discipline(found.id, "electrical")
        listed = services.sheets(found.set_id, "electrical")
        revisions = one(
            "select array_agg(d.key order by r.seq) from drawings_revision r"
            " join drawings_discipline d on d.id = r.discipline_id"
        )
        its_revision = one(
            "select d.key from drawings_drawingfile f join drawings_revision r on r.id = f.revision_id"
            " join drawings_discipline d on d.id = r.discipline_id where f.id = %s",
            [found.id],
        )
    assert (moved.discipline, moved.discipline_source) == ("electrical", "qs")
    assert [s.number for s in listed] == ["E-01", "E-02"]
    # Structural's first issue, left with no file, stays (a Revision is never deleted).
    assert (revisions, its_revision) == (["structural", "electrical"], "electrical")


def test_a_decided_or_colliding_sheet_keeps_the_files_discipline(qs_project: QsProject) -> None:
    member = qs_project.member
    struct = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    arch = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    [s1] = read_dwg(member, struct.id, ["X-01"])
    read_dwg(member, arch.id, ["X-01"])
    with member.acting():
        with pytest.raises(auth.Refused) as taken:
            services.set_discipline(arch.id, "structural")
        services.confirm_sheet(s1.id, confirmation_id=uuid.uuid4())
        with pytest.raises(auth.Refused) as decided:
            services.set_discipline(struct.id, "gas")
        with pytest.raises(auth.Refused) as unknown:
            services.set_discipline(struct.id, "zz_only")
        kept = (services.file(struct.id).discipline, services.file(arch.id).discipline)
    assert (taken.value.status, taken.value.message) == (
        409,
        {
            "code": "drawings.files.discipline_sheet_taken",
            "params": {"sheet": "X-01", "discipline": "Structural"},
        },
    )
    assert (decided.value.status, decided.value.message) == (
        409,
        {"code": "drawings.files.discipline_sheet_decided", "params": {"sheet": "X-01"}},
    )
    assert (unknown.value.status, unknown.value.message["code"]) == (
        400,
        "drawings.files.discipline_unknown",
    )
    assert kept == ("structural", "architectural")


def test_a_choice_refused_while_reading_is_kept_beside_a_limit_that_cut_the_reading(
    qs_project: QsProject,
) -> None:
    """#159 fix round 1 (F2): the refusal stays the read file's finding when a limit cut the reading
    too; the limit is still said in the report's Sheets section (from the finishing step's result)."""
    member = qs_project.member
    struct = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    read_dwg(member, struct.id, ["01", "02"])
    notes = add(member, qs_project.project_id, "KR-SET3-R0.dwg", drawing()).file
    with member.acting():
        services.set_discipline(notes.id, "structural")  # while it reads: its numbers are unread
    read_dwg(member, notes.id, ["01", "02", "03"], mark_read=False)
    cut = Message(code="takeoff.read_file.not_read_in_full", params={"limit": "sheets_capped"})
    with member.acting():
        services.mark_read(notes.id, [cut])
        shown = services.file(notes.id)
    assert shown.discipline != "structural"
    assert shown.finding == {
        "code": "drawings.files.discipline_choice_undone",
        "params": {"discipline": "Structural", "sheet": "01"},
    }


# A title read from a sheet's one view (#332) ---------------------------------------------------------


def test_an_unnumbered_sheet_takes_a_view_title_on_its_own_row(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project, frames=1)
    with qs_project.member.acting():
        [unnumbered] = services.record_sheets(found.id, [sheet_candidate(0, found.group)])
        titled = services.record_sheet_title(
            unnumbered.id, title=Sourced("BOUNDARY WALL DETAIL", ValueSource.VIEW_TITLE)
        )

    assert (titled.title, titled.sources["title"]) == ("BOUNDARY WALL DETAIL", "view_title")
    assert titled.number is None
