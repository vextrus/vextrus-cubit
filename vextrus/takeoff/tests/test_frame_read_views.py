"""Which views a family reads (frame_read._read_by): found by the session-16 showing, where every
family read all 262 confirmed views of a real set (sections, schedules, details) and asked one
Question per view."""

from types import SimpleNamespace

from vextrus.takeoff.services import frame_read


def _view(kind: str, *steps: str) -> SimpleNamespace:
    return SimpleNamespace(view=SimpleNamespace(kind=kind, steps=steps))


def test_a_family_reads_only_the_plan_views_of_its_own_step() -> None:
    plan, schedule = _view("plan", "columns"), _view("schedule", "columns")
    other = _view("plan", "beams")

    assert frame_read._read_by("columns", [plan, schedule, other]) == [plan]


def test_the_grid_reads_the_plans_of_the_steps_that_need_it() -> None:
    columns, section = _view("plan", "columns"), _view("section", "columns")
    piles = _view("plan", "foundations")

    assert frame_read._read_by("grid", [columns, section, piles]) == [columns]


def test_storeys_are_ordered_low_to_high_by_their_canonical_rank() -> None:
    names = ["roof", "floor_10", "ground", "top", "floor_2", "basement_1", "foundation"]

    ordered = sorted(names, key=lambda n: (frame_read._storey_rank(n), n))

    assert ordered == ["foundation", "basement_1", "ground", "floor_2", "floor_10", "top", "roof"]


def test_a_later_family_is_given_the_earlier_ones_candidates_as_facts() -> None:
    from decimal import Decimal

    from engine.families import types

    line = SimpleNamespace(
        candidate_key="v1:grid:B",
        mark="B",
        storey="",
        values={"axis": SimpleNamespace(value="y"), "offset": SimpleNamespace(value=6000.5)},
    )

    facts = frame_read._with_best(types, types.ConfirmedFacts(), "grid_line", [line]).facts

    assert [(f.family, f.mark) for f in facts] == [("grid_line", "B")]
    assert facts[0].values == {"axis": "y", "offset": Decimal("6000.5")}
