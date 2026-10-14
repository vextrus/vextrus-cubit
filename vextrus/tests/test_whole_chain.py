"""M1-49, the whole-chain test (docs/plans/M1.md M1-49), written red by M1-00's acceptance writer.

"A synthetic DWG with paper-space views (one paper box on a model-space sheet, one on a layout)
through every stage over HTTP, on PostgreSQL 18 as `vextrus_app`: Step 1 confirmed -> read (the
chain, C5) -> Steps 3, 4 and 6 confirmed -> `live_model` -> measure -> `boq` -> primitives."

Each stage is `xfail(strict=True)` until its ticket lands; that ticket's acceptance writer removes its
stage's mark (the builder never does), and a stage that passes while still marked fails the run.
Stages and their tickets (the plan's list): read, the chain on the synthetic set (M1-10a); confirm ->
`live_model` (M1-11a); read over HTTP (M1-11c); storeys (M1-32a); grid (M1-33); measure (M1-45);
`boq` (M1-15a); primitives (M1-25). Each stage runs the chain from the start up to itself, so it
stands alone; a later stage also needs the earlier stages' tickets (and, from `live_model` on, the
column family, M1-36, for Step 6).

The set is one invented structural DWG, drawn here with ezdxf and written by the repo's own writer
(`engine/fixtures/dwg`) in the test's folder: a 3 x 3 grid (A to C at 5 m, 1 to 3 at 4 m) with a
250 x 500 mm column at each of its 9 points, drawn twice in model space:
- S-101, a model-space sheet: the frame at 1:100 around the first copy, "GROUND FLOOR COLUMN LAYOUT
  PLAN" (one storey);
- S-102, a layout: a viewport at 1:100 onto the second copy, "1ST TO 3RD FLOOR COLUMN LAYOUT PLAN"
  (three storeys).
So: 4 storeys, 6 grid lines, 9 columns per storey, 36 in all. Levels are typed (no level marks are
drawn), 3.048 m apart. Nothing in it comes from a real drawing.

Every unbuilt module is imported inside a stage's body, so the file collects on main and each stage
fails inside its own test (an XFAIL), never at collection. Needs the toolchain:

    uv run --no-sync pytest -m "needs_toolchain or needs_bwrap" vextrus/tests/test_whole_chain.py -rxXf
"""

import importlib
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings

from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, owner_rows, start_worker
from vextrus.testing.jev import Offline
from vextrus.testing.jobs import run_inline

pytestmark = [
    pytest.mark.needs_toolchain,
    pytest.mark.needs_bwrap,
    pytest.mark.django_db(databases=["default", "owner"], transaction=True),
]

NAME = "WC-STR-R0.dwg"
VERSION = "AC1032"
GRID_X = (("A", 0.0), ("B", 5000.0), ("C", 10000.0))
GRID_Y = (("1", 0.0), ("2", 4000.0), ("3", 8000.0))
COLUMN_B, COLUMN_D = 250.0, 500.0
SCALE = 100.0
PAPER = (841.0, 594.0)
REGION = (40.0, 300.0, 340.0, 560.0)
"""The plan's place on paper (mm): x0, y0, x1, y1; its title sits under it."""
MODEL_SHEET_AT = (200_000.0, 0.0)
"""Where S-101's frame is inserted in model space (at 1:100)."""
LAYOUT_COPY_AT = (0.0, 0.0)
"""Where the copy S-102's viewport looks at is drawn in model space."""
STOREYS = 4
GRID_LINES = 6
COLUMNS = 9 * STOREYS
LEVELS = ("0", "3.048", "6.096", "9.144")
"""Each storey's slab level (m), typed, lowest first."""
STOREY_HEIGHT = Decimal("3.048")

BASE = "/api/projects/{project_id}"

# The synthetic set ---------------------------------------------------------------------------------


def _frame(block: Any) -> None:
    width, height = PAPER
    block.add_lwpolyline([(0, 0), (width, 0), (width, height), (0, height)], close=True)
    x0, y0, x1, y1 = 700.0, 0.0, width, height
    block.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True)
    rows = (("DRAWING NO.", "DWG_NO", 6.0), ("DRAWING TITLE", "TITLE", 4.0), ("REV.", "REV", 4.0),
            ("DATE", "DATE", 3.0))  # fmt: skip
    for i, (label, tag, size) in enumerate(rows):
        top = y1 - 12 - 22 * i
        block.add_text(label, height=2.5).set_placement((x0 + 4, top))
        block.add_attdef(tag, (x0 + 4, top - 8), dxfattribs={"height": size})
    block.add_attdef("TITLE2", (x0 + 4, y1 - 12 - 22 - 13), dxfattribs={"height": 4.0})


