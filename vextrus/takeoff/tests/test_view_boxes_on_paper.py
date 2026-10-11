"""#160 (one paper scale for views and buffers): each view's outline, as Step 1's API gives it, lies on
its sheet's paper and over its drawing, in the units the web draws it in (paper mm from the sheet's
lower-left corner: `Step1ViewOut.box`, `web/src/sheet/SheetViewer.tsx`'s `SheetOutline`), the
paper being the sheet's render's (`…/render`, 11's buffer) that the web draws under the outlines.

Session 11's review of main on the real sets saw every sheet's outlines misplaced: too small and piled
at the lower-left on frames in model space, oversized and off the paper on others. The views and the
render each laid their own paper over the frame (the view finder by its paper scale, the buffer by a
standard sheet at a standard scale or A1's long side), so one sheet's two papers differed.

Synthetic drawings, built at test time by the repo's writer (`engine/fixtures/dwg`), read by the
product's job (the real readers, `read_file` inline): #160's A3 frames in model space at drawing
scales (`engine/render/tests/acceptance/t160/drawing.py`: 1:37, 1:45 turned, 1:100, a frame block drawn
at a tenth of its paper, in millimetres; 1:37 in metres), each with one plan, and sheets on layouts
(`sheet_set_layouts`). They need the toolchain:

    uv run --no-sync pytest -m needs_toolchain vextrus/takeoff/tests/test_view_boxes_on_paper.py
"""

import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from engine.fixtures import dwg
from engine.render.buffers import SheetBuffers
from engine.render.tests.acceptance.t160 import drawing
from vextrus.takeoff.tasks import read_file
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add
from vextrus.testing.jobs import run_inline

LAYOUTS = "sheet_set_layouts"
ON_PAPER_MM = 1.0
"""How far past the paper's edge a box may reach (a rounding, not a misplacement)."""
SPANS = 0.5
"""How much of the drawing's extent, across or up, the sheet's outlines together cover at least: its
title block and its views lie apart over the frame, never piled in one corner of it."""


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> dict[str, bytes]:
    """Each drawing's bytes by its name: #160's frames' two files and the layouts set."""
    scratch = tmp_path_factory.mktemp("t160-build")
    paths = drawing.build_set(tmp_path_factory.mktemp("t160-set"), scratch)
    found = {name: path.read_bytes() for name, path in paths.items()}
    writer = scratch / "writer" / "Writer.dll"  # build_set built it there
    found[LAYOUTS] = dwg.build(LAYOUTS, scratch, writer).read_bytes()
    return found


@pytest.fixture(scope="module")
def dumper(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """The pinned ACadSharp dumper, built here: CI's image has none at the readers' default path."""
    from engine.read.acadsharp.tests.build import build_dumper

    return build_dumper(tmp_path_factory.mktemp("t160-dumper"))


@pytest.fixture
def engine_readers(dumper: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper))


def read_through_the_job(qs: QsProject, name: str, data: bytes) -> list[dict[str, Any]]:
    """Step 1's proposals, as the web reads them, once the job has read the file."""
    file_id = add(qs.member, qs.project_id, f"{name}.dwg", data).file.id
    run_inline(
        read_file.read_file,
        tenant_id=qs.member.developer_id,
        user_id=qs.member.user.pk,
        abort_reason=lambda: None,
        file_id=file_id,
    )
    api = api_as(qs.member)
    response = api.get(f"/api/projects/{qs.project_id}/takeoff/step1/proposals")
    assert response.status_code == 200, response.content
    return list(response.json()["proposals"])


def render(qs: QsProject, sheet_id: uuid.UUID) -> SheetBuffers:
    api = api_as(qs.member)
    response = api.get(f"/api/projects/{qs.project_id}/drawings/sheets/{sheet_id}/render")
    assert response.status_code == 200, response.content
    return SheetBuffers.from_bytes(response.content)


