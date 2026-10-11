"""A range's symbolic `top` resolved to a Drawing Set's highest numbered floor (S21-C4; 13's
`storeys.to_top` and `storeys.highest_floor`). The keys are given as 13's reader and
`views.storeys._keys` order them: a range's `top` (its `runs_to`) last, a listed `top` first (its
rank sorts it before every concrete key). Every list is invented."""

import pytest

from engine.recognise import storeys, views
from engine.recognise.storeys import MAX_FLOOR


def floors(first: int, last: int) -> tuple[str, ...]:
    return tuple(f"floor_{n}" for n in range(first, last + 1))


@pytest.mark.parametrize(
    ("keys", "resolved"),
    [
        (("floor_2", "roof", "top"), (*floors(2, 6), "roof")),
        (("floor_1", "top"), floors(1, 6)),
        (("ground", "roof", "top"), ("ground", *floors(1, 6), "roof")),
        (("mezzanine", "top"), ("mezzanine", *floors(1, 6))),
        (("floor_6", "stair_room_roof", "top"), ("floor_6", "stair_room_roof")),
        (("basement_1", "ground", "roof", "top"), ("basement_1", "ground", *floors(1, 6), "roof")),
        (("basement_1", "top"), ("basement_1", "ground", *floors(1, 6))),
        (("plinth", "top"), ("plinth", "ground", *floors(1, 6))),
    ],
)
def test_a_range_runs_to_the_sets_highest_floor(
    keys: tuple[str, ...], resolved: tuple[str, ...]
) -> None:
    assert storeys.to_top(keys, 6) == resolved


@pytest.mark.parametrize(
    "keys",
    [
        ("top",),  # the top floor alone: no start to run from
        ("top", "ground"),  # listed, not a range: the topmost floor only
        ("top", "floor_1"),
        ("typical", "top"),  # no concrete start
        ("roof", "top"),  # nothing below the roofs to start from
        floors(2, 6),  # no top
        (),
    ],
)
def test_a_top_not_ending_a_range_is_never_touched(keys: tuple[str, ...]) -> None:
    assert storeys.to_top(keys, 6) == keys


def test_no_numbered_floor_leaves_top() -> None:
    assert storeys.to_top(("ground", "roof", "top"), None) == ("ground", "roof", "top")


def test_a_highest_floor_below_the_start_leaves_top() -> None:
    assert storeys.to_top(("floor_8", "roof", "top"), 6) == ("floor_8", "roof", "top")


def test_a_highest_floor_at_the_start_drops_top() -> None:
    assert storeys.to_top(("floor_6", "roof", "top"), 6) == ("floor_6", "roof")


def test_a_range_starts_above_the_highest_floor_its_keys_hold() -> None:
    assert storeys.to_top(("floor_2", "floor_4", "top"), 6) == ("floor_2", *floors(4, 6))


def test_the_highest_floor_is_every_lists_highest_numbered_floor() -> None:
    lists = [("ground", "roof", "top"), ("floor_3",), floors(2, 9), ("not_stated",), ()]
    assert storeys.highest_floor(lists) == 9


@pytest.mark.parametrize(
    "lists",
    [[], [()], [("ground", "roof", "top", "typical", "basement_2", "not_stated")]],
)
def test_no_numbered_floor_is_no_highest(lists: list[tuple[str, ...]]) -> None:
    assert storeys.highest_floor(lists) is None


@pytest.mark.parametrize(
    "key",
    [
        "floor_0",
        "floor_01",
        f"floor_{MAX_FLOOR + 1}",
        "floor_" + "9" * 40,
        "floor_x",
        "Floor_3",
        "floor_3 ",
    ],
)
def test_a_key_not_a_numbered_floor_within_bounds_is_not_counted(key: str) -> None:
    assert storeys.highest_floor([(key,)]) is None


def test_the_reader_puts_a_ranges_top_last_and_a_listed_top_first() -> None:
    """The order `to_top` relies on, read from invented titles."""
    assert views.titled_storeys("17TH TO TOP FLOOR") == ("floor_17", "top")
    assert views.titled_storeys("17TH & TOP FLOOR") == ("top", "floor_17")
