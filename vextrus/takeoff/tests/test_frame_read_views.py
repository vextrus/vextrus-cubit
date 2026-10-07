"""Which views a family reads (frame_read._read_by): found by the session-16 showing, where every family
read all 262 confirmed views of a real set (sections, schedules, details) and asked one Question per view."""

from types import SimpleNamespace

from vextrus.takeoff.services import frame_read


def _view(kind: str, *steps: str) -> SimpleNamespace:
    return SimpleNamespace(view=SimpleNamespace(kind=kind, steps=steps))


def test_a_family_reads_only_the_plan_views_of_its_own_step() -> None:
    plan, schedule, other = _view("plan", "columns"), _view("schedule", "columns"), _view("plan", "beams")

    assert frame_read._read_by("columns", [plan, schedule, other]) == [plan]


def test_the_grid_reads_the_plans_of_the_steps_that_need_it() -> None:
    columns, section, piles = _view("plan", "columns"), _view("section", "columns"), _view("plan", "foundations")

    assert frame_read._read_by("grid", [columns, section, piles]) == [columns]
