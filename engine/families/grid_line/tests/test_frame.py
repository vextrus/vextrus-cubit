"""The frame: registering grid lines across views (frame.py's promises, at its public interface)."""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

import pytest

from engine.families.grid_line.frame import FactValue, register


@dataclass(frozen=True)
class Item:
    mark: str
    values: dict[str, Any]
    family: str = "grid_line"
    extra: dict[str, Any] = field(default_factory=dict)


def lines(offsets: dict[str, tuple[str, str]], dx: str = "0", dy: str = "0") -> list[Item]:
    """Grid lines by mark: (axis, offset), shifted by the view's place (dx, dy)."""
    found = []
    for mark, (axis, offset) in offsets.items():
        shift = Decimal(dy) if axis == "x" else Decimal(dx)
        value = FactValue(Decimal(offset) + shift, "mm")
        found.append(Item(mark, {"axis": FactValue(axis), "offset": value}))
    return found


GRID = {"A": ("y", "0"), "B": ("y", "6000"), "N1": ("x", "0"), "N2": ("x", "5000")}


def test_a_point_is_the_crossing_in_either_order() -> None:
    frame = register({"v": lines(GRID)})

    assert frame.point("B/N2") == frame.point("N2/B") == (Decimal(6000), Decimal(5000))


def test_views_drawn_apart_register_to_one_frame_whatever_the_order() -> None:
    one = lines(GRID)
    two = lines(GRID, "123456.5", "-777")

    forward = register({"one": one, "two": two})
    backward = register({"two": two, "one": one})

    assert forward.point("B/N2") == backward.point("B/N2") == register({"two": two}).point("B/N2")
    assert forward.conflicts == ()
    assert forward.unplaced == ()


def test_a_view_showing_part_of_the_grid_is_placed_by_the_labels_it_shares() -> None:
    whole = lines(GRID)
    part = lines({"B": ("y", "6000"), "C": ("y", "11000"), "N2": ("x", "5000")}, "40000", "3000")

    frame = register({"whole": whole, "part": part})

    assert frame.point("C/N1") == (Decimal(11000), Decimal(0))
    assert frame.lines["B"].views == ("part", "whole")
    assert frame.to_frame("part", Decimal(40000 + 11000), Decimal(3000)) == (Decimal(11000), Decimal(0))


def test_a_label_two_views_place_apart_is_a_conflict() -> None:
    one = lines(GRID)
    two = lines({**GRID, "B": ("y", "6500")})

    assert register({"one": one, "two": two}).conflicts == ("B",)


def test_one_label_astray_does_not_move_the_view() -> None:
    grid = {**GRID, "C": ("y", "11000")}
    one = lines(grid)
    two = lines({**grid, "B": ("y", "6400")}, "40000", "0")

    frame = register({"one": one, "two": two})

    assert frame.conflicts == ("B",)
    assert frame.point("C/N1") == (Decimal(11000), Decimal(0))


def test_a_view_sharing_no_label_in_a_direction_is_not_placed() -> None:
    one = lines(GRID)
    other = lines({"A": ("y", "0"), "M7": ("x", "100")})

    frame = register({"one": one, "other": other})

    assert frame.unplaced == ("other",)
    assert "M7" not in frame.lines


def test_confirmed_facts_with_plain_values_and_other_families_are_read_alike() -> None:
    plain = [Item("A", {"axis": "y", "offset": Decimal(0)}), Item("N1", {"axis": "x", "offset": "0"})]
    plain += [Item("B", {"axis": "y", "offset": "6000"}), Item("N2", {"axis": "x", "offset": 5000})]
    plain.append(Item("C1", {"axis": "y", "offset": "1"}, family="column"))

    frame = register({"v": plain})

    assert frame.point("B/N2") == (Decimal(6000), Decimal(5000))
    assert "C1" not in frame.lines


@pytest.mark.parametrize("ref", ["B", "B/N2/A", "A/B", "Q/N1"])
def test_a_reference_not_naming_two_crossing_lines_is_refused(ref: str) -> None:
    frame = register({"v": lines(GRID)})

    with pytest.raises((KeyError, ValueError)):
        frame.point(ref)


def test_no_grid_line_is_an_empty_frame() -> None:
    frame = register({"v": [Item("C1", {"axis": "y", "offset": "0"}, family="column")]})

    assert frame.lines == {}
