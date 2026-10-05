"""Ticket 236 (#236): the demo seed's Plot is the read job's own. KR-01's two PDFs are added after its
DWGs and read by the read job like any Plot, their pages matched to the sheets the DWGs' reads listed,
so a DWG read later (a QS adds a file during a walk) leaves them as they were ("the seed is made
faithful, not the matcher lenient").

Every test seeds with the toolchain switched off (t182's `no_toolchain`: no process may start), so the
seed reads its PDFs in this process (`kr01.replayed()`) and places each page by its text and sizes
(`ink=False`): a match has a transform and a residual, and no `render_f1`.
"""

import inspect
import re
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from django.db import connection, transaction

from engine.messages import plot as plot_codes
from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.drawings.messages import sheets as sheet_words
from vextrus.platform.services import tenancy
from vextrus.seed import drawings as seed_drawings
from vextrus.seed import kr01
from vextrus.seed.demo import Demo
from vextrus.takeoff.services.read_propose import plot

from ..t21c.step1_whole import open_questions, proposals, the
from ..t182 import test_seed_by_the_job as t182
from ..t182.test_seed_without_the_toolchain import as_nusrat, no_toolchain, seeded  # noqa: F401
from .test_kr01_pdfs import ARC, STR, TURNED, structural_sheets
from .test_readers_seam import no_sandbox  # noqa: F401 (a fixture)

pytestmark = pytest.mark.django_db(databases=["default", "owner"])

PT_PER_MM = 72 / 25.4
MOST_RESIDUAL_MM = 2.0


@pytest.fixture(autouse=True)
def sandbox_refused(no_sandbox: list[str]) -> Iterator[None]:  # noqa: F811 (a fixture)
    """The seed reads its PDFs in this process: the engine's sandboxed child is never started (CI
    has none), before, during or after the seed."""
    yield
    assert no_sandbox == []


def kr01_sheets(demo: Demo) -> list[services.SheetView]:
    with tenancy.acting_in(demo["developer:shapla"]):
        return services.sheets(demo["drawing_set:KR-01"])


def kr01_files(demo: Demo) -> dict[str, services.FileView]:
    with tenancy.acting_in(demo["developer:shapla"]):
        return {f.name: f for f in services.files(demo["drawing_set:KR-01"])}


def page_lines(demo: Demo, name: str) -> list[dict[str, Any]]:
    """The PDF's report lines on its pages (`drawings.report(...).pages`)."""
    with tenancy.acting_in(demo["developer:shapla"]):
        return [dict(line) for line in services.report(demo[f"file:KR-01:{name}"]).pages]


def of_file(demo: Demo, name: str) -> list[services.SheetView]:
    return [s for s in kr01_sheets(demo) if s.file_id == demo[f"file:KR-01:{name}"]]


def test_the_seeded_plots_are_the_jobs_matches(seeded: Demo) -> None:  # noqa: F811 (t182's fixture)
    """Case 3: the Structural PDF matches 11 of its 12 pages, the Architectural 7 of 8 (the
    unnumbered schedule's page names no sheet); each page is placed 1:1, turned where the page is."""
    shown = kr01_files(seeded)
    assert shown[STR].status == said.PLOT_MATCHED(matched=11, pages=12)
    assert shown[ARC].status == said.PLOT_MATCHED_LINES(matched=7, pages=8)
    structural_pdf, architectural_pdf = shown[STR].id, shown[ARC].id

    pages = {s.number: n for n, s in enumerate(structural_sheets(), start=1)}
    for sheet in of_file(seeded, "KR-STR-R0.dwg"):
        if sheet.number == "S-07":
            assert sheet.plot.none == sheet_words.PLOT_NO_PAGE(plot_file=STR), sheet.revision_mark
            assert sheet.plot.page is None
            continue
        assert (sheet.plot.file_id, sheet.plot.page) == (structural_pdf, pages[sheet.number])
        assert_placed(sheet, turned=pages[sheet.number] in TURNED)

    architectural = of_file(seeded, "KR-ARC-R0.dwg")
    drawn = list(seed_drawings.ARCHITECTURAL)
    assert len(architectural) == len(drawn)
    for sheet in architectural:
        if sheet.number is None:
            assert sheet.plot.page is None, sheet.title
            continue
        [n] = [n for n, s in enumerate(drawn, start=1) if s.number == sheet.number]
        assert (sheet.plot.file_id, sheet.plot.page) == (architectural_pdf, n)
        assert_placed(sheet, turned=False)

    electrical = of_file(seeded, "KR-ELE-R0.dwg")
    assert [s.plot.none for s in electrical] == [sheet_words.PLOT_NO_PDF(discipline="Electrical")] * len(
        electrical
    )
    assert [s.plot.render_f1 for s in kr01_sheets(seeded) if s.plot.render_f1 is not None] == []

    schedule_page = 1 + [s.number for s in drawn].index(None)
    no_sheet = plot_codes.REASONS["names_no_sheet"]
    assert dict(no_sheet(page=12)) in page_lines(seeded, STR)
    assert dict(no_sheet(page=schedule_page)) in page_lines(seeded, ARC)


