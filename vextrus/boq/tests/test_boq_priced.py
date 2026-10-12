"""The Priced BOQ's rules beyond the acceptance tests (S16-B; M1.md C13): each Element once, an open
step priced by its allowance, a rate per another unit unpriced, and boq's seam on takeoff.

The seams are stood in here without `rates.services.RateNotEntered`: anything without an `amount` is
not a rate.
"""

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import pytest

from vextrus.boq.services import allowances, priced, steps
from vextrus.projects import services as projects
from vextrus.testing.drawings import QsProject

pytestmark = pytest.mark.django_db


@dataclass(frozen=True)
class Line:
    element_id: uuid.UUID
    item_code: str
    step: str
    family: str
    storey: str
    billing_unit: str
    quantity: Decimal
    state: str
    rebar_basis: str | None
    trace: tuple[dict[str, str], ...]


@dataclass(frozen=True)
class Rate:
    amount: Decimal
    per_unit: str


class NoRate:
    pass


def column(n: int, code: str, unit: str, qty: str, state: str = "measured") -> Line:
    trace = ({"sheet_id": str(uuid.UUID(int=9)), "view_id": str(uuid.UUID(int=8)), "anchor": "a"},)
    return Line(
        uuid.UUID(int=n), code, "columns", "column", "floor_1", unit, Decimal(qty), state, None, trace
    )


@dataclass
class Seams:
    lines: tuple[Line, ...] = ()
    confirmed: frozenset[str] = frozenset()
    rates: dict[str, Rate] | None = None


@pytest.fixture
def seams(monkeypatch: pytest.MonkeyPatch) -> Seams:
    from vextrus.measurement import services as measurement
    from vextrus.rates import services as rates

    state = Seams(
        rates={
            "RCC-COL-1:1.5:3": Rate(Decimal("500.00"), "cft"),
            "REBAR-500W": Rate(Decimal("100.00"), "kg"),
        }
    )

    @dataclass(frozen=True)
    class Measured:
        lines: tuple[Line, ...]

    def measure(building_id: uuid.UUID, seq: Any = None, version: Any = None) -> Measured:
        return Measured(state.lines)

    def working_rate(item_code: str, project_id: uuid.UUID) -> Any:
        assert state.rates is not None
        return state.rates.get(item_code, NoRate())

    monkeypatch.setattr(measurement, "measure", measure, raising=False)
    monkeypatch.setattr(rates, "working_rate", working_rate, raising=False)
    monkeypatch.setattr(steps, "confirmed", lambda building_id: state.confirmed)
    return state


def read(qs_project: QsProject) -> priced.PricedBoq:
    with qs_project.member.acting():
        return priced.read(qs_project.project_id)


def enter_gfa(qs_project: QsProject, sft: str) -> None:
    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
        projects.gfa.set_gross_floor_area(building.id, sft, "sft")


def test_the_columns_allowance_is_the_area_times_each_consumption_priced(
    qs_project: QsProject, seams: Seams
) -> None:
    enter_gfa(qs_project, "10000")
    [line] = [a for a in read(qs_project).allowances if a.step == "columns"]
    by_code = {c.item_code: c for c in line.consumptions}
    assert by_code["RCC-COL-1:1.5:3"].quantity == Decimal("1700.00")  # 10000 x 0.17
    assert by_code["REBAR-500W"].quantity == Decimal("14000.00")  # 10000 x 1.40
    assert by_code["FW-COL"].amount is None
    # 1700 x 500 + 14000 x 100; the formwork and the core's concrete have no rate
    assert line.amount.amount == Decimal("2250000.00")
    assert line.unpriced == 2
    assert (line.source, line.confidence, line.part) == ("vextrus_default", "low", "whole")


def test_an_open_step_s_lines_are_not_billed_but_shown_as_measured_so_far(
    qs_project: QsProject, seams: Seams
) -> None:
    enter_gfa(qs_project, "10000")
    seams.lines = (column(1, "RCC-COL-1:1.5:3", "cft", "10.00"),)
    boq = read(qs_project)
    [line] = [a for a in boq.allowances if a.step == "columns"]
    assert line.measured_so_far.amount == Decimal("5000.00")
    assert boq.sections == ()
    assert boq.strip.measured.amount == 0
    assert boq.strip.total == boq.strip.allowance


def test_with_no_gfa_every_step_bills_its_lines(qs_project: QsProject, seams: Seams) -> None:
    seams.lines = (
        column(1, "RCC-COL-1:1.5:3", "cft", "10.00"),
        column(2, "RCC-COL-1:1.5:3", "cft", "2.00", "awaiting_answer"),
    )
    boq = read(qs_project)
    [section] = boq.sections
    [group] = section.groups
    [item] = group.items
    assert (item.number, item.quantity) == ("1.1.1", Decimal("10.00"))
    assert item.awaiting_answer is not None
    assert item.awaiting_answer.quantity == Decimal("2.00")
    assert boq.strip.total.amount == Decimal("6000.00")
    assert boq.measured_share == Decimal("0.8333")
    assert boq.allowances == ()


