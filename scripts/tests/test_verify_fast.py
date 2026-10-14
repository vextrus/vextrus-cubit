"""`verify --fast`'s seams (S29-F2a): the import reading, the fast units, the narrowed lints, the
time scale, the web selection, and the timed-out re-run of a fast web-test."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts import verify
from scripts.tests.acceptance.tf4.test_verify import Runner, clone, record_of, stage

__all__ = ["clone"]  # the fixture, re-exported for pytest


def write(root: Path, files: dict[str, str]) -> Path:
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return root


def test_imports_are_read_absolute_relative_and_by_import_module() -> None:
    text = (
        "import a.b\n"
        "from . import sibling\n"
        "from ..up import thing\n"
        "import importlib\n"
        "x = importlib.import_module('vextrus.testing.timing')\n"
    )
    found = verify.imported_by("vextrus/m/sub/file.py", text)
    assert {"a.b", "vextrus.m.sub", "vextrus.m.sub.sibling", "vextrus.m.up.thing"} <= found
    assert "vextrus.testing.timing" in found


def test_a_relative_import_in_a_package_init_resolves_from_the_package() -> None:
    assert "vextrus.m.rules" in verify.imported_by("vextrus/m/__init__.py", "from .rules import X\n")


def test_an_unparsable_file_imports_nothing() -> None:
    assert verify.imported_by("vextrus/m/bad.py", "def (:\n") == set()


@pytest.mark.parametrize(
    ("path", "unit"),
    [
        ("vextrus/m/tests/test_a.py", "vextrus/m/tests/test_a.py"),
        ("vextrus/m/tests/conftest.py", "vextrus/m/tests"),
        ("scripts/tests/acceptance/tf4/_schema.py", "scripts/tests/acceptance/tf4"),
        ("scripts/factory/crosspr.py", "scripts/factory"),
        ("vextrus/takeoff/api.py", "vextrus/takeoff"),
        ("scripts/verify.py", None),
        ("conftest.py", None),
        ("vextrus/conftest.py", None),
        ("vextrus/api.py", None),
    ],
)
def test_each_changed_file_has_its_fast_unit(path: str, unit: str | None) -> None:
    assert verify.fast_unit(path) == unit


def test_a_test_file_importing_a_selected_test_file_is_selected(tmp_path: Path) -> None:
    root = write(
        tmp_path,
        {
            "vextrus/a/__init__.py": "",
            "vextrus/a/clock.py": "X = 1\n",
            "vextrus/b/tests/test_one.py": "from vextrus.a.clock import X\n",
            "vextrus/c/tests/test_two.py": "from vextrus.b.tests.test_one import X\n",
            "vextrus/d/tests/test_three.py": "Y = 2\n",
        },
    )
    targets, _ = verify.fast_targets(["vextrus/a/clock.py"], root)
    assert targets == ["vextrus/a", "vextrus/b/tests/test_one.py", "vextrus/c/tests/test_two.py"]


def test_shared_configuration_is_left_to_ci_with_a_note(tmp_path: Path) -> None:
    root = write(tmp_path, {"conftest.py": "", "vextrus/__init__.py": ""})
    targets, notes = verify.fast_targets(["conftest.py"], root)
    assert targets == []
    assert notes == ["not run in fast: the whole suite for conftest.py (CI runs it)"]
    checks = verify.plan(["conftest.py"], root=root, fast=True, scale=1.0)
    assert not [c for c in checks if c.name.startswith("pytest")]


def test_a_file_under_the_lint_tests_runs_in_the_serial_lint_run() -> None:
    checks = verify.pytest_checks(["tools/lint/tests/acceptance/x/test_a.py", "vextrus/m"], 4)
    by_name = {c.name: c.argv for c in checks}
    assert by_name["pytest-lint"][-1] == "tools/lint/tests/acceptance/x/test_a.py"
    assert "tools/lint/tests/acceptance/x/test_a.py" not in by_name["pytest"]


def test_fast_ruff_and_mypy_name_the_changed_files_that_exist(tmp_path: Path) -> None:
    root = write(tmp_path, {"vextrus/m/__init__.py": "", "vextrus/m/a.py": "X = 1\n"})
    checks = verify.plan(["vextrus/m/a.py", "vextrus/m/gone.py"], root=root, fast=True, scale=1.0)
    argv = {c.name: c.argv for c in checks}
    assert argv["ruff"] == ("uv", "run", "ruff", "check", "vextrus/m/a.py")
    assert argv["ruff-format"] == ("uv", "run", "ruff", "format", "--check", "vextrus/m/a.py")
    assert argv["mypy"] == ("uv", "run", "mypy", "vextrus/m/a.py")
    assert argv["lint-imports"] == ("uv", "run", "lint-imports")


def test_fast_ruff_and_mypy_run_whole_when_the_configuration_changed(tmp_path: Path) -> None:
    root = write(tmp_path, {"vextrus/m/a.py": "X = 1\n", "pyproject.toml": ""})
    argv = {
        c.name: c.argv
        for c in verify.plan(["vextrus/m/a.py", "pyproject.toml"], root=root, fast=True, scale=1.0)
    }
    assert argv["ruff"] == ("uv", "run", "ruff", "check", ".")
    assert argv["mypy"] == ("uv", "run", "mypy")


def test_a_fast_web_change_with_no_test_plans_no_web_test(tmp_path: Path) -> None:
    root = write(tmp_path, {"web/vite.config.ts": ""})
    checks, notes = verify.plan_with_notes(["web/vite.config.ts"], root=root, fast=True, scale=1.0)
    names = [c.name for c in checks]
    assert "web-test" not in names
    assert "web-test-slowed" not in names
    assert "typecheck" in names
    assert any("web-test" in note for note in notes)


def test_a_changed_web_test_names_itself(tmp_path: Path) -> None:
    root = write(tmp_path, {"web/src/a/A.test.tsx": "", "web/src/a/B.test.tsx": ""})
    assert verify.fast_web_tests(["web/src/a/A.test.tsx"], root) == ["src/a/A.test.tsx"]


@pytest.mark.parametrize(
    ("given", "factor"),
    [("2.5", 2.5), ("0.2", 1.0), ("100", verify.TIME_SCALE_CAP), ("nan", 1.0), ("x", 1.0)],
)
def test_the_time_scale_is_kept_between_one_and_its_cap(
    given: str, factor: float, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(verify.TIME_SCALE, given)
    assert verify.time_scale() == factor


def test_the_cap_keeps_the_scaled_act_bound_under_the_lock_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from vextrus.testing.timing import scaled

    monkeypatch.setenv(verify.TIME_SCALE, str(verify.TIME_SCALE_CAP))
    assert scaled(0.5) < 3.0


def test_a_timed_out_fast_web_test_reruns_each_file_alone(
    clone: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    write(clone, {"web/src/a/A.test.tsx": "x\n"})
    tree = stage(clone, "web/src/a/A.tsx", "export {}\n")
    timed_out = (
        " FAIL  |browser (chromium)| src/a/A.test.tsx > it > waits\n"
        "Error: Test timed out in 5000ms.\n"
        "      Tests  1 failed (1)\n"
    )
    run = Runner({"web-test": [(1, timed_out)]})
    seen: list[tuple[str, ...]] = []

    def recording(check: verify.Check) -> tuple[int, str]:
        seen.append(check.argv)
        return run(check)

    monkeypatch.chdir(clone)
    verify.main(["--fast"], run=recording, leak=lambda root, tree: (False, []))
    capsys.readouterr()
    rerun = [argv for argv in seen if argv[-1] == "--maxWorkers=1"]
    assert rerun == [("npm", "--prefix", "web", "test", "--", "src/a/A.test.tsx", "--maxWorkers=1")]
    checks = {c["name"]: c for c in record_of(clone, tree)["checks"]}
    assert checks["web-test"]["exit_code"] == 0
