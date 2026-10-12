"""Reading one view's grid from what it draws (read.py), on drawn things made in code: no DWG."""

import math
import re

import numpy as np

from engine.families.grid_line.drawn import Circle, Drawn, Label
from engine.families.grid_line.read import read_grid

R = 450.0


def drawn(
    lines: list[tuple[float, float, float, float]], bubbles: list[tuple[str, float, float]]
) -> Drawn:
    segments = np.array(lines, dtype=np.float64).reshape(-1, 4)
    entities: list[tuple[str, tuple[str, ...], str]] = [
        (f"{i + 1:X}", (), "L") for i in range(len(lines))
    ]
    circles = [Circle(x, y, R, "B", f"C{i:X}", (), ()) for i, (_, x, y) in enumerate(bubbles)]
    labels = [Label(text, x, y, 400.0, f"7{i:X}", ()) for i, (text, x, y) in enumerate(bubbles)]
    return Drawn(segments, np.arange(len(lines), dtype=np.int64), entities, circles, labels)


def square_grid(turn: float = 0.0) -> Drawn:
    cos, sin = math.cos(turn), math.sin(turn)

    def at(x: float, y: float) -> tuple[float, float]:
        return (x * cos - y * sin, x * sin + y * cos)

    lines, bubbles = [], []
    for label, x in (("A", 0.0), ("B", 6000.0), ("C", 11000.0)):
        lines.append((*at(x, 0.0), *at(x, 12000.0)))
        bubbles.append((label, *at(x, -R)))
    for label, y in (("1", 0.0), ("2", 5000.0)):
        lines.append((*at(0.0, y), *at(14000.0, y)))
        bubbles.append((label, *at(-R, y)))
    return drawn(lines, bubbles)


def offsets(grid: Drawn) -> dict[str, tuple[str, float]]:
    return {line.mark: (line.axis, line.offset) for line in read_grid(grid).lines}


def test_each_bubble_heads_its_line_with_its_direction_and_offset() -> None:
    found = offsets(square_grid())

    assert found == {"A": ("y", 0.0), "B": ("y", 6000.0), "C": ("y", 11000.0),
                     "1": ("x", 0.0), "2": ("x", 5000.0)}  # fmt: skip


def test_a_turned_grid_keeps_its_spacing() -> None:
    found = offsets(square_grid(math.radians(30)))

    assert math.isclose(found["B"][1] - found["A"][1], 6000.0, abs_tol=1e-3)
    assert math.isclose(found["2"][1] - found["1"][1], 5000.0, abs_tol=1e-3)
    assert {found[m][0] for m in "ABC"} != {found[m][0] for m in "12"}


def test_a_line_drawn_in_pieces_is_one_line_from_end_to_end() -> None:
    pieces = [(0.0, 0.0, 0.0, 3000.0), (0.0, 3600.0, 0.0, 7000.0), (0.0, 7500.0, 0.0, 12000.0)]
    grid = read_grid(drawn(pieces, [("A", 0.0, -R)]))

    [line] = grid.lines
    assert math.isclose(line.length, 12000.0)


def test_a_circled_text_with_no_line_or_of_a_column_mark_is_no_grid_line() -> None:
    grid = drawn([(0.0, 0.0, 0.0, 12000.0)], [("C1", 0.0, -R), ("5", 50000.0, 50000.0)])

    assert read_grid(grid).lines == ()


def test_a_bubble_beside_a_line_rather_than_at_its_end_heads_nothing() -> None:
    assert read_grid(drawn([(0.0, 0.0, 0.0, 12000.0)], [("A", 0.0, 6000.0)])).lines == ()


def test_bubbles_at_both_ends_are_one_line() -> None:
    grid = read_grid(drawn([(0.0, 0.0, 0.0, 12000.0)], [("A", 0.0, -R), ("A", 0.0, 12000.0 + R)]))

    assert [line.mark for line in grid.lines] == ["A"]
    assert grid.twice == ()


def test_one_label_on_two_lines_is_found_twice() -> None:
    lines = [(0.0, 0.0, 0.0, 12000.0), (9000.0, 0.0, 9000.0, 12000.0)]
    grid = read_grid(drawn(lines, [("A", 0.0, -R), ("A", 9000.0, -R)]))

    assert grid.twice == ("A",)
    assert len(grid.lines) == 1


def test_a_profile_s_label_patterns_replace_the_default_shape() -> None:
    grid = drawn([(0.0, 0.0, 0.0, 12000.0)], [("G-1", 0.0, -R)])

    assert read_grid(grid).lines == ()
    assert [line.mark for line in read_grid(grid, (re.compile(r"G-\d+"),)).lines] == ["G-1"]


def test_a_line_drawn_as_two_facing_tails_runs_between_its_bubbles() -> None:
    tails = [(0.0, 0.0, 0.0, 1800.0), (0.0, 10200.0, 0.0, 12000.0)]
    grid = read_grid(drawn(tails, [("A", 0.0, -R), ("A", 0.0, 12000.0 + R)]))

    [line] = grid.lines
    assert (line.mark, line.axis, line.offset) == ("A", "y", 0.0)
    assert math.isclose(line.length, 12000.0 + 2 * R)


def test_a_lone_bubble_with_a_tail_or_tails_not_facing_is_no_grid_line() -> None:
    lone = drawn([(0.0, 0.0, 0.0, 1800.0)], [("A", 0.0, -R)])
    apart = drawn(
        [(0.0, 0.0, 0.0, 1800.0), (5000.0, 0.0, 5000.0, 1800.0)],
        [("A", 0.0, -R), ("A", 5000.0, -R)],
    )

    assert read_grid(lone).lines == ()
    assert read_grid(apart).lines == ()
