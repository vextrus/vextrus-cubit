"""A crafted file or profile is refused or bounded, never raised (the refuter's round on S16-R1): each
test pins one class it found."""

import contextlib
import math
import time
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import numpy as np

from engine.families.grid_line.drawn import Circle, Drawn, Label
from engine.families.grid_line.frame import register
from engine.families.grid_line.place import Unplaced, model_box
from engine.families.grid_line.read import read_grid
from engine.families.grid_line.recognise import BAD_PATTERN, NOT_FOUND, recognise
from engine.families.types import ConfirmedFacts, ProjectSetup
from engine.read.anchor import DwgAnchor
from engine.read.artefact import Block, Entity
from engine.recognise.types import Box, ViewCandidate, ViewKind

SHA = "0" * 64
R = 450.0


def artefact(blocks: dict[str, Block] | None = None, entities: dict[str, Any] | None = None) -> Any:
    summary = SimpleNamespace(source_sha256=SHA, reader="libredwg", reader_version="0.14", insunits=4)
    return SimpleNamespace(summary=summary, blocks=blocks or {}, entities=entities or {})


def one_bubble(lines: list[tuple[float, float, float, float]], x: float, y: float) -> Drawn:
    segments = np.array(lines, dtype=np.float64).reshape(-1, 4)
    entities: list[tuple[str, tuple[str, ...], str]] = [("1A", (), "L")] * len(lines)
    return Drawn(
        segments,
        np.arange(len(lines), dtype=np.int64),
        entities,
        [Circle(x, y, R, "B", "2B", (), ())],
        [Label("A", x, y, 400.0, "3C", ())],
    )


def test_many_collinear_pieces_join_in_linear_time() -> None:
    n = 40_000
    pieces = [(0.0, 0.0, 0.0, 12000.0)]
    pieces += [(0.0, -100.0 * (i + 1), 0.0, -100.0 * (i + 1) + 90.0) for i in range(n)]
    started = time.monotonic()

    [line] = read_grid(one_bubble(pieces, 0.0, 12000.0 + R)).lines

    assert time.monotonic() - started < 5.0
    assert math.isclose(line.length, 12000.0 + 100.0 * n, rel_tol=1e-9)


def test_a_line_at_the_float_limit_is_not_read() -> None:
    far = 1.7e308
    grid = read_grid(one_bubble([(far, 0.0, far, 12000.0)], far, -R))

    assert grid.lines == ()


def test_an_offset_no_decimal_can_subtract_is_skipped_by_the_frame() -> None:
    item = SimpleNamespace(family="grid_line", mark="A", values={"axis": "y", "offset": "Infinity"})
    other = SimpleNamespace(family="grid_line", mark="B", values={"axis": "y", "offset": "6000"})

    frame = register({"one": [item, other], "two": [item, other]})

    assert set(frame.lines) == {"B"}
    assert frame.lines["B"].offset == Decimal(0)


def test_a_viewport_whose_scale_underflows_leaves_the_view_unplaced() -> None:
    viewport = Entity(
        "5", "VIEWPORT", "0", "4",
        {"id": 2, "center": [10.0, 10.0, 0.0], "width": 1e-300, "height": 1e-300,
         "view_center_point": [0.0, 0.0, 0.0], "view_height": 1e300, "view_target_point": [0, 0, 0]},
    )  # fmt: skip
    layout = Block("4", "*Paper_Space", (0.0, 0.0, 0.0), "L1", ("5",))
    anchor = DwgAnchor(SHA, "libredwg", "0.14", "L1", (), "6")
    view = ViewCandidate(box=Box(0.0, 0.0, 20.0, 20.0), kind=ViewKind.PLAN, anchors=(anchor,))

    with contextlib.suppress(Unplaced):  # placed by nothing, or unplaced: never an arithmetic error
        model_box(artefact({"4": layout}, {"5": viewport}), SimpleNamespace(view=view))


def test_a_profile_pattern_that_is_no_pattern_is_a_question_not_an_error() -> None:
    held: Any = SimpleNamespace(view_id="V", sheet_id="S", artefact=artefact(), view=None, storey=None)
    profile: Any = SimpleNamespace(grid={"label_patterns": ["(", "a{99999999999}", "[A-Z]"]})

    found = recognise([held], ConfirmedFacts(), ProjectSetup(), profile)

    codes = [(q.code, dict(q.params)) for q in found.questions]
    assert (BAD_PATTERN, {"pattern": "("}) in codes
    assert (BAD_PATTERN, {"pattern": "a{99999999999}"}) in codes
    assert (NOT_FOUND, {"view": "V"}) in codes
