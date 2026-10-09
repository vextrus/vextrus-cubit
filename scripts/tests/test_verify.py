"""verify's path map and flake reading, beside the acceptance tests."""

import sys
from pathlib import Path

import pytest

from scripts.verify import Check, flakes_in, plan, pytest_workers, run_command

ENTRIES = [("scripts/tests/test_x.py :: test_a", "scripts/tests/test_x.py", "test_a")]


def test_shared_python_configuration_runs_the_whole_suite() -> None:
    [check] = [check for check in plan(["conftest.py"]) if check.name == "pytest"]
    assert check.argv[-1] == "tools.lint.acceptance_pytest"


def test_a_ci_workflow_change_runs_the_workflow_lint() -> None:
    assert [check.name for check in plan([".github/workflows/ci.yml"])] == ["workflows"]


def test_a_file_directly_under_tools_mod_is_not_a_plugin() -> None:
    assert plan(["tools/mod/README.md"], have=lambda tool: True) == []


def test_flakes_need_every_failure_listed_and_at_least_one_failure() -> None:
    listed = "FAILED scripts/tests/test_x.py::test_a - assert 0\n"
    assert flakes_in(listed, ENTRIES) == [ENTRIES[0][0]]
    assert flakes_in(listed + "ERROR scripts/tests/test_y.py::test_b\n", ENTRIES) is None
    assert flakes_in("error: mypy found 1 error\n", ENTRIES) is None
    assert flakes_in(listed, []) is None


def test_the_api_types_schema_is_the_exports_absolute_output(tmp_path: Path) -> None:
    """`api:types` runs from `web/`, so a relative schema path would point under `web/` (review F3)."""
    checks = {check.name: check for check in plan(["web/src/a.tsx"], root=tmp_path)}
    export = checks["openapi-export"].argv
    schema = checks["api-types"].env["OPENAPI_SCHEMA"]
    assert Path(schema).is_absolute()
    assert schema == str(tmp_path.resolve() / ".private/work/verify/openapi.json")
    assert export[export.index("--output") + 1] == schema
    assert export[0] != "sh"


def test_workers_are_checked_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", "auto")
    with pytest.raises(SystemExit):
        pytest_workers()
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", "")
    assert pytest_workers() == 6


def test_two_checks_sharing_a_name_each_keep_their_own_result(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Two changed plugins plan `plugin-validate` twice; the first's failure must not be replaced by
    the second's pass (the record is the READY push gate)."""
    import json
    import shutil
    import subprocess

    from scripts import verify as module

    def sh(*args: str) -> None:
        subprocess.run(["git", "-C", str(tmp_path), *args], capture_output=True, check=True)

    sh("init", "-q", "-b", "main")
    sh("config", "user.email", "t@example.invalid")
    sh("config", "user.name", "t")
    sh("config", "commit.gpgsign", "false")
    (tmp_path / "README.md").write_text("x\n")
    sh("add", "README.md")
    sh("commit", "-q", "-m", "init")
    sh("update-ref", "refs/remotes/origin/main", "HEAD")
    for plugin in ("a", "b"):
        (tmp_path / "tools" / "mod" / plugin / "x").mkdir(parents=True)
        (tmp_path / "tools" / "mod" / plugin / "x" / "f.json").write_text("{}\n")
        sh("add", f"tools/mod/{plugin}")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(shutil, "which", lambda tool: "/bin/true")

    def run(check: module.Check) -> tuple[int, str]:
        failing = check.name == "plugin-validate" and check.argv[-1].endswith("/a")
        return (1 if failing else 0), "out\n"

    assert module.main([], run=run, leak=lambda root, tree: (False, [])) == 1
    record = json.loads(next((tmp_path / ".git" / "vextrus").glob("verify-*.json")).read_text())
    assert record["ok"] is False
    validates = [c for c in record["checks"] if c["name"] == "plugin-validate"]
    assert sorted(c["exit_code"] for c in validates) == [0, 1]
    assert len({c["output_file"] for c in record["checks"]}) == len(record["checks"])


@pytest.mark.parametrize("force", ["FORCE_COLOR", "PY_COLORS", "CLICOLOR_FORCE", "MYPY_FORCE_COLOR"])
def test_a_check_never_inherits_a_forced_colour(monkeypatch: pytest.MonkeyPatch, force: str) -> None:
    """Issue #585: the owner's shell forces colour; checks write to files, and tests that read a
    child's output (node --test's counts, the acceptance lint's pytest) fail on its escapes."""
    monkeypatch.setenv(force, "1")
    probe = f"import os; print(os.environ.get({force!r}, 'unset'))"

    code, output = run_command(Check("probe", (sys.executable, "-c", probe)))

    assert (code, output.strip()) == (0, "unset")


def _toolchain(
    path: str, tmp_path: Path, *, pinned: bool = True
) -> tuple[tuple[str, ...] | None, list[str]]:
    from scripts.verify import EZDXF_PINNED, plan_with_notes

    checks, notes = plan_with_notes(
        [path], have=lambda tool: pinned or tool != EZDXF_PINNED, root=tmp_path
    )
    return next((c.argv for c in checks if c.name == "pytest-toolchain"), None), notes


def test_the_toolchain_run_leaves_out_the_network_bound_build_test_unless_changed(
    tmp_path: Path,
) -> None:
    ignored = "engine/read/acadsharp/tests/test_build.py"
    assert ignored in (_toolchain("engine/read/dwg.py", tmp_path)[0] or ())
    assert ignored not in (_toolchain(ignored, tmp_path)[0] or ())


@pytest.mark.parametrize(
    "path", ["tools/acadsharp-dump/Program.cs", "toolchain/ezdxf.lock", "uv.lock", "pyproject.toml"]
)
def test_every_engine_path_of_the_list_plans_the_toolchain_run(path: str, tmp_path: Path) -> None:
    argv = _toolchain(path, tmp_path)[0]
    assert argv is not None


def test_a_module_change_is_bounded_to_its_folder_with_four_workers(tmp_path: Path) -> None:
    argv = _toolchain("engine/render/x.py", tmp_path)[0] or ()
    assert argv[argv.index("-n") + 1] == "4"
    assert "engine/render" in argv
    assert "engine/check" not in argv


def test_a_deleted_or_unmarked_module_still_selects_a_test_so_pytest_never_exits_5(
    tmp_path: Path,
) -> None:
    from scripts.verify import ANCHOR

    for path in ("engine/gone/x.py", "engine/geometry/x.py"):
        argv = _toolchain(path, tmp_path)[0] or ()
        assert ANCHOR in argv
        assert "engine/gone" not in argv


def test_the_run_does_not_sync(tmp_path: Path) -> None:
    assert "--no-sync" in (_toolchain("engine/read/dwg.py", tmp_path)[0] or ())


def test_without_the_locked_compiled_wheel_no_run_is_planned_and_a_note_names_the_wheel(
    tmp_path: Path,
) -> None:
    argv, notes = _toolchain("engine/read/dwg.py", tmp_path, pinned=False)
    assert argv is None
    assert any("ezdxf" in n and "toolchain" in n and "uv pip install" in n for n in notes), notes