def assert_placed(sheet: services.SheetView, *, turned: bool) -> None:
    transform = sheet.plot.transform
    assert transform is not None, sheet.number
    assert float(transform["scale"]) == pytest.approx(PT_PER_MM, rel=0.01), sheet.number
    assert int(transform["rotation"]) == (90 if turned else 0), sheet.number
    assert sheet.plot.residual is not None, sheet.number
    assert float(sheet.plot.residual) <= MOST_RESIDUAL_MM, sheet.number
    assert sheet.plot.none is None, sheet.number


def test_the_seed_plots_come_from_the_job_not_the_seed(seeded: Demo) -> None:  # noqa: F811 (t182's fixture)
    """Case 4: each PDF went through the read job's `matching` step; `kadam` no longer writes KR-01's
    Plot by hand (no call of the seed's own `pdf(` or `plot(`)."""
    for name in (STR, ARC):
        file_id: uuid.UUID = seeded[f"file:KR-01:{name}"]
        with tenancy.acting_in(seeded["developer:shapla"]), connection.cursor() as cursor:
            cursor.execute("select step from drawings_readstep where file_id = %s", [file_id])
            steps = {step for (step,) in cursor.fetchall()}
        assert "matching" in steps, f"{name} was not matched by the read job: its steps are {steps}"

    source = inspect.getsource(seed_drawings.kadam)
    assert re.findall(r"(?<![\w.])(pdf|plot)\(", source) == []


Plots = list[tuple[str, str, int | None, str, str]]


def snapshot(demo: Demo) -> tuple[Plots, list[tuple[str, Any]], list[list[dict[str, Any]]]]:
    """Every KR-01 sheet's Plot, and each PDF's status and lines on its pages."""
    plots = sorted(
        (
            str(s.id),
            str(s.plot.file_id),
            s.plot.page,
            repr(s.plot.transform),
            repr(s.plot.none),
        )
        for s in kr01_sheets(demo)
    )
    shown = kr01_files(demo)
    return (
        plots,
        [(name, shown[name].status) for name in (STR, ARC)],
        [page_lines(demo, name) for name in (STR, ARC)],
    )


def match_for(demo: Demo, name: str) -> None:
    """What a DWG's `finishing` step does: the set's Plot matched again for it, in a transaction."""
    file_id: uuid.UUID = demo[f"file:KR-01:{name}"]
    with (
        tenancy.acting_in(demo["developer:shapla"], user_id=demo["user:nusrat"]),
        transaction.atomic(),
    ):
        seam: Any = plot.match  # 236's `match(file_id, readers)`: the file alone until built
        seam(file_id, kr01.replayed())


def test_a_dwg_read_after_the_seed_leaves_the_plots_alone(seeded: Demo) -> None:  # noqa: F811 (t182's fixture)
    """Case 5 (#236's own): a DWG's Plot matched again after the seed changes no sheet's page, no
    PDF's status and no line on its pages, however often and for whichever DWG."""
    before = snapshot(seeded)

    match_for(seeded, "KR-ELE-R0.dwg")
    assert snapshot(seeded) == before
    match_for(seeded, "KR-ELE-R0.dwg")
    assert snapshot(seeded) == before
    match_for(seeded, "KR-STR-R0.dwg")
    assert snapshot(seeded) == before
    assert sum(page is not None for (_, _, page, _, _) in before[0]) == 18


def test_section_7s_counts_still_hold(seeded: Demo) -> None:  # noqa: F811 (t182's fixture)
    """Case 6: with the Plot from the job, t182's counts of §7 hold as t182's own checks pin them
    (24 sheets, the five Questions in queue order, the coverage, the bulk act and its one-source
    sheets), and A-05 stays a kind Question."""
    nusrat = as_nusrat(seeded)
    project: uuid.UUID = seeded["project:KR-01"]
    t182.read_by_the_job(seeded)

    t182.test_the_job_finds_24_sheets_structural_13_architectural_8_electrical_3(nusrat, project, None)
    t182.test_the_job_asks_the_five_questions_in_queue_order(nusrat, project, None)
    t182.test_the_jobs_coverage_is_70_views_68_proposed_2_unaccounted(nusrat, project, None)
    t182.test_the_bulk_act_holds_17_that_agree_and_the_electrical_sheets_have_one_source(
        nusrat, project, None
    )
    [kind] = open_questions(nusrat, project, "low_confidence")
    assert kind["subject_id"] == the(proposals(nusrat, project), "A-05")["sheet_id"]
