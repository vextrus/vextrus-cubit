"""What Rev C of F-RCC6-BNBC draws (R0-G2, W-44..W-47), over the composed sheets, in-process.

`test_rcc6_bnbc_revision.py` proves Rev C moves no Rev B record; this suite proves what Rev C adds is
the drawing the R0 design asks for, and that it is drawn so the product's own readers see it the way
the set means it:

- every view Rev C adds stands on an existing sheet, inside its drawing window, over no other view,
  typed by its caption, and none of its texts is tall enough to title a view (the partition's caption
  share, `views/assign.ts`) — so no Rev B view is re-keyed;
- the lift core's leg D is drawn on the eight views that draw the core, at the storey each draws;
- the stair roof carries the two C4 stubs where the model builds them, and the grid they are read on;
- each slab panel schedule states every panel of its floors once, at the model's own bars;
- each tank plan's clear sizes are the model's lx and ly, the walls outside them;
- the eight traps R0 registers are drawn on the sheets `plan.SHEETS` puts them on;
- no Rev C paper text states a date (the 27 recency recordings read every sheet's dated text, W-43).
"""

from __future__ import annotations

import json
import re
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from fixtures.gen.rcc6_bnbc import model as M  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import blocks as B  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import plan  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import sheets as S  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit.scene import APPENDED, Scene, Sheet, View  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit.sheets import common, revc_details, revc_frame, revc_slabs  # noqa: E402

#: The views Rev C adds, by sheet, with the caption each is titled by on the paper beneath it.
REV_C_VIEWS = {
    ("S-08", "RAMP SECTION"): "RAMP SECTION  SCALE 1:50",
    ("S-19", "SLAB PANEL SCHEDULE (1ST FLOOR)"): "SLAB PANEL SCHEDULE (1ST FLOOR)  SCALE 1:50",
    ("S-20", "SLAB PANEL SCHEDULE (TYPICAL FLOOR)"): "SLAB PANEL SCHEDULE (TYPICAL FLOOR)  SCALE 1:50",
    ("S-21", "SLAB PANEL SCHEDULE (ROOF & STAIR ROOF)"):
        "SLAB PANEL SCHEDULE (ROOF & STAIR ROOF)  SCALE 1:50",
    ("S-23", "LIFT PIT PLAN AT FDN"): "LIFT PIT PLAN AT FDN  SCALE 1:50",
    ("S-24", "OHWT PLAN"): "OHWT PLAN  SCALE 1:50",
    ("S-24", "UGWR PLAN"): "UGWR PLAN  SCALE 1:50",
    ("S-24", "SEPTIC TANK PLAN"): "SEPTIC TANK PLAN  SCALE 1:50",
    ("S-25", "LINTEL NOTES"): "LINTEL NOTES",
    ("S-25", "LS1 SUNSHADE DETAIL"): "LS1 SUNSHADE DETAIL  SCALE 1:20",
}

#: The caption words the partition types a view by (`views/grammar.ts`), in its precedence: each Rev C
#: caption must say one, so no Rev C view waits on a recording to be typed.
CAPTION_TYPES = ("SCHEDULE", "NOTES", "DETAIL", "PLAN", "SECTION")

#: `views/assign.ts` CAPTION_HEIGHT_SHARE: a model-space text at least this share of the tallest one is
#: a caption, and a typed caption inside a window titles it.
CAPTION_HEIGHT_SHARE = 0.8

#: The traps R0 registers (R0-G2), each on the sheet it is drawn on.
R0_TRAPS = {
    "T-PIT-RECESS": "S-07", "T-BLINDING-OUTLINE": "S-08", "T-RAMP-REVEAL": "S-08", "T-CORE-BAND": "S-14",
    "T-LB1-HALF-LANDING": "S-15", "T-STUB-COLUMNS": "S-15", "T-TANK-CLEAR": "S-24",
    "T-LINTEL-NOS-FLOORS": "S-25",
}

DATE = re.compile(r"\b\d{2}-\d{2}-\d{4}\b")


@pytest.fixture(scope="module")
def world() -> dict[str, Any]:
    return M.build()


