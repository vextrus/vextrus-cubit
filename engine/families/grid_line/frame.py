"""The frame: the grid registered across plans (session 16's contract).

    register(candidates_by_view) -> Frame
    Frame.point("B/2") -> (x, y)

`candidates_by_view` maps a view's id to its grid lines: grid_line `ElementCandidate`s, or confirmed
`ElementFacts` (anything with a `mark` and `values` holding `axis` and `offset`, plain or as a value
object carrying `.value`). Anything of another family is ignored.

**How plans are registered.** Each plan draws the grid where its sheet put it, so a plan's offsets are
shifted from another's by the plan's place. The plan reading the most grid lines (ties: the lowest view
id) is the reference; every other plan is placed, one at a time (the one sharing the most labels with
what is placed first, ties by view id), per direction by the difference in offset most of the labels
they share agree on (ties: the first label's), so one label drawn astray does not move the plan. A
plan sharing no label in a direction is not placed (`unplaced`), and adds no line. A label whose
placed offset differs between plans by more than `TOLERANCE` is a `conflict` (the first placed is
kept). The result does not depend on the order of `candidates_by_view`.

**Its origin** is the lowest offset of each direction (A/1 in a grid lettered left to right and
numbered upwards), so `point` gives the same coordinates for the same grid whichever plans hold it.

`point("B/2")`: the crossing of the two lines the reference names, one of each direction, in either
order: x from the line drawn along "y", y from the line drawn along "x", in drawing units (Decimals).
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

FAMILY = "grid_line"
SEPARATOR = "/"
TOLERANCE = Decimal("1")
"""Drawing units two plans' offsets of one label may differ by before it is a conflict."""


@dataclass(frozen=True)
class FrameLine:
    mark: str
    axis: str  # "x" | "y": the direction it is drawn in
    offset: Decimal  # across that direction, from the frame's origin, in drawing units
    views: tuple[str, ...]


@dataclass(frozen=True)
class Frame:
    lines: Mapping[str, FrameLine] = field(default_factory=dict)
    shifts: Mapping[str, tuple[Decimal, Decimal]] = field(default_factory=dict)
    """Per placed view: what is added to its own (x, y) to put it in the frame."""
    unplaced: tuple[str, ...] = ()
    conflicts: tuple[str, ...] = ()

    def line(self, mark: str) -> FrameLine:
        try:
            return self.lines[mark]
        except KeyError:
            raise KeyError(f"the frame has no grid line {mark!r}") from None

    def point(self, ref: str) -> tuple[Decimal, Decimal]:
        """The crossing of the two lines `ref` names ("B/2"), as (x, y) in the frame."""
        parts = [part.strip() for part in ref.split(SEPARATOR)]
        if len(parts) != 2:
            raise ValueError(f"a grid reference names two lines, {ref!r} does not")
        first, second = (self.line(part) for part in parts)
        if first.axis == second.axis:
            raise ValueError(f"{ref!r} names two lines drawn in one direction")
        along_y = first if first.axis == "y" else second
        along_x = second if along_y is first else first
        return (along_y.offset, along_x.offset)

    def to_frame(self, view_id: str, x: Decimal, y: Decimal) -> tuple[Decimal, Decimal]:
        """A point of a placed view, in the frame."""
        dx, dy = self.shifts[view_id]
        return (x + dx, y + dy)


def _plain(value: object) -> object:
    return getattr(value, "value", value)


def _lines(items: Sequence[Any]) -> dict[str, tuple[str, Decimal]]:
    """A view's lines by mark: (axis, offset). An item of another family is skipped."""
    found: dict[str, tuple[str, Decimal]] = {}
    for item in items:
        family = getattr(item, "family", FAMILY)
        values = getattr(item, "values", None)
        mark = getattr(item, "mark", None)
        if family != FAMILY or not isinstance(values, Mapping) or not isinstance(mark, str):
            continue
        axis = _plain(values.get("axis"))
        offset = _plain(values.get("offset"))
        if axis not in ("x", "y") or offset is None:
            continue
        try:
            number = Decimal(str(offset))
        except ArithmeticError:
            continue
        if number.is_finite():
            found.setdefault(mark, (str(axis), number))
    return found


def _shift(
    placed: Mapping[str, tuple[str, Decimal]], own: Mapping[str, tuple[str, Decimal]], axis: str
) -> Decimal | None:
    """The shift most shared labels of `axis` agree on (within `TOLERANCE`); ties: the first label's."""
    differences = [
        placed[mark][1] - offset
        for mark, (line_axis, offset) in sorted(own.items())
        if line_axis == axis and mark in placed and placed[mark][0] == axis
    ]
    if not differences:
        return None
    return max(
        differences,
        key=lambda d: sum(abs(d - other) <= TOLERANCE for other in differences),
    )


def register(candidates_by_view: Mapping[str, Sequence[Any]]) -> Frame:
    by_view = {view: _lines(items) for view, items in candidates_by_view.items()}
    by_view = {view: lines for view, lines in by_view.items() if lines}
    if not by_view:
        return Frame()
    reference = min(by_view, key=lambda view: (-len(by_view[view]), view))
    placed: dict[str, tuple[str, Decimal]] = dict(by_view[reference])
    holders: dict[str, list[str]] = {mark: [reference] for mark in placed}
    shifts: dict[str, tuple[Decimal, Decimal]] = {reference: (Decimal(0), Decimal(0))}
    conflicts: set[str] = set()
    waiting = sorted(view for view in by_view if view != reference)
    unplaced: list[str] = []
    while waiting:
        view = min(waiting, key=lambda v: (-len(by_view[v].keys() & placed.keys()), v))
        waiting.remove(view)
        own = by_view[view]
        dy = _shift(placed, own, "x")  # lines drawn along x sit at a y
        dx = _shift(placed, own, "y")
        if dx is None or dy is None:
            unplaced.append(view)
            continue
        shifts[view] = (dx, dy)
        for mark, (axis, offset) in own.items():
            moved = offset + (dy if axis == "x" else dx)
            held = placed.get(mark)
            if held is None:
                placed[mark] = (axis, moved)
                holders[mark] = [view]
                continue
            holders[mark].append(view)
            if held[0] != axis or abs(held[1] - moved) > TOLERANCE:
                conflicts.add(mark)
    origin = {
        axis: min((offset for a, offset in placed.values() if a == axis), default=Decimal(0))
        for axis in ("x", "y")
    }
    lines = {
        mark: FrameLine(mark, axis, offset - origin[axis], tuple(sorted(holders[mark])))
        for mark, (axis, offset) in placed.items()
    }
    shifts = {view: (dx - origin["y"], dy - origin["x"]) for view, (dx, dy) in shifts.items()}
    return Frame(lines, shifts, tuple(unplaced), tuple(sorted(conflicts)))