def drawn_extent(buffers: SheetBuffers, layer: str | None = None) -> tuple[float, float, float, float]:
    """The extent of what the render draws (on `layer`, else all), in paper mm."""
    lines = buffers.lines
    if layer is not None:
        layers = [i for i, s in enumerate(buffers.strings) if s == layer]
        prims = np.flatnonzero(np.isin(buffers.primitives["layer"], layers))
        lines = lines[np.isin(lines["prim"], prims)]
        assert len(lines), f"the render draws nothing on {layer}"
    xs = np.concatenate([lines["x0"], lines["x1"]])
    ys = np.concatenate([lines["y0"], lines["y1"]])
    return float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())


def misplaced(qs: QsProject, proposals: list[dict[str, Any]]) -> list[str]:
    """Each sheet's outlines that leave its paper or miss its drawing, said in a line each."""
    wrong = []
    for i, proposal in enumerate(proposals):
        name = proposal["number"] or f"sheet {i + 1}"
        views = proposal["views"]
        if not views:  # the set's cover: a rectangle holding text, with no title block nor view
            continue
        buffers = render(qs, proposal["sheet_id"])
        width, height = buffers.paper.width_mm, buffers.paper.height_mm
        boxes = [[float(v) for v in view["box"]] for view in views]
        for view, (x0, y0, x1, y1) in zip(views, boxes, strict=True):
            if (
                x0 < -ON_PAPER_MM
                or y0 < -ON_PAPER_MM
                or x1 > width + ON_PAPER_MM
                or y1 > height + ON_PAPER_MM
            ):
                wrong.append(
                    f"{name} {view['kind']} {[round(v, 1) for v in (x0, y0, x1, y1)]}"
                    f" off its paper {round(width, 1)} x {round(height, 1)} mm"
                )
        dx0, dy0, dx1, dy1 = drawn_extent(buffers)
        across = max(b[2] for b in boxes) - min(b[0] for b in boxes)
        up = max(b[3] for b in boxes) - min(b[1] for b in boxes)
        if max(across / (dx1 - dx0), up / (dy1 - dy0)) < SPANS:
            wrong.append(
                f"{name}: its outlines span {round(across, 1)} x {round(up, 1)} mm"
                f" of a drawing {round(dx1 - dx0, 1)} x {round(dy1 - dy0, 1)} mm"
            )
    return wrong


@pytest.mark.needs_toolchain
@pytest.mark.django_db
@pytest.mark.usefixtures("engine_readers")
def test_views_of_frames_in_model_space_lie_on_the_renders_paper_over_its_drawing(
    qs_project: QsProject, built: dict[str, bytes]
) -> None:
    for name in drawing.INSUNITS:
        read = read_through_the_job(qs_project, name, built[name])
    proposals = [p for p in read if p["number"] in {f.number for f in drawing.FRAMES}]
    assert sorted(p["number"] for p in proposals) == sorted(f.number for f in drawing.FRAMES)
    assert misplaced(qs_project, proposals) == []
    # And each sheet's plan: its outline is where the render draws the plan (its title under it).
    for proposal in proposals:
        (plan,) = [v for v in proposal["views"] if v["title"] == drawing.TITLE]
        x0, y0, x1, y1 = (float(v) for v in plan["box"])
        dx0, dy0, dx1, dy1 = drawn_extent(render(qs_project, proposal["sheet_id"]), drawing.PLAN_LAYER)
        assert (x0, x1, y1) == pytest.approx((dx0, dx1, dy1), abs=ON_PAPER_MM), proposal["number"]
        assert y0 < dy0, proposal["number"]


@pytest.mark.needs_toolchain
@pytest.mark.django_db
@pytest.mark.usefixtures("engine_readers")
def test_views_of_sheets_on_layouts_lie_on_the_renders_paper_over_its_drawing(
    qs_project: QsProject, built: dict[str, bytes]
) -> None:
    proposals = read_through_the_job(qs_project, LAYOUTS, built[LAYOUTS])
    assert {p["number"] for p in proposals} >= {"S-101", "S-102", "S-103"}
    assert all(p["views"] for p in proposals if p["number"] in {"S-101", "S-102", "S-103"})
    assert misplaced(qs_project, proposals) == []
