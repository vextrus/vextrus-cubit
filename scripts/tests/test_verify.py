"""verify's path map and flake reading, beside the acceptance tests."""

from pathlib import Path

from scripts.verify import flakes_in, plan

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
