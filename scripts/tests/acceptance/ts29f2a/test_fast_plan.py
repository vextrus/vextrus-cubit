"""Ticket S29-F2a (docs/plans/factory-s29.md item 2, F2; the owner's Q3: "Speed up CI first, then a
fast verify before READY; CI is the full gate"): "`verify --fast` runs the changed modules and their
importers, changed web files, a narrowed crosspr, web timeouts scaled by the machine".

The selection is pinned by its plan, never by running suites. Seams named by this ticket:

- `scripts.verify.plan(paths, *, root, fast=True, scale=<factor>) -> list[Check]`: the fast plan for
  the checkout at `root` (its Python files are read there to find importers). `fast=False` (the
  default) is today's full plan, unchanged.
- `scripts.verify.time_scale() -> float`: the machine's factor (1.0 or more) the fast plan uses when no
  `scale` is given.
- `VEXTRUS_TIME_SCALE`: the factor, in the environment of the test checks the fast plan runs (the web
  tests' timeouts, and pytest's scaled bounds, read it).

    uv run pytest -rf scripts/tests/acceptance/ts29f2a
"""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

import pytest

SCALE = "VEXTRUS_TIME_SCALE"

PYTHON_TREE = {
    "vextrus/__init__.py": "",
    "vextrus/alpha/__init__.py": "",
    "vextrus/alpha/rules.py": "LIMIT = 3\n",
    "vextrus/alpha/tests/__init__.py": "",
    "vextrus/alpha/tests/test_rules.py": (
        "from vextrus.alpha.rules import LIMIT\n\n\ndef test_limit() -> None:\n    assert LIMIT == 3\n"
    ),
    "vextrus/beta/__init__.py": "",
    "vextrus/beta/use.py": (
        "from vextrus.alpha import rules\n\n\ndef limit() -> int:\n    return rules.LIMIT\n"
    ),
    "vextrus/beta/tests/__init__.py": "",
    "vextrus/beta/tests/test_use.py": (
        "from vextrus.beta.use import limit\n\n\ndef test_use() -> None:\n    assert limit() == 3\n"
    ),
    "vextrus/gamma/__init__.py": "",
    "vextrus/gamma/other.py": "WORD = 'other'\n",
    "vextrus/gamma/tests/__init__.py": "",
    "vextrus/gamma/tests/test_other.py": (
        "from vextrus.gamma.other import WORD\n\n\ndef test_word() -> None:\n    assert WORD\n"
    ),
}
"""An invented checkout: `alpha.rules` changes; `beta.use` imports it (and `beta`'s test imports
`beta.use`); `gamma` imports neither."""

WEB_TREE = {
    "web/src/takeoff/Panel.tsx": "export const Panel = () => null;\n",
    "web/src/takeoff/Panel.test.tsx": "import { Panel } from './Panel';\nPanel;\n",
    "web/src/other/Other.tsx": "export const Other = () => null;\n",
    "web/src/other/Other.test.tsx": "import { Other } from './Other';\nOther;\n",
}


@pytest.fixture
def checkout(tmp_path: Path) -> Path:
    root = tmp_path / "checkout"
    for name, text in {**PYTHON_TREE, **WEB_TREE}.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return root


def verify() -> Any:
    """`scripts.verify`, typed loosely: the seams this ticket names are not built on main."""
    return importlib.import_module("scripts.verify")


def fast_plan(paths: list[str], root: Path, **options: Any) -> list[Any]:
    found: list[Any] = verify().plan(paths, root=root, fast=True, **{"scale": 1.0, **options})
    return found


def _relative(part: str, root: Path) -> str:
    return part.removeprefix(f"{root.resolve()}/").removeprefix(f"{root}/")


def pytest_parts(checks: list[Any], root: Path) -> list[str]:
    """Every argument of the plan's pytest checks, relative to the checkout."""
    runs = [check for check in checks if check.name.startswith("pytest")]
    assert runs, f"the fast plan runs no pytest: {[check.name for check in checks]}"
    return [_relative(part, root) for check in runs for part in check.argv]


