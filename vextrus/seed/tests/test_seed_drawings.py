"""The demo seed's `drawings` rows (ticket 14; m0-screens §7): KR-01 at §7's state after reading,
BP-02's file states and stall, MG-01's read DWG, every render decoding and no raw code in a title."""

from collections import Counter
from datetime import timedelta
from typing import Any

import pytest
from django.db import connection
from django.utils import timezone

from engine.render.buffers import SheetBuffers
from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.drawings.messages import sheets as sheet_words
from vextrus.platform.services import jobs, tenancy
from vextrus.seed import drawings as seed_drawings
from vextrus.seed import platform as seed_platform
from vextrus.seed import projects as seed_projects
from vextrus.seed.demo import Demo
from vextrus.takeoff.tasks.read_file import read_file

RAW_CODES = ("%%", "\\P", "\\f", "\\S", "^J", "{\\")


@pytest.fixture
def demo(monkeypatch: pytest.MonkeyPatch) -> Demo:
    """platform's, projects' and drawings' seeds, as `seed_demo` runs them."""
    monkeypatch.setenv(seed_platform.PASSWORD_VARIABLE, "a demo password for the tests")
    made: Demo = {}
    seed_platform.run(made)
    seed_projects.run(made)
    seed_drawings.run(made)
    return made


def files_of(demo: Demo, developer: str, code: str) -> dict[str, services.FileView]:
    with tenancy.acting_in(demo[developer]):
        return {f.name: f for f in services.files(demo[f"drawing_set:{code}"])}


@pytest.mark.django_db(databases=["default", "owner"])
def test_kr_01_is_at_section_7s_state(demo: Demo) -> None:
    shown = files_of(demo, "developer:shapla", "KR-01")
    with tenancy.acting_in(demo["developer:shapla"]):
        sheets = services.sheets(demo["drawing_set:KR-01"])
        views = {sheet.id: services.views(sheet.id) for sheet in sheets}
        renders = [services.render(sheet.id) for sheet in sheets]
        summary = services.summary(shown.values())

    assert {name: f.status for name, f in shown.items()} == {
        "KR-STR-R0.dwg": said.READ(),
        "KR-ARC-R0.dwg": said.READ_BANGLA(),
        "KR-ELE-R0.dwg": said.READ(),
        "KR-STR-R0.pdf": said.PLOT_MATCHED(matched=11, pages=12),
        "KR-ARC-R0.pdf": said.PLOT_MATCHED_LINES(matched=8, pages=8),
        "KR-STR-old.dwg": said.HELD(),
        "site-photos.pdf": said.REFUSED_SCAN(),
    }
    assert Counter(s.discipline for s in sheets) == {
        "structural": 13,
        "architectural": 8,
        "electrical": 3,
    }
    assert summary == said.SUMMARY(files=7, sheets=24, reading=0, failed=0, held=1, refused=1)
    assert shown["KR-STR-old.dwg"].sheets_found is None
    # Electrical has no PDF: the refused site photographs (of no Discipline) are not its Plot.
    electrical = [s.plot.none for s in sheets if s.discipline == "electrical"]
    assert electrical == [sheet_words.PLOT_NO_PDF(discipline="Electrical")] * 3
    every_view = [v for listed in views.values() for v in listed]
    assert len(every_view) == 70
    assert sum(v.kind == "title_block" for v in every_view) == 23
    excluded = [v for v in every_view if v.proposed_exclusion]
    proposed = [v for v in every_view if not v.proposed_exclusion and (v.steps or v.part)]
    unaccounted = [v for v in every_view if not v.proposed_exclusion and not v.steps and not v.part]
    assert (len(excluded), len(proposed), len(unaccounted)) == (25, 43, 2)
    by_number = {(s.number, s.revision_mark): s for s in sheets}
    assert {v.title for v in unaccounted} == {""}
    assert all(v.sheet_revision_id == by_number[("S-10", "R0")].id for v in unaccounted)
    assert by_number[("S-07", "A")].sheet_id == by_number[("S-07", "B")].sheet_id
    assert [s.title for s in sheets if s.number is None] == ["DOOR AND WINDOW SCHEDULE"]
    for sheet, content in zip(sheets, renders, strict=True):
        buffers = SheetBuffers.from_bytes(content)
        for view in views[sheet.id]:
            assert_on_paper(view.box, sheet, buffers)
    for text in [s.title for s in sheets] + [v.title for v in every_view]:
        assert not any(code in text for code in RAW_CODES), text