def _attributes(number: str, title: tuple[str, str]) -> dict[str, str]:
    return {"DWG_NO": number, "TITLE": title[0], "TITLE2": title[1], "REV": "R0", "DATE": "12.08.2026"}


def _building(model: Any, at: tuple[float, float]) -> None:
    """The grid, its bubbles and the nine columns with their marks, origin at `at` (mm)."""
    ox, oy = at
    for label, x in GRID_X:
        model.add_line((ox + x, oy - 1500), (ox + x, oy + 9500), dxfattribs={"layer": "GRID"})
        model.add_circle((ox + x, oy + 10000), 400, dxfattribs={"layer": "GRID"})
        model.add_text(label, height=400, dxfattribs={"layer": "GRID"}).set_placement(
            (ox + x - 150, oy + 9850)
        )
    for label, y in GRID_Y:
        model.add_line((ox - 1500, oy + y), (ox + 11500, oy + y), dxfattribs={"layer": "GRID"})
        model.add_circle((ox - 2000, oy + y), 400, dxfattribs={"layer": "GRID"})
        model.add_text(label, height=400, dxfattribs={"layer": "GRID"}).set_placement(
            (ox - 2150, oy + y - 150)
        )
    b, d = COLUMN_B / 2, COLUMN_D / 2
    for _, x in GRID_X:
        for _, y in GRID_Y:
            cx, cy = ox + x, oy + y
            corners = [(cx - b, cy - d), (cx + b, cy - d), (cx + b, cy + d), (cx - b, cy + d)]
            model.add_lwpolyline(corners, close=True, dxfattribs={"layer": "COLUMN"})
            model.add_text("C1", height=150, dxfattribs={"layer": "COLUMN"}).set_placement(
                (cx + 300, cy + 300)
            )


def _title(space: Any, title: str, at: tuple[float, float], scale: float) -> None:
    ox, oy = at
    x0, y0 = REGION[0], REGION[1]
    space.add_text(title, height=6.0 * scale).set_placement((ox + x0 * scale, oy + (y0 - 18) * scale))
    space.add_text("SCALE 1:100", height=3.5 * scale).set_placement(
        (ox + (x0 + 240) * scale, oy + (y0 - 18) * scale)
    )


def draw() -> Any:
    """The one file: S-101 in model space, S-102 on a layout."""
    from engine.fixtures.dwg import new_drawing

    doc = new_drawing()
    doc.header["$INSUNITS"] = 4
    for layer in ("GRID", "COLUMN"):
        doc.layers.add(layer)
    _frame(doc.blocks.new("BORDER-L", base_point=(0, 0)))
    model = doc.modelspace()

    # S-101: the frame at 1:100 in model space, the building inside its plan's region.
    fx, fy = MODEL_SHEET_AT
    frame = model.add_blockref(
        "BORDER-L", (fx, fy), dxfattribs={"xscale": SCALE, "yscale": SCALE, "zscale": SCALE}
    )
    frame.add_auto_attribs(_attributes("S-101", ("GROUND FLOOR COLUMN", "LAYOUT PLAN")))
    _building(model, (fx + (REGION[0] + 40) * SCALE, fy + (REGION[1] + 40) * SCALE))
    _title(model, "GROUND FLOOR COLUMN LAYOUT PLAN", (fx, fy), SCALE)

    # S-102: a layout whose viewport (1:100) looks at the second copy.
    _building(model, LAYOUT_COPY_AT)
    layout = doc.layouts.new("S-102")
    layout.add_blockref("BORDER-L", (0, 0)).add_auto_attribs(
        _attributes("S-102", ("1ST TO 3RD FLOOR COLUMN", "LAYOUT PLAN"))
    )
    middle = (PAPER[0] / 2, PAPER[1] / 2)
    layout.add_viewport(center=middle, size=PAPER, view_center_point=middle, view_height=PAPER[1])
    x0, y0, x1, y1 = REGION
    centre = ((x0 + x1) / 2, (y0 + y1) / 2)
    size = (x1 - x0, y1 - y0)
    looks_at = (LAYOUT_COPY_AT[0] + 5000.0, LAYOUT_COPY_AT[1] + 4500.0)
    layout.add_viewport(
        center=centre, size=size, view_center_point=looks_at, view_height=size[1] * SCALE
    )
    _title(layout, "1ST TO 3RD FLOOR COLUMN LAYOUT PLAN", (0.0, 0.0), 1.0)
    return doc


