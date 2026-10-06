"""S15-E7 (#538, superseding #197): "an order fault leaves no Sheet without a Plot". A Sheet a read
Plot draws keeps a page of a Plot whichever order the set's DWGs and Plots are read in, through the
real read job (`vextrus.takeoff.tasks.read_file`, each file read before the next is added):

1. A Plot's page that names its sheet by ink alone (no text) keeps that sheet when a later Plot names
   the sheet by text and an unrelated DWG is read after both (#197 1, order A, PLOT-1, PLOT-2, C).
2. Two sheets of one number, each drawn by its own Plot page, keep their pages when a DWG read after
   both Plots finds the ink budget (`engine.plot.registration.MAX_INK_TRIES`) spent before every page
   is tried; a budget of 2 stands for a large set's 128 (#197 2, order A, B, PLOT-1, PLOT-2, C).

The set is invented (`plot_set.py`). Needs the toolchain:

    uv run pytest -m "needs_toolchain and needs_bwrap" -rf vextrus/takeoff/tests/acceptance/ts15e7
"""

import uuid

import pytest

from engine.plot import registration
from engine.plot.tests.acceptance.t157 import test_stroked_title_blocks as T
from vextrus.drawings import services as drawings
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import (  # noqa: F401
    dumper,
    engine_readers,
)
from vextrus.takeoff.tests.acceptance.ts15e7 import plot_set
from vextrus.testing.drawings import QsProject

pytestmark = [pytest.mark.django_db, pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]

A, B, C = "KR-STR-A.dwg", "KR-STR-B.dwg", "KR-STR-C.dwg"
P1, P2 = "KR-STR-PLOT-1.pdf", "KR-STR-PLOT-2.pdf"


@pytest.fixture(scope="module")
def drawn(tmp_path_factory: pytest.TempPathFactory) -> dict[str, bytes]:
    """The set's DWGs, written once: A (S-201 drawing region A, S-203), B (S-201 drawing region B,
    S-204), C (S-301 alone, unrelated to any Plot)."""
    folder = tmp_path_factory.mktemp("ts15e7-set")
    writer = plot_set.writer(folder)
    return {
        A: plot_set.dwg(folder, writer, "a", [("S-201", T.REGION_A), ("S-203", plot_set.REGION_C)]),
        B: plot_set.dwg(folder, writer, "b", [("S-201", T.REGION_B), ("S-204", plot_set.REGION_C)]),
        C: plot_set.dwg(folder, writer, "c", [("S-301", plot_set.REGION_C)]),
    }


@pytest.mark.parametrize("order", ["a-p1-p2-c", "a-c-p1-p2", "a-p1-p2"])
def test_a_sheet_a_textless_plot_page_draws_keeps_a_plot_page_in_every_read_order(
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811
    drawn: dict[str, bytes],
    order: str,
) -> None:
    files = {
        A: drawn[A],
        C: drawn[C],
        P1: plot_set.textless_plot(T.REGION_A, T._region_a(T.REGION_A[0])),
        P2: plot_set.plot_naming_s201(T.REGION_A, T._region_a(T.REGION_A[0])),
    }
    names = {"a-p1-p2-c": [A, P1, P2, C], "a-c-p1-p2": [A, C, P1, P2], "a-p1-p2": [A, P1, P2]}[order]

    ids = plot_set.read_in_order(qs_project, files, names)

    by_id: dict[uuid.UUID | None, str] = {v: k for k, v in ids.items()}
    with qs_project.member.acting():
        listed = drawings.sheets(drawings.file(ids[A]).set_id)
    plots = {s.number: (by_id.get(s.plot.file_id), s.plot.page, s.plot.none) for s in listed}
    kept = plots.get("S-201")
    expected = [(P1, 1, None), (P2, 1, None)]
    assert kept in expected, f"S-201 is left without a Plot page after reading {order}: {plots}"


@pytest.mark.parametrize("order", ["a-b-pdfs-c", "a-b-c-pdfs"])
def test_two_sheets_of_one_number_keep_their_plot_pages_when_the_ink_budget_is_spent(
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811
    drawn: dict[str, bytes],
    order: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(registration, "MAX_INK_TRIES", 2)
    files = {
        **drawn,
        P1: plot_set.plot_naming_s201(T.REGION_B, T._region_b(T.REGION_B[0])),
        P2: plot_set.plot_naming_s201(T.REGION_A, T._region_a(T.REGION_A[0])),
    }
    names = {"a-b-pdfs-c": [A, B, P1, P2, C], "a-b-c-pdfs": [A, B, C, P1, P2]}[order]

    ids = plot_set.read_in_order(qs_project, files, names)

    by_id: dict[uuid.UUID | None, str] = {v: k for k, v in ids.items()}
    with qs_project.member.acting():
        listed = drawings.sheets(drawings.file(ids[A]).set_id)
    plots = {
        by_id[s.file_id]: (by_id.get(s.plot.file_id), s.plot.page, s.plot.none)
        for s in listed
        if s.number == "S-201"
    }
    assert plots == {A: (P2, 1, None), B: (P1, 1, None)}, (
        f"a sheet S-201 is left without its Plot page after reading {order}: {plots}"
    )