def assert_on_paper(
    box: tuple[str, str, str, str], sheet: services.SheetView, buffers: SheetBuffers
) -> None:
    """A view's box lies on its sheet's paper: inside a laid-out sheet's frame, or a layout's paper."""
    x0, y0, x1, y1 = (float(v) for v in box)
    if "box" in sheet.location:
        fx0, fy0, fx1, fy1 = (float(v) for v in sheet.location["box"])
    else:
        paper = buffers.paper
        fx0, fy0 = paper.origin
        fx1 = fx0 + paper.width_mm / paper.mm_per_unit
        fy1 = fy0 + paper.height_mm / paper.mm_per_unit
    assert fx0 <= x0 < x1 <= fx1, (sheet.number, box)
    assert fy0 <= y0 < y1 <= fy1, (sheet.number, box)


@pytest.mark.django_db(databases=["default", "owner"])
def test_kr_01s_reports_say_what_section_7_says(demo: Demo) -> None:
    shown = files_of(demo, "developer:shapla", "KR-01")
    with tenancy.acting_in(demo["developer:shapla"]):
        structural = services.report(shown["KR-STR-R0.dwg"].id)
        architectural = services.report(shown["KR-ARC-R0.dwg"].id)
        structural_pdf = services.report(shown["KR-STR-R0.pdf"].id)
        held = services.report(shown["KR-STR-old.dwg"].id)

    assert [row.asked["params"]["asked"] for row in structural.font_rows] == [
        "Arial", "Romans", "Swiss 721 Condensed",
    ]  # fmt: skip
    assert architectural.sheets[0] == {
        "code": "drawings.reports.sheets_found",
        "params": {"sheets": 8, "drawn": 6, "layouts": 2},
    }
    assert architectural.sheets[1]["code"] == "drawings.reports.empty_layouts"
    assert [line["params"].get("texts") for line in architectural.bangla] == [9]
    assert structural_pdf.pages[0] == {
        "code": "drawings.reports.pages_matched",
        "params": {"matched": 11, "pages": 12},
    }
    assert {
        "code": "drawings.reports.page_sheet_not_in_dwg",
        "params": {"page": 12, "sheet": "S-13"},
    } in (structural_pdf.pages)
    assert held.readers[0]["code"] == "engine.decoders_agree.disagree"


@pytest.mark.django_db(databases=["default", "owner"])
def test_bp_02_holds_the_rows_a_file_with_no_read_job_can_be_on(demo: Demo) -> None:
    shown = files_of(demo, "developer:shapla", "BP-02")

    assert {name: f.status for name, f in shown.items()} == {
        "BP-STR-R0.dwg": said.READING_SHEET(position=7, total=12),
        "BP-STR-R0.pdf": said.PLOT_WAITING(),  # its DWG is still reading
        "BP-ARC-R0.dwg": said.WAITING(ahead=1),  # BP-STR-R0.dwg is read before it
        "BP-ARC-old.dwg": said.HELD(),  # 19a's seed answers it
        "BP-ARC-R0.pdf": said.PLOT_MATCHED(matched=4, pages=6),  # against BP-ARC-old.dwg's sheets
        "BP-ELE-R0.dwg": said.CANCELLED(
            actor="Nusrat Jahan", vextrus="no", cancelled_date=_cancelled(shown)
        ),
        "BP-PLB-R0.dwg": said.FAILED(tries=3),
        "BP-FIRE-R0.dwg": said.FAILED(tries=1),
        "BP-LIFT-R12.dwg": said.OLD_VERSION(),
    }
    assert shown["BP-FIRE-R0.dwg"].finding == {
        "code": "engine.decoders_agree.not_installed",
        "params": {},
    }


