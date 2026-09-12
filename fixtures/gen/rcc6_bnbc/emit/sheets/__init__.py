"""The 26 sheets of F-RCC6-BNBC, composed from `model.build()` (Wave B D2).

Public API (Implementer B and `emit.dxf` / `emit.pdf` call exactly these):

    compose(world) -> list[Scene.Sheet]    exactly `plan.SHEETS`, in order
    blocks()       -> list[Scene.Block]    every block those sheets insert

`compose` also proves two things about itself before it hands the sheets back: every trap
`traps.json` puts on a sheet is really drawn there, and every member mark
`selfcheck.schedule_marks()` puts on a sheet is printed there as a TEXT of family `mark`.
"""

from __future__ import annotations

from typing import Any

from .. import blocks as _blocks
from .. import plan
from ..scene import Block, Sheet, dim_text
from . import beams, cols, details, found, front, slabs
from .common import Ctx

#: One composer per sheet number, in the roster's own order.
COMPOSERS = {
    "S-00": front.s00, "S-01": front.s01, "S-02": front.s02, "S-03": front.s03,
    "S-04": found.s04, "S-05": found.s05, "S-06": found.s06, "S-07": found.s07,
    "S-08": found.s08, "S-09": found.s09,
    "S-10": cols.s10, "S-11": cols.s11, "S-12": cols.s12,
    "S-13": beams.s13, "S-14": beams.s14, "S-15": beams.s15,
    "S-16": beams.s16, "S-17": beams.s17, "S-18": beams.s18,
    "S-19": slabs.s19, "S-20": slabs.s20, "S-21": slabs.s21,
    "S-22": details.s22, "S-23": details.s23, "S-24": details.s24,
    "S-25": details.s25, "S-26": details.s26,
}


def blocks() -> list[Block]:
    """Every block the sheets insert, in definition order (children before their parents)."""
    return _blocks.library()


def compose(world: dict[str, Any]) -> list[Sheet]:
    """The 26 sheets, in `plan.SHEETS` order, each checked for its own traps and marks."""
    ctx = Ctx(world)
    sheets = [COMPOSERS[number](ctx) for number in plan.sheet_numbers()]
    _author_dim_text(sheets)
    _check_traps(ctx, sheets)
    _check_marks(ctx, sheets)
    return sheets


def _author_dim_text(sheets: list[Sheet]) -> None:
    """A dimension that carries a `fact` prints it: its text is authored here from its own measured
    span x DIMLFAC, in the view's unit habit (W-08), so the printed string and the drawn geometry
    are one fact. A dimension with no fact keeps `text = None` and is measured by the reader."""
    for sheet in sheets:
        for unit, scene in [("mm", sheet.paper), *[(v.unit, v.scene) for v in sheet.views]]:
            for item in scene.items:
                if item["kind"] != "DIMENSION" or item.get("text") or not item.get("fact"):
                    continue
                (x1, y1), (x2, y2) = item["p1"], item["p2"]
                measure = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
                item["text"] = dim_text(measure, item.get("dimlfac", 1.0), unit)


def trapped_items(sheet: Sheet) -> dict[str, dict[str, Any]]:
    """Every item on a sheet that names a trap, by trap id."""
    out: dict[str, dict[str, Any]] = {}
    for scene in [sheet.paper, *[v.scene for v in sheet.views]]:
        for item in scene.items:
            trap = item.get("trap")
            if trap and trap not in out:
                out[trap] = item
    return out


def role_item(sheet: Sheet, role: str) -> dict[str, Any] | None:
    for scene in [sheet.paper, *[v.scene for v in sheet.views]]:
        for item in scene.items:
            if item.get("role") == role:
                return item
    return None


def _check_traps(ctx: Ctx, sheets: list[Sheet]) -> None:
    by_number = {s.number: s for s in sheets}
    missing = []
    for trap in ctx.traps["traps"]:
        number = trap["sheet"]
        if number == "*":
            continue
        if trap["id"] not in trapped_items(by_number[number]):
            missing.append((trap["id"], number))
    assert not missing, f"traps registered on a sheet but not drawn on it: {missing}"


def _check_marks(ctx: Ctx, sheets: list[Sheet]) -> None:
    missing = []
    for sheet in sheets:
        wanted = set(ctx.marks_for(sheet.number))
        if not wanted:
            continue
        printed = set()
        for scene in [sheet.paper, *[v.scene for v in sheet.views]]:
            for item in scene.items:
                if item["kind"] == "TEXT" and item.get("family") == "mark":
                    printed.add(item["s"])
        for mark in sorted(wanted - printed):
            missing.append((sheet.number, mark))
    assert not missing, f"schedule marks not printed on their own sheet: {missing[:20]}"
