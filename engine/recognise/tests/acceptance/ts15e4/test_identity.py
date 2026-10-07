"""S15-E4: the split changes no behaviour. On every synthetic file (`fixtures.py`), each Sheet's views
read through the package, with the file's one `ViewBudget` passed to every call, are what main's single
module read (`golden.json`, written on bd5378fe5 before the split): every field of every View, the
paper and the limits, per Sheet and per Discipline.

Each part's fields are their own test, so a later ticket that changes its part's behaviour on purpose
(S15-E2 paper, S15-E3 storeys, S15-E5 routing, S15-E6 titles) withdraws or amends only its own:

    uv run pytest -m needs_toolchain engine/recognise/tests/acceptance/ts15e4
"""

from collections.abc import Collection
from pathlib import Path
from typing import Any

import pytest

from engine.recognise.tests.acceptance.ts15e4 import fixtures

pytestmark = pytest.mark.needs_toolchain

PAPER = ("box",)
TITLES = ("title", "stated_scale", "not_to_scale", "subject", "layer")
STOREYS = ("storeys", "storeys_as_stated", "storeys_meaning")
ROUTING = ("steps", "part", "exclusion")
SEGMENT = ("type", "kind", "anchors")
EVERY_FIELD = {*PAPER, *TITLES, *STOREYS, *ROUTING, *SEGMENT}

type Readings = dict[str, list[dict[str, Any]]]


@pytest.fixture(scope="module")
def files(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    return fixtures.build_files(tmp_path_factory.mktemp("ts15e4-identity"))


@pytest.fixture(scope="module")
def read_now(files: dict[str, Path]) -> Readings:
    found: Readings = fixtures.read_views(files, explicit_budget=True)  # type: ignore[assignment]
    return found


def facet(readings: Readings, keys: Collection[str]) -> dict[str, list[list[dict[str, Any]]]]:
    return {
        name: [[{k: view[k] for k in keys} for view in r["views"]] for r in found]
        for name, found in readings.items()
    }


def test_the_golden_covers_every_field_of_a_view() -> None:
    views = [v for found in fixtures.golden().values() for r in found for v in r["views"]]
    assert views, "the golden holds no view"
    assert all(set(v) == EVERY_FIELD for v in views)


def test_every_file_and_sheet_is_read_as_on_main(read_now: Readings) -> None:
    golden = fixtures.golden()
    assert sorted(read_now) == sorted(golden)
    assert {n: [(r["discipline"], r["sheet"], r["number"]) for r in f] for n, f in read_now.items()} == {
        n: [(r["discipline"], r["sheet"], r["number"]) for r in f] for n, f in golden.items()
    }


def test_the_views_found_their_kinds_and_order_are_mains(read_now: Readings) -> None:
    assert facet(read_now, SEGMENT) == facet(fixtures.golden(), SEGMENT)


def test_the_limits_each_sheet_reports_are_mains(read_now: Readings) -> None:
    def limits(readings: Readings) -> dict[str, list[object]]:
        return {name: [r["limits"] for r in found] for name, found in readings.items()}

    assert limits(read_now) == limits(fixtures.golden())


def test_each_views_box_and_the_sheets_paper_are_mains(read_now: Readings) -> None:
    def papers(readings: Readings) -> dict[str, list[object]]:
        return {name: [r["paper"] for r in found] for name, found in readings.items()}

    assert papers(read_now) == papers(fixtures.golden())
    assert facet(read_now, PAPER) == facet(fixtures.golden(), PAPER)


def test_each_views_title_scale_subject_and_layer_are_mains(read_now: Readings) -> None:
    assert facet(read_now, TITLES) == facet(fixtures.golden(), TITLES)


def test_each_views_storeys_are_mains(read_now: Readings) -> None:
    assert facet(read_now, STOREYS) == facet(fixtures.golden(), STOREYS)


def test_each_views_steps_part_and_exclusion_are_mains(read_now: Readings) -> None:
    assert facet(read_now, ROUTING) == facet(fixtures.golden(), ROUTING)
