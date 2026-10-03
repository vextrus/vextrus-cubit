"""Debt (#197), from #157's re-check 3.
A textless page given by ink in PLOT-1's run; PLOT-2 (added later) has a page naming the
sheet by text. A later unrelated DWG's run full-matches the textless page, `unclaimed` takes its ink
match back (a text page names the sheet), and `_release` now lets the sheet go, while PLOT-2's page is
not in `full`, so the sheet ends with no Plot at all."""

from pathlib import Path

import pytest

from engine.fixtures.pdf._writer import Page, Pdf, document
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


def _textless(region: tuple[float, float], shapes: list[tuple[str, tuple[float, ...]]]) -> bytes:
    pdf = Pdf()
    content = b"0.5 w\n" + T._border_and_strip() + T._body(region, shapes)
    return document(
        pdf,
        [Page(content=content, size=T.A1)],
        info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"},
    )


@pytest.mark.parametrize("order", ["a-p1-p2-c", "a-c-p1-p2", "a-p1-p2"])
def test_unclaimed(
    request: pytest.FixtureRequest,
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811
    tmp_path: Path,
    order: str,
) -> None:
    if request.node.callspec.id == "a-p1-p2-c":
        request.applymarker(
            pytest.mark.xfail(strict=True, reason="#197: a sheet ends with no Plot in this order")
        )
    files = {
        "KR-STR-A.dwg": _build(tmp_path, "a", [("S-201", T.REGION_A), ("S-203", REGION_C)]),
        "KR-STR-C.dwg": _build(tmp_path, "c", [("S-301", REGION_C)]),
        "KR-STR-PLOT-1.pdf": _textless(T.REGION_A, T._region_a(T.REGION_A[0])),
        "KR-STR-PLOT-2.pdf": _one_page_plot(T.REGION_A, T._region_a(T.REGION_A[0])),
    }
    a, c, p1, p2 = "KR-STR-A.dwg", "KR-STR-C.dwg", "KR-STR-PLOT-1.pdf", "KR-STR-PLOT-2.pdf"
    names = {"a-p1-p2-c": [a, p1, p2, c], "a-c-p1-p2": [a, c, p1, p2], "a-p1-p2": [a, p1, p2]}[order]
    ids = _read_in_order(qs_project, files, names)
    with qs_project.member.acting():
        listed = drawings.sheets(drawings.file(ids[a]).set_id)
        rep = {n: drawings.report(ids[n]).pages for n in (p1, p2)}
    inv = {v: k for k, v in ids.items()}
    plots = {s.number: (inv.get(s.plot.file_id), s.plot.page, s.plot.none) for s in listed}
    assert plots["S-201"][1] is not None, (plots, rep)
