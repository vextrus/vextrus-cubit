"""S24-A5's review (#703, round 1): "One page, one sheet" in the read job, whichever file is read last.

A Plot of two pages, each drawing only its frame (their ink alike). Page 1 is S-204's: its own number
small in the title block, and a larger mark on it reading S-201. Page 2 is S-201's. DWG A holds S-201
and DWG B S-204. Read A, then the Plot, then B, B's read moved page 1 to S-204 and let S-201 go,
and S-201 ended with no page though page 2 plots it; read A, B, then the Plot, S-201 was on page 2.
Every order ends with S-201 on page 2 and S-204 on page 1.
"""

from pathlib import Path

import pytest

from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from engine.plot.tests.acceptance.t157 import test_stroked_title_blocks as T
from vextrus.drawings import services as drawings
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import (  # noqa: F401
    dumper,
    engine_readers,
    run_job,
)
from vextrus.takeoff.tests.test_read_plot_order import _build, _read_in_order
from vextrus.testing.drawings import QsProject

pytestmark = [pytest.mark.django_db, pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]


def _plot() -> bytes:
    pdf = Pdf()
    font = truetype_font(pdf)
    k = T.PT_PER_MM
    frame = b"0.5 w\n" + T._border_and_strip()
    page_1 = frame + text(720 * k, 540 * k, "S-204", size=3 * k)
    page_1 += text(300 * k, 300 * k, "S-201", size=12 * k)
    page_2 = frame + text(720 * k, 540 * k, "S-201", size=8 * k)
    pages = [Page(content=c, size=T.A1, fonts={"F1": font}) for c in (page_1, page_2)]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


@pytest.mark.parametrize("order", ["a-b-pdf", "a-pdf-b", "pdf-a-b"])
def test_the_set_ends_with_one_page_a_sheet_whichever_file_is_read_last(
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811
    tmp_path: Path,
    order: str,
) -> None:
    a, b, plot = "KR-STR-A.dwg", "KR-STR-B.dwg", "KR-STR-PLOT.pdf"
    files = {
        a: _build(tmp_path, "a", [("S-201", T.REGION_A)]),
        b: _build(tmp_path, "b", [("S-204", T.REGION_B)]),
        plot: _plot(),
    }
    names = {"a-b-pdf": [a, b, plot], "a-pdf-b": [a, plot, b], "pdf-a-b": [plot, a, b]}[order]
    ids = _read_in_order(qs_project, files, names)

    with qs_project.member.acting():
        listed = drawings.sheets(drawings.file(ids[a]).set_id)
    pages = {s.number: (s.plot.file_id, s.plot.page) for s in listed}
    assert pages == {"S-201": (ids[plot], 2), "S-204": (ids[plot], 1)}, listed
