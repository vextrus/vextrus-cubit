"""Ticket S16-R1, the grid reader (docs/plans/M1.md C4; the session's contract, grid_line): "candidate
per grid line: `mark` = label verbatim ("A", "1"), `values` include `axis` ("x"|"y" direction of the
line), `offset` in drawing units; identity rule "label". The frame (registered grid across plans) is
`engine.families.grid_line.frame.register(candidates_by_view) -> Frame` with `Frame.point(ref "B/2")
-> (x, y)` in drawing units."

On one synthetic file (`drawing.py`) read by M0's reader (`engine.read.read`), through the family's
`recognise(views, confirmed, setup, profile)` with no profile. Built through the real writer:

    uv run --no-sync pytest -m needs_toolchain engine/families/grid_line/tests/acceptance/ts16r1
"""

import importlib
from collections import Counter
from collections.abc import Sequence
from decimal import Decimal
from typing import Any

import pytest

from engine.read import ReadArtefact, read
from engine.recognise.types import Box, ViewCandidate, ViewKind

from . import drawing

# Not built yet (K0 and R1): imported by name, typed Any, so the base type-checks and fails here.
frame: Any = importlib.import_module("engine.families.grid_line.frame")
manifest: Any = importlib.import_module("engine.families.grid_line.manifest")
recognising: Any = importlib.import_module("engine.families.grid_line.recognise")
types: Any = importlib.import_module("engine.families.types")
register = frame.register
MANIFEST = manifest.MANIFEST
recognise = recognising.recognise
ConfirmedFacts = types.ConfirmedFacts
ProjectSetup = types.ProjectSetup
QuestionRaised = types.QuestionRaised
ViewArtefact = types.ViewArtefact

pytestmark = pytest.mark.needs_toolchain

TOLERANCE = Decimal("0.001")


@pytest.fixture(scope="module")
def artefact(tmp_path_factory: pytest.TempPathFactory) -> ReadArtefact:
    build = tmp_path_factory.mktemp("ts16r1-build")
    folder = tmp_path_factory.mktemp("structural")
    return read(drawing.build(folder, build))


def _view(artefact: ReadArtefact, view_id: str, at: tuple[float, float]) -> Any:
    box = Box(*drawing.box_of(at))
    return ViewArtefact(
        view_id=view_id,
        sheet_id="ts16r1-sheet",
        artefact=artefact,
        view=ViewCandidate(box=box, kind=ViewKind.PLAN, title="COLUMN LAYOUT PLAN"),
    )


type Read = tuple[tuple[Any, ...], tuple[Any, ...]]


def _read(views: Sequence[Any]) -> Read:
    found = recognise(views, ConfirmedFacts(), ProjectSetup(), None)
    return tuple(found.candidates), tuple(found.questions)


def _plain(value: object) -> object:
    """A value as named in `values`: plain, or a value object holding it in `.value`."""
    return getattr(value, "value", value)


def _number(value: object) -> Decimal:
    return Decimal(str(_plain(value)))


def _by_mark(candidates: Sequence[Any]) -> dict[str, Any]:
    return {c.mark: c for c in candidates}


def test_the_manifest_is_the_grid_line_family_identified_by_label() -> None:
    assert MANIFEST.key == "grid_line"
    assert MANIFEST.identity_rule == "label"


def test_one_candidate_per_grid_line_with_its_label_verbatim(artefact: ReadArtefact) -> None:
    candidates, _ = _read([_view(artefact, "plan_1", drawing.PLAN_1_AT)])

    assert Counter(c.mark for c in candidates) == Counter(drawing.MARKS)
    assert {c.family for c in candidates} == {"grid_line"}


def test_a_column_mark_is_not_read_as_a_grid_line(artefact: ReadArtefact) -> None:
    candidates, _ = _read([_view(artefact, "plan_1", drawing.PLAN_1_AT)])

    assert "C1" not in {c.mark for c in candidates}


def test_each_grid_line_names_its_axis_as_the_direction_it_is_drawn(artefact: ReadArtefact) -> None:
    candidates = _by_mark(_read([_view(artefact, "plan_1", drawing.PLAN_1_AT)])[0])

    axes = {mark: _plain(candidates[mark].values["axis"]) for mark in drawing.MARKS}
    assert axes == {"A": "y", "B": "y", "C": "y", "D": "y", "1": "x", "2": "x", "3": "x", "4": "x"}


@pytest.mark.parametrize(
    ("family", "first", "second"),
    [("letters", "A", "B"), ("letters", "B", "C"), ("letters", "C", "D"),
     ("numbers", "1", "2"), ("numbers", "2", "3"), ("numbers", "3", "4")],
)  # fmt: skip
def test_the_spacing_between_grid_lines_is_read_in_drawing_units(
    artefact: ReadArtefact, family: str, first: str, second: str
) -> None:
    candidates = _by_mark(_read([_view(artefact, "plan_1", drawing.PLAN_1_AT)])[0])
    labels = drawing.LETTERS if family == "letters" else drawing.NUMBERS

    offset = {mark: _number(candidates[mark].values["offset"]) for mark in (first, second)}
    read_spacing = offset[second] - offset[first]

    assert abs(abs(read_spacing) - drawing.spacing(labels, first, second)) <= TOLERANCE


def test_two_offset_plans_register_into_one_frame_with_the_same_b2(artefact: ReadArtefact) -> None:
    plan_1, _ = _read([_view(artefact, "plan_1", drawing.PLAN_1_AT)])
    plan_2, _ = _read([_view(artefact, "plan_2", drawing.PLAN_2_AT)])

    together = register({"plan_1": plan_1, "plan_2": plan_2})
    reversed_order = register({"plan_2": plan_2, "plan_1": plan_1})
    only_1 = register({"plan_1": plan_1})
    only_2 = register({"plan_2": plan_2})

    b2 = together.point("B/2")
    assert reversed_order.point("B/2") == b2
    assert only_1.point("B/2") == only_2.point("B/2") == b2


def test_the_frame_places_intersections_at_the_grid_spacing(artefact: ReadArtefact) -> None:
    plan_1, _ = _read([_view(artefact, "plan_1", drawing.PLAN_1_AT)])
    plan_2, _ = _read([_view(artefact, "plan_2", drawing.PLAN_2_AT)])
    frame = register({"plan_1": plan_1, "plan_2": plan_2})

    a1 = frame.point("A/1")
    for ref, (dx, dy) in {"B/2": (6000, 5000), "D/4": (17000, 15000), "C/3": (11000, 9500)}.items():
        x, y = frame.point(ref)
        assert abs(_number(x) - _number(a1[0]) - dx) <= TOLERANCE, ref
        assert abs(_number(y) - _number(a1[1]) - dy) <= TOLERANCE, ref


def test_a_plan_with_no_grid_raises_a_question_not_silence(artefact: ReadArtefact) -> None:
    candidates, questions = _read([_view(artefact, "no_grid", drawing.NO_GRID_AT)])

    assert candidates == ()
    assert questions
    assert all(isinstance(q, QuestionRaised) for q in questions)
