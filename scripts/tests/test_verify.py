"""verify's path map and flake reading, beside the acceptance tests."""

from pathlib import Path

import pytest

from scripts.verify import flakes_in, plan, pytest_workers

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
    monkeypatch.setattr(module, "_have", lambda tool: True)

    def run(check: module.Check) -> tuple[int, str]:
        failing = check.name == "plugin-validate" and check.argv[-1].endswith("/a")
        return (1 if failing else 0), "out\n"

    assert module.main([], run=run, leak=lambda root, tree: (False, [])) == 1
    record = json.loads(next((tmp_path / ".git" / "vextrus").glob("verify-*.json")).read_text())
    assert record["ok"] is False
    validates = [c for c in record["checks"] if c["name"] == "plugin-validate"]
    assert sorted(c["exit_code"] for c in validates) == [0, 1]
    assert len({c["output_file"] for c in record["checks"]}) == len(record["checks"])
