"""S17-F2: "the governor's pytest cost scales with the worker count (~3 GB at 8)"
(`docs/handoff/session-17-prompt.md`, F2). The measured costs: "One pytest run: ... the full serial
suite | 3.3" GB (`docs/specs/factory.md` 2.3) and, at `-n 8`, "about 3 GB more memory"
(`docs/specs/factory.md`, xdist row; `.claude/rules/backend.md`; `verify-ci-speed.md` §2 item 2).

Seam: `scripts.factory.governor.unit_cost_gb(unit, agents, *, workers=N)`, the cost the memory floor
subtracts (GiB). It is called through a loosely typed name so the file type-checks before `workers`
exists.
"""

from collections.abc import Callable

import pytest

from scripts.factory import governor

SERIAL_GB = 3.3


def cost(unit: str, workers: int) -> float:
    priced: Callable[..., float] = governor.unit_cost_gb
    return priced(unit, None, workers=workers)


@pytest.mark.parametrize("workers", [0, 1])
def test_a_serial_pytest_costs_the_measured_three_point_three_gb(workers: int) -> None:
    assert cost("pytest", workers) == pytest.approx(SERIAL_GB)


def test_the_pytest_cost_grows_with_the_worker_count() -> None:
    costs = [cost("pytest", workers) for workers in range(1, 17)]
    assert costs == sorted(costs), f"never cheaper with more workers: {costs}"
    assert cost("pytest", 6) > cost("pytest", 1), costs


def test_eight_workers_cost_about_three_gb_more_than_a_serial_run() -> None:
    extra = cost("pytest", 8) - cost("pytest", 1)
    assert 2.5 <= extra <= 3.5, f"about 3 GB more at -n 8, got {extra:.2f}"


@pytest.mark.parametrize(
    ("unit", "gb"), [("web-tests", 9.5), ("walk", 5.6), ("rd-run", 3.0), ("local-agent", 0.9)]
)
def test_the_worker_count_changes_no_other_units_cost(unit: str, gb: float) -> None:
    assert cost(unit, 8) == pytest.approx(gb)
