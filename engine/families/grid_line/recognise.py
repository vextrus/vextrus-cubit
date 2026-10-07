"""The grid_line family's recogniser (docs/plans/M1.md C4; session 16's contract).

    recognise(views, confirmed, setup, profile) -> Recognised

For each view: what model space draws inside the view's box, taken from paper to model space by
`place.model_box` (the whole space when the artefact comes with no view), is read by
`read.read_grid`, and each grid line becomes one `ElementCandidate`:

- `mark`: the bubble's label, verbatim; `candidate_key`: `<view id>|<mark>`; `storey`: the view's;
- `values["axis"]`: "x" or "y", the direction the line is drawn in (the grid's first or second);
- `values["offset"]`: its place across that direction, in drawing units (a Decimal), so two lines'
  offsets differ by their spacing; its `unit` is the file's drawing unit;
- `anchors`: the label's text (`mark`) and the line (`axis`), each a `DwgAnchor` on the view's sheet;
- `geometry`: the line's two ends in drawing units.

A view where no grid line is read raises `engine.grid_line.not_found {view}`; a view where only one
direction is read raises `engine.grid_line.one_direction {view, axis}`; a label drawn on two different
lines raises `engine.grid_line.label_twice {view, label}`; a view whose box cannot be taken to model
space (`place.model_box`) raises `engine.grid_line.view_unplaced {view}`; a profile label pattern
that is no regular expression is left out and raises `engine.grid_line.profile_pattern_refused
{pattern}`. Never silence.

The Drafting Profile's `grid` part (C6: `{"layers": [...], "bubble_blocks": [...]}`, optionally
`label_patterns`), when confirmed, narrows the search: lines and circles on its layers, bubbles inside
its blocks. No layer, block or label is named in this code (ADR 0039).
"""

import re
import warnings
from collections.abc import Mapping, Sequence
from decimal import Decimal
from typing import Any

from engine.families.grid_line.drawn import Drawn, read_space
from engine.families.grid_line.place import Unplaced, model_box
from engine.families.grid_line.read import GridLine, ViewGrid, read_grid
from engine.families.types import (
    ConfirmedFacts,
    ElementCandidate,
    FactValue,
    ProfileParts,
    ProjectSetup,
    QuestionRaised,
    Recognised,
    ViewArtefact,
)
from engine.read.anchor import DwgAnchor
from engine.read.artefact import ReadArtefact

FAMILY = "grid_line"
NOT_FOUND = "engine.grid_line.not_found"
ONE_DIRECTION = "engine.grid_line.one_direction"
LABEL_TWICE = "engine.grid_line.label_twice"
UNPLACED = "engine.grid_line.view_unplaced"
BAD_PATTERN = "engine.grid_line.profile_pattern_refused"
SOURCE = "drawing"

