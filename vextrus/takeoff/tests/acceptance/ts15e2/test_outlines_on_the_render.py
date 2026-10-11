"""S15-E2's acceptance (#535; G1 f-1, #314: outlines off the paper): what the viewer is given lays each
view's outline over its drawing.

The viewer (`web/src/sheet/SheetViewer.tsx`) draws the sheet's render (`…/drawings/sheets/{id}/render`,
11's buffer) and lays over it each view's outline at its box (`Step1ViewOut.box`, paper mm from the
sheet's lower-left corner), through one transform; it moves neither. So the outlines land on the
drawing only when the product's read job gives a view's box and the render on one paper. Session 15's
walk (#314, FL6, BLOCKS) saw them apart on the real sets; the synthetic sheets of
`engine/render/tests/acceptance/ts15e2/drawing.py` (bordered A1 frames in model space at 1:100, A1
layouts by their plot settings, one with a stray line off its sheet and one with no frame) show it on
main. Each is read by the product's job (the real readers, `read_file` inline). Its export's paper for
a sheet (#212's `paper`) is the render's too: one paper a sheet. They need the toolchain:

    uv run pytest -m needs_toolchain vextrus/takeoff/tests/acceptance/ts15e2
"""

import hashlib
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from engine.render.buffers import SheetBuffers
from engine.render.tests.acceptance.ts15e2 import drawing
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import export
from vextrus.takeoff.tasks import read_file
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add
from vextrus.testing.jobs import run_inline

WITHIN_MM = 1.0
"""How far an outline's edge may lie from the drawing's on paper (a rounding, not a misplacement)."""
RUN = {"id": "ts15e2", "commit": None, "code_hash": None, "started_at": "2026-10-06T00:00:00Z",
       "seconds": 1.0}  # fmt: skip
NUMBERS = sorted(s.number for s in drawing.SHEETS)

type Box = tuple[float, float, float, float]


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    """Each file of the set by its name, built once."""
    build = tmp_path_factory.mktemp("ts15e2-build")
    return drawing.build_set(tmp_path_factory.mktemp("ts15e2-set"), build)


@pytest.fixture(scope="module")
def dumper(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """The pinned ACadSharp dumper, built here: CI's image has none at the readers' default path."""
    from engine.read.acadsharp.tests.build import build_dumper

    return build_dumper(tmp_path_factory.mktemp("ts15e2-dumper"))


@pytest.fixture
def engine_readers(dumper: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper))


def read_through_the_job(qs: QsProject, path: Path) -> str:
    """The file added and read by the job; its sha256."""
    data = path.read_bytes()
    file_id = add(qs.member, qs.project_id, path.name, data).file.id
    run_inline(
        read_file.read_file,
        tenant_id=qs.member.developer_id,
        user_id=qs.member.user.pk,
        abort_reason=lambda: None,
        file_id=file_id,
    )
    with qs.member.acting():
        sha256 = drawings.file(file_id).sha256
    assert sha256 == hashlib.sha256(data).hexdigest()
    return sha256


def proposals(qs: QsProject) -> dict[str, dict[str, Any]]:
    """Step 1's proposals, as the web reads them, by the sheet's number: its layout's name for a sheet
    on a layout (the frameless `E-503` has no other), else the number read from its frame."""
    response = api_as(qs.member).get(f"/api/projects/{qs.project_id}/takeoff/step1/proposals")
    assert response.status_code == 200, response.content
    found: dict[str, dict[str, Any]] = {}
    for proposal in response.json()["proposals"]:
        number = proposal["layout"] or proposal["number"]
        if number is not None:
            found[number] = proposal
    return found


def render(qs: QsProject, sheet_id: uuid.UUID | str) -> SheetBuffers:
    response = api_as(qs.member).get(f"/api/projects/{qs.project_id}/drawings/sheets/{sheet_id}/render")
    assert response.status_code == 200, response.content
    return SheetBuffers.from_bytes(response.content)