@pytest.fixture(scope="module")
def sheets(world: dict[str, Any]) -> dict[str, Sheet]:
    return {sheet.number: sheet for sheet in S.compose(world)}


def _rev_c_views(sheets: dict[str, Sheet]) -> dict[tuple[str, str], View]:
    return {(n, v.title): v for n, sheet in sheets.items() for v in sheet.views if v.rev == APPENDED}


def _texts(scene: Scene) -> list[dict[str, Any]]:
    return [item for item in scene.items if item["kind"] in ("TEXT", "MTEXT")]


# ---------------------------------------------------------------------------------------------
# The views Rev C adds
# ---------------------------------------------------------------------------------------------


def test_rev_c_adds_its_views_to_existing_sheets_and_no_sheet(sheets: dict[str, Sheet]) -> None:
    assert [number for number, sheet in sheets.items() if sheet.new_in is not None] == []
    assert list(sheets) == plan.sheet_numbers()
    assert set(_rev_c_views(sheets)) == set(REV_C_VIEWS)


def test_each_rev_c_view_is_captioned_by_a_word_that_types_it(sheets: dict[str, Sheet]) -> None:
    for (number, title), caption in REV_C_VIEWS.items():
        view = _rev_c_views(sheets)[(number, title)]
        under = [item for item in sheets[number].paper.items if item.get("rev") == APPENDED
                 and item["kind"] == "TEXT" and item["at"] == (view.paper_at[0], view.paper_at[1] - 6.0)]
        assert [item["s"] for item in under] == [caption], (number, title)
        words = set(re.split(r"[^A-Z0-9]+", caption))
        assert words & set(CAPTION_TYPES), f"{caption!r} says no word the caption grammar types a view by"


def test_each_rev_c_view_stands_in_its_sheets_window_over_no_other_view(sheets: dict[str, Sheet]) -> None:
    for (number, title), view in _rev_c_views(sheets).items():
        x0, y0, w, h = B.window(sheets[number].size)
        (ax, ay), (sw, sh) = view.paper_at, view.paper_size
        assert x0 <= ax and y0 + 8.0 <= ay and ax + sw <= x0 + w and ay + sh <= y0 + h, (number, title)
        for other in sheets[number].views:
            if other is view:
                continue
            (bx, by), (ow, oh) = other.paper_at, other.paper_size
            # windows apart, and each window's own title band (8 mm under it) clear of the other
            apart = ax + sw <= bx or bx + ow <= ax or ay + sh <= by - 8.0 or by + oh <= ay - 8.0
            assert apart, (number, title, other.title)


def test_no_rev_c_text_can_title_a_view(sheets: dict[str, Sheet]) -> None:
    """A model-space text as tall as a caption re-titles the window it stands in (and a taller one than
    Rev B's tallest lowers every caption below the share): Rev C letters below both."""
    rev_b = [item["h"] for sheet in sheets.values() for view in sheet.views if view.rev is None
             for item in _texts(view.scene) if item.get("rev") is None]
    tallest = max(rev_b)
    rev_c = [(number, title, item["h"], item.get("s") or item.get("raw"))
             for (number, title), view in _rev_c_views(sheets).items() for item in _texts(view.scene)]
    rev_c += [(number, view.title, item["h"], item.get("s") or item.get("raw"))
              for number, sheet in sheets.items() for view in sheet.views if view.rev is None
              for item in _texts(view.scene) if item.get("rev") == APPENDED]
    assert rev_c, "Rev C letters nothing in model space"
    too_tall = [entry for entry in rev_c if entry[2] >= CAPTION_HEIGHT_SHARE * tallest]
    assert too_tall == [], too_tall


def test_no_rev_c_paper_text_states_a_date(sheets: dict[str, Sheet]) -> None:
    dated = [(number, item["s"]) for number, sheet in sheets.items() for item in sheet.paper.items
             if item.get("rev") == APPENDED and item["kind"] == "TEXT" and DATE.search(item["s"])]
    assert dated == []


# ---------------------------------------------------------------------------------------------
# What they draw
# ---------------------------------------------------------------------------------------------


