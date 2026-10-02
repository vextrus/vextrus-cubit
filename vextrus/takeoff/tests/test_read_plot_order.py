"""The review's case (157): a Plot read before two DWGs of one Discipline that both carry S-201; the
page ended on both sheets (read order PDF, A, B). One page, one sheet, in either order."""

from pathlib import Path
from typing import Any

import pytest

from engine.fixtures import dwg
from engine.fixtures.dwg import new_drawing
from engine.fixtures.dwg.sheet_set_layouts import _frame
from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from engine.plot.tests.acceptance.t157 import test_stroked_title_blocks as T
from vextrus.drawings import services as drawings
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import (  # noqa: F401
    dumper,
    engine_readers,
    run_job,
)
from vextrus.testing.drawings import QsProject, add

pytestmark = [pytest.mark.django_db, pytest.mark.needs_toolchain, pytest.mark.needs_bwrap]
REGION_C = (100_000.0, 5_000.0)


def _sparse(cx: float) -> list[tuple[str, tuple[float, ...]]]:
    return [("line", (cx - 4000, 5000, cx + 4000, 5000)), ("line", (cx, 1000, cx, 9000))]


def _draw(sheets: Any) -> Any:
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)), 841, 594, (700, 0, 841, 594))
    model = doc.modelspace()
    for kind, v in T._shapes() + _sparse(REGION_C[0]):
        if kind == "line":
            model.add_line((v[0], v[1]), (v[2], v[3]))
        else:
            model.add_circle((v[0], v[1]), v[2])
    for number, view in sheets:
        layout = doc.layouts.new(number)
        ref = layout.add_blockref("BORDER-L", (0, 0))
        ref.add_auto_attribs(
            {
                "DWG_NO": number,
                "TITLE": "PLAN " + number,
                "TITLE2": "X",
                "REV": "R0",
                "DATE": "01.09.2026",
            }
        )
        middle = (841 / 2, 594 / 2)
        layout.add_viewport(center=middle, size=(841, 594), view_center_point=middle, view_height=594)
        layout.add_viewport(
            center=T.CENTRE, size=T.SIZE, view_center_point=view, view_height=T.VIEW_HEIGHT
        )
    return doc


def _build(tmp: Path, name: str, sheets: Any) -> bytes:
    tmp = tmp / name
    tmp.mkdir()
    writer = dwg.build_writer(tmp)
    dxf, out = tmp / f"{name}.dxf", tmp / f"{name}.dwg"
    _draw(sheets).saveas(dxf)
    dwg._run([str(dwg.dotnet()), str(writer), str(dxf), str(out), T.VERSION], 120)
    return out.read_bytes()


def _plot() -> bytes:
    pdf = Pdf()
    font = truetype_font(pdf)
    k = T.PT_PER_MM
    body = T._border_and_strip() + T._body(T.REGION_B, T._region_b(T.REGION_B[0]))
    content = b"0.5 w\n" + body + text(720 * k, 540 * k, "S-201", size=8 * k)
    return document(
        pdf,
        [Page(content=content, size=T.A1, fonts={"F1": font})],
        info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"},
    )


