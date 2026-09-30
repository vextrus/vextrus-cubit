"""Ticket 157 through the real read job (#157, B2: "Integration test: upload a synthetic DWG and its
Plot; each sheet's `plot_page` is set"): the PDF job's matching step registers the Plot's pages to the
set's sheets and records each through `drawings.services.record_plot`, in whichever order the two
files are read.

The set is synthetic, built in the test's folder by the repo's writers: 13's set A
(`engine/fixtures/dwg/sheet_set_layouts.py`: S-101, S-102, S-103) and ticket 18's Plot of it
(`engine/plot/tests/acceptance/t18/test_plot_registration.py`, `_plot`: page 1 plots S-102, page 2
S-101, page 3 S-103 with its title block stroked and its number in the body, page 4 a sheet no drawing
has). Both are Structural by their names. Needs the toolchain:

    uv run pytest -m "needs_toolchain and needs_bwrap" -rf vextrus/takeoff/tests/acceptance/t157
"""

import uuid
from pathlib import Path

import pytest

from vextrus.drawings import services as drawings
from vextrus.drawings.messages import sheets as said
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add
from vextrus.testing.jobs import run_inline
from vextrus.testing.tenancy import Member

pytestmark = [pytest.mark.django_db, pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]

PAGES = {"S-102": 1, "S-101": 2, "S-103": 3}
"""Each sheet of set A and the page of t18's Plot that plots it."""


@pytest.fixture(scope="module")
def set_a(tmp_path_factory: pytest.TempPathFactory) -> bytes:
    from engine.fixtures import dwg

    folder = tmp_path_factory.mktemp("t157-set-a")
    return dwg.build("sheet_set_layouts", folder, dwg.build_writer(folder)).read_bytes()


@pytest.fixture(scope="module")
def plot() -> bytes:
    from engine.plot.tests.acceptance.t18.test_plot_registration import _plot

    return _plot()


@pytest.fixture(scope="module")
def dumper(tmp_path_factory: pytest.TempPathFactory) -> Path:
    from engine.read.acadsharp.tests.build import build_dumper

    return build_dumper(tmp_path_factory.mktemp("t157-dumper"))


@pytest.fixture
def engine_readers(dumper: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper))


def run_job(member: Member, file_id: uuid.UUID) -> None:
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=lambda: None,
        file_id=file_id,
    )


def sheets_of(member: Member, file_id: uuid.UUID) -> dict[str, drawings.SheetView]:
    with member.acting():
        found = drawings.file(file_id)
        listed = [s for s in drawings.sheets(found.set_id) if s.file_id == file_id]
    return {s.number or "": s for s in listed}


def _upload_and_read(
    project: QsProject, set_a: bytes, plot: bytes, *, pdf_first: bool
) -> tuple[uuid.UUID, uuid.UUID]:
    member = project.member
    files = [("KR-STR-R0.dwg", set_a), ("KR-STR-PLOT.pdf", plot)]
    if pdf_first:
        files.reverse()
    ids = {}
    for name, content in files:
        file_id = add(member, project.project_id, name, content).file.id
        run_job(member, file_id)
        ids[name] = file_id
    with member.acting():
        for file_id in ids.values():
            assert drawings.file(file_id).state == drawings.FileState.READ
    return ids["KR-STR-R0.dwg"], ids["KR-STR-PLOT.pdf"]


@pytest.mark.parametrize("pdf_first", [False, True], ids=["drawing-then-plot", "plot-then-drawing"])
def test_each_sheet_has_the_plot_page_that_plots_it(
    qs_project: QsProject, set_a: bytes, plot: bytes, engine_readers: None, pdf_first: bool
) -> None:
    dwg_id, pdf_id = _upload_and_read(qs_project, set_a, plot, pdf_first=pdf_first)

    sheets = sheets_of(qs_project.member, dwg_id)
    assert set(sheets) == set(PAGES)
    for number, page in PAGES.items():
        found = sheets[number].plot
        assert (found.file_id, found.page) == (pdf_id, page), (number, found)
        assert found.none is None, (number, found.none)


def test_a_matched_sheet_is_placed_on_its_page(
    qs_project: QsProject, set_a: bytes, plot: bytes, engine_readers: None
) -> None:
    """Registered, not only named: the page matched by its title block's text carries the transform
    that places its sheet (t18's Plot draws set A 1:1, upright, at the page's origin)."""
    dwg_id, _ = _upload_and_read(qs_project, set_a, plot, pdf_first=False)

    transform = sheets_of(qs_project.member, dwg_id)["S-102"].plot.transform
    assert transform is not None
    assert transform["rotation"] == 0
    assert float(transform["scale"]) == pytest.approx(72 / 25.4, rel=0.01)


def test_no_sheet_of_a_matched_set_says_no_page_matched(
    qs_project: QsProject, set_a: bytes, plot: bytes, engine_readers: None
) -> None:
    """The false line every real sheet showed (#157): once the Plot is read, no sheet it plots says
    "no page of it matched"."""
    dwg_id, _ = _upload_and_read(qs_project, set_a, plot, pdf_first=False)

    for number, sheet in sheets_of(qs_project.member, dwg_id).items():
        assert sheet.plot.none is None or sheet.plot.none["code"] != said.PLOT_NO_PAGE.code, number
