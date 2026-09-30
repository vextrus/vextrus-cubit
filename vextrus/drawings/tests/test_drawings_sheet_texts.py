"""Ticket 21c's parts of a Drawing Set: "Mark for Vextrus" on a file that could not be read, and the
report's sheets (the Bangla text section's sheets; the Fonts table's "Sheets" column), worked out from
the kept ReadArtefact and each printed sheet's location. Invented drawings only (docs/sdlc.md)."""

import uuid

import pytest

from engine.check.bangla_ansi import BanglaAnsi, Flagged, FoundBy
from engine.read.artefact import ReadArtefact
from engine.recognise.types import CheckOutcome, CheckResult, SheetCandidate, SheetLocation
from engine.render import fonts
from engine.render.fixtures.artefacts import PAPER, Drawing
from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.drawings.services import _on_sheets
from vextrus.platform.services import auth
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, frame, read_dwg, sheet_candidate

pytestmark = pytest.mark.django_db

BANGLA = "Kÿvm"
"""An invented text as a Bijoy-style font stores Bangla."""


def invented(sha256: str, name: str) -> tuple[ReadArtefact, list[str]]:
    """Three sheets laid out in model space (`frame(0..2)`) and one on the layout `Layout1`:
    - S-01: an Arial text, and the title block's text (romans.shx, a block inserted on S-01 and S-03);
    - S-02: two Bangla texts;
    - S-03: an Arial text, and the title block's again;
    - S-04 (the layout): an Arial text and one Bangla text;
    and one Bangla text on no sheet. Answers the artefact and the Bangla texts' handles."""
    d = Drawing()
    block = d.block("TITLE")
    d.text("TITLE BLOCK", (5.0, 5.0, 0.0), font="romans.shx", owner=block)
    for i in (0, 2):
        d.text(f"NOTE {i}", (frame(i).x0 + 20.0, 100.0, 0.0))
        d.insert(block, (frame(i).x0 + 150.0, 10.0, 0.0))
    x = frame(1).x0
    bangla = [
        d.text(BANGLA, (x + 20.0, 60.0, 0.0), font="SutonnyMJ.ttf"),
        d.text(BANGLA, (x + 60.0, 60.0, 0.0), font="SutonnyMJ.ttf"),
    ]
    d.text("LAYOUT NOTE", (10.0, 10.0, 0.0), owner=PAPER)
    bangla.append(d.text(BANGLA, (40.0, 10.0, 0.0), font="SutonnyMJ.ttf", owner=PAPER))
    bangla.append(d.text(BANGLA, (-500.0, -500.0, 0.0), font="SutonnyMJ.ttf"))  # on no sheet
    made = d.artefact()
    s = made.summary
    return (
        ReadArtefact.build(
            source_sha256=sha256,
            source_name=name,
            format=s.format,
            reader=s.reader,
            reader_version=s.reader_version,
            layouts=list(s.layouts),
            insunits=s.insunits,
            notes=list(s.notes),
            blocks=made.blocks.values(),
            entities=made.entities.values(),
        ),
        bangla,
    )


def read_invented(qs: QsProject, *, mark_read: bool = True) -> tuple[uuid.UUID, list[uuid.UUID]]:
    found = add(qs.member, qs.project_id, "KR-STR-R0.dwg", drawing()).file
    with qs.member.acting():
        artefact, bangla = invented(found.sha256, found.name)
        services.store_artefact(found.id, artefact)
        services.record_reports(
            found.id,
            cross_check=CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED),
            font_report=fonts.report(artefact),
            bangla_ansi=BanglaAnsi(tuple(Flagged(h, FoundBy.FONT, "SutonnyMJ") for h in bangla)),
        )
        candidates = [
            sheet_candidate(i, found.group, number=f"S-0{i + 1}", title=f"Sheet {i + 1}")
            for i in range(3)
        ]
        layout = sheet_candidate(0, found.group, number="S-04", title="Sheet 4")
        candidates.append(
            SheetCandidate(
                location=SheetLocation(layout="Layout1"),
                number=layout.number,
                title=layout.title,
                group=found.group,
            )
        )
        printed = services.record_sheets(found.id, candidates)
        if mark_read:
            services.mark_read(found.id)
    return found.id, [sheet.id for sheet in printed]


def font_sheets(report: services.Report) -> dict[str, int]:
    return {str(row.asked["params"]["asked"]).casefold(): row.sheets for row in report.font_rows}