def test_a_rate_per_another_unit_is_no_rate_for_the_item(qs_project: QsProject, seams: Seams) -> None:
    assert seams.rates is not None
    seams.rates["RCC-COL-1:1.5:3"] = Rate(Decimal("17000.00"), "m3")
    seams.lines = (column(1, "RCC-COL-1:1.5:3", "cft", "10.00"),)
    boq = read(qs_project)
    [item] = boq.sections[0].groups[0].items
    assert item.rate is None
    assert item.amount is None
    assert boq.strip.unpriced_lines == 1


def test_every_allowance_step_is_a_takeoff_step_after_the_grid() -> None:
    keys = [d.step for d in allowances.DEFAULTS]
    assert set(keys) <= set(steps.STEPS)
    assert keys == sorted(keys, key=steps.STEPS.index)
    assert {"storeys", "grid"}.isdisjoint(keys)
    for default in allowances.DEFAULTS:
        steps.section_of(default.step)


def test_confirmed_reads_takeoff_s_step_rows_and_keeps_only_confirmed_step_keys(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    from vextrus.takeoff import services as takeoff

    @dataclass(frozen=True)
    class Row:
        step: str
        status: str

    asked: list[uuid.UUID] = []

    class FrameSteps:
        @staticmethod
        def steps(project_id: uuid.UUID) -> list[Row]:
            asked.append(project_id)
            return [Row("columns", "confirmed"), Row("grid", "in_review"), Row("sheets", "confirmed")]

    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
        monkeypatch.delattr(takeoff, "frame_steps", raising=False)
        if "frame_steps" not in takeoff.__all__:
            assert steps.confirmed(building.id) == frozenset()
        monkeypatch.setattr(takeoff, "frame_steps", FrameSteps, raising=False)
        assert steps.confirmed(building.id) == frozenset({"columns"})
    assert asked == [qs_project.project_id]


def test_one_item_code_in_two_steps_bills_in_each_step_s_group(
    qs_project: QsProject, seams: Seams
) -> None:
    beam = Line(
        uuid.UUID(int=7),
        "REBAR-500W",
        "beams",
        "beam",
        "floor_1",
        "kg",
        Decimal("5.00"),
        "measured",
        "by_ratio",
        (),
    )
    seams.lines = (column(1, "REBAR-500W", "kg", "3.00"), beam)
    [section] = read(qs_project).sections
    billed = {(g.group, i.item_code): i.quantity for g in section.groups for i in g.items}
    assert billed == {
        ("columns", "REBAR-500W"): Decimal("3.00"),
        ("beams", "REBAR-500W"): Decimal("5.00"),
    }


def test_each_item_and_allowance_carries_its_description_and_the_boq_its_building(
    qs_project: QsProject, seams: Seams
) -> None:
    seams.lines = (
        column(1, "RCC-COL-1:1.5:3", "cft", "1.00"),
        column(1, "FW-COL", "sft", "1.00"),
        column(1, "REBAR-500W", "kg", "1.00"),
    )
    seams.confirmed = frozenset({"columns"})
    enter_gfa(qs_project, "1000")
    boq = read(qs_project)
    said = {i.item_code: i.description for s in boq.sections for g in s.groups for i in g.items}
    assert said == {
        "RCC-COL-1:1.5:3": {
            "code": "boq.item.rcc",
            "params": {"strength_mpa": "", "mix": "1:1.5:3", "class": "columns"},
        },
        "FW-COL": {"code": "boq.item.formwork", "params": {"class": "columns"}},
        "REBAR-500W": {"code": "boq.item.rebar", "params": {"grade": "500W", "class": "columns"}},
    }
    beams = next(a for a in boq.allowances if a.step == "beams")
    assert beams.description == {"code": "boq.item.allowance", "params": {"step": "beams"}}
    parts = {(a.step, a.part) for a in boq.allowances if a.step == "foundations"}
    assert parts == {("foundations", "piles_caps"), ("foundations", "rest")}
    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
    assert boq.building_id == building.id


def test_the_api_carries_the_building_and_the_descriptions(qs_project: QsProject, seams: Seams) -> None:
    seams.lines = (column(1, "RCC-COL-1:1.5:3", "cft", "1.00"),)
    body = qs_project.member.client.get(f"/api/projects/{qs_project.project_id}/boq").json()
    with qs_project.member.acting():
        [building] = projects.buildings(qs_project.project_id)
    assert body["building_id"] == str(building.id)
    [item] = body["sections"][0]["groups"][0]["items"]
    assert item["description"]["code"] == "boq.item.rcc"