def _cancelled(shown: dict[str, services.FileView]) -> Any:
    return shown["BP-ELE-R0.dwg"].status["params"]["cancelled_date"]


@pytest.mark.django_db(databases=["default", "owner"])
def test_mg_01_holds_one_read_dwg_and_meghna_sees_nothing_of_shapla(demo: Demo) -> None:
    shown = files_of(demo, "developer:meghna", "MG-01")
    with tenancy.acting_in(demo["developer:meghna"]), connection.cursor() as cursor:
        cursor.execute("select count(*) from drawings_drawingfile")
        [(files,)] = cursor.fetchall()

    assert {name: f.status for name, f in shown.items()} == {
        "MG-STR-R0.dwg": said.READ(),
        "MG-ARC-R0.pdf": said.READING_PAGE_LEFT(position=5, total=16, minutes=120),
        "MG-ARC-R0.dwg": said.RETRYING(attempt=2, tries=3),
    }
    assert files == 3


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_seed_refuses_without_the_markets_library(monkeypatch: pytest.MonkeyPatch) -> None:
    from django.db import DatabaseError

    def cannot(using: str = "owner") -> dict[str, int]:
        raise DatabaseError("the owner cannot connect")

    monkeypatch.setattr("vextrus.platform.services.library.sync", cannot)

    with pytest.raises(seed_drawings.SeedRefused, match=r"manage\.py sync_library"):
        seed_drawings.run({})


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_seed_refuses_a_market_with_no_disciplines(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(seed_platform.PASSWORD_VARIABLE, "a demo password for the tests")
    made: Demo = {}
    seed_platform.run(made)
    seed_projects.run(made)
    monkeypatch.setattr("vextrus.platform.services.library.sync", lambda using="owner": {})
    monkeypatch.setattr("vextrus.drawings.services.disciplines", list)

    with pytest.raises(seed_drawings.SeedRefused, match=r"manage\.py sync_library"):
        seed_drawings.run(made)


@pytest.mark.django_db(databases=["default", "owner"])
@pytest.mark.parametrize(
    ("later", "words"),
    [
        (25, said.READING_PAGE_LEFT(position=5, total=16, minutes=95)),
        (31, said.READING_PAGE(position=5, total=16)),
        (24 * 60, said.READING_PAGE(position=5, total=16)),
    ],
)
def test_the_seeded_reading_pdf_reads_sensibly_on_a_walk_later(
    demo: Demo, monkeypatch: pytest.MonkeyPatch, later: int, words: Any
) -> None:
    """Its time left counts down from the seed's clock stamp for 30 minutes (STEADY times a page's
    PAGE_MINUTES), never below a minute; after that it reads as a stalled read does, no time left."""
    walked = timezone.now() + timedelta(minutes=later)
    monkeypatch.setattr("vextrus.drawings.services.drawing_files.timezone.now", lambda: walked)
    shown = files_of(demo, "developer:meghna", "MG-01")

    assert shown["MG-ARC-R0.pdf"].status == words


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_seeded_retrying_file_can_be_cancelled_and_tried_again(demo: Demo) -> None:
    """Its job is 21a's read job, declared wherever the app runs (a job the seed declared itself was
    unknown to the served app, whose "Try again" then failed), waiting for its second try."""
    file_id = demo["file:MG-01:MG-ARC-R0.dwg"]
    with tenancy.acting_in(demo["developer:meghna"], user_id=demo["user:tanvir"]):
        seeded = services.file(file_id)
        assert seeded.read_job_id is not None
        state = jobs.state(seeded.read_job_id)
        assert state is not None
        assert (state.task, state.status, state.attempt) == (read_file.name, "retrying", 2)
        services.cancel(file_id, actor_name="Tanvir Ahmed")
        again = services.restart(file_id)

    assert again.state == services.FileState.WAITING