_BUILT: dict[str, Path] = {}


def the_set(factory: pytest.TempPathFactory) -> Path:
    """The set's folder (`structural/<NAME>`), built once per run by the repo's writer."""
    if "set" not in _BUILT:
        from engine.fixtures import dwg

        scratch = factory.mktemp("whole-chain-build")
        writer = dwg.build_writer(scratch)
        dxf = scratch / "whole-chain.dxf"
        draw().saveas(dxf)
        folder = factory.mktemp("whole-chain-set")
        (folder / "structural").mkdir()
        dwg._run(
            [str(dwg.dotnet()), str(writer), str(dxf), str(folder / "structural" / NAME), VERSION], 120
        )
        _BUILT["set"] = folder
    return _BUILT["set"]


def the_dumper(factory: pytest.TempPathFactory) -> Path:
    if "dumper" not in _BUILT:
        from engine.read.acadsharp.tests.build import build_dumper

        _BUILT["dumper"] = build_dumper(factory.mktemp("whole-chain-dumper"))
    return _BUILT["dumper"]


@pytest.fixture
def readers(tmp_path_factory: pytest.TempPathFactory, jev_offline: Offline) -> pytest.TempPathFactory:
    """Jev answers offline with a firm first choice; the readers' dumper is built in the body."""
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import jev_says

    jev_says(jev_offline, "0.97")
    return tmp_path_factory


def _use_dumper(factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(the_dumper(factory)))


# The chain, over HTTP ------------------------------------------------------------------------------


def _path(project_id: uuid.UUID, rest: str) -> str:
    return BASE.replace("{project_id}", str(project_id)) + rest


def _building_id(project_id: uuid.UUID) -> uuid.UUID:
    [(found,)] = owner_rows("select id from projects_building where project_id = %s", [project_id])
    return uuid.UUID(str(found))


def _drain() -> None:
    """Run every job the reads enqueued: the default queue's worker, then the CAD queue's."""
    for queues in (("default",), (settings.VEXTRUS_CAD_QUEUE,)):
        worker = start_worker(queues)
        output, _ = worker.communicate(timeout=900)
        assert worker.returncode == 0, output


def step1_confirmed(
    qs: QsProject, factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> Any:
    """Upload the set's DWG through the API, read it with the product's read job and confirm Step 1
    to the end (M0's whole Step 1, as 21c's toolchain test does)."""
    from vextrus.takeoff.tasks import read_file
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
        answer,
        confirm,
        keys,
        open_questions,
        progress,
        proposals,
        uploaded,
    )

    _use_dumper(factory, monkeypatch)
    content = (the_set(factory) / "structural" / NAME).read_bytes()
    file_id = uploaded(qs.member, qs.project_id, NAME, content)
    run_inline(
        read_file.read_file, tenant_id=qs.member.developer_id, user_id=qs.member.user.pk, file_id=file_id
    )
    api = api_as(qs.member)
    for question in open_questions(api, qs.project_id):
        assert answer(api, qs.project_id, question["id"], keys(question)[0]).status_code == 200
    for one in [p["id"] for p in proposals(api, qs.project_id) if p["decision"] is None]:
        done = confirm(api, qs.project_id, [one])
        assert done.status_code == 200, done.content
    assert progress(api, qs.project_id)["structural"]["status"] == "confirmed"
    return api


def read_step(api: Any, project_id: uuid.UUID, step: str) -> None:
    """C9: `POST steps/{step}/read` -> 202 `{step, enqueued}`; the read runs as a job."""
    response = api.send("post", _path(project_id, f"/takeoff/steps/{step}/read"), {})
    assert response.status_code == 202, (step, response.status_code, response.content[:300])
    assert response.json()["step"] == step
    _drain()


def _proposals_in(value: Any) -> list[dict[str, Any]]:
    """Every Proposal (an object with an `id` and a `state`) anywhere in a `GET proposals` reply."""
    if isinstance(value, dict):
        own = [value] if {"id", "state"} <= set(value) else []
        return own + [p for item in value.values() for p in _proposals_in(item)]
    if isinstance(value, list):
        return [p for item in value for p in _proposals_in(item)]
    return []


def step_proposals(api: Any, project_id: uuid.UUID, step: str) -> list[dict[str, Any]]:
    response = api.get(_path(project_id, f"/takeoff/steps/{step}/proposals?group=storey"))
    assert response.status_code == 200, (step, response.status_code, response.content[:300])
    return _proposals_in(response.json())


