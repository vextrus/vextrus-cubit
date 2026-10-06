"""S15-E7's synthetic Drawing Set for the Plot's order faults (#197): invented structural DWGs and
Plots, built in the test's folder by the repo's writers (engine/fixtures/dwg, engine/fixtures/pdf), on
ticket 157's synthetic sheet (`engine/plot/tests/acceptance/t157/test_stroked_title_blocks.py`, `T`).
No office's convention, nothing from a real drawing.

- A DWG (`dwg`): one layout per sheet named, each an attributed A1 frame (`BORDER-L`, its title block
  filled in: the number, "PLAN <number>") with AutoCAD's main viewport and one viewport showing the
  model region given. Model space draws T's two regions (A and B, alike but for their shapes) and a
  sparse cross at `REGION_C`.
- A Plot with S-201 in its title block (`plot_naming_s201`), one page plotting the region given.
- A Plot with no text at all (`textless_plot`): one page plotting the region given, its title block
  stroked, so only its ink can name its sheet.
"""

import uuid
from pathlib import Path

from ezdxf.layouts.blocklayout import BlockLayout

from engine.fixtures import dwg as dwg_writer
from engine.fixtures.dwg import new_drawing
from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from engine.plot.tests.acceptance.t157 import test_stroked_title_blocks as T
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import run_job
from vextrus.testing.drawings import QsProject, add

REGION_C = (100_000.0, 5_000.0)
PRODUCER = {"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"}
Shapes = list[tuple[str, tuple[float, ...]]]


def _frame(block: BlockLayout) -> None:
    width, height = 841.0, 594.0
    block.add_lwpolyline([(0, 0), (width, 0), (width, height), (0, height)], close=True)
    x0, y0, x1, y1 = 700.0, 0.0, width, height
    block.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True)
    rows = (("DRAWING NO.", "DWG_NO", 6.0), ("DRAWING TITLE", "TITLE", 4.0), ("REV.", "REV", 4.0),
            ("DATE", "DATE", 3.0), ("SCALE", None, 3.0))  # fmt: skip
    for i, (label, tag, size) in enumerate(rows):
        top = y1 - 12 - 22 * i
        block.add_text(label, height=2.5).set_placement((x0 + 4, top))
        if tag is not None:
            block.add_attdef(tag, (x0 + 4, top - 8), dxfattribs={"height": size})
    block.add_attdef("TITLE2", (x0 + 4, y1 - 12 - 22 - 13), dxfattribs={"height": 4.0})


def _sparse(cx: float) -> Shapes:
    return [("line", (cx - 4000, 5000, cx + 4000, 5000)), ("line", (cx, 1000, cx, 9000))]


def writer(folder: Path) -> Path:
    """The repo's DWG writer, built in `folder`."""
    return dwg_writer.build_writer(folder)


def dwg(folder: Path, writer: Path, name: str, sheets: list[tuple[str, tuple[float, float]]]) -> bytes:
    """A DWG of the sheets named, each a layout showing the model region given (see the module),
    written in `folder` by `writer`."""
    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)))
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
    dxf, out = folder / f"{name}.dxf", folder / f"{name}.dwg"
    doc.saveas(dxf)
    dwg_writer._run([str(dwg_writer.dotnet()), str(writer), str(dxf), str(out), T.VERSION], 120)
    return out.read_bytes()


def plot_naming_s201(region: tuple[float, float], shapes: Shapes) -> bytes:
    """One page plotting `shapes` at `region`, S-201 in its title block."""
    pdf = Pdf()
    font = truetype_font(pdf)
    k = T.PT_PER_MM
    content = b"0.5 w\n" + T._border_and_strip() + T._body(region, shapes)
    content += text(720 * k, 540 * k, "S-201", size=8 * k)
    return document(pdf, [Page(content=content, size=T.A1, fonts={"F1": font})], info=PRODUCER)


def textless_plot(region: tuple[float, float], shapes: Shapes) -> bytes:
    """One page plotting `shapes` at `region`, no text on it (its title block stroked)."""
    pdf = Pdf()
    content = b"0.5 w\n" + T._border_and_strip() + T._body(region, shapes)
    return document(pdf, [Page(content=content, size=T.A1)], info=PRODUCER)


def read_in_order(project: QsProject, files: dict[str, bytes], names: list[str]) -> dict[str, uuid.UUID]:
    """Add each file named, in order, and run its read job before the next is added."""
    ids = {}
    for name in names:
        ids[name] = add(project.member, project.project_id, name, files[name]).file.id
        run_job(project.member, ids[name])
    return ids
