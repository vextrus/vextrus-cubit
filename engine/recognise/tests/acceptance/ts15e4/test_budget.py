"""S15-E4: the file's view budget is an argument, not a module's variable (tickets.md, S15-E4: "the
per-file budget becomes an explicit argument"; today `_held`, views.py:498, the file last read's walker).

`ViewBudget(artefact)` is one file's: `find(artefact, sheet, conventions, budget=budget)` spends it,
so the file's Sheets share its bounds as they did (views.py's docstring, "Hostile input is bounded, by
one budget for the whole file"), and nothing of the file is held once the caller lets go of it. A
call with no budget is given one of its own (17's acceptance tests call `find` so). The bounds are
the package's `MAX_*` names, as "not read in full"'s acceptance tests lower them.

    uv run pytest -m needs_toolchain engine/recognise/tests/acceptance/ts15e4
"""

import gc
import weakref
from pathlib import Path
from typing import Any

import pytest

from engine.read import read
from engine.recognise.tests.acceptance.ts15e4 import fixtures

pytestmark = pytest.mark.needs_toolchain

MODEL = "t17-S-model"
"""Two Sheets in model space, each weighing the whole model against the file's scan bound."""
LAYOUTS = "t17-S-layouts"


@pytest.fixture(scope="module")
def files(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    return fixtures.build_files(tmp_path_factory.mktemp("ts15e4-budget"), {MODEL, LAYOUTS})


def cut(found: Any) -> int:
    limits: dict[str, int] = found.limits or {}
    return limits.get("scan_budget", 0)


def read_alone(path: Path, monkeypatch: pytest.MonkeyPatch, bound: int) -> list[int]:
    """Each Sheet of the file read on a budget of its own, the scan bound at `bound`: its cut."""
    views = fixtures.views_package()
    monkeypatch.setattr(views, "MAX_SCANS", bound)
    artefact = read(path)
    found = []
    for sheet in fixtures.file_sheets(artefact):
        budget = views.ViewBudget(artefact)
        found.append(cut(views.find(artefact, sheet, fixtures.conventions(), budget=budget)))
    return found


@pytest.fixture(scope="module")
def one_sheets_bound(files: dict[str, Path]) -> int:
    """The least scan bound that reads each of the model file's Sheets, alone, uncut."""
    with pytest.MonkeyPatch.context() as monkeypatch:
        low, high = 0, fixtures.views_package().MAX_SCANS
        assert read_alone(files[MODEL], monkeypatch, high) == [0, 0]
        while low < high:
            middle = (low + high) // 2
            if any(read_alone(files[MODEL], monkeypatch, middle)):
                low = middle + 1
            else:
                high = middle
        assert low > 0
        return low


def test_one_budget_is_spent_across_the_files_sheets(
    files: dict[str, Path], one_sheets_bound: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    views = fixtures.views_package()
    monkeypatch.setattr(views, "MAX_SCANS", one_sheets_bound)
    artefact = read(files[MODEL])
    budget = views.ViewBudget(artefact)
    first, second = fixtures.file_sheets(artefact)
    assert cut(views.find(artefact, first, fixtures.conventions(), budget=budget)) == 0
    assert cut(views.find(artefact, second, fixtures.conventions(), budget=budget)) >= 1


def test_two_budgets_of_one_file_are_spent_apart(
    files: dict[str, Path], one_sheets_bound: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    views = fixtures.views_package()
    monkeypatch.setattr(views, "MAX_SCANS", one_sheets_bound)
    artefact = read(files[MODEL])
    first, second = fixtures.file_sheets(artefact)
    views.find(artefact, first, fixtures.conventions(), budget=views.ViewBudget(artefact))
    found = views.find(artefact, second, fixtures.conventions(), budget=views.ViewBudget(artefact))
    assert cut(found) == 0


def test_a_budget_of_another_file_is_refused(files: dict[str, Path]) -> None:
    views = fixtures.views_package()
    model, layouts = read(files[MODEL]), read(files[LAYOUTS])
    budget = views.ViewBudget(model)
    sheet = fixtures.file_sheets(layouts)[0]
    with pytest.raises(ValueError):  # noqa: PT011 (no authority words its message)
        views.find(layouts, sheet, fixtures.conventions(), budget=budget)


def test_nothing_of_a_file_is_held_after_its_views_are_read(files: dict[str, Path]) -> None:
    views = fixtures.views_package()
    artefact = read(files[MODEL])
    for sheet in fixtures.file_sheets(artefact):
        list(views.find(artefact, sheet, fixtures.conventions()))
    held = weakref.ref(artefact)
    del artefact
    gc.collect()
    assert held() is None, "the views package still holds the file it last read"


def test_nothing_of_a_file_is_held_once_its_budget_is_let_go(files: dict[str, Path]) -> None:
    views = fixtures.views_package()
    artefact = read(files[MODEL])
    budget = views.ViewBudget(artefact)
    for sheet in fixtures.file_sheets(artefact):
        list(views.find(artefact, sheet, fixtures.conventions(), budget=budget))
    held = weakref.ref(artefact)
    del artefact, budget
    gc.collect()
    assert held() is None, "the views package still holds the file it last read"