def confirm_step(api: Any, project_id: uuid.UUID, step: str) -> dict[str, Any]:
    """C9: `POST confirmations {act, step, proposal_ids}` for every open Proposal of the step."""
    ids = [p["id"] for p in step_proposals(api, project_id, step) if p["state"] == "open"]
    assert ids, f"step {step} proposed nothing"
    response = api.send(
        "post",
        _path(project_id, "/takeoff/confirmations"),
        {"act": "confirm", "step": step, "proposal_ids": ids},
    )
    assert response.status_code == 200, (step, response.status_code, response.content[:300])
    reply: dict[str, Any] = response.json()
    return reply


def storeys(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    response = api.get(_path(project_id, "/takeoff/storeys"))
    assert response.status_code == 200, (response.status_code, response.content[:300])
    found: dict[str, Any] = response.json()
    return found


def storeys_confirmed(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    """Step 3: read, each storey's level typed (C19 `PUT storeys/{key}/level`), confirmed."""
    read_step(api, project_id, "storeys")
    listed = sorted(storeys(api, project_id)["storeys"], key=lambda s: s["order"])
    for storey, level in zip(listed, LEVELS, strict=True):
        typed = api.send(
            "put",
            _path(project_id, f"/takeoff/storeys/{storey['key']}/level"),
            {"value": level, "unit": "m"},
        )
        assert typed.status_code == 200, (typed.status_code, typed.content[:300])
    return confirm_step(api, project_id, "storeys")


def grid_confirmed(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    read_step(api, project_id, "grid")
    return confirm_step(api, project_id, "grid")


def columns_confirmed(api: Any, project_id: uuid.UUID) -> dict[str, Any]:
    read_step(api, project_id, "columns")
    return confirm_step(api, project_id, "columns")


def model_confirmed(
    qs: QsProject, factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> tuple[Any, dict[str, Any]]:
    """Steps 1, 3, 4 and 6 confirmed: the Live Model holds the storeys, the grid and the columns."""
    api = step1_confirmed(qs, factory, monkeypatch)
    storeys_confirmed(api, qs.project_id)
    grid_confirmed(api, qs.project_id)
    return api, columns_confirmed(api, qs.project_id)


# The stages -----------------------------------------------------------------------------------------


@pytest.mark.xfail(strict=True, reason="M1-10a: the chain on the synthetic set")
def test_stage_read_the_chain_places_both_views_and_exports_version_2(
    readers: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """C5 and C1: the harness runs the chain over the set; both views are placed (A6: one paper box on
    a model-space sheet, one on a layout), so no `engine.view.not_placed` is raised; the export is
    version 2, the unknown-office read."""
    importlib.import_module("engine.families.chain")
    from engine import harness

    _use_dumper(readers, monkeypatch)
    document: Any = harness.run(the_set(readers), tmp_path / "export.json")

    assert document["version"] == 2
    assert document["read_mode"] == "unknown_office"
    assert [q for q in document["questions"] if q["code"] == "engine.view.not_placed"] == []
    assert isinstance(document["counts"], dict)


@pytest.mark.xfail(strict=True, reason="M1-11a: confirm -> live_model")
def test_stage_live_model_a_confirmation_writes_a_model_version_holding_the_storeys(
    qs_project: QsProject, readers: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    live_model = importlib.import_module("vextrus.live_model.services")
    api = step1_confirmed(qs_project, readers, monkeypatch)

    reply = storeys_confirmed(api, qs_project.project_id)

    assert set(reply) >= {"confirmation_id", "model_version_seq", "figures_changed"}
    with qs_project.member.acting():
        snapshot = live_model.snapshot(_building_id(qs_project.project_id))
    assert snapshot.seq == reply["model_version_seq"]
    assert len(snapshot.elements) == STOREYS


@pytest.mark.xfail(strict=True, reason="M1-11c: read over HTTP")
def test_stage_read_over_http_a_steps_read_proposes_open_proposals(
    qs_project: QsProject, readers: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    api = step1_confirmed(qs_project, readers, monkeypatch)

    read_step(api, qs_project.project_id, "storeys")

    listed = step_proposals(api, qs_project.project_id, "storeys")
    assert len(listed) == STOREYS
    assert {p["state"] for p in listed} == {"open"}
    response = api.get(_path(qs_project.project_id, "/takeoff/steps"))
    [row] = [s for s in response.json() if s["step"] == "storeys"]
    assert row["status"] == "in_review"


@pytest.mark.xfail(strict=True, reason="M1-32a: storeys")
def test_stage_storeys_four_storeys_ordered_with_typed_levels_and_both_views_placed(
    qs_project: QsProject, readers: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C19: the storeys come from Step 1's view storeys (Ground; 1st to 3rd), levels typed (`basis:
    typed`), heights derived from the next storey's slab level; each plan view placed on its storeys."""
    api = step1_confirmed(qs_project, readers, monkeypatch)

    storeys_confirmed(api, qs_project.project_id)

    shown = storeys(api, qs_project.project_id)
    listed = sorted(shown["storeys"], key=lambda s: s["order"])
    assert len(listed) == STOREYS
    assert [Decimal(s["slab_level_m"]) for s in listed] == [Decimal(level) for level in LEVELS]
    assert {s["basis"] for s in listed} == {"typed"}
    assert [Decimal(s["height_m"]) for s in listed[:-1]] == [STOREY_HEIGHT] * (STOREYS - 1)
    assert sorted(len(v["storeys"]) for v in shown["view_placements"]) == [1, 3]


@pytest.mark.xfail(strict=True, reason="M1-33: grid")
def test_stage_grid_six_grid_lines_proposed_and_confirmed(
    qs_project: QsProject, readers: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    api = step1_confirmed(qs_project, readers, monkeypatch)
    storeys_confirmed(api, qs_project.project_id)

    read_step(api, qs_project.project_id, "grid")

    assert len(step_proposals(api, qs_project.project_id, "grid")) == GRID_LINES
    reply = confirm_step(api, qs_project.project_id, "grid")
    assert reply["figures_changed"] in (True, False)
    assert {p["state"] for p in step_proposals(api, qs_project.project_id, "grid")} == {"confirmed"}


@pytest.mark.xfail(strict=True, reason="M1-45: measure")
def test_stage_measure_one_concrete_line_per_column(
    qs_project: QsProject, readers: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C11: `measure(building_id, model_version_seq, rule_set_version_id)` on the pinned version; a
    column's line is SI, carries its mark, storey and Trace."""
    measurement = importlib.import_module("vextrus.measurement.services")
    _, reply = model_confirmed(qs_project, readers, monkeypatch)

    with qs_project.member.acting():
        pinned = measurement.pin_default(qs_project.project_id)
        measured = measurement.measure(
            _building_id(qs_project.project_id), reply["model_version_seq"], pinned.id
        )
    lines = [
        line
        for line in measured.lines
        if line.unit_si == "m3" and line.element_id is not None and line.mark == "C1"
    ]

    assert len(lines) == COLUMNS
    assert all(line.b_m == Decimal("0.5") or line.l_m == Decimal("0.25") for line in lines)
    assert all(line.trace for line in lines)


@pytest.mark.xfail(strict=True, reason="M1-15a: boq")
def test_stage_boq_the_columns_concrete_is_billed_by_storey(
    qs_project: QsProject, readers: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C13: `GET boq` -> sections of BOQ Items as billed; the columns' concrete is measured on every
    storey."""
    api, _ = model_confirmed(qs_project, readers, monkeypatch)

    response = api.get(_path(qs_project.project_id, "/boq"))

    assert response.status_code == 200, (response.status_code, response.content[:300])
    items = [item for section in response.json()["sections"] for item in section["items"]]
    columns = [item for item in items if item["group"] == "columns" and item["cost_basis"] == "measured"]
    assert columns, "no measured BOQ Item for the columns"
    assert any(len(item["by_storey"]) == STOREYS and Decimal(item["quantity"]) > 0 for item in columns)


@pytest.mark.xfail(strict=True, reason="M1-25: primitives")
def test_stage_primitives_each_confirmed_column_is_a_prism(
    qs_project: QsProject, readers: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """C17: `GET takeoff/model/primitives` -> one row per (element_id, part), state `confirmed`, its
    primitives of C4's kinds."""
    api, reply = model_confirmed(qs_project, readers, monkeypatch)

    response = api.get(
        _path(qs_project.project_id, f"/takeoff/model/primitives?seq={reply['model_version_seq']}")
    )

    assert response.status_code == 200, (response.status_code, response.content[:300])
    columns = [row for row in response.json() if row["family"] == "column"]
    assert len(columns) == COLUMNS
    assert {row["state"] for row in columns} == {"confirmed"}
    assert all([p["kind"] for p in row["primitives"]] == ["prism"] for row in columns)