def _rects(scene: Scene, layer: str) -> list[tuple[float, float, float, float]]:
    out = []
    for item in scene.items:
        if item["kind"] == "LWPOLYLINE" and item["layer"] == layer and item.get("rev") == APPENDED:
            xs = [p[0] for p in item["points"]]
            ys = [p[1] for p in item["points"]]
            out.append((min(xs), min(ys), max(xs), max(ys)))
    return out


#: The eight views that draw the lift core and the storey whose legs each draws (W-36): the plans draw
#: the storey under their floor, the typical ones the lower band (T-CORE-BAND), S-23 its GF core.
CORE_VIEWS = (
    ("S-13", "1ST FLOOR BEAM LAYOUT", "GF"),
    ("S-14", "TYPICAL FLOOR BEAM LAYOUT", "1F"),
    ("S-15", "ROOF BEAM LAYOUT", "6F"),
    ("S-15", "STAIR ROOF BEAM LAYOUT", "ROOF"),
    ("S-19", "1ST FLOOR SLAB REINFORCEMENT PLAN", "GF"),
    ("S-20", "TYPICAL SLAB REINFORCEMENT PLAN", "1F"),
    ("S-21", "ROOF & STAIR ROOF PLAN", "6F"),
    ("S-23", "LIFT CORE PLAN", "GF"),
)


def test_the_generator_draws_leg_d_on_exactly_the_core_views() -> None:
    assert tuple(revc_frame.CORE_VIEWS) == CORE_VIEWS


@pytest.mark.parametrize(("number", "title", "storey"), CORE_VIEWS)
def test_leg_d_is_drawn_where_each_core_view_draws_legs_3_and_4(
    sheets: dict[str, Sheet], world: dict[str, Any], number: str, title: str, storey: str
) -> None:
    view = next(v for v in sheets[number].views if v.title == title)
    ctx = common.Ctx(world)
    leg = ctx.by_id[f"SW1-D@{storey}"]
    want = tuple(float(leg[k]) for k in ("x0", "y0", "x1", "y1"))
    assert want in [tuple(round(v, 6) for v in r) for r in _rects(view.scene, "S-WALL")], (number, title)
    assert float(leg["t"]) == (250.0 if storey in ("GF", "1F", "2F") else 200.0)


def test_the_stair_roof_is_gridded_and_carries_its_two_c4_stubs(
    sheets: dict[str, Sheet], world: dict[str, Any]
) -> None:
    srr = next(v for v in sheets["S-15"].views if v.title == "STAIR ROOF BEAM LAYOUT").scene
    ctx = common.Ctx(world)
    bubbles = sorted(item["attribs"]["GRID"] for item in srr.items if item["kind"] == "INSERT"
                     and item["block"] == "GRID_BUBBLE" and item.get("rev") == APPENDED)
    assert bubbles == sorted([*revc_frame.SRR_AXES, *revc_frame.SRR_ROWS])
    stubs = _rects(srr, "S-COLS")
    for sid in revc_frame.STUBS:
        m = ctx.by_id[sid]
        poly = [(float(x), float(y)) for x, y in M.column_poly(ctx.stacks[m["stack"]], "ROOF")]
        xs, ys = [x for x, _ in poly], [y for _, y in poly]
        box = (min(xs), min(ys), max(xs), max(ys))
        assert box in stubs, sid
        assert (m["mark"], m["level"]) == ("C4", "ROOF")
    marks = [item["s"] for item in srr.items if item.get("family") == "mark" and item.get("rev") == APPENDED]
    assert marks.count("C4") == len(revc_frame.STUBS)


@pytest.mark.parametrize(("number", "title", "levels", "_at", "_size"), revc_slabs.SCHEDULES)
def test_each_slab_panel_schedule_states_every_panel_once_at_its_own_bars(
    sheets: dict[str, Sheet], world: dict[str, Any], number: str, title: str, levels: tuple[str, ...],
    _at: Any, _size: Any
) -> None:
    view = next(v for v in sheets[number].views if v.title == title)
    marks = [item["s"] for item in view.scene.items if item.get("family") == "mark"]
    want = list(dict.fromkeys(m["mark"] for level in levels for m in world["members"]
                              if m["class"] == "SLAB" and m["level"] == level))
    assert marks == want
    ctx = common.Ctx(world)
    for m in revc_slabs._panels(ctx, levels):
        row = revc_slabs.row(ctx, m)
        if row[-1] in ("CANTILEVER", "ONE WAY"):
            continue
        dia, spacing = M.SLAB_BARS[int(m["t"])]
        assert [cell[0] for cell in row[2:5]] == [f"{dia}%%C @ {spacing}"] * 3, m["id"]