def drawn_box(buffers: SheetBuffers, layer: str) -> Box:
    """The box, in the render's paper mm, of every line it draws on `layer`."""
    layers = [i for i, s in enumerate(buffers.strings) if s == layer]
    prims = np.flatnonzero(np.isin(buffers.primitives["layer"], layers))
    lines = buffers.lines[np.isin(buffers.lines["prim"], prims)]
    assert len(lines), f"the render draws nothing on {layer}"
    xs = np.concatenate([lines["x0"], lines["x1"]]).astype(float)
    ys = np.concatenate([lines["y0"], lines["y1"]]).astype(float)
    return (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max()))


@pytest.fixture
def read_set(qs_project: QsProject, built: dict[str, Path], engine_readers: None) -> dict[str, str]:
    """Both files read by the job: each file's sha256 by its name."""
    return {f"{name}.dwg": read_through_the_job(qs_project, path) for name, path in built.items()}


@pytest.mark.needs_toolchain
@pytest.mark.django_db
def test_each_plans_outline_from_step_1_lies_where_its_render_draws_the_plan(
    qs_project: QsProject, read_set: dict[str, str]
) -> None:
    """Every sheet's plan: its box as Step 1's API gives it is the box its render draws the plan and its
    title in, each edge within 1 mm: the outline the viewer lays at that box is over the plan."""
    found = proposals(qs_project)
    assert sorted(found) == NUMBERS, f"Step 1 proposes {sorted(found)}"
    wrong = []
    for number in NUMBERS:
        proposal = found[number]
        (plan,) = [v for v in proposal["views"] if v["title"] == drawing.TITLE]
        box = tuple(float(v) for v in plan["box"])
        buffers = render(qs_project, proposal["sheet_id"])
        p = drawn_box(buffers, drawing.PLAN_LAYER)
        t = drawn_box(buffers, drawing.TITLE_LAYER)
        drawn = (min(p[0], t[0]), min(p[1], t[1]), max(p[2], t[2]), max(p[3], t[3]))
        if any(abs(a - b) > WITHIN_MM for a, b in zip(box, drawn, strict=True)):
            wrong.append(
                f"{number}: outline {[round(v, 1) for v in box]}, drawn {[round(v, 1) for v in drawn]}"
            )
    assert wrong == []


@pytest.mark.needs_toolchain
@pytest.mark.django_db
def test_the_jobs_export_states_the_paper_each_sheets_render_is_drawn_on(
    qs_project: QsProject, read_set: dict[str, str], built: dict[str, Path]
) -> None:
    """One paper a sheet: the job's export's `paper` for each sheet is its render's (width and height
    within 1 mm), and a bordered A1 sheet's is A1."""
    found = proposals(qs_project)
    folder = next(iter(built.values())).parent
    document: Any = export.export(
        qs_project.member.developer_id, qs_project.project_id, read_set, folder=folder, run=RUN
    )
    papers: dict[str, list[float] | None] = {}
    for file in document["files"]:
        for sheet in file.get("sheets") or []:
            number = sheet["location"]["layout"] or (sheet.get("number") or {}).get("value")
            if isinstance(number, str):
                papers[number] = sheet["paper"]
    wrong = []
    for number in NUMBERS:
        buffers = render(qs_project, found[number]["sheet_id"])
        stated = papers.get(number)
        drawn = (buffers.paper.width_mm, buffers.paper.height_mm)
        if stated is None or any(abs(a - b) > WITHIN_MM for a, b in zip(stated, drawn, strict=True)):
            wrong.append(f"{number}: the export states {stated}, the render is drawn on {drawn}")
    assert wrong == []
    for number in ("E-401", "E-402", "E-501"):
        stated = papers[number]
        assert stated is not None
        assert sorted(stated, reverse=True) == pytest.approx(list(drawing.A1), abs=WITHIN_MM), number