UNITS = {0: "unitless", 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m"}
"""INSUNITS as the unit a drawing's numbers are in."""


def _grid_part(profile: ProfileParts | None) -> Mapping[str, Any]:
    """The profile's `grid` part (C6), whatever it is given as; empty when it holds none."""
    parts = getattr(profile, "parts", None)
    holder = parts if isinstance(parts, Mapping) else profile
    part = holder.get("grid") if isinstance(holder, Mapping) else getattr(holder, "grid", None)
    return part if isinstance(part, Mapping) else {}


def _strings(value: object) -> tuple[str, ...]:
    if isinstance(value, str | bytes) or not isinstance(value, Sequence):
        return ()
    return tuple(v for v in value if isinstance(v, str) and v)


def _patterns(texts: Sequence[str]) -> tuple[tuple[re.Pattern[str], ...], tuple[str, ...]]:
    """The profile's label patterns compiled, and those that are no pattern (refused, not raised)."""
    held: list[re.Pattern[str]] = []
    refused: list[str] = []
    for text in texts:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error")  # a pattern Python warns of is refused, never raised
                held.append(re.compile(text))
        except re.error, OverflowError, RecursionError, Warning:
            refused.append(text)
    return tuple(held), tuple(refused)


class _Spaces:
    """Model space walked once per artefact in one call."""

    def __init__(self, layers: Sequence[str]) -> None:
        self.layers = layers
        self.held: dict[int, tuple[ReadArtefact, Drawn]] = {}

    def of(self, artefact: ReadArtefact) -> Drawn:
        held = self.held.get(id(artefact))
        if held is None or held[0] is not artefact:
            held = (artefact, read_space(artefact, self.layers))
            self.held[id(artefact)] = held
        return held[1]


def _decimal(value: float) -> Decimal:
    return Decimal(repr(value))


def _anchor(artefact: ReadArtefact, sheet: str, handle: str, inserts: tuple[str, ...]) -> Any:
    summary = artefact.summary
    try:
        return DwgAnchor(
            summary.source_sha256, summary.reader, summary.reader_version, sheet, inserts, handle
        )
    except ValueError:
        return None


def _value(value: Any, unit: str, text: str) -> FactValue:
    """K0's value object. The axis is a word ("x" | "y"), not a number: carried in `value` as the
    session's contract names it, which K0's `Decimal` annotation does not cover (said in the PR)."""
    return FactValue(value=value, unit=unit, text=text)


def _candidate(view: ViewArtefact, drawn: Drawn, line: GridLine, unit: str) -> ElementCandidate:
    artefact = view.artefact
    label = line.bubble.label
    handle, inserts, _ = drawn.entities[line.line_entity]
    anchors = {
        "mark": _anchor(artefact, view.sheet_id, label.handle, label.inserts),
        "axis": _anchor(artefact, view.sheet_id, handle, inserts),
    }
    return ElementCandidate(
        family=FAMILY,
        candidate_key=f"{view.view_id}|{line.mark}",
        storey=getattr(view, "storey", None),
        band=None,
        mark=line.mark,
        at=None,
        values={
            "axis": _value(line.axis, "", label.shown),
            "offset": _value(_decimal(line.offset), unit, ""),
        },
        anchors={k: v for k, v in anchors.items() if v is not None},
        source=SOURCE,
        confidence=Decimal(1),
        geometry=(line.start, line.end),
    )


def _questions(view: ViewArtefact, grid: ViewGrid) -> list[QuestionRaised]:
    if not grid.lines:
        return [QuestionRaised(code=NOT_FOUND, params={"view": view.view_id})]
    found: list[QuestionRaised] = []
    axes = {line.axis for line in grid.lines}
    for axis in ("x", "y"):
        if axis not in axes:
            found.append(QuestionRaised(code=ONE_DIRECTION, params={"view": view.view_id, "axis": axis}))
    found.extend(
        QuestionRaised(code=LABEL_TWICE, params={"view": view.view_id, "label": label})
        for label in grid.twice
    )
    return found


def recognise(
    views: Sequence[ViewArtefact],
    confirmed: ConfirmedFacts,
    setup: ProjectSetup,
    profile: ProfileParts | None,
) -> Recognised:
    part = _grid_part(profile)
    layers = _strings(part.get("layers"))
    blocks = frozenset(_strings(part.get("bubble_blocks")))
    patterns, refused = _patterns(_strings(part.get("label_patterns")))
    spaces = _Spaces(layers)
    candidates: list[ElementCandidate] = []
    questions = [QuestionRaised(code=BAD_PATTERN, params={"pattern": text}) for text in refused]
    for view in views:
        artefact = view.artefact
        try:
            box = model_box(artefact, view)
        except Unplaced:
            questions.append(QuestionRaised(code=UNPLACED, params={"view": view.view_id}))
            continue
        drawn = spaces.of(artefact).within(box)
        if blocks:
            drawn = Drawn(
                drawn.segments,
                drawn.segment_entity,
                drawn.entities,
                [c for c in drawn.circles if blocks & set(c.block_names)],
                drawn.labels,
            )
        grid = read_grid(drawn, patterns)
        unit = UNITS.get(artefact.summary.insunits, "unitless")
        candidates.extend(_candidate(view, drawn, line, unit) for line in grid.lines)
        questions.extend(_questions(view, grid))
    return Recognised(candidates=tuple(candidates), questions=tuple(questions))