def test_the_report_names_the_sheets_with_bangla_text_in_sheet_order(qs_project: QsProject) -> None:
    file_id, ids = read_invented(qs_project)
    with qs_project.member.acting():
        report = services.report(file_id)

    assert report.bangla_sheets == (
        services.BanglaSheet(ids[1], "S-02", 2),
        services.BanglaSheet(ids[3], "S-04", 1),  # on the layout; the text on no sheet is on none
    )


def test_each_font_row_counts_the_sheets_its_texts_are_on(qs_project: QsProject) -> None:
    file_id, _ = read_invented(qs_project)
    with qs_project.member.acting():
        report = services.report(file_id)

    # Arial on S-01, S-03 and the layout; the title block's font where its block is inserted.
    assert font_sheets(report) == {"arial": 3, "romans": 2, "sutonnymj": 2}


def test_a_file_whose_sheets_are_not_listed_names_none(qs_project: QsProject) -> None:
    file_id, _ = read_invented(qs_project, mark_read=False)
    with qs_project.member.acting():
        report = services.report(file_id)

    assert report.bangla_sheets == ()
    assert set(font_sheets(report).values()) == {0}


def test_texts_on_places_a_text_by_its_insertion_point_through_its_inserts() -> None:
    artefact, bangla = invented("0" * 64, "invented.dwg")
    box = frame(1)
    on = _on_sheets.texts_on(
        artefact,
        [
            ("drawn", {"box": [repr(box.x0), repr(box.y0), repr(box.x1), repr(box.y1)]}),
            ("layout", {"layout": "Layout1"}),
            ("gone", {"layout": "No such layout"}),
            ("bad", {"box": ["x", 1, 2, 3]}),
        ],
    )

    assert on["drawn"] == set(bangla[:2])
    assert bangla[2] in on["layout"]
    assert len(on["layout"]) == 2
    assert (on["gone"], on["bad"]) == (set(), set())


# Mark for Vextrus ---------------------------------------------------------------------------------


def failed(qs: QsProject) -> uuid.UUID:
    found = add(qs.member, qs.project_id, "KR-STR-R1.dwg", drawing()).file
    with qs.member.acting():
        services.mark_failed(found.id, {"code": "engine.read.reader_failed", "params": {}}, tries=3)
    return found.id


def test_a_failed_file_is_marked_once_and_reading_it_again_clears_the_mark(
    qs_project: QsProject,
) -> None:
    file_id = failed(qs_project)
    with qs_project.member.acting():
        before = services.file(file_id).marked_for_vextrus
        marked = services.mark_for_vextrus(file_id)
        again = services.mark_for_vextrus(file_id)
        restarted = services.restart(file_id)

    assert (before, marked.marked_for_vextrus, again.marked_for_vextrus) == (False, True, True)
    assert marked.state == services.FileState.FAILED
    assert restarted.marked_for_vextrus is False


def test_only_a_file_that_could_not_be_read_is_marked(qs_project: QsProject) -> None:
    member = qs_project.member
    read = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    read_dwg(member, read.id, ["A-01"])
    waiting = add(member, qs_project.project_id, "KR-ARC-R1.dwg", drawing()).file
    with member.acting():
        refusals = []
        for file_id in (read.id, waiting.id):
            with pytest.raises(auth.Refused) as refused:
                services.mark_for_vextrus(file_id)
            refusals.append((refused.value.status, refused.value.message))
        shown = [services.file(read.id).marked_for_vextrus, services.file(waiting.id).marked_for_vextrus]

    assert refusals == [(409, said.NOT_FAILED())] * 2
    assert shown == [False, False]


def test_the_api_refuses_to_mark_a_read_file_in_words(qs_project: QsProject) -> None:
    member = qs_project.member
    read = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    read_dwg(member, read.id, ["A-01"])
    path = f"/api/projects/{qs_project.project_id}/drawings/files/{read.id}/mark-for-vextrus"

    response = api_as(member).post(path)

    assert (response.status_code, response.json()) == (409, said.NOT_FAILED())


def test_a_read_file_with_no_sheet_asks_to_be_marked_and_is(qs_project: QsProject) -> None:
    """The words gate's M1: the report tells the QS to mark a read file that found no sheet (4.5), so
    the act takes it; a file read in full is still refused (above)."""
    member = qs_project.member
    empty = add(member, qs_project.project_id, "KR-ARC-R0.dwg", drawing()).file
    read_dwg(member, empty.id, [])
    with member.acting():
        marked = services.mark_for_vextrus(empty.id)

    assert (marked.state, marked.marked_for_vextrus) == (services.FileState.READ, True)
