"""Debt (#197), from #157's re-check 3.
With the ink budget spent, a DWG read later (unrelated sheets) lets go of a page an
earlier PDF run gave by ink. Budget patched to 2 to stand for 128 on a large set."""

from pathlib import Path

import pytest

from engine.plot import registration
from engine.plot.tests.acceptance.t157 import test_stroked_title_blocks as T
from vextrus.drawings import services as drawings
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import (  # noqa: F401
    dumper,
    engine_readers,
    run_job,
)
from vextrus.takeoff.tests.test_read_plot_order import REGION_C, _build, _one_page_plot, _read_in_order
from vextrus.testing.drawings import QsProject

pytestmark = [pytest.mark.django_db, pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]


@pytest.mark.parametrize("budget", [2, 128])
@pytest.mark.parametrize("order", ["a-b-pdfs-c", "a-b-c-pdfs"])
def test_budget(
    request: pytest.FixtureRequest,
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811
    tmp_path: Path,
    order: str,
    budget: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if request.node.callspec.id == "a-b-pdfs-c-2":
        request.applymarker(
            pytest.mark.xfail(strict=True, reason="#197: a sheet ends with no Plot in this order")
        )
    monkeypatch.setattr(registration, "MAX_INK_TRIES", budget)
    files = {
        "KR-STR-A.dwg": _build(tmp_path, "a", [("S-201", T.REGION_A), ("S-203", REGION_C)]),
        "KR-STR-B.dwg": _build(tmp_path, "b", [("S-201", T.REGION_B), ("S-204", REGION_C)]),
        "KR-STR-C.dwg": _build(tmp_path, "c", [("S-301", REGION_C)]),
        "KR-STR-PLOT-1.pdf": _one_page_plot(T.REGION_B, T._region_b(T.REGION_B[0])),
        "KR-STR-PLOT-2.pdf": _one_page_plot(T.REGION_A, T._region_a(T.REGION_A[0])),
    }
    pdfs = ["KR-STR-PLOT-1.pdf", "KR-STR-PLOT-2.pdf"]
    a, b, c = "KR-STR-A.dwg", "KR-STR-B.dwg", "KR-STR-C.dwg"
    names = {"a-b-pdfs-c": [a, b, *pdfs, c], "a-b-c-pdfs": [a, b, c, *pdfs]}[order]
    ids = _read_in_order(qs_project, files, names)
    with qs_project.member.acting():
        listed = drawings.sheets(drawings.file(ids[a]).set_id)
        rep = {n: drawings.report(ids[n]).pages for n in pdfs}
    plots = {
        ("A" if s.file_id == ids[a] else "B"): (
            s.plot.file_id,
            s.plot.page,
            s.plot.none,
        )
        for s in listed
        if s.number == "S-201"
    }
    assert plots == {
        "A": (ids["KR-STR-PLOT-2.pdf"], 1, None),
        "B": (ids["KR-STR-PLOT-1.pdf"], 1, None),
    }, (plots, rep)