def covers(parts: list[str], folder: str) -> bool:
    return any(part == folder or part.startswith(f"{folder}/") for part in parts)


def web_tests(checks: list[Any]) -> list[Any]:
    found = [check for check in checks if check.name.startswith("web-test")]
    assert found, f"the fast plan runs no web-test: {[check.name for check in checks]}"
    return found


# Python: the changed modules and their importers ---------------------------------------------------


def test_a_fast_plan_runs_the_changed_modules_tests(checkout: Path) -> None:
    parts = pytest_parts(fast_plan(["vextrus/alpha/rules.py"], checkout), checkout)
    assert covers(parts, "vextrus/alpha"), parts


def test_a_fast_plan_runs_the_tests_of_the_modules_importing_the_change(checkout: Path) -> None:
    """`vextrus/beta/use.py` imports `vextrus.alpha.rules`: beta's tests exercise the change."""
    parts = pytest_parts(fast_plan(["vextrus/alpha/rules.py"], checkout), checkout)
    assert covers(parts, "vextrus/beta"), parts


def test_a_fast_plan_leaves_out_a_module_that_imports_nothing_changed(checkout: Path) -> None:
    parts = pytest_parts(fast_plan(["vextrus/alpha/rules.py"], checkout), checkout)
    assert not covers(parts, "vextrus/gamma"), parts
    assert "." not in parts, f"the whole suite runs for one module's change: {parts}"


# Web: the changed files' tests, timeouts scaled by the machine -------------------------------------


def test_a_fast_plan_tests_the_changed_web_file_and_no_other(checkout: Path) -> None:
    for check in web_tests(fast_plan(["web/src/takeoff/Panel.tsx"], checkout)):
        named = [_relative(part, checkout) for part in check.argv]
        assert any("takeoff/Panel" in part for part in named), (check.name, named)
        assert not any("other/Other" in part for part in named), (check.name, named)


def test_a_fast_plans_web_tests_carry_the_machines_time_scale(checkout: Path) -> None:
    for check in web_tests(fast_plan(["web/src/takeoff/Panel.tsx"], checkout, scale=2.5)):
        assert SCALE in check.env, (check.name, check.env)
        assert float(check.env[SCALE]) == 2.5, (check.name, check.env)


def test_a_fast_plans_pytest_carries_the_machines_time_scale(checkout: Path) -> None:
    checks = fast_plan(["vextrus/alpha/rules.py"], checkout, scale=2.5)
    runs = [check for check in checks if check.name.startswith("pytest")]
    assert runs
    for check in runs:
        assert float(check.env.get(SCALE, "nan")) == 2.5, (check.name, check.env)


def test_the_machines_time_scale_is_a_factor_of_at_least_one() -> None:
    factor = verify().time_scale()
    assert isinstance(factor, float)
    assert factor >= 1.0


def test_a_fast_plan_given_no_scale_uses_the_machines(checkout: Path) -> None:
    """The factor verify computes for this machine: 1.0 or more, never left out."""
    checks = verify().plan(["web/src/takeoff/Panel.tsx"], root=checkout, fast=True)
    for check in web_tests(checks):
        assert float(check.env[SCALE]) >= 1.0, (check.name, check.env)


# The full verify stays as it is ----------------------------------------------------------------------


def test_the_full_plan_is_the_plan_without_fast(checkout: Path) -> None:
    plan = verify().plan
    for paths in (["vextrus/alpha/rules.py"], ["web/src/takeoff/Panel.tsx"]):
        full = plan(paths, root=checkout, fast=False)
        today = plan(paths, root=checkout)
        assert [(c.name, c.argv) for c in full] == [(c.name, c.argv) for c in today], paths
    web = {c.name: c.argv for c in plan(["web/src/takeoff/Panel.tsx"], root=checkout, fast=False)}
    assert web["web-test"] == ("npm", "--prefix", "web", "test")
    assert "web-test-slowed" in web