def test_a_changed_spacing_stops_the_schedule(world: dict[str, Any]) -> None:
    """The schedule prints a spacing only where the bars' own counts bear it out."""
    ctx = common.Ctx(world)
    s1 = next(m for m in ctx.at("SLAB", "1F") if m["mark"] == "S1")
    original = M.SLAB_BARS[int(s1["t"])]
    try:
        M.SLAB_BARS[int(s1["t"])] = (original[0], original[1] + 25)
        with pytest.raises(AssertionError):
            revc_slabs.row(ctx, s1)
    finally:
        M.SLAB_BARS[int(s1["t"])] = original
    assert revc_slabs.row(ctx, s1)[2][0] == f"{original[0]}%%C @ {original[1]}"


@pytest.mark.parametrize(("spec_name", "prefix", "_section", "title", "_at", "_size"), revc_details.TANKS)
def test_each_tank_plan_draws_the_clear_sizes_with_the_walls_outside(
    sheets: dict[str, Sheet], spec_name: str, prefix: str, _section: str, title: str, _at: Any, _size: Any
) -> None:
    spec = getattr(M, spec_name)
    view = next(v for v in sheets["S-24"].views if v.title == title)
    wall = float(spec["wall"])
    ly = float(spec["ly"]) * spec.get("chambers", 1) + float(spec.get("baffle", 0)) if spec_name == "SEPTIC" \
        else float(spec["ly"])
    rects = [item for item in view.scene.items if item["kind"] == "LWPOLYLINE" and item["layer"] == "S-WALL"]
    boxes = []
    for item in rects:
        xs = [p[0] for p in item["points"]]
        ys = [p[1] for p in item["points"]]
        boxes.append((round(max(xs) - min(xs), 6), round(max(ys) - min(ys), 6), round(min(xs), 6)))
    assert (float(spec["lx"]), ly, wall) in boxes, (title, boxes)  # the clear inside, set in by the wall
    assert (float(spec["lx"]) + 2 * wall, ly + 2 * wall, 0.0) in boxes, (title, boxes)  # the outer faces
    notes = [item["s"] for item in view.scene.items if item["kind"] == "TEXT"]
    assert "ALL SIZES ARE CLEAR INSIDE" in notes


# ---------------------------------------------------------------------------------------------
# The traps R0 registers
# ---------------------------------------------------------------------------------------------


def test_r0s_traps_are_registered_and_drawn_on_their_sheets(sheets: dict[str, Sheet]) -> None:
    traps = json.loads((ROOT / "fixtures/gen/rcc6_bnbc/traps.json").read_text(encoding="utf-8"))["traps"]
    registry = {t["id"]: t for t in traps}
    for trap, number in R0_TRAPS.items():
        assert registry[trap]["sheet"] == number, trap
        assert trap in plan.traps_on(number), trap
        assert trap in S.trapped_items(sheets[number]), trap
    assert len(registry) == 60


def test_the_notes_state_the_models_figures(world: dict[str, Any]) -> None:
    """Spot checks with teeth: the figures Rev C prints are the model's."""
    assert M.COVER["PILE"] == M.COVER["FOOTING"] == Decimal(75)
    ctx = common.Ctx(world)
    lin = {mark: ctx.by_mark[mark][0] for mark in ("L1", "L2", "LS1")}
    assert {m["length"] - m["opening_w"] for m in lin.values()} == {Decimal(600)}  # bearing 300 each side
    cap = ctx.by_id["PC-CORE"]
    c = M.CORE
    clear = ((c["x1"] - c["x0"]) - c["t_low"], (c["y1"] - c["y0"]) - c["t_low"])
    assert clear == (Decimal("2493.2"), Decimal("2188.4"))
    assert cap["recess"] == clear[0] * clear[1] * (M.ELEV["PCTOP"] - c["pit_bottom"])