@pytest.mark.parametrize("order", ["pdf-a-b", "a-b-pdf"])
def test_one_page_one_sheet(
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811 (the acceptance module's fixture)
    tmp_path: Path,
    order: str,
) -> None:
    a = _build(tmp_path, "a", [("S-201", T.REGION_A), ("S-203", REGION_C)])
    b = _build(tmp_path, "b", [("S-201", T.REGION_B), ("S-204", REGION_C)])
    files = {"KR-STR-A.dwg": a, "KR-STR-B.dwg": b, "KR-STR-PLOT.pdf": _plot()}
    names = (
        ["KR-STR-PLOT.pdf", "KR-STR-A.dwg", "KR-STR-B.dwg"]
        if order == "pdf-a-b"
        else ["KR-STR-A.dwg", "KR-STR-B.dwg", "KR-STR-PLOT.pdf"]
    )
    m = qs_project.member
    ids = {}
    for n in names:
        ids[n] = add(m, qs_project.project_id, n, files[n]).file.id
        run_job(m, ids[n])
    with m.acting():
        set_id = drawings.file(ids["KR-STR-A.dwg"]).set_id
        rows = [
            (
                s.number,
                "A" if s.file_id == ids["KR-STR-A.dwg"] else "B",
                s.plot.page,
                s.plot.none and s.plot.none.get("code"),
            )
            for s in drawings.sheets(set_id)
        ]
    print(order, sorted(rows, key=str))
    on_page = [r for r in rows if r[2] == 1]
    assert len(on_page) <= 1, on_page


def _one_page_plot(region: tuple[float, float], shapes: Any) -> bytes:
    """One page plotting `shapes` with S-201 in its title block."""
    pdf = Pdf()
    font = truetype_font(pdf)
    k = T.PT_PER_MM
    content = b"0.5 w\n" + T._border_and_strip() + T._body(region, shapes)
    content += text(720 * k, 540 * k, "S-201", size=8 * k)
    page = Page(content=content, size=T.A1, fonts={"F1": font})
    return document(pdf, [page], info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


def _read_in_order(qs_project: QsProject, files: dict[str, bytes], names: list[str]) -> dict[str, Any]:
    member = qs_project.member
    ids = {}
    for name in names:
        ids[name] = add(member, qs_project.project_id, name, files[name]).file.id
        run_job(member, ids[name])
    return ids


@pytest.mark.parametrize("order", ["pdfs-a-b", "a-b-pdfs", "pdfs-b-a", "a-pdfs-b"])
def test_two_drawings_sheets_of_one_number_each_keep_their_own_plot_in_every_order(
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811
    tmp_path: Path,
    order: str,
) -> None:
    """157's review (N2): DWG A and B each have an S-201; PLOT-1 (added first) plots B's, PLOT-2 A's.
    In two of four orders A was let go of PLOT-1's page by B's read and never kept again."""
    files = {
        "KR-STR-A.dwg": _build(tmp_path, "a", [("S-201", T.REGION_A), ("S-203", REGION_C)]),
        "KR-STR-B.dwg": _build(tmp_path, "b", [("S-201", T.REGION_B), ("S-204", REGION_C)]),
        "KR-STR-PLOT-1.pdf": _one_page_plot(T.REGION_B, T._region_b(T.REGION_B[0])),
        "KR-STR-PLOT-2.pdf": _one_page_plot(T.REGION_A, T._region_a(T.REGION_A[0])),
    }
    pdfs = ["KR-STR-PLOT-1.pdf", "KR-STR-PLOT-2.pdf"]
    a, b = "KR-STR-A.dwg", "KR-STR-B.dwg"
    names = {
        "pdfs-a-b": [*pdfs, a, b],
        "pdfs-b-a": [*pdfs, b, a],
        "a-b-pdfs": [a, b, *pdfs],
        "a-pdfs-b": [a, *pdfs, b],
    }[order]
    ids = _read_in_order(qs_project, files, names)

    with qs_project.member.acting():
        listed = drawings.sheets(drawings.file(ids[a]).set_id)
    plots = {
        ("A" if s.file_id == ids[a] else "B"): (s.plot.file_id, s.plot.page)
        for s in listed
        if s.number == "S-201"
    }
    assert plots == {"A": (ids["KR-STR-PLOT-2.pdf"], 1), "B": (ids["KR-STR-PLOT-1.pdf"], 1)}


@pytest.mark.parametrize("order", ["pdf-a", "pdf-a-b", "a-b-pdf"])
def test_a_later_drawings_read_never_lets_go_of_another_drawings_page_by_name_alone(
    qs_project: QsProject,
    engine_readers: None,  # noqa: F811
    tmp_path: Path,
    order: str,
) -> None:
    """157's review (N1): one PDF, page 1 referring to S-201 in its body, page 2 S-201's own. A holds
    S-201; B, read later, ranked A's pages without geometry, let page 2 go, and A ended with none."""
    pdf = Pdf()
    font = truetype_font(pdf)
    k = T.PT_PER_MM
    wrong = T._border_and_strip() + T._body(T.REGION_B, T._region_b(T.REGION_B[0]))
    right = T._border_and_strip() + T._body(T.REGION_A, T._region_a(T.REGION_A[0]))
    pages = [
        Page(
            content=b"0.5 w\n" + wrong + text(200 * k, 200 * k, "S-201", size=8 * k),
            size=T.A1,
            fonts={"F1": font},
        ),
        Page(
            content=b"0.5 w\n" + right + text(720 * k, 540 * k, "S-201", size=8 * k),
            size=T.A1,
            fonts={"F1": font},
        ),
    ]
    info = {"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"}
    files = {
        "KR-STR-A.dwg": _build(tmp_path, "a", [("S-201", T.REGION_A)]),
        "KR-STR-B.dwg": _build(tmp_path, "b", [("S-204", T.REGION_B)]),
        "KR-STR-PLOT.pdf": document(pdf, pages, info=info),
    }
    a, b, plot = "KR-STR-A.dwg", "KR-STR-B.dwg", "KR-STR-PLOT.pdf"
    names = {"pdf-a": [plot, a], "pdf-a-b": [plot, a, b], "a-b-pdf": [a, b, plot]}[order]
    ids = _read_in_order(qs_project, files, names)

    with qs_project.member.acting():
        [s201] = [s for s in drawings.sheets(drawings.file(ids[a]).set_id) if s.number == "S-201"]
    assert (s201.plot.file_id, s201.plot.page) == (ids[plot], 2), s201.plot
